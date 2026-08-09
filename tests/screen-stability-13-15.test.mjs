import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("router has stable URLs for every transient screen and force remount bypasses equality short-circuit", async () => {
  const router = await read("src/app/router.js");
  for (const fragment of [
    'return { route: "learn.catalog-content"',
    'return { route: "learn.study"',
    'return { route: "learn.results"',
    'return { route: "test.session"',
    'return { route: "test.results"',
    'return { route: "match.game"',
    'return { route: "match.results"',
    'routeName === "learn.study" ? "/study"',
    'routeName === "learn.results" ? "/results"',
    'return "/test/session"',
    'return "/test/results"',
    'return "/match/game"',
    'return "/match/results"',
  ]) assert.ok(router.includes(fragment), `missing route fragment: ${fragment}`);
  assert.match(router, /if \(!initial && !force && targetsEqual\(target, current\)\)/);
});

test("direct reload of stateful sessions fails safe instead of rendering an empty session", async () => {
  const learn = await read("src/features/learn/feature.js");
  const testFeature = await read("src/features/test/index.js");
  const matchFeature = await read("src/features/match/index.js");
  assert.match(learn, /screen === "study" && !learnState\.studySession\.inProgress/);
  assert.match(learn, /screen === "results" && !learnState\.studySession\.completed/);
  assert.match(testFeature, /screen === "session" && \(!testState\.session\.inProgress \|\| !testState\.items\.length\)/);
  assert.match(testFeature, /screen === "results" && !testState\.session\.completed/);
  assert.match(matchFeature, /screen === "game" && \(!matchState\.session\.inProgress \|\| !matchState\.total\)/);
  assert.match(matchFeature, /screen === "results" && !matchState\.session\.completed/);
});

test("Profile no longer imports the removed station-size API", async () => {
  const profile = await read("src/features/profile/index.js");
  assert.doesNotMatch(profile, /getStationSize/);
  assert.match(profile, /buildLearningRoute\(words\)/);
});

test("service worker treats 404 navigation as an SPA fallback and never forces client reload", async () => {
  const worker = await read("service-worker.js");
  assert.match(worker, /response\.status === 404/);
  assert.match(worker, /freshIndexResponse\(\)/);
  assert.doesNotMatch(worker, /client\.navigate|clients\.map\(.*navigate/);
  assert.doesNotMatch(worker, /MODULE_REWRITES/);
});

test("persisted authentication cannot block initial routing", async () => {
  const bootstrap = await read("src/app/bootstrap.js");
  const authStart = bootstrap.indexOf("const authInitialization = waitForAuthInitialization()");
  const routerStart = bootstrap.indexOf("await router.start()");
  const backgroundRefresh = bootstrap.indexOf("persistedAuth && !callbackVisit");
  assert.ok(authStart >= 0 && routerStart > authStart && backgroundRefresh > routerStart);
  assert.doesNotMatch(bootstrap.slice(authStart, routerStart), /if \(persistedAuth\)[\s\S]*await authInitialization/);
  assert.match(bootstrap, /if \(callbackVisit\) await authInitialization/);
});
