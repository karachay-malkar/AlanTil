import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (relativePath) => readFile(path.join(root, relativePath), "utf8");

test("a restored authenticated account URL is canonicalized before router startup", async () => {
  const index = await source("index.html");
  assert.match(index, /location\.pathname === "\/profile\/account"/);
  assert.match(index, /localStorage\.getItem\("alantil_auth_session_v1"\)/);
  assert.match(index, /history\.replaceState\(null, "", "\/profile"\)/);
  assert.ok(index.indexOf('localStorage.getItem("alantil_auth_session_v1")') < index.indexOf('<script type="module"'));
});

test("OAuth callback routing is excluded from restored-tab recovery", async () => {
  const index = await source("index.html");
  assert.match(index, /const callbackKeys = \["code", "error", "error_code", "error_description"\]/);
  assert.match(index, /if \(!callbackVisit/);
});
