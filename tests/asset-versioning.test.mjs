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
  "/src/shared/auth/guest-profile-prompt.js",
  "/src/shared/auth/supabase-client.js",
  "/src/shared/data/word-repository.js",
  "/src/shared/i18n/index.js",
  "/src/shared/i18n/messages-13-10.js",
  "/src/shared/progress/progress-sync.js",
  "/src/shared/progress/storage-scope.js",
];

test("13.10.1 is the published application version", async () => {
  const analytics = await read("src/config/analytics.js");
  const index = await read("index.html");
  assert.match(analytics, /appVersion = "13\.10\.1"/);
  assert.match(index, /app\.css\?v=13\.10\.1/);
  assert.match(index, /bootstrap\.js\?v=13\.10\.1/);
});

test("legacy singleton module URLs are redirected to one 13.10.1 instance", async () => {
  const index = await read("index.html");
  for (const path of singletonPaths) {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const mapping = new RegExp(`"${escaped}\\?v=13\\.(?:9\\.0|10\\.0)"\\s*:\\s*"${escaped}\\?v=13\\.10\\.1"`);
    const isNewOnly = index.includes(`"${path}?v=13.10.1"`);
    assert.ok(mapping.test(index) || isNewOnly, `missing 13.10.1 singleton mapping for ${path}`);
  }
});

test("changed entry modules do not reference the broken 13.10.0 URLs", async () => {
  const paths = [
    "src/app/bootstrap.js",
    "src/features/account/index.js",
    "src/features/account/login.js",
    "src/shared/auth/auth-service.js",
    "src/shared/auth/guest-profile-prompt.js",
    "src/shared/auth/google-identity.js",
  ];
  for (const path of paths) {
    assert.doesNotMatch(await read(path), /\?v=13\.10\.0/);
  }
});
