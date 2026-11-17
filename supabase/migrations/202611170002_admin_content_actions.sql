-- Audited content-removal RPCs used by the Control Center.
create or replace function public.admin_delete_post(target_post_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not public.admin_has_permission('posts.delete') then
    raise exception 'Not authorized to delete posts' using errcode = '42501';
  end if;
  delete from public.posts where id = target_post_id;
  if not found then raise exception 'Post not found'; end if;
  insert into public.admin_audit_logs(actor_id, action, target_type, target_id)
  values ((select auth.uid()), 'post.deleted', 'post', target_post_id::text);
end;
$function$;
revoke all on function public.admin_delete_post(bigint) from public, anon;
grant execute on function public.admin_delete_post(bigint) to authenticated;

create or replace function public.admin_delete_comment(target_comment_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not public.admin_has_permission('posts.delete') then
    raise exception 'Not authorized to delete comments' using errcode = '42501';
  end if;
  delete from public.post_comments where id = target_comment_id;
  if not found then raise exception 'Comment not found'; end if;
  insert into public.admin_audit_logs(actor_id, action, target_type, target_id)
  values ((select auth.uid()), 'comment.deleted', 'comment', target_comment_id::text);
end;
$function$;
revoke all on function public.admin_delete_comment(bigint) from public, anon;
grant execute on function public.admin_delete_comment(bigint) to authenticated;
