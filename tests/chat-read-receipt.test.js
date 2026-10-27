import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("read receipts accept persisted numeric IDs returned as strings", () => {
  const chat = readFileSync(new URL("../src/components/Chat.jsx", import.meta.url), "utf8");
  assert.ok(
    chat.includes('typeof id === "string" && /^\\d+$/.test(id)'),
    "string IDs must be checked with a digit regex, not an escaped literal \\d"
  );

  const numericId = /^\d+$/;
  assert.equal(numericId.test("12345"), true);
  assert.equal(numericId.test("pending-12345"), false);
  assert.equal(numericId.test("12x45"), false);
});
