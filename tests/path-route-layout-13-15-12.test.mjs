import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("13.15.12 keeps 60px path stations with a 25px vertical gap and clear catalog spacing", async () => {
  const pathStyles = await read("src/features/path/path.css");
  const appStyles = await read("src/shared/styles/app.css");
  assert.match(pathStyles, /\.pathView\{--station-size:60px;/);
  assert.match(pathStyles, /\.stationNode\{[^}]*width:var\(--station-size\);height:60px;min-height:60px;/);
  assert.match(appStyles, /--route-station-gap:25px/);
  assert.match(appStyles, /\.stationWordCount\{top:84px\}/);
  assert.match(appStyles, /\.pathView \.routeCatalogGroups\{padding-bottom:56px\}/);
});

test("13.15.12 lets story tabs use the full viewport width", async () => {
  const appStyles = await read("src/shared/styles/app.css");
  assert.match(appStyles, /\.pathStickyControls\{padding:0 0 2px!important\}/);
  assert.match(appStyles, /\.storyTabs\{[^}]*width:100%;[^}]*scroll-padding-inline:8px/);
  assert.match(appStyles, /\.storyTab:first-child\{margin-left:8px\}/);
  assert.match(appStyles, /\.storyTab:last-child\{margin-right:8px\}/);
});

test("13.15.12 repeats one global seven-step route wave", async () => {
  const appStyles = await read("src/shared/styles/app.css");
  const routeScale = await read("src/shared/ui/route-scale.js");
  assert.match(appStyles, /--route-wave-amplitude:clamp\(46px,16vw,64px\)/);
  for (let step = 1; step <= 7; step += 1) {
    assert.match(appStyles, new RegExp(`\\.stationNode\\[data-route-step="${step}"\\]`));
  }
  assert.match(routeScale, /const ROUTE_WAVE_STEPS = 7/);
  assert.match(routeScale, /node\.querySelector\("\.stationOrdinal"\)/);
  assert.match(routeScale, /node\.dataset\.routeStep = String\(\(sequenceIndex % ROUTE_WAVE_STEPS\) \+ 1\)/);
});

test("13.15.12 keeps one continuous dashed connector behind route stations", async () => {
  const styles = await read("src/features/path/path.css");
  const routeScale = await read("src/shared/ui/route-scale.js");
  assert.match(styles, /\.routeConnector\{[^}]*pointer-events:none/);
  assert.match(styles, /\.routeConnectorPath\{[^}]*stroke-width:1;[^}]*stroke-dasharray:3 7/);
  assert.match(routeScale, /function ensureRouteConnector\(routeMap\)/);
  assert.match(routeScale, /routeMap\.querySelectorAll\("\.stationNode"\)/);
  assert.match(routeScale, /d \+= ` C \$\{previous\.x\.toFixed\(2\)\}/);
});

test("13.15.12 cache-busts typography and application entrypoints", async () => {
  const index = await read("index.html");
  const appStyles = await read("src/shared/styles/app.css");
  const bootstrap = await read("src/app/bootstrap.js");
  const worker = await read("service-worker.js");
  assert.match(index, /data-text-size="medium"/);
  assert.match(index, /app\.css\?v=13\.15\.12/);
  assert.match(index, /bootstrap\.js\?v=13\.15\.12/);
  assert.match(appStyles, /theme\.css\?v=13\.15\.12/);
  assert.match(appStyles, /typography\.css\?v=13\.15\.12/);
  assert.match(bootstrap, /RELEASE_VERSION = "13\.15\.12"/);
  assert.match(worker, /const VERSION = "13\.15\.12\.3"/);
});