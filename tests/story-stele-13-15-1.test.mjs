import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("story stele keeps scoped seen state and uses the approved WebP artwork", async () => {
  const source = await read("src/features/path/story-stele.js");
  const artwork = await readFile(new URL("../assets/path/story-stele.webp", import.meta.url));
  assert.match(source, /alantil_story_intro_seen_v1/);
  assert.match(source, /readScopedJson/);
  assert.match(source, /writeScopedJson/);
  assert.match(source, /story-stele\.webp\?v=13\.15\.6/);
  assert.match(source, /✦/);
  assert.match(source, /autoOpen && !hasSeenStoryStele\(storyId\)/);
  assert.equal(artwork.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(artwork.subarray(8, 12).toString("ascii"), "WEBP");
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
  assert.match(css, /background:rgba\(22,20,17,\.72\)/);
  assert.match(css, /storySteleDialog[\s\S]*pointer-events:none/);
  assert.match(css, /storySteleCard[\s\S]*pointer-events:auto/);
});

test("production stele geometry matches the approved 932 by 1688 artwork", async () => {
  const css = await read("src/features/path/story-stele.css");
  assert.match(css, /aspect-ratio:932\/1688/);
  assert.match(css, /--stele-zone-left:22%/);
  assert.match(css, /--stele-zone-width:56%/);
  assert.match(css, /--stele-zone-top:18\.3%/);
  assert.match(css, /--stele-zone-bottom:13\.5%/);
  assert.match(css, /width:min\(calc\(100vw - 6px\),53dvh,932px\)/);
  assert.match(css, /"Palatino Linotype","Book Antiqua",Palatino/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("text remains live HTML with the approved high-contrast mountain-stone palette", async () => {
  const source = await read("src/features/path/story-stele.js");
  const css = await read("src/features/path/story-stele.css");
  assert.match(source, /<h2 class="storySteleTitle"/);
  assert.match(source, /<div class="storySteleBody" data-stele-scroll>/);
  assert.match(css, /storySteleTitle[\s\S]*color:#F0E3CB/);
  assert.match(css, /storySteleBody[\s\S]*color:#E6DDCC/);
  assert.match(css, /storySteleCard::before[\s\S]*color:#D09A43/);
  assert.match(css, /--stele-zone-width:56%/);
});

test("path trigger and route scale share one axis with a soft four-point-star pulse", async () => {
  const css = await read("src/features/path/story-stele.css");
  assert.match(css, /\.storySteleTrigger\{[\s\S]*right:8px;top:80%/);
  assert.match(css, /\.pathView>\.routeScale\{right:12px\}/);
  assert.match(css, /@media\(max-width:360px\)\{\.storySteleTrigger\{width:32px;height:58px;right:9px\}/);
  assert.match(css, /storySteleTrigger::before/);
  assert.match(css, /storySteleStarPulse 4\.8s ease-in-out infinite/);
  assert.match(css, /storySteleStarHalo 4\.8s ease-in-out infinite/);
  assert.match(css, /storySteleCard::before[\s\S]*content:"✦"/);
});

test("study action uses the normal light button without changing its handler", async () => {
  const source = await read("src/features/path/station-view.js");
  assert.match(source, /class="btn stationStudyButton"/);
  assert.doesNotMatch(source, /class="btn actionText stationStudyButton"/);
  assert.match(source, /\[data-station-study\][\s\S]*onStartStudy\?\.\(studyMode, activeWords\(\)\)/);
});

test("current release preserves lazy story stele artwork and cache coherence", async () => {
  const index = await read("index.html");
  const bootstrap = await read("src/app/bootstrap.js");
  const appCss = await read("src/shared/styles/app.css");
  const worker = await read("service-worker.js");
  const stele = await read("src/features/path/story-stele.js");
  assert.match(index, /targetVersion = "16\.7\.13"/);
  assert.match(index, /bootstrap\.js\?v=16\.7\.13/);
  assert.match(bootstrap, /RELEASE_VERSION = "16\.7\.13"/);
  assert.match(appCss, /story-stele\.css/);
  assert.match(worker, /VERSION = "16\.7\.13-on-demand-path"/);
  assert.doesNotMatch(worker, /story-stele\.webp\?v=13\.15\.6/);
  assert.match(stele, /artwork\.src = artwork\.dataset\.src/);
});

test("stele image reserves approved dimensions and decodes off the rendering path", async () => {
  const source = await read("src/features/path/story-stele.js");
  assert.match(source, /class="storySteleArtwork" data-src="\$\{ASSET_URL\}" width="932" height="1688" decoding="async"/);
  assert.match(source, /artwork\.src = artwork\.dataset\.src/);
});
