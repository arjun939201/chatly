import test from "node:test";
import assert from "node:assert/strict";
process.env.SESSION_SECRET="test-secret-that-is-long-enough-for-unit-tests";
process.env.NODE_ENV="test";
const {seal,unseal}=await import("./index.js");
test("encrypted session round-trips",()=>{const v={token:"fake-token",exp:Date.now()+60000};assert.deepEqual(unseal(seal(v)),v);});
test("session tampering is rejected",()=>{const v=seal({token:"fake-token",exp:Date.now()+60000});assert.equal(unseal(v+"tampered"),null);});
test("expired sessions are rejected",()=>assert.equal(unseal(seal({token:"fake-token",exp:Date.now()-1000})),null));