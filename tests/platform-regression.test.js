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
  assert.match(main, /<AppErrorBoundary>[\\s\\S]*?<App \/>[\\s\\S]*?<\\/AppErrorBoundary>/);
  assert.match(boundary, /getDerivedStateFromError/);
  assert.match(boundary, /Something went wrong/);
  assert.match(boundary, /Try again/);
  assert.match(boundary, /window\\.location\\.reload\(\)/);
  assert.doesNotMatch(boundary, /this\\.state\\.error\\.message/);
});
