-- Create groups through a trusted, authenticated RPC so the group row, creator owner
-- membership (trigger), and invited members are written as one transaction.
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

  if coalesce(cardinality(p_member_ids), 0) = 0 then
    raise exception 'Select at least one person to create a group' using errcode = '22023';
  end if;

  insert into public.group_conversations (name, description, created_by)
  values (trim(p_name), coalesce(p_description, ''), v_creator)
  returning id into v_group_id;

  -- The AFTER INSERT trigger adds the creator as owner. Insert invitees only.
  insert into public.group_conversation_members (conversation_id, user_id, role)
  select v_group_id, invitee_id, 'member'
  from (
    select distinct unnest(p_member_ids) as invitee_id
  ) invitees
  where invitee_id is not null and invitee_id <> v_creator;

  return v_group_id;
end;
$function$;

revoke all on function public.create_group_conversation(text, text, uuid[]) from public, anon;
grant execute on function public.create_group_conversation(text, text, uuid[]) to authenticated;
