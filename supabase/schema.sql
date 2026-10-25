-- Chatly profile and messaging schema (safe to rerun)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null default 'Chatly user',
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Migrate existing profile table: username is now optional; avatar support added.
alter table public.profiles alter column username drop not null;
alter table public.profiles alter column display_name set default 'Chatly user';
alter table public.profiles add column if not exists avatar_url text;

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists messages_pair_time_idx on public.messages (sender_id, recipient_id, created_at);

alter table public.profiles enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles" on public.profiles
  for select to authenticated using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Users can read messages they participate in" on public.messages;
create policy "Users can read messages they participate in" on public.messages
  for select to authenticated using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Users can send messages as themselves" on public.messages;
create policy "Users can send messages as themselves" on public.messages
  for insert to authenticated with check (auth.uid() = sender_id and sender_id <> recipient_id);

-- Create/refresh profile on email or OAuth account creation. Username is optional.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  chosen_name text;
  chosen_username text;
begin
  chosen_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Chatly user'
  );
  chosen_username := nullif(lower(coalesce(new.raw_user_meta_data ->> 'username', '')), '');
  insert into public.profiles (id, username, display_name, avatar_url)
  values (new.id, chosen_username, chosen_name, nullif(new.raw_user_meta_data ->> 'avatar_url', ''))
  on conflict (id) do update set
    display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill profiles for already-registered users without a profile.
insert into public.profiles (id, display_name)
select u.id, coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''),
  nullif(u.raw_user_meta_data ->> 'full_name', ''),
  nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'Chatly user')
from auth.users u
on conflict (id) do nothing;

-- Private-by-default user-owned avatar storage bucket, public read for avatar rendering.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "Avatar images are publicly viewable" on storage.objects;
create policy "Avatar images are publicly viewable" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "Users upload their own avatars" on storage.objects;
create policy "Users upload their own avatars" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update their own avatars" on storage.objects;
create policy "Users update their own avatars" on storage.objects
  for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete their own avatars" on storage.objects;
create policy "Users delete their own avatars" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Add messages to realtime publication only if needed.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end
$$;


-- Community feed: posts and reactions.
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists posts_created_at_idx on public.posts (created_at desc);

create table if not exists public.post_likes (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.posts enable row level security;
alter table public.post_likes enable row level security;

drop policy if exists "Authenticated users can read posts" on public.posts;
create policy "Authenticated users can read posts" on public.posts
  for select to authenticated using (true);
drop policy if exists "Users can create their own posts" on public.posts;
create policy "Users can create their own posts" on public.posts
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own posts" on public.posts;
create policy "Users can delete their own posts" on public.posts
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Authenticated users can read post likes" on public.post_likes;
create policy "Authenticated users can read post likes" on public.post_likes
  for select to authenticated using (true);
drop policy if exists "Users can like as themselves" on public.post_likes;
create policy "Users can like as themselves" on public.post_likes
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can remove their own likes" on public.post_likes;
create policy "Users can remove their own likes" on public.post_likes
  for delete to authenticated using (auth.uid() = user_id);


-- Post comments.
create table if not exists public.post_comments (
 id bigint generated always as identity primary key,
 post_id bigint not null references public.posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index if not exists post_comments_post_time_idx on public.post_comments (post_id, created_at);
alter table public.post_comments enable row level security;
drop policy if exists "Authenticated users can read post comments" on public.post_comments;
create policy "Authenticated users can read post comments" on public.post_comments for select to authenticated using (true);
drop policy if exists "Users can create their own post comments" on public.post_comments;
create policy "Users can create their own post comments" on public.post_comments for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own post comments" on public.post_comments;
create policy "Users can delete their own post comments" on public.post_comments for delete to authenticated using (auth.uid() = user_id);


-- Follow relationships used by profile Follow/Following controls.
create table if not exists public.user_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint user_follows_no_self_follow check (follower_id <> following_id)
);
create index if not exists user_follows_following_idx on public.user_follows (following_id, follower_id);
alter table public.user_follows enable row level security;

drop policy if exists "Authenticated users can read follow relationships" on public.user_follows;
create policy "Authenticated users can read follow relationships" on public.user_follows
  for select to authenticated using (true);
drop policy if exists "Users can follow as themselves" on public.user_follows;
create policy "Users can follow as themselves" on public.user_follows
  for insert to authenticated with check (auth.uid() = follower_id and follower_id <> following_id);
drop policy if exists "Users can unfollow as themselves" on public.user_follows;
create policy "Users can unfollow as themselves" on public.user_follows
  for delete to authenticated using (auth.uid() = follower_id);

-- Profile bios are used by the profile editor and public profile view.
alter table public.profiles add column if not exists bio text not null default '';
