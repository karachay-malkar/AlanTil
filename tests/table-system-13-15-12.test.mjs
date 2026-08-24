import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("table geometry follows the three text-size modes from one shared source", async () => {
  const css = await read("src/shared/styles/table-system.css");
  assert.match(css, /data-text-size="small"[\s\S]*--table-row-height:46px/);
  assert.match(css, /data-text-size="medium"[\s\S]*--table-row-height:52px/);
  assert.match(css, /data-text-size="large"[\s\S]*--table-row-height:64px/);
  assert.match(css, /--table-head-height:38px/);
  assert.match(css, /\.stationWordRow[\s\S]*height:var\(--table-row-height\)/);
  assert.match(css, /\.adminUsersTable tbody tr\{height:var\(--table-row-height\)\}/);
});

test("long table values and station header use managed right-to-left overflow motion", async () => {
  const layout = await read("src/shared/ui/adaptive-layout.js");
  const css = await read("src/shared/styles/table-system.css");
  const index = await read("index.html");
  assert.match(layout, /appHeaderScreenTitle/);
  assert.match(layout, /stationWordRow \.stationStaticText/);
  assert.match(layout, /adminUsersTable/);
  assert.match(layout, /--marquee-distance/);
  assert.match(css, /translateX\(calc\(-1 \* var\(--marquee-distance/);
  assert.match(index, /adaptive-layout\.js\?v=13\.15\.12\.5/);
});

test("path labels reserve room for two lines and keep the count below the title", async () => {
  const app = await read("src/shared/styles/app.css");
  const layout = await read("src/shared/ui/adaptive-layout.js");
  assert.match(app, /data-text-size="large"[^\n]*--route-station-gap:72px/);
  assert.match(app, /\.stationMeta\{/);
  assert.match(app, /-webkit-line-clamp:2/);
  assert.match(app, /\.stationMeta \.stationWordCount\{position:static/);
  assert.match(app, /routeSectionStations\{padding-bottom:var\(--route-station-meta-reserve/);
  assert.match(layout, /function ensureStationMeta/);
});
