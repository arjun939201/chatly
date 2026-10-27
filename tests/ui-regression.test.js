import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("shared UI has consistent disabled, touch, and keyboard feedback", async () => {
  const css = await read("../src/professional-ui.css");
  assert.match(css, /button:disabled\s*\{[^}]*cursor:\s*not-allowed/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(css, /:focus-within\s*\{\s*outline:\s*2px solid var\(--chatly-accent\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("mobile layouts account for safe areas and avoid oversized chat gutters", async () => {
  const css = await read("../src/professional-ui.css");
  assert.match(css, /padding: 16px 10px calc\(88px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /height: calc\(100dvh - 68px - env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /@media \(max-width: 600px\)/);
});

test("post and message text can wrap instead of widening the viewport", async () => {
  const css = await read("../src/professional-ui.css");
  assert.match(css, /\.message-bubble, \.chat-message, \.post-body, \.comment-body/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /word-break:\s*break-word/);
});

test("notifications retain bounded pagination and live updates", async () => {
  const source = await read("../src/components/NotificationsDestination.jsx");
  assert.match(source, /const pageSize = 50/);
  assert.match(source, /\.range\(offset, offset \+ pageSize - 1\)/);
  assert.match(source, /postgres_changes/);
  assert.match(source, /loadNotifications\(true, true\)/);
});

test("chat screen keeps realtime subscriptions and avoids duplicate message insertion", async () => {
  const source = await read("../src/components/Chat.jsx");
  assert.match(source, /postgres_changes/);
  assert.match(source, /filter\(item => item\.id !== incoming\.id\)/);
  assert.match(source, /syncConversationList/);
});

test("CI runs production build and regression tests with a bounded runner", async () => {
  const workflow = await read("../.github/workflows/ci.yml");
  assert.match(workflow, /timeout-minutes:\s*10/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /cancel-in-progress:\s*true/);
});

test("opening notifications does not silently mark every unread item as read", async () => {
  const source = await read("../src/components/NotificationsDestination.jsx");
  assert.doesNotMatch(source, /Opening Notifications marks all currently unread activity as read/);
  assert.match(source, /onClick=\{\(\) => markRead\(item\.id\)\}/);
  assert.match(source, /onClick=\{markAllRead\}/);
});

test("notifications expose an unread-only filter and keep its count visible", async () => {
  const source = await read("../src/components/NotificationsDestination.jsx");
  assert.match(source, /\["all",\s*"unread",\s*"like",\s*"comment",\s*"follow"\]/);
  assert.match(source, /filter === "unread" \? !item\.read_at/);
  assert.match(source, /Unread\$\{unreadCount/);
});

test("notification filter controls remain horizontally usable on small screens", async () => {
  const css = await read("../src/professional-ui.css");
  assert.match(css, /\.notification-filter-row\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /\.notification-filter-row button\s*\{[^}]*white-space:\s*nowrap/);
  assert.match(css, /@media \(max-width: 520px\)/);
});
