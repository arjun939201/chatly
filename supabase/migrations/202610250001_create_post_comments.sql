-- Comments table expected by src/components/Feed.jsx
-- public.posts.id is bigint, so post_comments.post_id must also be bigint.
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_id_created_at_idx
  on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;

drop policy if exists "Authenticated users can read comments" on public.post_comments;
create policy "Authenticated users can read comments"
  on public.post_comments for select
  to authenticated
  using (true);

drop policy if exists "Users can add their own comments" on public.post_comments;
create policy "Users can add their own comments"
  on public.post_comments for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own comments" on public.post_comments;
create policy "Users can delete their own comments"
  on public.post_comments for delete
  to authenticated
  using (auth.uid() = user_id);

-- Refresh PostgREST's schema cache after the table is created.
notify pgrst, 'reload schema';
