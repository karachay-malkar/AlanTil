import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("story stele uses scoped per-story seen state and the approved mystery star", async () => {
  const source = await read("src/features/path/story-stele.js");
  assert.match(source, /alantil_story_intro_seen_v1/);
  assert.match(source, /readScopedJson/);
  assert.match(source, /writeScopedJson/);
  assert.match(source, /✦/);
  assert.match(source, /autoOpen && !hasSeenStoryStele\(storyId\)/);
});

test("path home mounts the stele and no longer renders the permanent intro block", async () => {
  const source = await read("src/features/path/feature.js");
  assert.match(source, /mountStoryStele/);
  assert.match(source, /autoOpen: true/);
  assert.doesNotMatch(source, /renderStoryIntro\(/);
  assert.doesNotMatch(source, /class="storyIntro"/);
});

test("production style is bronze Palatino with hard safe text boundaries", async () => {
  const css = await read("src/features/path/story-stele.css");
  assert.match(css, /"Palatino Linotype","Book Antiqua",Palatino/);
  assert.match(css, /color:#8a6841/);
  assert.match(css, /--stele-zone-left:28\.9%/);
  assert.match(css, /--stele-zone-width:42\.2%/);
  assert.match(css, /--stele-zone-pad-x:4\.2%/);
  assert.match(css, /storySteleMysteryPulse 6s/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("cache busting points the app and service worker to 13.15.1", async () => {
  const index = await read("index.html");
  const bootstrap = await read("src/app/bootstrap.js");
  const appCss = await read("src/shared/styles/app.css");
  const sw = await read("service-worker.js");
  assert.match(index, /targetVersion = "13\.15\.1"/);
  assert.match(index, /app\.css\?v=13\.15\.1/);
  assert.match(index, /bootstrap\.js\?v=13\.15\.1/);
  assert.match(bootstrap, /RELEASE_VERSION = "13\.15\.1"/);
  assert.match(appCss, /story-stele\.css\?v=13\.15\.1/);
  assert.doesNotMatch(appCss, /story-intro\.css/);
  assert.match(sw, /VERSION = "13\.15\.1"/);
  assert.match(sw, /story-stele\.png\?v=13\.15\.1/);
});
