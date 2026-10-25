create table if not exists public.user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint user_follows_not_self check (follower_id <> following_id)
);

create index if not exists user_follows_following_id_idx
  on public.user_follows (following_id);

alter table public.user_follows enable row level security;

drop policy if exists "Users can read follow relationships" on public.user_follows;
create policy "Users can read follow relationships"
  on public.user_follows for select to authenticated using (true);

drop policy if exists "Users can follow from their own account" on public.user_follows;
create policy "Users can follow from their own account"
  on public.user_follows for insert to authenticated
  with check (auth.uid() = follower_id);

drop policy if exists "Users can unfollow from their own account" on public.user_follows;
create policy "Users can unfollow from their own account"
  on public.user_follows for delete to authenticated
  using (auth.uid() = follower_id);

notify pgrst, 'reload schema';
