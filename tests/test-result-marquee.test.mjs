import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("every result mode uses one row renderer and one overflow motion", async () => {
  const view = await read("src/features/test/view.js");
  const learn = await read("src/features/learn/results.js");
  const match = await read("src/features/match/view.js");
  const path = await read("src/features/path/index.js");
  const resultList = await read("src/shared/ui/result-list.js");
  const css = await read("src/shared/styles/components.css");
  for (const source of [view, learn, match, path]) {
    assert.match(source, /renderResultRow/);
    assert.match(source, /bindResultRows/);
  }
  assert.match(resultList, /renderOverflowMarquee/);
  assert.match(resultList, /bindOverflowMarquees/);
  assert.match(css, /\.resultListRow\{[^}]*height:80px[^}]*grid-template-columns:44px minmax\(0,1fr\) 44px/s);
  assert.match(css, /\.resultDetailLine\{[^}]*white-space:nowrap/s);
  assert.match(css, /\.resultStatus\{[^}]*background:transparent[^}]*border:0/s);
});

test("station list and test results share one marquee implementation", async () => {
  const station = await read("src/features/path/station-view.js");
  const components = await read("src/shared/styles/components.css");
  const pathCss = await read("src/features/path/path.css");
  assert.match(station, /bindOverflowMarquees/);
  assert.match(station, /renderOverflowMarquee/);
  assert.match(components, /@keyframes overflowTextMarquee/);
  assert.doesNotMatch(pathCss, /@keyframes stationWordMarquee/);
});
