import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const profile = await readFile(new URL("../src/components/PublicProfile.jsx", import.meta.url), "utf8");

test("public profile displays the total post count, not only the loaded page", () => {
  assert.match(profile, /const \[postCount, setPostCount\] = useState\(0\)/);
  assert.match(profile, /select\("id,body,created_at", \{ count: "exact" \}\)/);
  assert.match(profile, /setPostCount\(postResult\.count \?\? \(postResult\.data \|\| \[\]\)\.length\)/);
  assert.match(profile, /<b>\{postCount\}<\/b> posts/);
});

test("public profile clears stale counts when the viewed account changes", () => {
  assert.match(profile, /setPosts\(\[\]\); setPostCount\(0\); setFollowers\(0\); setFollowingCount\(0\); setIsFollowing\(false\)/);
});

test("follow interactions remain disabled while loading or saving", () => {
  assert.match(profile, /if \(ownProfile \|\| busy \|\| loading \|\| !person\?\.id \|\| !session\?\.user\?\.id\) return/);
  assert.match(profile, /disabled=\{busy \|\| loading\}/);
});
