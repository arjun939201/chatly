import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = path => readFile(new URL(path, import.meta.url), "utf8");
test("Control Center is linked from the signed-in account menu and protected by database roles", async () => {
 const app = await read("../src/App.jsx");
 assert.match(app, /AdminDashboard/);
 assert.match(app, /tab === "admin"/);
 assert.match(app, /adminRole/);
 assert.match(app, /setTab\("admin"\)/);
});
test("Admin dashboard exposes the main management areas and protected actions", async () => {
 const ui = await read("../src/components/AdminDashboard.jsx");
 for (const item of ["users", "posts", "comments", "reports", "staff", "audit"]) assert.ok(ui.includes('"' + item + '"'));
 assert.match(ui, /admin_set_user_restriction/);
 assert.match(ui, /admin_delete_post/);
 assert.match(ui, /admin_assign_role/);
});
test("Admin UI has responsive mobile navigation and horizontal table overflow", async () => {
 const css = await read("../src/admin-control-center.css");
 assert.match(css, /max-width:680px/);
 assert.match(css, /overflow-x:auto/);
});
