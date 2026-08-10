import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("story stele keeps scoped seen state and uses the approved full-resolution artwork", async () => {
  const source = await read("src/features/path/story-stele.js");
  assert.match(source, /alantil_story_intro_seen_v1/);
  assert.match(source, /readScopedJson/);
  assert.match(source, /writeScopedJson/);
  assert.match(source, /story-stele\.avif\?v=13\.15\.3/);
  assert.match(source, /✦/);
  assert.match(source, /autoOpen && !hasSeenStoryStele\(storyId\)/);
});

test("overflowing stele text auto-scrolls slowly and pauses for manual input", async () => {
  const source = await read("src/features/path/story-stele.js");
  assert.match(source, /AUTO_SCROLL_PX_PER_SECOND = 7/);
  assert.match(source, /requestAnimationFrame\(autoScrollTick\)/);
  assert.match(source, /pointerdown/);
  assert.match(source, /touchstart/);
  assert.match(source, /wheel/);
  assert.match(source, /AUTO_SCROLL_RESUME_DELAY_MS/);
  assert.match(source, /MIN_BODY_FONT_SIZE_PX = 12\.5/);
});

test("stele closes from the dimmed backdrop and from stone outside its text area", async () => {
  const source = await read("src/features/path/story-stele.js");
  const css = await read("src/features/path/story-stele.css");
  assert.match(source, /backdrop\?\.addEventListener\("click", \(\) => closeStele\(\)/);
  assert.match(source, /card\?\.addEventListener\("click", \(event\) =>/);
  assert.match(source, /event\.target\.closest\("\[data-stele-content\]"\)/);
  assert.match(css, /storySteleOverlay[\s\S]*position:fixed/);
  assert.match(css, /z-index:var\(--z-modal\)/);
  assert.match(css, /background:rgba\(24,22,19,\.62\)/);
  assert.match(css, /storySteleDialog[\s\S]*pointer-events:none/);
  assert.match(css, /storySteleCard[\s\S]*pointer-events:auto/);
});

test("production stele geometry matches the 772 by 1536 artwork", async () => {
  const css = await read("src/features/path/story-stele.css");
  assert.match(css, /aspect-ratio:772\/1536/);
  assert.match(css, /--stele-zone-left:23%/);
  assert.match(css, /--stele-zone-width:54%/);
  assert.match(css, /--stele-zone-top:14\.3%/);
  assert.match(css, /--stele-zone-bottom:16\.9%/);
  assert.match(css, /"Palatino Linotype","Book Antiqua",Palatino/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("cache busting points the app and service worker to 13.15.3", async () => {
  const index = await read("index.html");
  const bootstrap = await read("src/app/bootstrap.js");
  const appCss = await read("src/shared/styles/app.css");
  const sw = await read("service-worker.js");
  assert.match(index, /targetVersion = "13\.15\.3"/);
  assert.match(index, /\/src\/features\/path\/story-stele\.js/);
  assert.match(index, /app\.css\?v=13\.15\.3/);
  assert.match(index, /bootstrap\.js\?v=13\.15\.3/);
  assert.match(bootstrap, /RELEASE_VERSION = "13\.15\.3"/);
  assert.match(bootstrap, /router\.js\?v=13\.15\.3/);
  assert.match(appCss, /story-stele\.css\?v=13\.15\.3/);
  assert.doesNotMatch(appCss, /story-intro\.css/);
  assert.match(sw, /VERSION = "13\.15\.3"/);
  assert.match(sw, /story-stele\.avif\?v=13\.15\.3/);
});
