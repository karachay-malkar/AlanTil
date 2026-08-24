import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("profile navigation follows the story-tab horizontal overflow contract", async () => {
  const css = await read("src/shared/styles/app.css");
  assert.match(css, /\.profilePrimaryNav\{[\s\S]*width:auto[\s\S]*grid-template-columns:none/);
  assert.match(css, /grid-auto-flow:column/);
  assert.match(css, /grid-auto-columns:minmax\(max-content,1fr\)/);
  assert.match(css, /overflow-x:auto/);
  assert.match(css, /scroll-snap-type:x proximity/);
  assert.match(css, /scrollbar-width:none/);
  assert.match(css, /\.profilePrimaryTab\{[\s\S]*white-space:nowrap[\s\S]*scroll-snap-align:center/);
});

test("profile-navigation patch refreshes the service-worker cache namespace", async () => {
  const worker = await read("service-worker.js");
  assert.match(worker, /const VERSION = "13\.15\.12\.2"/);
  assert.match(worker, /\/src\/shared\/styles\/app\.css\?v=13\.15\.12/);
});
