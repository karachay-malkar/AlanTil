import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

async function filesUnder(relativeDir) {
  const output = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else output.push(full);
    }
  }
  await walk(path.join(root, relativeDir));
  return output;
}

test("16.8 adaptive station meta uses explicit opt-in and never targets dioramas globally", async () => {
  const adaptive = await read("src/shared/ui/adaptive-layout.js");
  const feature = await read("src/features/path/feature.js");
  const compatibility = await read("src/features/path/index.js");
  assert.match(adaptive, /\.stationNode\[data-adaptive-station-meta\]/);
  assert.doesNotMatch(adaptive, /querySelectorAll\?\.\(['"]\.stationNode['"]\)/);
  assert.doesNotMatch(adaptive, /beginnerDioramaNode/);
  const iconBranch = feature.slice(feature.indexOf("if (iconName)"), feature.indexOf("const dictionaryId"));
  assert.match(iconBranch, /beginnerDioramaFrame/);
  assert.doesNotMatch(iconBranch, /data-adaptive-station-meta/);
  const regularBranch = feature.slice(feature.indexOf("const dictionaryId"), feature.indexOf("function routeSection"));
  assert.match(regularBranch, /data-adaptive-station-meta/);
  assert.match(compatibility, /class="choiceControl stationNode \$\{status\}"[\s\S]*data-adaptive-station-meta/);
  assert.match(feature, /button\.className=stationNodeClass\(station,status\)/);
});

test("16.8 runtime uses one static cache-busting version", async () => {
  const targets = [
    ...(await filesUnder("src")),
    ...(await filesUnder("packages")),
    path.join(root, "index.html"),
    path.join(root, "service-worker.js"),
  ];
  const mismatches = [];
  for (const file of targets) {
    let source;
    try { source = await readFile(file, "utf8"); } catch { continue; }
    for (const match of source.matchAll(/\?v=(?!\$\{)([^&"'`\s)]+)/g)) {
      if (match[1] !== "16.8.0.2") mismatches.push(`${path.relative(root, file)} -> ${match[1]}`);
    }
  }
  assert.deepEqual(mismatches, []);
});

test("16.8 keeps persistent data schema keys while bumping public release metadata", async () => {
  const release = await read("packages/alantil-core/release.js");
  const dictionary = await read("packages/alantil-core/dictionary-contract.js");
  const progress = await read("src/shared/progress/word-progress-store.js");
  const mobile = JSON.parse(await read("mobile/app.json"));
  assert.match(release, /APP_VERSION = "16\.8\.0"/);
  assert.match(release, /WEB_BUILD_VERSION = "16\.8\.0\.2"/);
  assert.match(release, /WEB_DEPLOY_BRANCH = "agent\/16\.8\.0"/);
  assert.match(dictionary, /alantil_dictionary_cache_v5/);
  assert.match(progress, /alantil_word_progress_v13_5/);
  assert.equal(mobile.expo.version, "16.8.0");
  assert.equal(mobile.expo.android.versionCode, 41);
  assert.equal(mobile.expo.ios.buildNumber, "41");
  assert.equal(mobile.expo.extra.architecture, "shared-core-16.7.0");
});
