-- Harden SECURITY DEFINER post-view RPCs against search_path object shadowing.
-- Keep the public RPC signatures and authenticated-only execution behavior.
create or replace function public.record_post_view(p_post_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  inserted_count integer;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.posts p
    where p.id = p_post_id
  ) then
    return false;
  end if;

  insert into public.post_views(post_id, user_id)
  values (p_post_id, v_user_id)
  on conflict (post_id, user_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$function$;

create or replace function public.get_post_view_counts(post_ids bigint[])
returns table(post_id bigint, view_count bigint)
language sql
stable
security definer
set search_path = ''
as $function$
  select v.post_id, pg_catalog.count(*)::bigint
  from public.post_views v
  where v.post_id = any(post_ids)
  group by v.post_id;
$function$;

revoke all on function public.record_post_view(bigint) from public, anon;
grant execute on function public.record_post_view(bigint) to authenticated;
revoke all on function public.get_post_view_counts(bigint[]) from public, anon;
grant execute on function public.get_post_view_counts(bigint[]) to authenticated;
