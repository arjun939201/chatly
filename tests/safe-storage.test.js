import test from "node:test";
import assert from "node:assert/strict";
import { getStoredValue, setStoredValue, getStoredJSON, setStoredJSON } from "../src/lib/safeStorage.js";

function withLocalStorage(t, storage) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  });
}

test("storage helpers read and write values and JSON", t => {
  const values = new Map();
  withLocalStorage(t, {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  });
  assert.equal(getStoredValue("theme", "system"), "system");
  assert.equal(setStoredValue("theme", "dark"), true);
  assert.equal(getStoredValue("theme", "system"), "dark");
  assert.equal(setStoredJSON("prefs", { compact: true }), true);
  assert.deepEqual(getStoredJSON("prefs", {}), { compact: true });
});

test("unavailable browser storage falls back without throwing", t => {
  withLocalStorage(t, {
    getItem() { throw new Error("storage blocked"); },
    setItem() { throw new Error("storage blocked"); },
  });
  assert.equal(getStoredValue("theme", "system"), "system");
  assert.deepEqual(getStoredJSON("prefs", { enabled: true }), { enabled: true });
  assert.equal(setStoredValue("theme", "dark"), false);
  assert.equal(setStoredJSON("prefs", { enabled: false }), false);
});

test("malformed persisted JSON returns the provided fallback", t => {
  withLocalStorage(t, { getItem: () => "{broken", setItem() {} });
  assert.deepEqual(getStoredJSON("prefs", []), []);
});
