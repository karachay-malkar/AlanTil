import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import path from'node:path';
import{execFileSync}from'node:child_process';
import{fileURLToPath}from'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const png=p=>fs.readFileSync(path.join(ROOT,p));
execFileSync(process.execPath,[path.join(ROOT,'mobile/tools/generate-app-icons.mjs')],{stdio:'ignore'});

test('Mobile Path defaults fresh installs to roots while stored story keeps priority',()=>{const source=read('mobile/platform/path-state.js');assert.match(source,/DEFAULT_NATIVE_STORY='roots'/);assert.match(source,/saved\?\.active_story\|\|DEFAULT_NATIVE_STORY/);assert.match(source,/route_settings_v13_1/);assert.doesNotMatch(read('packages/alantil-core/path-config.js'),/defaultStoryType:\s*["']roots["']/);});

test('16.6.14 generates the supplied filled Alan Til launcher artwork',()=>{const config=JSON.parse(read('mobile/app.json')),pkg=JSON.parse(read('mobile/package.json')),generator=read('mobile/tools/generate-app-icons.mjs');assert.equal(config.expo.version,'16.6.14');assert.equal(config.expo.android.versionCode,39);assert.equal(config.expo.ios.buildNumber,'39');assert.equal(config.expo.extra.releaseVersion,'16.6.14');assert.equal(pkg.version,'16.6.14');assert.equal(config.expo.icon,'./assets/branding/alantil-icon.png');assert.equal(config.expo.android.adaptiveIcon.foregroundImage,'./assets/branding/alantil-adaptive-foreground.png');assert.equal(config.expo.android.adaptiveIcon.backgroundColor,'#fcf7f1');assert.doesNotMatch(read('mobile/app.json'),/osuyat-icon\.png/);assert.match(generator,/BG=\[252,247,241\],FG=\[61,51,41\]/);assert.match(generator,/\[157,623\]/);assert.match(generator,/\[871,623\]/);const legacy=png('mobile/assets/branding/alantil-icon.png'),adaptive=png('mobile/assets/branding/alantil-adaptive-foreground.png');for(const image of[legacy,adaptive]){assert.equal(image.subarray(1,4).toString(),'PNG');assert.equal(image.readUInt32BE(16),1024);assert.equal(image.readUInt32BE(20),1024);}});
