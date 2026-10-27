import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const history = await readFile(new URL("../src/components/HistoryDestination.jsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/professional-ui.css", import.meta.url), "utf8");

test("global account trigger opens a dedicated side navigation", () => {
  assert.match(app, /setProfileMenuOpen\(v => !v\)/);
  assert.match(app, /global-profile-drawer/);
  assert.match(app, /global-profile-backdrop/);
  assert.match(app, /aria-label="Close navigation menu"/);
});

test("account drawer exposes only the agreed destinations", () => {
  const drawerStart = app.indexOf('className="global-profile-drawer"');
  assert.notEqual(drawerStart, -1);
  const drawerEnd = app.indexOf("</nav>", drawerStart);
  assert.notEqual(drawerEnd, -1);
  const drawer = app.slice(drawerStart, drawerEnd);
  for (const label of ["Profile", "History", "Settings", "Log out"]) {
    assert.ok(drawer.includes(label), `drawer should include ${label}`);
  }
  assert.match(drawer, /setTab\("profile"\)/);
  assert.match(drawer, /setTab\("history"\)/);
  assert.match(drawer, /setTab\("settings"\)/);
  assert.match(drawer, /supabase\.auth\.signOut\(\)/);
});

test("history route receives the signed-in session and returns to feed", () => {
  assert.match(app, /tab === "history" && <HistoryDestination session=\{session\} onBack=\{\(\) => setTab\("feed"\)\}/);
});

test("history offers bookmarks and liked-post views with loading, retry and empty states", () => {
  assert.match(history, /view === "bookmarks" \? "saved_posts" : "post_likes"/);
  assert.match(history, /role="tablist"/);
  assert.match(history, /Bookmarks/);
  assert.match(history, /Liked posts/);
  assert.match(history, /Loading history/);
  assert.match(history, /setRetry\(v => v \+ 1\)/);
  assert.match(history, /No bookmarks yet/);
  assert.match(history, /No liked posts yet/);
});

test("history queries are user-scoped and bounded, and preserve saved order", () => {
  assert.match(history, /\.eq\("user_id", session\.user\.id\)/);
  assert.match(history, /\.order\("created_at", \{ ascending: false \}\)\.limit\(100\)/);
  assert.match(history, /\.in\("id", ids\)/);
  assert.match(history, /ids\.map\(id => byId\.get\(String\(id\)\)\)\.filter\(Boolean\)/);
});

test("account navigation and history have responsive and reduced-motion styling", () => {
  assert.match(styles, /\.global-profile-drawer/);
  assert.match(styles, /\.history-page/);
  assert.match(styles, /@media\s*\(max-width:\s*600px\)/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
});


test("history posts show author identity and preserve author/date fallbacks", () => {
  assert.match(history, /from\("profiles"\)\.select\("id,username,display_name,avatar_url"\)/);
  assert.match(history, /author\.display_name \|\| author\.username \|\| "Chatly member"/);
  assert.match(history, /author\.username \? `@\$\{author\.username\}` : "Community post"/);
  assert.match(history, /history-author-avatar/);
  assert.match(history, /history-post-date/);
});

test("history tabs are associated with an accessible busy tab panel", () => {
  assert.match(history, /role="tablist"/);
  assert.match(history, /aria-controls="history-post-panel"/);
  assert.match(history, /role="tabpanel"/);
  assert.match(history, /aria-busy=\{loading\}/);
  assert.match(history, /tabIndex=\{view === "bookmarks" \? 0 : -1\}/);
});

test("history gives actionable guidance when an optional history table is missing", () => {
  assert.match(history, /rowsError\.code === "PGRST205"/);
  assert.match(history, /Bookmarks are not available yet because saved-post storage is not configured/);
  assert.match(history, /Liked-post history is not available yet because like storage is not configured/);
});

test("history styling includes author identity and narrow-screen adjustments", () => {
  assert.match(styles, /\.history-post-author/);
  assert.match(styles, /\.history-author-avatar/);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*?\.history-post/);
});


test("portal-rendered account drawer clicks are not mistaken for outside clicks", () => {
  assert.match(app, /closest\("\.global-profile-menu, \.global-profile-drawer, \.profile-page-head, \.profile-dropdown"\)/);
  assert.match(app, /createPortal\([\s\S]*?className="global-profile-drawer"/);
});
