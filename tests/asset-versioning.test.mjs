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

test("13.10.5 is the published application version", async () => {
  const analytics = await read("src/config/analytics.js");
  const index = await read("index.html");
  assert.match(analytics, /appVersion = "13\.10\.5"/);
  assert.match(index, /app\.css\?v=13\.10\.5/);
  assert.match(index, /bootstrap\.js\?v=13\.10\.5/);
});

test("singleton module URLs resolve to one 13.10.5 instance", async () => {
  const index = await read("index.html");
  for (const path of singletonPaths) {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const target = new RegExp(`"${escaped}\\?v=13\\.10\\.5"`);
    assert.ok(target.test(index) || index.includes(`${path}?v=13.10.5`), `missing 13.10.5 reference for ${path}`);
  }
});

test("Supabase SDK uses one pinned official ESM module", async () => {
  const client = await read("src/shared/auth/supabase-client.js");
  assert.match(client, /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.110\.7\/\+esm/);
  assert.doesNotMatch(client, /src\/vendor\/supabase-js|payload-[1-4]|gunzip/);
});

test("guest shell does not eagerly preload Supabase", async () => {
  const index = await read("index.html");
  const worker = await read("service-worker.js");
  assert.doesNotMatch(index, /modulepreload[^>]+supabase-js/);
  const coreAssets = worker.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)?.[1] || "";
  assert.doesNotMatch(coreAssets, /supabase-js|payload-[1-4]/);
});
