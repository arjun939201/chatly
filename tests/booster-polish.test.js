import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const polish = readFileSync(new URL("../src/booster-polish.css", import.meta.url), "utf8");
const entry = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");

test("booster polish is loaded after the established application styles", () => {
  assert.match(entry, /import "\.\/booster-polish\.css";/);
  assert.ok(entry.indexOf('import "./booster-polish.css";') > entry.indexOf('import "./professional-ui.css";'));
});

test("keyboard focus indicators remain explicit", () => {
  assert.match(polish, /:focus-visible/);
  assert.match(polish, /outline: 2px solid var\(--chatly-accent/);
});

test("reduced-motion preference is respected app-wide", () => {
  assert.match(polish, /prefers-reduced-motion:\s*reduce/);
  assert.match(polish, /transition-duration:\s*0\.01ms\s*!important/);
  assert.match(polish, /animation-duration:\s*0\.01ms\s*!important/);
});

test("long dialogs fit mobile viewports and respect safe areas", () => {
  assert.match(polish, /max-height:\s*calc\(100dvh/);
  assert.match(polish, /env\(safe-area-inset-top\)/);
  assert.match(polish, /overscroll-behavior:\s*contain/);
});

test("native controls are not forced into a fixed color scheme", () => {
  assert.doesNotMatch(polish, /color-scheme:\s*(light|dark)\s*;/);
});
