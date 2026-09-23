import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("16.7 release version has one shared source for Web and Mobile runtime", async () => {
  const release = await read("packages/alantil-core/release.js");
  const analytics = await read("src/config/analytics.js");
  const versionScreen = await read("src/features/settings/version.js");
  const mobileAnalytics = await read("mobile/platform/analytics.js");
  const mobileApp = JSON.parse(await read("mobile/app.json"));
  const mobilePackage = JSON.parse(await read("mobile/package.json"));

  assert.match(release, /APP_VERSION = "16[.]7[.]0"/);
  assert.match(release, /WEB_BUILD_VERSION = "16[.]7[.]0[.]30"/);
  assert.match(analytics, /appVersion = APP_VERSION/);
  assert.doesNotMatch(analytics, /13[.]15[.]9/);
  assert.match(versionScreen, /APP_VERSION/);
  assert.doesNotMatch(versionScreen, /<dd>13[.]15[.]12<\/dd>/);
  assert.match(mobileAnalytics, /alantil-core\/release[.]js/);
  assert.doesNotMatch(mobileAnalytics, /const APP_VERSION='16[.]7[.]0'/);
  assert.equal(mobileApp.expo.version, "16.7.0");
  assert.equal(mobileApp.expo.extra.releaseVersion, "16.7.0");
  assert.equal(mobileApp.expo.extra.architecture, "shared-core-16.7.0");
  assert.equal(mobilePackage.version, "16.7.0");
});

test("diorama labels are structurally below their own image without absolute positioning", async () => {
  const feature = await read("src/features/path/feature.js");
  const pathStyles = await read("src/features/path/path.css");
  const appStyles = await read("src/shared/styles/app.css");

  assert.match(feature, /<span class="stationLabel beginnerDioramaLabel">/);
  assert.doesNotMatch(feature, /beginnerDioramaLabel" style=/);
  assert.match(pathStyles, /beginnerDioramaNode\{width:168px;height:auto;min-height:148px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:6px/);
  assert.match(pathStyles, /beginnerDioramaFrame\{[^}]*top:auto[^}]*flex:0 0 118px/);
  assert.match(pathStyles, /beginnerDioramaLabel\{position:static;[^}]*flex:0 0 auto/);
  assert.doesNotMatch(appStyles, /top:126px!important/);
});
