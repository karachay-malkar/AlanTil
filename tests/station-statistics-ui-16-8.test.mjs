import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("set statistics use one memory graph, history dialog and three problem columns", async()=>{
  const view=await read("src/features/path/station-view.js");
  const stats=await read("src/features/path/station-statistics.js");
  const css=await read("src/features/path/path.css");
  assert.match(view,/renderStationStatistics\(station\)/);
  assert.doesNotMatch(view,/stationMetricGrid|stationMasteryBadge|recentTestSummariesForWords/);
  assert.match(stats,/stage\.progress_memory/);
  assert.match(stats,/data-station-history/);
  assert.match(stats,/data-history-mode="learn"/);
  assert.match(stats,/data-history-mode="tests"/);
  assert.match(stats,/stage\.shows_per_word/);
  assert.match(stats,/stage\.test_errors/);
  assert.match(css,/\.stationMemoryChart/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\) minmax\(82px,\.58fr\) minmax\(82px,\.58fr\)/);
});

test("native station statistics use the shared statistics surface", async()=>{
  const station=await read("mobile/screens/station.js");
  const stats=await read("mobile/ui/station-statistics.js");
  assert.match(station,/StationStatistics/);
  assert.match(stats,/getNativeStationStatistics/);
  assert.match(stats,/ProfileTabs/);
  assert.match(stats,/showsPerWord/);
  assert.match(stats,/testErrors/);
});
