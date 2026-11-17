-- Chatly Control Center: role-based administration, moderation restrictions and audit trail.
-- Owner bootstrap is intentionally explicit; see docs/ADMIN_SETUP.md.

create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'super_admin', 'admin', 'moderator', 'support')),
  permissions text[] not null default '{}',
  is_active boolean not null default true,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_user_restrictions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('suspended', 'banned')),
  reason text not null default '',
  expires_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists admin_roles_role_idx on public.admin_roles(role, is_active);

alter table public.admin_roles enable row level security;
alter table public.admin_user_restrictions enable row level security;
alter table public.admin_audit_logs enable row level security;

create or replace function public.admin_has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.admin_roles r
    where r.user_id = (select auth.uid())
      and r.is_active
      and (r.role = 'owner' or '*' = any(r.permissions) or required_permission = any(r.permissions))
  );
$function$;
revoke all on function public.admin_has_permission(text) from public, anon;
grant execute on function public.admin_has_permission(text) to authenticated;

create or replace function public.admin_account_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select not exists (
    select 1 from public.admin_user_restrictions r
    where r.user_id = (select auth.uid())
      and (r.status = 'banned' or (r.status = 'suspended' and (r.expires_at is null or r.expires_at > now())))
  );
$function$;
revoke all on function public.admin_account_is_active() from public, anon;
grant execute on function public.admin_account_is_active() to authenticated;

drop policy if exists "Users can read their own admin role or authorized roles" on public.admin_roles;
create policy "Users can read their own admin role or authorized roles"
  on public.admin_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.admin_has_permission('roles.read'));

drop policy if exists "Authorized staff can read restrictions" on public.admin_user_restrictions;
create policy "Authorized staff can read restrictions"
  on public.admin_user_restrictions for select to authenticated
  using (public.admin_has_permission('users.read'));

drop policy if exists "Authorized staff can read audit logs" on public.admin_audit_logs;
create policy "Authorized staff can read audit logs"
  on public.admin_audit_logs for select to authenticated
  using (public.admin_has_permission('audit.read'));

-- Admins may inspect and remove content through the normal authenticated Data API.
drop policy if exists "Authorized admins can delete posts" on public.posts;
create policy "Authorized admins can delete posts"
  on public.posts for delete to authenticated
  using (public.admin_has_permission('posts.delete'));

drop policy if exists "Authorized admins can delete comments" on public.post_comments;
create policy "Authorized admins can delete comments"
  on public.post_comments for delete to authenticated
  using (public.admin_has_permission('posts.delete'));

drop policy if exists "Authorized staff can review post reports" on public.post_reports;
create policy "Authorized staff can review post reports"
  on public.post_reports for select to authenticated
  using (public.admin_has_permission('reports.read'));

-- Restrictions are enforced in PostgreSQL, not only in the Control Center UI.
do $block$
declare
  table_name text;
begin
  foreach table_name in array array['posts','post_comments','post_likes','messages','user_follows'] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop policy if exists %I on public.%I', 'Chatly active account restriction', table_name);
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated using (public.admin_account_is_active()) with check (public.admin_account_is_active())',
        'Chatly active account restriction', table_name
      );
    end if;
  end loop;
end
$block$;

create or replace function public.admin_set_user_restriction(
  target_user_id uuid,
  new_status text,
  restriction_reason text default '',
  restriction_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_role text;
begin
  if not public.admin_has_permission('users.restrict') then
    raise exception 'Not authorized to restrict users' using errcode = '42501';
  end if;
  if target_user_id is null or target_user_id = (select auth.uid()) then
    raise exception 'You cannot restrict your own account';
  end if;
  if new_status not in ('active', 'suspended', 'banned') then
    raise exception 'Invalid account status';
  end if;
  select role into target_role from public.admin_roles where user_id = target_user_id and is_active;
  if target_role = 'owner' then
    raise exception 'The owner account is protected';
  end if;

  if new_status = 'active' then
    delete from public.admin_user_restrictions where user_id = target_user_id;
  else
    insert into public.admin_user_restrictions(user_id, status, reason, expires_at, created_by, updated_at)
    values (target_user_id, new_status, left(coalesce(restriction_reason, ''), 1000), restriction_expires_at, (select auth.uid()), now())
    on conflict (user_id) do update set
      status = excluded.status,
      reason = excluded.reason,
      expires_at = excluded.expires_at,
      created_by = excluded.created_by,
      updated_at = now();
  end if;

  insert into public.admin_audit_logs(actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'user.' || new_status, 'user', target_user_id::text,
    jsonb_build_object('reason', left(coalesce(restriction_reason, ''), 1000), 'expires_at', restriction_expires_at));
end;
$function$;
revoke all on function public.admin_set_user_restriction(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.admin_set_user_restriction(uuid, text, text, timestamptz) to authenticated;

create or replace function public.admin_assign_role(
  target_user_id uuid,
  new_role text,
  new_permissions text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_role text;
  existing_role text;
begin
  if not public.admin_has_permission('roles.manage') then
    raise exception 'Not authorized to manage staff roles' using errcode = '42501';
  end if;
  if target_user_id is null or target_user_id = (select auth.uid()) then
    raise exception 'You cannot change your own role';
  end if;
  if new_role not in ('owner', 'super_admin', 'admin', 'moderator', 'support') then
    raise exception 'Invalid role';
  end if;
  select role into actor_role from public.admin_roles where user_id = (select auth.uid()) and is_active;
  select role into existing_role from public.admin_roles where user_id = target_user_id and is_active;
  if (new_role = 'owner' or existing_role = 'owner') and actor_role <> 'owner' then
    raise exception 'Only the owner can assign or modify an owner role';
  end if;

  insert into public.admin_roles(user_id, role, permissions, is_active, assigned_by, updated_at)
  values (target_user_id, new_role, coalesce(new_permissions, '{}'), true, (select auth.uid()), now())
  on conflict (user_id) do update set
    role = excluded.role,
    permissions = excluded.permissions,
    is_active = true,
    assigned_by = excluded.assigned_by,
    updated_at = now();

  insert into public.admin_audit_logs(actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'role.assigned', 'user', target_user_id::text,
    jsonb_build_object('role', new_role, 'permissions', coalesce(new_permissions, '{}')));
end;
$function$;
revoke all on function public.admin_assign_role(uuid, text, text[]) from public, anon;
grant execute on function public.admin_assign_role(uuid, text, text[]) to authenticated;

create or replace function public.admin_remove_role(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_role text;
  target_role text;
begin
  if not public.admin_has_permission('roles.manage') then
    raise exception 'Not authorized to manage staff roles' using errcode = '42501';
  end if;
  if target_user_id is null or target_user_id = (select auth.uid()) then
    raise exception 'You cannot remove your own role';
  end if;
  select role into actor_role from public.admin_roles where user_id = (select auth.uid()) and is_active;
  select role into target_role from public.admin_roles where user_id = target_user_id;
  if target_role = 'owner' and actor_role <> 'owner' then
    raise exception 'Only the owner can remove an owner role';
  end if;
  if target_role = 'owner' then
    raise exception 'Ownership cannot be removed here';
  end if;
  delete from public.admin_roles where user_id = target_user_id;
  insert into public.admin_audit_logs(actor_id, action, target_type, target_id)
  values ((select auth.uid()), 'role.removed', 'user', target_user_id::text);
end;
$function$;
revoke all on function public.admin_remove_role(uuid) from public, anon;
grant execute on function public.admin_remove_role(uuid) to authenticated;
