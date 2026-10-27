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


test("secondary feed actions appear on hover or keyboard focus, not permanently", () => {
  assert.match(polish, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(polish, /\.post-card:hover \.post-options-trigger/);
  assert.match(polish, /\.comment-message:hover \.comment-own-actions/);
  assert.match(polish, /\.comment-message:focus-within \.comment-own-actions/);
  assert.match(polish, /@media \(hover: none\), \(pointer: coarse\)/);
  assert.match(polish, /\.comment-actions-open \.comment-own-actions/);
});

test("Chat conversation preferences use guarded storage helpers", () => {
  const chat = readFileSync(new URL("../src/components/Chat.jsx", import.meta.url), "utf8");
  assert.match(chat, /import \{ getStoredJSON, setStoredJSON \}/);
  assert.match(chat, /chatly-archived-chats-/);
  assert.match(chat, /chatly-pinned-chats-/);
  assert.match(chat, /chatly-muted-chats-/);
  assert.match(chat, /chatly-read-markers-/);
  assert.doesNotMatch(chat, /localStorage\.(getItem|setItem)/);
});

test("unsent chat drafts are restored per signed-in user", () => {
  const chat = readFileSync(new URL("../src/components/Chat.jsx", import.meta.url), "utf8");
  assert.match(chat, /chatly-message-drafts-/);
  assert.match(chat, /setStoredJSON/);
  assert.match(chat, /getStoredJSON/);
});
