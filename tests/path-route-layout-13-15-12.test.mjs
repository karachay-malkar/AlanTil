import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("13.15.12 keeps 60px path stations with a 25px vertical gap", async () => {
  const pathStyles = await read("src/features/path/path.css");
  const appStyles = await read("src/shared/styles/app.css");
  assert.match(pathStyles, /\.pathView\{--station-size:60px;/);
  assert.match(pathStyles, /\.stationNode\{[^}]*width:var\(--station-size\);height:60px;min-height:60px;/);
  assert.match(appStyles, /\.pathView\{--route-station-gap:25px\}/);
  assert.match(appStyles, /\.stationWordCount\{top:84px\}/);
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
  assert.match(worker, /const VERSION = "13\.15\.12"/);
});
