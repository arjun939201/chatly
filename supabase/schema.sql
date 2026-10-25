-- Chatly database schema
-- Run this in Supabase SQL Editor.

-- 1. Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- 2. Messages
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

-- 3. Message index
create index if not exists messages_pair_time_idx
  on public.messages (sender_id, recipient_id, created_at);

-- 4. Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.messages enable row level security;

-- 5. Profiles policies
drop policy if exists "Authenticated users can read profiles"
  on public.profiles;

create policy "Authenticated users can read profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists "Users can update their own profile"
  on public.profiles;

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 6. Messages policies
drop policy if exists "Users can read messages they participate in"
  on public.messages;

create policy "Users can read messages they participate in"
  on public.messages
  for select
  to authenticated
  using (
    auth.uid() = sender_id
    or auth.uid() = recipient_id
  );

drop policy if exists "Users can send messages as themselves"
  on public.messages;

create policy "Users can send messages as themselves"
  on public.messages
  for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and sender_id <> recipient_id
  );

-- 7. Automatically create a profile after signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_username text;
  chosen_display_name text;
begin
  chosen_username := lower(
    coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)
    )
  );

  chosen_display_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    chosen_username
  );

  insert into public.profiles (
    id,
    username,
    display_name
  )
  values (
    new.id,
    chosen_username,
    chosen_display_name
  );

  return new;
end;
$$;

-- 8. Create signup trigger
drop trigger if exists on_auth_user_created
  on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- 9. Enable realtime for messages
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end
$$;
