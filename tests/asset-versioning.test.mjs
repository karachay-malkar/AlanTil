import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const singletonPaths = [
  "/src/config/analytics.js",
  "/src/config/auth-providers.js",
  "/src/config/supabase.js",
  "/src/features/account/index.js",
  "/src/features/account/login.js",
  "/src/shared/auth/auth-service.js",
  "/src/shared/auth/auth-store.js",
  "/src/shared/auth/google-identity.js",
  "/src/shared/auth/guest-profile-prompt.js",
  "/src/shared/auth/supabase-client.js",
  "/src/shared/data/word-repository.js",
  "/src/shared/i18n/index.js",
  "/src/shared/i18n/messages-13-10.js",
  "/src/shared/progress/progress-sync.js",
  "/src/shared/progress/storage-scope.js",
];

test("13.10.2 is the published application version", async () => {
  const analytics = await read("src/config/analytics.js");
  const index = await read("index.html");
  assert.match(analytics, /appVersion = "13\.10\.2"/);
  assert.match(index, /app\.css\?v=13\.10\.2/);
  assert.match(index, /bootstrap\.js\?v=13\.10\.2/);
});

test("changed singleton module URLs resolve to one 13.10.2 instance", async () => {
  const index = await read("index.html");
  for (const path of singletonPaths) {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const target = new RegExp(`"${escaped}\\?v=13\\.10\\.2"`);
    assert.ok(target.test(index) || index.includes(`${path}?v=13.10.2`), `missing 13.10.2 reference for ${path}`);
  }
});

test("local Supabase SDK replaces runtime CDN loading", async () => {
  const client = await read("src/shared/auth/supabase-client.js");
  const loader = await read("src/vendor/supabase-js.js");
  assert.match(client, /\/src\/vendor\/supabase-js\.js\?v=13\.10\.2/);
  assert.match(loader, /payload-1\.txt/);
  assert.match(loader, /gunzipSync/);
  assert.doesNotMatch(client + loader, /cdn\.jsdelivr\.net|unpkg\.com|esm\.sh/);
});
