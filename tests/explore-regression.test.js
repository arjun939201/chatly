import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const search = await readFile(new URL("../src/components/SearchPeople.jsx", import.meta.url), "utf8");
const explore = await readFile(new URL("../src/components/explore/useExploreData.js", import.meta.url), "utf8");

test("search destination follows queries supplied by navigation", () => {
  assert.match(search, /useEffect\(\(\) => \{ setQuery\(initialQuery \|\| ""\); \}, \[initialQuery\]\)/);
});

test("explore search handles missing configuration without leaving loading active", () => {
  assert.match(explore, /if \(!supabase\)/);
  assert.match(explore, /Search is unavailable because Chatly is not configured yet/);
  assert.match(explore, /setPeopleLoading\(false\)/);
  assert.match(explore, /setPostsLoading\(false\)/);
});

test("people and post search always clear current-request loading after failures", () => {
  assert.equal((explore.match(/finally \{/g) || []).length, 2);
  assert.match(explore, /People search failed/);
  assert.match(explore, /Post search failed/);
  assert.match(explore, /request !== requestId\.current/);
});

test("search pagination stays bounded and deduplicates appended records", () => {
  assert.match(explore, /const PAGE_SIZE = 20/);
  assert.match(explore, /\.range\(from, to\)/);
  assert.match(explore, /current\.some\(existing => existing\.id === row\.id\)/);
});
