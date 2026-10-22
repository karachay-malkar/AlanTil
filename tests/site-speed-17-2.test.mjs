import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('guide and online games do not block startup',async()=>{
 const bootstrap=await read('src/app/bootstrap.js');
 const onboarding=await read('src/features/onboarding/index.js');
 assert.doesNotMatch(onboarding,/^import\s+["']\.\/guide\.js/m);
 assert.doesNotMatch(bootstrap,/^import .*createAshykOnlineAdapter/m);
 assert.doesNotMatch(bootstrap,/^import .*runLearningSetup/m);
 assert.match(bootstrap,/await router\.start\(\);[\s\S]*?requestIdleCallback\(installGuide/);
 assert.match(bootstrap,/import\("\.\.\/features\/onboarding\/index\.js/);
 assert.match(bootstrap,/import\("\.\.\/features\/onboarding\/guide\.js/);
});
test('Path styles are lazy and still available on every path route',async()=>{
 const app=await read('src/shared/styles/app.css');
 const css=await read('src/shared/styles/lazy/path.css');
 const registry=await read('src/app/screen-registry.js');
 const router=await read('src/app/router.js');
 for(const name of ['path.css','story-stele.css','story-word-list.css','path-navigation.css']){
   assert.ok(!app.includes('features/path/'+name));
   assert.ok(css.includes(name));
 }
 for(const name of ['path.home','path.story-words','path.station','path.study','path.test']){
   assert.match(registry,new RegExp('"'+name.replace('.','\\.')+'"[^\\n]*styles: \\[["path"]'));
 }
 assert.match(router,/path: "\/src\/shared\/styles\/lazy\/path\.css"/);
});
test('service worker and HTML refer to same code generation',async()=>{
 const index=await read('index.html'),bootstrap=await read('src/app/bootstrap.js'),sw=await read('service-worker.js');
 assert.match(index,/targetVersion = "17\.2\.1"/);
 assert.match(index,/bootstrap\.js\?v=17\.2\.1/);
 assert.match(bootstrap,/ASSET_VERSION = "17\.2\.1"/);
 assert.match(sw,/VERSION = "17\.2\.1"/);
});
