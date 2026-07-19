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
  "/src/features/onboarding/index.js",
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
  "/src/shared/settings/learning-preview-data.js",
  "/src/shared/settings/learning-setup.js",
  "/src/features/path/station-view.js",
  "/src/features/test/view.js",
  "/src/shared/domain/alan-display.js",
  "/src/shared/ui/modal.js",
  "/src/shared/ui/word-renderers.js",
  "/src/shared/settings/user-settings-store.js",
];

test("13.10.11 is the published application version", async () => {
  const analytics = await read("src/config/analytics.js");
  const index = await read("index.html");
  assert.match(analytics, /appVersion = "13\.10\.11"/);
  assert.match(index, /app\.css\?v=13\.10\.11/);
  assert.match(index, /bootstrap\.js\?v=13\.10\.11/);
});

test("singleton module URLs resolve to one 13.10.11 instance", async () => {
  const index = await read("index.html");
  for (const path of singletonPaths) {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const target = new RegExp(`"${escaped}\?v=13\.10\.11"`);
    assert.ok(target.test(index) || index.includes(`${path}?v=13.10.11`), `missing 13.10.11 reference for ${path}`);
  }
});

test("auth SDK is not part of the guest critical path", async () => {
  const index = await read("index.html");
  const worker = await read("service-worker.js");
  assert.doesNotMatch(index, /modulepreload[^>]+supabase-js/);
  const coreAssets = worker.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)?.[1] || "";
  assert.doesNotMatch(coreAssets, /supabase-js|payload-[1-4]/);
});

test("changed display modules canonicalize every historical URL", async () => {
  const index = await read("index.html");
  const paths = [
    "/src/features/path/station-view.js",
    "/src/features/test/view.js",
    "/src/shared/domain/alan-display.js",
    "/src/shared/ui/modal.js",
    "/src/shared/ui/word-renderers.js",
  ];
  const versions = ["13.9.0", ...Array.from({ length: 11 }, (_, index) => `13.10.${index}`)];
  for (const path of paths) {
    for (const version of versions) {
      assert.ok(index.includes(`"${path}?v=${version}": "${path}?v=13.10.11"`), `missing ${path} alias for ${version}`);
    }
  }
});

test("new shared helpers are imported at the 13.10.11 URL", async () => {
  const alanDisplay = await read("src/shared/domain/alan-display.js");
  const wordRenderers = await read("src/shared/ui/word-renderers.js");
  const stationView = await read("src/features/path/station-view.js");
  const testView = await read("src/features/test/view.js");
  assert.match(alanDisplay, /example-groups\.js\?v=13\.10\.11/);
  assert.match(wordRenderers, /example-groups\.js\?v=13\.10\.11/);
  assert.match(stationView, /overflow-marquee\.js\?v=13\.10\.11/);
  assert.match(testView, /overflow-marquee\.js\?v=13\.10\.11/);
});
