import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const release=JSON.parse(file('release.json'));
const version=release.version;

test('tower environment patch is a new release, not cached 17.2.11 code',()=>{
 assert.equal(release.branch,'17.2');
 assert.ok(Number(version.split('.')[2])>=12,
  'All changes to the tower world must advance the release beyond 17.2.11');
 const html=file('index.html');
 assert.ok(html.includes('name="alantil-app-version" content="'+version+'"'));
 assert.ok(html.includes('const targetVersion = "'+version+'"'));
 assert.ok(html.includes('src="/src/app/bootstrap.js?v='+version+'"'));
 const router=file('src/app/router.js');
 assert.ok(router.includes('const TOWER_ASSET_VERSION = "'+version+'"'));
 assert.ok(router.includes('const ASSET_VERSION = "'+version+'"'));
 const tower=file('src/features/tower/index.js');
 assert.ok(tower.includes("prefab-scene.js?v="+version));
 assert.ok(tower.includes('data-world'), 'The latest construction UI must expose the world button');
 assert.ok(file('src/features/tower/prefab-scene.js').includes('kunlum-real-environment.js?v='+version));
 assert.ok(file('src/shared/styles/lazy/tower.css').includes('tower.css?v='+version));
 const sw=file('service-worker.js');
 assert.ok(sw.includes('const VERSION = "'+version+'"'));
 assert.ok(sw.includes('alantil-runtime-'));
 assert.ok(sw.includes('event.respondWith(versionedCode ? cacheFirst(request)'));
 assert.ok(file('src/app/bootstrap.js').includes('service-worker.js?v=${ASSET_VERSION}'));
});
