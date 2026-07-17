import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const stationView = await readFile(new URL("../src/features/path/station-view.js", import.meta.url), "utf8");
const chromeCss = await readFile(new URL("../src/shared/styles/chrome.css", import.meta.url), "utf8");

test("stage words are static while only overflowing translations use the marquee", () => {
  assert.match(stationView, /staticLine\(word\.word, "contentListPrimary"\)/);
  assert.match(stationView, /scrollingLine\(word\.trans, "contentListSecondary"\)/);
  assert.doesNotMatch(stationView, /scrollingLine\(word\.word/);
});

test("stage rows reserve fixed left-aligned content and action columns", () => {
  assert.match(chromeCss, /\.stationWordRow\{[^}]*grid-template-columns:36px minmax\(0,1fr\) 36px/s);
  assert.match(chromeCss, /\.stationWordRow>\.contentListMain\{[^}]*grid-column:2[^}]*text-align:left/s);
  assert.match(chromeCss, /\.stationWordRow \.contentListPrimary\{[^}]*text-align:left[^}]*transform:none!important/s);
});
