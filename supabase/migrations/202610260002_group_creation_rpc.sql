-- Atomic and authenticated group creation. The caller can add only existing profile IDs.
create or replace function public.create_group_conversation(
  p_name text,
  p_description text default '',
  p_member_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_group_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_description text := trim(coalesce(p_description, ''));
  v_member_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Group name must contain between 2 and 80 characters' using errcode = '22023';
  end if;
  if char_length(v_description) > 500 then
    raise exception 'Group description must be 500 characters or fewer' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_member_ids), 0) = 0 then
    raise exception 'Select at least one member' using errcode = '22023';
  end if;

  -- Confirm each requested member has a profile. Duplicate IDs are harmless and ignored.
  foreach v_member_id in array p_member_ids loop
    if v_member_id is null or v_member_id = v_user_id then
      continue;
    end if;
    if not exists (select 1 from public.profiles p where p.id = v_member_id) then
      raise exception 'One or more selected members are unavailable' using errcode = '22023';
    end if;
  end loop;

  if not exists (
    select 1 from unnest(p_member_ids) as requested(user_id)
    where requested.user_id is not null and requested.user_id <> v_user_id
  ) then
    raise exception 'Select at least one other member' using errcode = '22023';
  end if;

  insert into public.group_conversations(name, description, created_by)
  values (v_name, v_description, v_user_id)
  returning id into v_group_id;

  insert into public.group_conversation_members(conversation_id, user_id, role)
  values (v_group_id, v_user_id, 'owner');

  insert into public.group_conversation_members(conversation_id, user_id, role)
  select v_group_id, requested.user_id, 'member'
  from (select distinct user_id from unnest(p_member_ids) as ids(user_id)) requested
  where requested.user_id is not null and requested.user_id <> v_user_id
  on conflict (conversation_id, user_id) do nothing;

  return v_group_id;
end;
$function$;

revoke all on function public.create_group_conversation(text, text, uuid[]) from public, anon;
grant execute on function public.create_group_conversation(text, text, uuid[]) to authenticated;
