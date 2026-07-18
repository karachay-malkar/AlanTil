import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const singletonPaths = [
  "/src/app/router.js",
  "/src/config/analytics.js",
  "/src/config/auth-providers.js",
  "/src/config/supabase.js",
  "/src/features/account/index.js",
  "/src/features/account/login.js",
  "/src/features/path/index.js",
  "/src/features/settings/index.js",
  "/src/features/settings/version.js",
  "/src/features/songs/index.js",
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

test("13.10.7 is the published application version", async () => {
  const analytics = await read("src/config/analytics.js");
  const index = await read("index.html");
  assert.match(analytics, /appVersion = "13\.10\.7"/);
  assert.match(index, /app\.css\?v=13\.10\.7/);
  assert.match(index, /bootstrap\.js\?v=13\.10\.7/);
});

test("singleton module URLs resolve to one 13.10.7 instance", async () => {
  const index = await read("index.html");
  for (const path of singletonPaths) {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const target = new RegExp(`"${escaped}\?v=13\.10\.7"`);
    assert.ok(target.test(index) || index.includes(`${path}?v=13.10.7`), `missing 13.10.7 reference for ${path}`);
  }
});

test("auth SDK is not part of the guest critical path", async () => {
  const index = await read("index.html");
  const worker = await read("service-worker.js");
  assert.doesNotMatch(index, /modulepreload[^>]+supabase-js/);
  const coreAssets = worker.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)?.[1] || "";
  assert.doesNotMatch(coreAssets, /supabase-js|payload-[1-4]/);
});
