import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
test('bracket navigation preserves full labels and scrolls only when they exceed the row',async()=>{
 const css=await read('src/shared/styles/bracket-tabs.css'),renderer=await read('src/shared/ui/profile-navigation.js');
 assert.match(renderer,/profilePrimaryNav bracketTabsShell/);assert.match(renderer,/bracketTabsTrack/);
 for(const token of ['grid-auto-columns:minmax(max-content,1fr)','overflow-x:auto','white-space']){
  if(token==='white-space')assert.match(await read('src/shared/styles/typography.css'),/white-space:nowrap/);
  else assert.ok(css.includes(token));
 }
 assert.match(css,/max-width:none;overflow:visible;text-overflow:clip/);
 assert.match(await read('src/shared/ui/bracket-tabs.js'),/scrollWidth-track.clientWidth-track.scrollLeft/);
});
test('bracket navigation refreshes its assets with the current Web build',async()=>{
 const release=await read('packages/alantil-core/release.js'),build=/WEB_BUILD_VERSION = "([^"]+)"/.exec(release)[1];
 const worker=await read('service-worker.js'),html=await read('index.html'),app=await read('src/shared/styles/app.css');
 assert.ok(worker.includes(`const VERSION = "${build}"`));
 assert.ok(worker.includes(`/src/shared/ui/bracket-tabs.js?v=${build}`));
 assert.ok(html.includes(`/src/shared/ui/bracket-tabs.js?v=${build}`));
 assert.ok(app.includes(`bracket-tabs.css?v=${build}`));
});
