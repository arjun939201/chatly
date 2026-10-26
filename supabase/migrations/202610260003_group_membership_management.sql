-- Centralize membership changes and enforce owner/admin boundaries.
create or replace function public.manage_group_member(
  p_conversation_id uuid,
  p_action text,
  p_member_id uuid default null,
  p_role text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_target uuid := coalesce(p_member_id, auth.uid());
  v_actor_role text;
  v_target_role text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select role into v_actor_role
  from public.group_conversation_members
  where conversation_id = p_conversation_id and user_id = v_actor;

  if v_actor_role is null then
    raise exception 'You are not a member of this group' using errcode = '42501';
  end if;

  select role into v_target_role
  from public.group_conversation_members
  where conversation_id = p_conversation_id and user_id = v_target;

  if p_action = 'add' then
    if v_actor_role not in ('owner', 'admin') then
      raise exception 'Only group admins can add members' using errcode = '42501';
    end if;
    if v_target is null or not exists (select 1 from public.profiles p where p.id = v_target) then
      raise exception 'Selected member is unavailable' using errcode = '22023';
    end if;
    insert into public.group_conversation_members(conversation_id, user_id, role)
    values (p_conversation_id, v_target, 'member')
    on conflict (conversation_id, user_id) do nothing;

  elsif p_action = 'remove' then
    if v_target_role is null then
      raise exception 'This person is not a group member' using errcode = '22023';
    end if;
    if v_target = v_actor then
      if v_actor_role = 'owner' then
        raise exception 'The owner must transfer ownership before leaving' using errcode = '42501';
      end if;
    elsif v_actor_role not in ('owner', 'admin') then
      raise exception 'Only group admins can remove other members' using errcode = '42501';
    elsif v_target_role = 'owner' or (v_actor_role = 'admin' and v_target_role = 'admin') then
      raise exception 'You cannot remove this group administrator' using errcode = '42501';
    end if;
    delete from public.group_conversation_members
    where conversation_id = p_conversation_id and user_id = v_target;

  elsif p_action = 'role' then
    if v_actor_role <> 'owner' then
      raise exception 'Only the group owner can change member roles' using errcode = '42501';
    end if;
    if p_role is null or p_role not in ('admin', 'member') or v_target_role is null or v_target = v_actor then
      raise exception 'Invalid role change' using errcode = '22023';
    end if;
    update public.group_conversation_members
    set role = p_role
    where conversation_id = p_conversation_id and user_id = v_target;

  else
    raise exception 'Unsupported membership action' using errcode = '22023';
  end if;
end;
$function$;

revoke all on function public.manage_group_member(uuid, text, uuid, text) from public, anon;
grant execute on function public.manage_group_member(uuid, text, uuid, text) to authenticated;
