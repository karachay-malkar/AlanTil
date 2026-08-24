import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("13.15.11 keeps path stations compact at 60px", async () => {
  const styles = await read("src/features/path/path.css");
  assert.match(styles, /\.pathView\{--station-size:60px;--route-station-gap:43px;/);
  assert.match(styles, /\.stationNode\{[^}]*width:var\(--station-size\);height:60px;min-height:60px;/);
  assert.match(styles, /\.stationProgressRing\{width:var\(--station-size\);height:var\(--station-size\);/);
});

test("13.15.11 draws one continuous dashed connector behind route stations", async () => {
  const styles = await read("src/features/path/path.css");
  const routeScale = await read("src/shared/ui/route-scale.js");
  assert.match(styles, /\.routeConnector\{[^}]*pointer-events:none/);
  assert.match(styles, /\.routeConnectorPath\{[^}]*stroke-width:1;[^}]*stroke-dasharray:3 7/);
  assert.match(routeScale, /function ensureRouteConnector\(routeMap\)/);
  assert.match(routeScale, /routeMap\.querySelectorAll\("\.stationNode"\)/);
  assert.match(routeScale, /d \+= ` C \$\{previous\.x\.toFixed\(2\)\}/);
  assert.match(routeScale, /window\.addEventListener\("resize", measureAndRender/);
});

test("13.15.11 cache-busts the path stylesheet and connector module", async () => {
  const index = await read("index.html");
  const appStyles = await read("src/shared/styles/app.css");
  const bootstrap = await read("src/app/bootstrap.js");
  const worker = await read("service-worker.js");
  assert.match(index, /app\.css\?v=13\.15\.11/);
  assert.match(index, /bootstrap\.js\?v=13\.15\.11/);
  assert.match(index, /\/src\/shared\/ui\/route-scale\.js/);
  assert.match(appStyles, /path\.css\?v=13\.15\.11/);
  assert.match(bootstrap, /RELEASE_VERSION = "13\.15\.11"/);
  assert.match(worker, /const VERSION = "13\.15\.11"/);
});
