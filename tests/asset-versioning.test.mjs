import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const SINGLETON_URL_VERSION = "13.15.12";

async function javascriptFiles(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...await javascriptFiles(path));
    else if (entry.name.endsWith(".js")) output.push(path);
  }
  return output;
}

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
  "/src/features/settings/feature.js",
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
  "/src/shared/i18n/messages-13-15-12.js",
  "/src/shared/progress/progress-queue.js",
  "/src/shared/progress/progress-repository.js",
  "/src/shared/progress/progress-sync.js",
  "/src/shared/progress/storage-scope.js",
  "/src/shared/progress/station-progress-store.js",
  "/src/shared/progress/route-settings-store.js",
  "/src/shared/progress/session-builders.js",
  "/src/shared/settings/learning-preview-data.js",
  "/src/shared/settings/learning-setup.js",
  "/src/shared/settings/user-settings-store.js",
  "/src/features/learn/state.js",
  "/src/features/test/state.js",
  "/src/features/match/state.js",
  "/src/features/path/station-view.js",
  "/src/features/test/view.js",
  "/src/shared/domain/alan-display.js",
  "/src/shared/ui/modal.js",
  "/src/shared/ui/word-renderers.js",
];

function generatedImportMapFrom(index) {
  const pathSource = index.match(/const singletonPaths = (\[[^;]+\]);/)?.[1] || "[]";
  const versionSource = index.match(/const versions = (\[[^;]+\]);/)?.[1] || "[]";
  const targetVersion = index.match(/const targetVersion = "([^"]+)"/)?.[1] || "";
  const paths = JSON.parse(pathSource);
  const versions = JSON.parse(versionSource);
  const imports = {};
  for (const path of paths) for (const version of versions) imports[`${path}?v=${version}`] = `${path}?v=${targetVersion}`;
  return { imports, paths, versions, targetVersion };
}

test("13.15.12 is the published app and cache release", async () => {
  const index = await read("index.html");
  const analytics = await read("src/config/analytics.js");
  const versionScreen = await read("src/features/settings/version.js");
  const bootstrap = await read("src/app/bootstrap.js");
  const worker = await read("service-worker.js");
  const wordsConfig = await read("src/config/words.js");
  assert.match(index, /app\.css\?v=13\.15\.12/);
  assert.match(index, /bootstrap\.js\?v=13\.15\.12/);
  assert.match(analytics, /appVersion = "13\.15\.9"/);
  assert.match(versionScreen, /<dd>13\.15\.12<\/dd>/);
  assert.match(worker, /const VERSION = "13\.15\.12"/);
  assert.match(bootstrap, /RELEASE_VERSION = "13\.15\.12"/);
  assert.match(wordsConfig, /alantil_dictionary_cache_v5/);
  assert.match(wordsConfig, /alantil_dictionary_cache_v4/);
});

test("13.15 feature modules are loaded explicitly and the service worker does not rewrite JavaScript modules", async () => {
  const router = await read("src/app/router.js");
  const worker = await read("service-worker.js");
  assert.match(router, /features\/path\/feature\.js/);
  assert.match(router, /features\/learn\/feature\.js/);
  assert.match(router, /features\/settings\/feature\.js/);
  assert.match(router, /features\/admin\/index\.js/);
  assert.doesNotMatch(worker, /MODULE_REWRITES|rewrittenModuleResponse|entry-13-14|word-normalizer-13-14/);
});

test("Settings dependencies resolve through the 13.15.12 singleton identity", async () => {
  const settings = await read("src/features/settings/feature.js");
  const worker = await read("service-worker.js");
  assert.match(settings, /SETTINGS_ASSET_VERSION = "13\.15\.12"/);
  assert.match(settings, /word-repository\.js\?v=13\.13/);
  assert.match(settings, /auth-service\.js\?v=13\.13/);
  assert.match(settings, /user-settings-store\.js\?v=13\.15\.12/);
  assert.match(worker, /url\.pathname\.startsWith\("\/src\/shared\/settings\/"\)/);
  assert.match(worker, /url\.pathname\.startsWith\("\/src\/shared\/admin\/"\)/);
  assert.match(worker, /"\/src\/shared\/data\/word-repository\.js"/);
  assert.match(worker, /"\/src\/shared\/progress\/progress-repository\.js"/);
  assert.match(worker, /"\/src\/shared\/progress\/progress-sync\.js"/);
});

