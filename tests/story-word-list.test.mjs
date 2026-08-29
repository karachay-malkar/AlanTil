import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("story word list is a routed read-only path screen",async()=>{
  const [feature,list,router,registry]=await Promise.all([read("src/features/path/feature.js"),read("src/features/path/story-word-list.js"),read("src/app/router.js"),read("src/app/screen-registry.js")]);
  assert.match(feature,/path\.story-words/);
  assert.match(feature,/list-checks\.svg/);
  assert.match(router,/third === "words"/);
  assert.match(router,/path\.story-words/);
  assert.match(registry,/"path\.story-words"/);
  assert.match(list,/setHeaderContent\?\.\(\{ title: msg\("common\.spisok_slov"\) \}\)/);
  assert.doesNotMatch(list,/role="dialog"|storyWordsOverlay|startStudy|startTest|data-start/);
});

test("story word list search lives in shell header and never auto-focuses on mount",async()=>{
  const list=await read("src/features/path/story-word-list.js");
  assert.match(list,/setHeaderAction/);
  assert.match(list,/storyWordHeaderSearchInput/);
  assert.match(list,/storyWordSearchToggle/);
  assert.match(list,/requestAnimationFrame\(\(\) => input\?\.focus/);
  assert.doesNotMatch(list,/\.focus\([^)]*\).*renderStoryWordList/s);
});

test("story and favorite word lists use shared one-line marquee",async()=>{
  const [story,favorites]=await Promise.all([read("src/features/path/story-word-list.js"),read("src/features/learn/set-preparation.js")]);
  for(const source of [story,favorites]){assert.match(source,/renderOverflowMarquee/);assert.match(source,/bindOverflowMarquees/);}
  assert.equal(story.includes("<small>${escapeHtml(entry.word.trans)}</small>"), false);
  assert.doesNotMatch(favorites,/secondary:\s*word\.trans/);
});

test("list preserves story order, numbering and thematic section markers",async()=>{
  const list=await read("src/features/path/story-word-list.js");
  for(const token of [/story\?\.catalogs/,/catalog\.sections/,/section\.stations/,/station\.words/,/seen\.has/,/storyWordSection/,/ordinal:\s*\+\+ordinal/])assert.match(list,token);
});
