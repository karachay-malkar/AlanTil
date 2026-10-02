import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { masteryLevelForPercent } from "../packages/alantil-core/mastery.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("set dioramas use exact progress fill, three app-logo marks, and slow background stars", async () => {
  const feature = await read("src/features/path/feature.js");
  const styles = await read("src/features/path/path.css");
  const iconBranch = feature.slice(feature.indexOf("if (iconName)"), feature.indexOf("const dictionaryId"));

  assert.equal(masteryLevelForPercent(79), 0);
  assert.equal(masteryLevelForPercent(80), 1);
  assert.equal(masteryLevelForPercent(89), 1);
  assert.equal(masteryLevelForPercent(90), 2);
  assert.equal(masteryLevelForPercent(99), 2);
  assert.equal(masteryLevelForPercent(100), 3);

  assert.match(feature, /masteryLevelForPercent/);
  assert.match(iconBranch, /--station-progress-percent:\${progress\.percent}%/);
  assert.match(iconBranch, /beginnerDioramaImageMuted/);
  assert.match(iconBranch, /beginnerDioramaImageProgress/);
  assert.match(iconBranch, /data-achievement-level="\${achievementLevel}"/);
  assert.match(iconBranch, /achievementLevel > 0 \? stationStarField\(station\.key\) : ""/);
  assert.doesNotMatch(iconBranch, /stationAchievementMarks/);
  assert.doesNotMatch(iconBranch, /stationAchievementLogo/);
  assert.doesNotMatch(iconBranch, /assets\/images\/logo\.png/);
  assert.match(feature, /STATION_STAR_COUNT = 12/);
  assert.match(feature, /STATION_STAR_ORBITS/);
  assert.match(feature, /STATION_STAR_SIZES = \[5, 6, 7, 8, 9, 10\]/);
  assert.match(feature, /stationStarRandom/);
  assert.match(feature, /stationStarField\(stationKey\)/);
  assert.match(feature, /length: STATION_STAR_COUNT/);

  assert.match(styles, /beginnerDioramaImageMuted\{[^}]*saturate\(\.4[0-9]?\)/);
  assert.match(styles, /beginnerDioramaImageProgress\{[^}]*clip-path:inset\(calc\(100% - var\(--station-progress-percent\)\) 0 0 0\)/);
  assert.doesNotMatch(styles, /stationAchievementMarks/);
  assert.doesNotMatch(styles, /stationAchievementLogo/);
  assert.match(styles, /#D09A43/i);
  assert.match(styles, /data-achievement-level="0"[^}]*stationStarField/);
  assert.match(styles, /stationOrbitStar\.isReverse/);
  assert.match(styles, /@keyframes stationDioramaStars/);
  assert.match(styles, /@keyframes stationDioramaOrbit/);
  assert.match(styles, /@keyframes stationDioramaOrbitReverse/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)[\s\S]*stationOrbitStar/);
  assert.doesNotMatch(styles, /beginnerDioramaImage\{[^}]*grayscale\(1\) saturate\(0\)/);
});

test("live path progress refresh updates exact fill and passed-set star field without remounting", async () => {
  const feature = await read("src/features/path/feature.js");
  const refreshStart = feature.indexOf("function refreshRouteProgressInPlace");
  const refreshEnd = feature.indexOf("function bindStoryTabs", refreshStart);
  const refresh = feature.slice(refreshStart, refreshEnd);

  assert.ok(refreshStart >= 0 && refreshEnd > refreshStart);
  assert.match(refresh, /--station-progress-percent/);
  assert.match(refresh, /data-station-progress-percent/);
  assert.match(refresh, /masteryLevelForPercent\(wordProgress\.percent\)/);
  assert.match(refresh, /data-achievement-level/);
  assert.match(refresh, /stationStarField\(station\.key\)/);
  assert.match(refresh, /insertAdjacentHTML\("afterbegin"/);
  assert.match(refresh, /stars\.remove\(\)/);
  assert.doesNotMatch(refresh, /stationAchievementLogo/);
});
