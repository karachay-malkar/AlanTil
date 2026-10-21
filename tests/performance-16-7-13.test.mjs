import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("path home avoids loading study/test UI modules before a user starts a session", async () => {
  const path = await read("src/features/path/feature.js");
  assert.doesNotMatch(path, /^import.*from "\.\.\/learn\/study\.js/m);
  assert.doesNotMatch(path, /^import.*from "\.\/station-test\.js/m);
  assert.match(path, /function loadStudyDependencies\(\)/);
  assert.match(path, /function loadTestDependencies\(\)/);
  assert.match(path, /if\(screen==="study"\)\{const mountSignal=controller\.signal;const \{renderStudy,renderLearnResults\}=await loadStudyDependencies\(\)/);
  assert.match(path, /if\(screen==="test"\)\{const mountSignal=controller\.signal;const \{createStationTestSession,renderStationTest\}=await loadTestDependencies\(\)/);
  assert.match(path, /studyDependencies\?\.finalizeLearnSession\("interrupted",reason\)/);
});

test("Service Worker does not prefetch onboarding for returning users", async () => {
  const worker = await read("service-worker.js");
  const core = worker.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)?.[1] || "";
  assert.doesNotMatch(core, /features\/onboarding|feature\/onboarding\.css/);
  assert.match(core, /src\/app\/bootstrap\.js/);
  assert.match(worker, /const SPA_ROUTE_PREFIXES = new Set/);
  assert.match(worker, /const networkTarget = isSpaRoute \? "\/index\.html" : request/);
  assert.match(worker, /cacheTarget = isSpaRoute \? "\/index\.html" : request/);
  assert.match(worker, /url\.pathname === "\/tower-masonry-test"/);
});

test("SPA navigation excludes file-like paths, preserving standalone assets", async () => {
  const worker = await read("service-worker.js");
  assert.ok(worker.includes("!/\\.[a-z0-9]+$/i.test(url.pathname)"));
});