test("profile keeps character assets but they are lazy and not part of the service-worker shell", async () => {
  const profile = await read("src/features/profile/index.js");
  const profileStyles = await read("src/features/profile/profile.css");
  const worker = await read("service-worker.js");
  const male = await readFile(new URL("../assets/images/profile/avatar_male.png", import.meta.url));
  const female = await readFile(new URL("../assets/images/profile/avatar_female.png", import.meta.url));
  assert.match(profile, /avatar_male\.png\?v=13\.11/);
  assert.match(profile, /avatar_female\.png\?v=13\.11/);
  const coreAssets = worker.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)?.[1] || "";
  assert.doesNotMatch(coreAssets, /avatar_male|avatar_female/);
  assert.match(profile, /profileAvatarSvg/);
  assert.match(profileStyles, /\.profileAvatarImage/);
  assert.equal(male.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(female.subarray(1, 4).toString("ascii"), "PNG");
});

test("historical singleton URLs canonicalize to one 13.15.12 in-memory instance", async () => {
  const index = await read("index.html");
  const generated = generatedImportMapFrom(index);
  const importMap = generated.imports;
  const versions = ["13.9.0", ...Array.from({ length: 13 }, (_, i) => `13.10.${i}`), "13.11", "13.12", "13.13", "13.14", "13.15", "13.15.1", "13.15.2", "13.15.3", "13.15.4", "13.15.5", "13.15.6", "13.15.7", "13.15.8", "13.15.9", "13.15.10", "13.15.10.1", "13.15.10.2", "13.15.10.3", "13.15.10.4", "13.15.10.5", "13.15.10.6", "13.15.10.7", "13.15.10.8", "13.15.10.9", "13.15.10.10", "13.15.10.11", "13.15.10.12", "13.15.11"];
  assert.equal(generated.targetVersion, SINGLETON_URL_VERSION);
  for (const path of singletonPaths) {
    assert.ok(generated.paths.includes(path), `missing singleton path ${path}`);
    for (const version of versions) {
      assert.ok(generated.versions.includes(version), `missing supported version ${version}`);
      assert.equal(importMap[`${path}?v=${version}`], `${path}?v=${SINGLETON_URL_VERSION}`, `missing ${path} alias for ${version}`);
    }
  }
});

test("current singleton imports do not create a second state instance", async () => {
  const index = await read("index.html");
  const importMap = generatedImportMapFrom(index).imports;
  const stateful = new Set(singletonPaths);
  for (const file of await javascriptFiles(resolve(projectRoot, "src"))) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/(?:from\s*|import\s*\()(["'])([^"']+\?v=[^"']+)\1/g)) {
      const specifier = match[2];
      if (specifier.includes("base=1")) continue;
      const [pathPart, query = ""] = specifier.split("?");
      const absolutePath = pathPart.startsWith("/")
        ? pathPart
        : `/${relative(projectRoot, resolve(dirname(file), pathPart)).split(sep).join("/")}`;
      if (!stateful.has(absolutePath)) continue;
      const absoluteSpecifier = `${absolutePath}?${query}`;
      const resolved = importMap[absoluteSpecifier] || absoluteSpecifier;
      assert.equal(resolved, `${absolutePath}?v=${SINGLETON_URL_VERSION}`, `${file} imports a second ${absoluteSpecifier} instance`);
    }
  }
});

test("auth SDK and profile avatars are not part of the guest critical path", async () => {
  const index = await read("index.html");
  const worker = await read("service-worker.js");
  assert.doesNotMatch(index, /modulepreload[^>]+supabase-js/);
  const coreAssets = worker.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)?.[1] || "";
  assert.doesNotMatch(coreAssets, /supabase-js|payload-[1-4]|avatar_male|avatar_female/);
});

test("shared display helpers keep their required dependencies", async () => {
  const alanDisplay = await read("src/shared/domain/alan-display.js");
  const wordRenderers = await read("src/shared/ui/word-renderers.js");
  const stationView = await read("src/features/path/station-view.js");
  const testView = await read("src/features/test/view.js");
  assert.match(alanDisplay, /example-groups\.js\?v=13\.10\.12/);
  assert.match(wordRenderers, /example-groups\.js\?v=13\.10\.12/);
  assert.match(stationView, /overflow-marquee\.js\?v=13\.10\.12/);
  assert.match(testView, /result-list\.js\?v=13\.10\.12/);
});
