import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const mobile=path.resolve(here,'..');
const read=(file)=>fs.readFileSync(path.join(mobile,file),'utf8');
const components=read('ui/components.js'),guide=read('ui/guide.js'),learn=read('screens/learn.js'),surface=read('ui/learn-surface.js'),songs=read('screens/songs.js'),pathScreen=read('screens/path.js'),pathState=read('platform/path-state.js');

test('round header/help controls keep Web geometry without Android elevation shadow',()=>{
  assert.match(components,/headerCircle:\{[\s\S]*?borderRadius:CH\.actionSize\/2[\s\S]*?elevation:0/);
  assert.match(components,/shadowColor:Platform\.OS==='android'\?'transparent':'#292721'/);
  assert.match(guide,/help:\{[\s\S]*?elevation:0[\s\S]*?overflow:'hidden'/);
});

test('Learn flips one shared card plane and keeps gradient mounted between keyed cards',()=>{
  assert.match(learn,/cardRotate=flip\.interpolate/);
  assert.match(learn,/styles\.cardFlip/);
  assert.match(learn,/backFace:\{[^}]*transform:\[\{rotateY:'180deg'\}\]/s);
  assert.doesNotMatch(learn,/frontOpacity=flip\.interpolate/);
  assert.doesNotMatch(learn,/backOpacity=flip\.interpolate/);
  assert.match(learn,/elevation:0/);
  assert.match(surface,/lastMeasuredSize=\{width:560,height:620\}/);
  assert.match(surface,/<Svg width="100%" height="100%" viewBox=/);
  assert.doesNotMatch(surface,/size\.width>0&&size\.height>0\?/);
});

test('Songs renders immediately from memory catalog and restores UI state without a blocking screen',()=>{
  assert.match(songs,/getNativeSongsMemoryCache/);
  assert.match(songs,/initialCatalog=initialSongs\.length\?initialSongs:getNativeSongsMemoryCache\(\)/);
  assert.match(songs,/songsUiMemory/);
  assert.match(songs,/uiDirty=React\.useRef\(false\)/);
  assert.doesNotMatch(songs,/if\(!navigationReady\)return <Screen>/);
  assert.match(songs,/const cached=getNativeSongsMemoryCache\(\);if\(cached\.length\)\{setSongs\(cached\);setLoading\(false\);\}/);
});

test('Path guide story focus switches optimistically and measurements refresh early',()=>{
  assert.match(pathScreen,/storyRef\.current=nextStory;offsetRef\.current=0;setSteleOpen\(false\);setActiveStory\(nextStory\);void saveNativeStoryScroll/);
  assert.match(pathScreen,/void storyTabsControlRef\.current\?\.scrollToStory\?\.\(next\.story,true\)/);
  assert.doesNotMatch(pathScreen,/setTimeout\(\(\)=>resolve\(true\),animated\?190:0\)/);
  assert.match(pathScreen,/requestAnimationFrame\(\(\)=>setGuideIndex\(nextIndex\)\)/);
  assert.match(guide,/timers=\[32,96,180,320\]/);
  assert.match(guide,/Promise\.all\(targetDefs\.map/);
  assert.match(pathState,/const activeStoryWrites=new Map\(\)/);
  assert.match(pathState,/key=nativeScopedStorageKey\(SETTINGS_KEY\)/);
  assert.match(pathState,/activeStoryWrites\.set\(key,operation\)/);
});
