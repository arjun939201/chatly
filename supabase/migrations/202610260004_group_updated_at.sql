-- Keep group-list ordering accurate whenever metadata changes.
create or replace function public.set_group_conversation_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists group_conversations_updated_at on public.group_conversations;
create trigger group_conversations_updated_at
before update on public.group_conversations
for each row execute function public.set_group_conversation_updated_at();

create index if not exists group_messages_sender_time_idx
  on public.group_messages(sender_id, created_at desc);
