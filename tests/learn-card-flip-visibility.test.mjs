import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("study faces are hidden independently of browser backface compositing", async () => {
  const css = await read("src/features/learn/learn.css");
  assert.match(css, /backface-visibility:hidden;-webkit-backface-visibility:hidden/);
  assert.match(css, /transition:visibility 0s linear \.21s/);
  assert.match(css, /\.learnCard \.cardFront\{visibility:visible\}/);
  assert.match(css, /\.learnCard \.cardBack\{visibility:hidden;transform:rotateY\(180deg\)/);
  assert.match(css, /\.learnCard\.flipped \.cardFront\{visibility:hidden\}/);
  assert.match(css, /\.learnCard\.flipped \.cardBack\{visibility:visible\}/);
  assert.match(css, /\.learnCard\.flip-reset \.cardFace\{transition:none!important\}/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("new cards reset both flip and face visibility without resetting learning progress", async () => {
  const study = await read("src/features/learn/study.js");
  const reset = study.slice(study.indexOf("function resetFlipInstant()"), study.indexOf("function updateFavorite()"));
  assert.match(reset, /card\.classList\.add\("flip-reset"\)/);
  assert.match(reset, /card\.classList\.remove\("flipped"\)/);
  assert.match(reset, /void inner\.offsetWidth/);
  assert.match(reset, /card\.classList\.remove\("flip-reset"\)/);
  assert.ok(reset.indexOf('add("flip-reset")') < reset.indexOf('remove("flipped")'));
  assert.ok(reset.indexOf('remove("flipped")') < reset.indexOf('remove("flip-reset")'));
  assert.match(study, /persistSessionRuntime\(/);
  assert.match(study, /card\.addEventListener\("click", \(\) => card\.classList\.toggle\("flipped"\)/);
});

test("both Learn and Path receive the same revised study module and CSS", async () => {
  const paths = await Promise.all([
    read("src/features/learn/feature.js"),
    read("src/features/path/feature.js"),
    read("src/shared/styles/lazy/learn.css"),
  ]);
  assert.match(paths[0], /study\.js\?v=16\.8\.0\.19/);
  assert.match(paths[1], /study\.js\?v=16\.8\.0\.19/);
  assert.match(paths[2], /learn\.css\?v=16\.8\.0\.19/);
});

test("service worker refuses activation if shell precache is incomplete", async () => {
  const code = await read("service-worker.js");
  let install;
  let activatedEarly = 0;
  let shouldFail = true;
  const cache = { add: () => shouldFail ? Promise.reject(new Error("offline")) : Promise.resolve() };
  const self = {
    addEventListener: (name, callback) => { if (name === "install") install = callback; },
    skipWaiting: () => { activatedEarly++; return Promise.resolve(); },
  };
  vm.runInNewContext(code, { self, caches: { open: async () => cache }, Request: class { constructor(url) { this.url = url; } } });
  let installation;
  install({ waitUntil: (promise) => { installation = promise; } });
  await assert.rejects(installation, /offline/);
  assert.equal(activatedEarly, 0);
  shouldFail = false;
  install({ waitUntil: (promise) => { installation = promise; } });
  await installation;
  assert.equal(activatedEarly, 1);
  assert.match(code, /const VERSION = "16\.8\.0\.19"/);
  assert.match(code, /name\.startsWith\("alantil-"\)/);
  assert.doesNotMatch(code, /localStorage\.clear|indexedDB\.deleteDatabase/);
});
