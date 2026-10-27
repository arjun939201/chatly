import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("post-linked tables use the same bigint key type as posts.id", async () => {
  const [comments, views, reports] = await Promise.all([
    read("../supabase/migrations/202610250001_create_post_comments.sql"),
    read("../supabase/migrations/202610260002_create_post_views.sql"),
    read("../supabase/migrations/202610270001_create_post_reports.sql")
  ]);
  for (const [name, sql] of [["comments", comments], ["views", views], ["reports", reports]]) {
    assert.match(sql, /post_id bigint not null references public\.posts\(id\)/, name + " must reference bigint posts.id");
    assert.match(sql, /enable row level security/i, name + " must enable RLS");
  }
});

test("direct-message updates are restricted and read receipts use a recipient-scoped RPC", async () => {
  const sql = await read("../supabase/migrations/202610270002_secure_message_permissions.sql");
  assert.match(sql, /REVOKE UPDATE ON TABLE public\.messages FROM authenticated/i);
  assert.match(sql, /GRANT UPDATE \(body\) ON TABLE public\.messages TO authenticated/i);
  assert.match(sql, /recipient_id = auth\.uid\(\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.mark_message_read\(bigint\) FROM PUBLIC, anon/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.mark_message_read\(bigint\) TO authenticated/i);
});

test("CI executes regression tests and the production build", async () => {
  const ci = await read("../.github/workflows/ci.yml");
  assert.match(ci, /run: npm test/);
  assert.match(ci, /run: npm run build/);
  assert.match(ci, /permissions:\s*contents: read/);
});

test("example frontend environment contains placeholders rather than credentials", async () => {
  const env = await read("../.env.example");
  assert.match(env, /your-project\.supabase\.co/);
  assert.match(env, /your-supabase-publishable-or-anon-key/);
  assert.match(env, /your_youtube_api_key/);
  assert.doesNotMatch(env, /service_role|sb_secret_[A-Za-z0-9]+/i);
});

test("deployment documentation explains migration order and live RLS limits", async () => {
  const readme = await read("../README.md");
  assert.match(readme, /ascending filename order/);
  assert.match(readme, /does not execute SQL migrations or verify live Row Level Security policies/);
  assert.match(readme, /Never expose a service-role key in a `VITE_/);
});


test("app shell recovers from render failures without exposing internals", async () => {
  const [main, boundary] = await Promise.all([
    read("../src/main.jsx"),
    read("../src/components/AppErrorBoundary.jsx")
  ]);
  assert.ok(main.includes("<AppErrorBoundary>"));
  assert.ok(main.includes("<App />"));
  assert.ok(main.includes("</AppErrorBoundary>"));
  assert.ok(boundary.includes("getDerivedStateFromError"));
  assert.ok(boundary.includes("Something went wrong"));
  assert.ok(boundary.includes("Try again"));
  assert.ok(boundary.includes("window.location.reload()"));
  assert.ok(!boundary.includes("this.state.error.message"));
});

test("group membership changes cannot bypass the role-checked RPC", async () => {
  const [base, management, hardening] = await Promise.all([
    read("../supabase/migrations/202610260001_group_chats.sql"),
    read("../supabase/migrations/202610260003_group_membership_management.sql"),
    read("../supabase/migrations/202610270003_secure_group_membership.sql")
  ]);
  assert.ok(base.includes("Admins manage membership and users may leave"));
  assert.ok(management.includes("The owner must transfer ownership before leaving"));
  assert.ok(management.includes("v_target_role = 'owner' or (v_actor_role = 'admin' and v_target_role = 'admin')"));
  assert.ok(hardening.includes("REVOKE INSERT, UPDATE, DELETE ON TABLE public.group_conversation_members FROM PUBLIC, anon, authenticated"));
  assert.ok(hardening.includes('DROP POLICY IF EXISTS "Group admins can add members"'));
  assert.ok(hardening.includes('DROP POLICY IF EXISTS "Admins manage membership and users may leave"'));
  assert.ok(hardening.includes("REVOKE INSERT ON TABLE public.group_conversations FROM PUBLIC, anon, authenticated"));
  assert.ok(hardening.includes('DROP POLICY IF EXISTS "Authenticated users can create groups"'));
});


test("notification date formatting handles malformed timestamps safely", async () => {
  const notifications = await read("../src/components/NotificationsDestination.jsx");
  assert.ok(notifications.includes("function relativeTime(value)"));
  assert.ok(notifications.includes("function dateLabel(value)"));
  assert.ok(notifications.includes('if (!value || Number.isNaN(date.getTime())) return "Earlier";'));
  assert.ok(notifications.includes('if (Number.isNaN(date.getTime())) return "Earlier";'));
});
