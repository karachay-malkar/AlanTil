import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CORE_PATH_CONFIG } from "../packages/alantil-core/path-config.js";
import { buildLearningRoute } from "../packages/alantil-core/learning-route.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function routeWord(id, storyId, globalOrder) {
  return {
    id,
    story_id: storyId,
    story_name: storyId === "roots" ? "Возвращение к истокам" : "Начать понимать",
    story_order: storyId === "understanding" ? 1 : 2,
    dictionary_id: "level",
    dictionary_name: "Level",
    section_id: `section-${storyId}`,
    section_name: "Section",
    set_id: "set-1",
    set_name: "Set",
    global_order: globalOrder,
  };
}

test("16.8 Path uses roots as the default without reordering story tabs", () => {
  assert.equal(CORE_PATH_CONFIG.defaultStoryType, "roots");
  assert.deepEqual(CORE_PATH_CONFIG.storyOrder, ["understanding", "roots", "ascent", "pathways"]);
  const route = buildLearningRoute([
    routeWord("u1", "understanding", 1),
    routeWord("r1", "roots", 2),
  ]);
  assert.deepEqual(route.storyOrder, ["understanding", "roots"]);
  assert.equal(route.defaultStoryType, "roots");
});

test("Web root and bottom-nav Path entry resolve to roots while explicit story URLs remain supported", async () => {
  const [router, bootstrap, feature] = await Promise.all([
    read("src/app/router.js"),
    read("src/app/bootstrap.js"),
    read("src/features/path/feature.js"),
  ]);
  assert.match(router, /const DEFAULT_STORY = "roots"/);
  assert.match(router, /String\(second \|\| DEFAULT_STORY\)/);
  assert.match(router, /\["home", "path\.home"\]\.includes\(route\).*nextParams\.storyType = DEFAULT_STORY/);
  assert.match(bootstrap, /\/path\/roots/);
  assert.doesNotMatch(bootstrap, /\/path\/understanding/);
  assert.match(feature, /screen==="home"\?route\.defaultStoryType:getRouteSettings\(\)\.active_story/);
});

test("Mobile Path entry prefers the explicit entry target over stored active_story", async () => {
  const [appRoot, pathScreen, pathState] = await Promise.all([
    read("mobile/AppRoot.js"),
    read("mobile/screens/path.js"),
    read("mobile/platform/path-state.js"),
  ]);
  assert.match(pathState, /DEFAULT_NATIVE_STORY='roots'/);
  assert.match(appRoot, /if\(next==='path'\)setPathEntryStory\(route\.defaultStoryType\|\|'roots'\)/);
  assert.match(appRoot, /if\(nextStation\?\.storyType\)setPathEntryStory\(nextStation\.storyType\)/);
  assert.match(appRoot, /setPathEntryStory\(storyType\);setTab\('path'\)/);
  assert.match(appRoot, /initialStory=\{pathEntryStory\|\|route\.defaultStoryType\}/);
  assert.match(pathScreen, /configuredDefault=route\.stories\?\.\[route\.defaultStoryType\]\?route\.defaultStoryType/);
  assert.match(pathScreen, /const restored=route\.stories\?\.\[defaultStory\]\?defaultStory:/);
});
test("Changing the default does not rewrite the historical oblivion to understanding migration", async () => {
  const [webStore, nativeStore] = await Promise.all([
    read("src/shared/progress/route-settings-store.js"),
    read("mobile/platform/path-state.js"),
  ]);
  assert.match(webStore, /LEGACY_STORY_REPLACEMENT_ID = "understanding"/);
  assert.match(webStore, /next\.active_story = LEGACY_STORY_REPLACEMENT_ID/);
  assert.match(nativeStore, /LEGACY_STORY_REPLACEMENT='understanding'/);
  assert.match(nativeStore, /raw===LEGACY_STORY_ID\?LEGACY_STORY_REPLACEMENT:raw/);
  assert.match(nativeStore, /story===LEGACY_STORY_REPLACEMENT/);
});

