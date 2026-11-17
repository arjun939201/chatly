# Chatly Control Center — one-time owner setup

The Control Center is protected by PostgreSQL RLS and server-side permission checks. Do not grant roles by editing frontend state or user-editable Auth metadata.

## 1. Apply the migration

Apply \`supabase/migrations/202611170001_chatly_control_center.sql\` to the Chatly Supabase project using the SQL editor or your normal migration workflow.

## 2. Bootstrap the owner

Sign in to Chatly with the account that should own the platform. In Supabase SQL Editor, run the following after replacing the email with that account's exact sign-in email:

\`\`\`sql
insert into public.admin_roles (user_id, role, permissions, is_active)
select id, 'owner', array['*']::text[], true
from auth.users
where lower(email) = lower('YOUR_OWNER_EMAIL')
on conflict (user_id) do update
set role = 'owner', permissions = array['*']::text[], is_active = true, updated_at = now();
\`\`\`

Confirm exactly one row was affected. The owner account is not inferred from a GitHub identity or public profile.

## 3. Default permission sets for staff

Use \`public.admin_assign_role(user_id, role, permissions)\` while signed in as the owner. Suggested permissions:

- Super admin: \`users.read, users.restrict, posts.read, posts.delete, reports.read, roles.read, audit.read\`
- Admin: \`users.read, users.restrict, posts.read, posts.delete, reports.read\`
- Moderator: \`posts.read, posts.delete, reports.read\`
- Support: \`users.read\`

The owner always has all permissions. The database prevents non-owners from assigning, changing, or removing an owner role. Staff cannot modify their own role.

## Security notes

- A suspended or banned account is blocked from creating or changing posts, comments, likes, messages, and follows by restrictive RLS policies. This is an in-app restriction, not a Supabase Auth ban; sign-in remains possible.
- Post/comment deletion is permanent and should be used only after review.
- Administrative reads and changes are permission-scoped. Role assignments, removals, and user restrictions are recorded in the audit log.
- The app does not expose the Supabase service-role key.
