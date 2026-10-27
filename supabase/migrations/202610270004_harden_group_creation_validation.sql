-- Harden group creation validation without changing the existing RPC contract.
-- The creator must invite at least one other existing profile; self-only arrays are invalid.
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
  v_creator uuid := auth.uid();
  v_group_id uuid;
  v_invitee uuid;
begin
  if v_creator is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_name is null or char_length(trim(p_name)) not between 2 and 80 then
    raise exception 'Group name must be between 2 and 80 characters' using errcode = '22023';
  end if;

  if p_description is not null and char_length(p_description) > 500 then
    raise exception 'Group description cannot exceed 500 characters' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from unnest(coalesce(p_member_ids, '{}'::uuid[])) as requested(user_id)
    where requested.user_id is not null
      and requested.user_id <> v_creator
  ) then
    raise exception 'Select at least one other member to create a group' using errcode = '22023';
  end if;

  -- Validate all distinct invitees before creating any rows; the function is atomic.
  for v_invitee in
    select distinct requested.user_id
    from unnest(coalesce(p_member_ids, '{}'::uuid[])) as requested(user_id)
    where requested.user_id is not null
      and requested.user_id <> v_creator
  loop
    if not exists (select 1 from public.profiles p where p.id = v_invitee) then
      raise exception 'One or more selected members are unavailable' using errcode = '22023';
    end if;
  end loop;

  insert into public.group_conversations (name, description, created_by)
  values (trim(p_name), coalesce(p_description, ''), v_creator)
  returning id into v_group_id;

  -- The existing AFTER INSERT trigger adds the creator as owner.
  insert into public.group_conversation_members (conversation_id, user_id, role)
  select v_group_id, invitees.user_id, 'member'
  from (
    select distinct requested.user_id
    from unnest(coalesce(p_member_ids, '{}'::uuid[])) as requested(user_id)
    where requested.user_id is not null
      and requested.user_id <> v_creator
  ) invitees
  on conflict (conversation_id, user_id) do nothing;

  return v_group_id;
end;
$function$;

revoke all on function public.create_group_conversation(text, text, uuid[]) from public, anon;
grant execute on function public.create_group_conversation(text, text, uuid[]) to authenticated;
