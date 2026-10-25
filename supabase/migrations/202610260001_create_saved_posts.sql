create table if not exists public.saved_posts (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id bigint not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists saved_posts_user_created_idx
  on public.saved_posts (user_id, created_at desc);

alter table public.saved_posts enable row level security;

drop policy if exists "Users can view their saved posts" on public.saved_posts;
create policy "Users can view their saved posts"
  on public.saved_posts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can save posts" on public.saved_posts;
create policy "Users can save posts"
  on public.saved_posts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can unsave their posts" on public.saved_posts;
create policy "Users can unsave their posts"
  on public.saved_posts for delete
  to authenticated
  using (auth.uid() = user_id);
