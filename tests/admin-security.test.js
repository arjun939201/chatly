import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/202611170001_chatly_control_center.sql", import.meta.url), "utf8");
const setup = await readFile(new URL("../docs/ADMIN_SETUP.md", import.meta.url), "utf8");

test("admin authorization is based on a private database role record, not user metadata", () => {
  assert.match(migration, /create table if not exists public\.admin_roles/);
  assert.match(migration, /public\.admin_has_permission/);
  assert.doesNotMatch(migration, /raw_user_meta_data|user_metadata/);
});

test("admin RPCs are not executable by anon or PUBLIC", () => {
  assert.match(migration, /revoke all on function public\.admin_assign_role\(uuid, text, text\[\]\) from public, anon/i);
  assert.match(migration, /grant execute on function public\.admin_assign_role\(uuid, text, text\[\]\) to authenticated/i);
  assert.match(migration, /revoke all on function public\.admin_set_user_restriction\(uuid, text, text, timestamptz\) from public, anon/i);
});

test("non-owner staff cannot modify owner assignments or their own roles", () => {
  assert.match(migration, /Only the owner can assign or modify an owner role/);
  assert.match(migration, /You cannot change your own role/);
  assert.match(migration, /Ownership cannot be removed here/);
});

test("suspension restrictions are enforced with restrictive RLS policies", () => {
  assert.match(migration, /as restrictive for all to authenticated/i);
  assert.match(migration, /public\.admin_account_is_active\(\)/);
});

test("admin mutations create audit records", () => {
  assert.match(migration, /insert into public\.admin_audit_logs/);
  assert.match(migration, /'role\.assigned'/);
  assert.match(migration, /'user\.' \|\| new_status/);
});

test("owner bootstrap requires an explicit existing Auth account", () => {
  assert.match(setup, /YOUR_OWNER_EMAIL/);
  assert.match(setup, /from auth\.users/);
  assert.match(setup, /The owner account is not inferred/);
});
