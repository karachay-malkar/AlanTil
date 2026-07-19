import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("test result answers use the shared one-line overflow motion", async () => {
  const view = await read("src/features/test/view.js");
  const css = await read("src/features/test/test.css");
  assert.match(view, /renderOverflowMarquee/);
  assert.match(view, /bindOverflowMarquees/);
  assert.match(css, /\.testResultAnswerLine\{[^}]*white-space:nowrap/s);
  assert.match(css, /grid-template-columns:auto minmax\(0,1fr\)/);
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
