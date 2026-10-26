import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/components/Feed.jsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/professional-ui.css", import.meta.url), "utf8");

test("feed load is bounded and deduplicates post records", () => {
  assert.match(source, /\.order\("created_at",\s*\{\s*ascending:\s*false\s*\}\)\.limit\(100\)/);
  assert.match(source, /new Map\(\(data \|\| \[\]\)\.map\(post => \[post\.id, post\]\)\)/);
});

test("like interaction blocks duplicate requests and rolls back failures", () => {
  assert.match(source, /likeRequests\.current\.has\(post\.id\)/);
  assert.match(source, /likeRequests\.current\.add\(post\.id\)/);
  assert.match(source, /likeRequests\.current\.delete\(post\.id\)/);
  assert.match(source, /setPosts\(current => current\.map\(item => item\.id === post\.id[\s\S]*?liked: wasLiked/);
  assert.match(source, /aria-pressed=\{post\.liked\}/);
});

test("comment submission guards duplicate sends and preserves draft on failure", () => {
  assert.match(source, /commentSubmitLock\.current\) return/);
  assert.match(source, /commentSubmitLock\.current = true/);
  assert.match(source, /commentSubmitLock\.current = false/);
  assert.match(source, /Your draft is still here/);
  assert.match(source, /disabled=\{commentBusy \|\| !commentDraft\.trim\(\)\}/);
});

test("post publishing rejects empty content and shows busy feedback", () => {
  assert.match(source, /if \(busy \|\| !body\.trim\(\)\) return/);
  assert.match(source, /disabled=\{busy \|\| !body\.trim\(\)\}/);
  assert.match(source, /busy \? "Posting…"/);
});

test("deletion is owner-only and removes local post and comment state", () => {
  assert.match(source, /post\.user_id !== session\.user\.id \|\| deleteBusy/);
  assert.match(source, /window\.confirm\("Delete this post permanently/);
  assert.match(source, /setPosts\(current => current\.filter\(item => item\.id !== post\.id\)\)/);
  assert.match(source, /delete next\[post\.id\]/);
});

test("feed and timestamps expose accessible semantics", () => {
  assert.match(source, /role="feed" aria-label="Community posts" aria-busy=\{feedLoading\}/);
  assert.match(source, /aria-posinset=\{postIndex \+ 1\} aria-setsize=\{posts\.length\}/);
  assert.match(source, /<time dateTime=\{post\.created_at\}>/);
  assert.match(source, /<time className="comment-timestamp" dateTime=\{comment\.created_at\}>/);
});

test("missing saved_posts does not block the regular feed", () => {
  assert.match(source, /const savedTableUnavailable = savedResult\.error\?\.code === "PGRST205"/);
  assert.match(source, /if \(savedResult\.error && !savedTableUnavailable\) throw savedResult\.error/);
  assert.match(source, /savedTableUnavailable \? \[\] : \(savedResult\.data \|\| \[\]\)\.map/);
  assert.match(source, /Saved posts are unavailable until the saved_posts table is configured\. Your feed is still working\./);
});

test("saved view explains when its table is missing", () => {
  assert.match(source, /Saved posts are unavailable because the saved_posts table is not set up yet\./);
});

test("shared post URLs scroll to their target and clear the query after navigation", () => {
  assert.match(source, /new URLSearchParams\(window\.location\.search\)\.get\("post"\)/);
  assert.match(source, /target\.scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
  assert.match(source, /window\.history\.replaceState\(\{\}, "", window\.location\.pathname \+ window\.location\.hash\)/);
});

test("post reporting submits a reason and keeps duplicate submits disabled", () => {
  assert.match(source, /supabase\.from\("post_reports"\)\.insert/);
  assert.match(source, /reporter_id: session\.user\.id/);
  assert.match(source, /disabled=\{reportBusy\}/);
  assert.match(source, /Thanks\. Your report was submitted for review\./);
});

test("hidden-post undo is only offered for the active hide notice", () => {
  assert.match(source, /lastHiddenPost && notice === "Post hidden from your feed\." &&/);
});

test("post engagement controls use the expected layout and right alignment", () => {
  assert.match(source, /className="post-actions-primary"/);
  assert.match(source, /className="post-engagement-meta"/);
  assert.match(source, /<time dateTime=\{post\.created_at\}>[\s\S]*?<span className="post-view-count"/);
  // Metadata stays in the engagement row and is pushed to the right.
  assert.match(styles, /\.post-actions \.post-engagement-meta\{display:flex;align-items:center;justify-content:flex-end;[^}]*margin:0 0 0 auto/);
});


test("notifications fetch a bounded page and count unread activity separately", async () => {
  const source = await readFile(new URL("../src/components/NotificationsDestination.jsx", import.meta.url), "utf8");
  assert.match(source, /const pageSize = 50/);
  assert.match(source, /\.range\(offset, offset \+ pageSize - 1\)/);
  assert.match(source, /\.select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(source, /setHasMore\(notifications\.length === pageSize\)/);
  assert.doesNotMatch(source, /for \(let offset = 0; ; offset \+= pageSize\)/);
});

test("notification load-more appends deduplicated activity on demand", async () => {
  const source = await readFile(new URL("../src/components/NotificationsDestination.jsx", import.meta.url), "utf8");
  assert.match(source, /loadNotifications\(true, true\)/);
  assert.match(source, /const merged = new Map\(current\.map\(item => \[item\.id, item\]\)\)/);
  assert.match(source, /disabled=\{loadingMore\}/);
  assert.match(source, /Loading activity…/);
});


test("shared UI respects reduced-motion preferences", () => {
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.app-shell \*[\s\S]*?animation: none !important/);
  assert.match(styles, /transition: none !important/);
});

test("background notification refresh errors do not replace loaded activity", async () => {
  const source = await readFile(new URL("../src/components/NotificationsDestination.jsx", import.meta.url), "utf8");
  assert.match(source, /if \(!silent\) setError\(err\.message \|\| "Could not load notifications\."\)/);
});


test("auth bootstrap falls back to sign-in instead of leaving a loading screen stuck", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /supabase\.auth\.getSession\(\)[\s\S]*?\.catch\(error =>/);
  assert.match(source, /Session bootstrap failed/);
  assert.match(source, /setSession\(null\);\s*setLoading\(false\);/);
});


test("profile avatar image failures reveal the initials fallback", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.ok((source.match(/classList\.add\("avatar-image-failed"\)/g) || []).length >= 5);
    });

test("profile post grid keeps metadata aligned and text readable", async () => {
  const styles = await readFile(new URL("../src/professional-ui.css", import.meta.url), "utf8");
  assert.match(styles, /\.app-shell \.profile-post-tile \{[\s\S]*?flex-direction: column/);
  assert.match(styles, /\.app-shell \.profile-post-tile small \{[\s\S]*?margin-top: auto/);
  assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.profile-post-tile:hover/);
});


test("profile relationship counts open real follower and following lists", async () => {
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /async function openProfileConnections\(kind\)/);
  assert.match(app, /kind === "followers" \? "follower_id" : "following_id"/);
  assert.match(app, /supabase\.from\("user_follows"\)\.select\(idColumn\)/);
  assert.match(app, /supabase\.from\("profiles"\)\.select\("id,username,display_name,avatar_url,bio"\)\.in\("id", ids\)/);
  assert.match(app, /className="profile-stat-button"/);
  assert.match(app, /profileConnections\.people\.map\(person =>/);
  assert.match(app, /openPublicProfile\(person\)/);
});

test("profile statistics show loading and recover from failed count queries", async () => {
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /const \[profileStatsLoading, setProfileStatsLoading\] = useState\(false\)/);
  assert.match(app, /setProfileStatsError\(true\)/);
  assert.match(app, /profileStatsLoading \? "—" : profileStats\.followers/);
  assert.match(app, /setProfileStatsRetry\(value => value \+ 1\)/);
  assert.match(app, /if \(!countResult\.error\) setProfileStats\(current => \(\{ \.\.\.current, posts: countResult\.count \|\| 0 \}\)\)/);
});

test("profile connection lists have responsive, keyboard-visible interaction styling", async () => {
  const styles = await readFile(new URL("../src/professional-ui.css", import.meta.url), "utf8");
  assert.match(styles, /\.profile-counts > \.profile-stat-button:hover,[\s\S]*?\.profile-counts > \.profile-stat-button:focus-visible/);
  assert.match(styles, /\.profile-connections-list \{[\s\S]*?overflow-y: auto/);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*?\.profile-counts > \.profile-stat-button/);
});
