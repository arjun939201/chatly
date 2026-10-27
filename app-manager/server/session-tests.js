import test from "node:test";
import assert from "node:assert/strict";
process.env.SESSION_SECRET = "test-secret-that-is-long-enough-for-unit-tests";
process.env.NODE_ENV = "test";
const { seal, unseal } = await import("./index.js");

test("encrypted session round-trips", () => {
  const value = { token: "fake-token", exp: Date.now() + 60_000 };
  assert.deepEqual(unseal(seal(value)), value);
});
test("session tampering is rejected", () => {
  const value = seal({ token: "fake-token", exp: Date.now() + 60_000 });
  assert.equal(unseal(value + "tampered"), null);
});
test("expired sessions are rejected", () => {
  assert.equal(unseal(seal({ token: "fake-token", exp: Date.now() - 1000 })), null);
});
