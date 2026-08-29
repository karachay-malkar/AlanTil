import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("story list trigger shares the left guide control stack",async()=>{
  const [css,guide]=await Promise.all([read("src/features/path/story-word-list.css"),read("src/features/onboarding/guide.js")]);
  assert.match(guide,/\.alantilGuideTrigger\{[^}]*left:10px;top:80%/s);
  assert.match(css,/\.storyWordsTrigger\{[^}]*left:10px;top:calc\(80% - 46px\)/s);
  assert.match(css,/\.storyWordsTrigger img\{[^}]*width:19px;height:19px/s);
  assert.doesNotMatch(css,/\.storyWordsTrigger\{[^}]*right:/s);
});

test("story list reuses station row typography and transparent path surface",async()=>{
  const [list,css]=await Promise.all([read("src/features/path/story-word-list.js"),read("src/features/path/story-word-list.css")]);
  assert.match(list,/contentListRow stationWordRow storyWordRow/);
  assert.match(list,/contentListPrimary stationTextClip stationStaticText/);
  assert.match(list,/contentListSecondary stationTextClip/);
  assert.match(css,/background:var\(--path-scene-gradient\)/);
  assert.match(css,/background:transparent!important/);
});
