-- Unique authenticated views: one viewer per post for the lifetime of that post.
create table if not exists public.post_views (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_views_post_id_idx on public.post_views(post_id);

alter table public.post_views enable row level security;

drop policy if exists "Users can record their own post views" on public.post_views;
create policy "Users can record their own post views"
  on public.post_views for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.user_id <> auth.uid()
    )
  );

drop policy if exists "Users can read their own post views" on public.post_views;
create policy "Users can read their own post views"
  on public.post_views for select to authenticated
  using (user_id = auth.uid());

create or replace function public.record_post_view(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.posts p
    where p.id = p_post_id and p.user_id <> auth.uid()
  ) then
    return false;
  end if;

  insert into public.post_views(post_id, user_id)
  values (p_post_id, auth.uid())
  on conflict (post_id, user_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;

create or replace function public.get_post_view_counts(post_ids uuid[])
returns table(post_id uuid, view_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select v.post_id, count(*)::bigint
  from public.post_views v
  where v.post_id = any(post_ids)
  group by v.post_id;
$$;

revoke all on function public.record_post_view(uuid) from public;
grant execute on function public.record_post_view(uuid) to authenticated;
revoke all on function public.get_post_view_counts(uuid[]) from public;
grant execute on function public.get_post_view_counts(uuid[]) to authenticated;
