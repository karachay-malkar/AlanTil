import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=(relative)=>fs.readFileSync(path.join(root,relative),'utf8');

test('16.6.3 audit correction keeps auth bootstrap ahead of scoped storage hydration',()=>{
  const source=read('mobile/AppRoot.js');
  const bootstrap=source.indexOf('await bootstrapNativeAuth()');
  const scoped=source.indexOf("Promise.allSettled([loadNativeSettings(),loadNativeFavorites(),loadNativeSongFavorites()])",bootstrap);
  assert.ok(bootstrap>=0&&scoped>bootstrap,'auth must establish storage scope before scoped state is read');
  assert.match(source,/await synchronizeNativeAccount\(\)/);
  assert.match(source,/nextUserId===authUserId\.current/);
  assert.doesNotMatch(source,/Promise\.all\(\[/);
  assert.match(source,/key=\{`path-\$\{dataEpoch\}`\}/);
  assert.match(source,/key=\{`profile-\$\{dataEpoch\}`\}/);
});

test('16.6.3 account synchronization is single-flight',()=>{
  const source=read('mobile/platform/cloud-sync.js');
  assert.match(source,/let flushing=null,synchronizing=null/);
  assert.match(source,/if\(synchronizing\)return synchronizing/);
  assert.match(source,/synchronizing=\(async\(\)=>/);
  assert.match(source,/\.finally\(\(\)=>\{synchronizing=null;\}\)/);
});

test('16.6.3 audit correction restores consent-gated native analytics runtime',()=>{
  const analytics=read('mobile/platform/analytics.js');
  const progress=read('mobile/platform/progress.js');
  assert.match(analytics,/record_anonymous_visit/);
  assert.match(analytics,/loadNativeAnalyticsPreference/);
  assert.match(analytics,/EVENTS\.SCREEN_TIME/);
  assert.match(progress,/EVENTS\.ACTIVITY_COMPLETE/);
  assert.match(progress,/EVENTS\.WORD_RESULT/);
});

test('16.6.3 guide supports interactive spotlight proxies and continuous target tracking',()=>{
  const source=read('mobile/ui/guide.js');
  assert.match(source,/interactiveTarget/);
  assert.match(source,/targetProxy/);
  assert.match(source,/setInterval\(measure,140\)/);
});

test('16.6.3 learn restores web card presentation primitives',()=>{
  const source=read('mobile/screens/learn.js');
  assert.match(source,/rotateY:frontRotate/);
  assert.match(source,/rotateY:backRotate/);
  assert.match(source,/backfaceVisibility:'hidden'/);
  assert.match(source,/groups\.length>1/);
  assert.match(source,/unknownTarget/);
  assert.match(source,/knownTarget/);
});

test('16.6.3 navigation uses canonical Web practice and profile glyphs',()=>{
  const source=read('mobile/ui/icons.js');
  assert.match(source,/PracticeIcon[\s\S]*M4 4h7v7H4V4/);
  assert.match(source,/ProfileIcon[\s\S]*M12 12a5 5 0 1 0 0-10/);
});

test('16.6.3 station result details use overflow marquee contract',()=>{
  const source=read('mobile/screens/station-test.js');
  assert.match(source,/OverflowMarquee/);
  assert.match(source,/function ResultText/);
  assert.match(source,/detailValue/);
  assert.doesNotMatch(source,/resultPrimary[^\n]*numberOfLines/);
});

test('16.6.3 songs reuse canonical localized Web metadata labels',()=>{
  const source=read('mobile/screens/songs.js');
  assert.match(source,/songs\.ispolnitel/);
  assert.match(source,/songs\.pleylist/);
  assert.match(source,/songs\.informatsiya_o_pesne/);
  assert.doesNotMatch(source,/>ARTIST</);
  assert.doesNotMatch(source,/>PLAYLIST</);
  assert.doesNotMatch(source,/accessibilityLabel="Info"/);
});
