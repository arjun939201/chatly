-- Run this in Supabase SQL Editor.
-- Profile rows are created automatically when a new Auth user signs up.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists messages_pair_time_idx
  on public.messages (sender_id, recipient_id, created_at);

alter table public.profiles enable row level security;
alter table public.messages enable row level security;

-- Authenticated users can discover profile names/usernames in this starter.
create policy "Authenticated users can read profiles"
  on public.profiles for select to authenticated using (true);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read messages they participate in"
  on public.messages for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users can send messages as themselves"
  on public.messages for insert to authenticated
  with check (auth.uid() = sender_id and sender_id <> recipient_id);

-- Create a profile after sign-up. Username is required from sign-up metadata.
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
  chosen_username := lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
  chosen_display_name := coalesce(new.raw_user_meta_data ->> 'display_name', chosen_username);
  insert into public.profiles (id, username, display_name)
  values (new.id, chosen_username, chosen_display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable database changes for live chat (if not already included).
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then
  null;
end $$;
