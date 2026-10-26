-- Fix group creation RLS: automatically add the creator as owner before INSERT ... RETURNING
-- evaluates the member-only SELECT policy. Keep the function narrowly scoped and secure.
create or replace function public.add_group_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.group_conversation_members (conversation_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$function$;

revoke all on function public.add_group_creator_as_owner() from public, anon, authenticated;

drop trigger if exists group_conversations_add_creator on public.group_conversations;
create trigger group_conversations_add_creator
  after insert on public.group_conversations
  for each row
  execute function public.add_group_creator_as_owner();

-- Ensure only the creator can create the row as themselves.
drop policy if exists "Authenticated users can create groups" on public.group_conversations;
create policy "Authenticated users can create groups"
  on public.group_conversations
  for insert
  to authenticated
  with check (created_by = (select auth.uid()));

-- Owner membership is inserted by the trusted trigger, not directly by the browser.
drop policy if exists "Users can join groups they create" on public.group_conversation_members;
