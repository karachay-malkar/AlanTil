import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const release=JSON.parse(await read('release.json'));

test('17.2 release metadata matches Web, SW, Android and analytics',async()=>{
 assert.equal(release.branch,'17.2');assert.equal(release.version,'17.2.1');
 const [index,boot,router,worker,core,analytics]=await Promise.all(
 ['index.html','src/app/bootstrap.js','src/app/router.js','service-worker.js','packages/alantil-core/release.js','src/config/analytics.js'].map(read));
 assert.match(index,/targetVersion = "17\.2\.1"/);
 assert.match(boot,/ASSET_VERSION = "17\.2\.1"/);
 assert.match(router,/ASSET_VERSION = "17\.2\.1"/);
 assert.match(worker,/VERSION = "17\.2\.1"/);
 assert.match(core,/APP_VERSION = "17\.2\.1"/);
 assert.match(core,/WEB_DEPLOY_BRANCH = "17\.2"/);
 assert.match(analytics,/appVersion = APP_VERSION/);
 const app=JSON.parse(await read('mobile/app.json'));
 const pkg=JSON.parse(await read('mobile/package.json'));
 assert.equal(app.expo.version,'17.2.1');
 assert.equal(app.expo.android.versionCode,44);
 assert.equal(app.expo.extra.releaseVersion,'17.2.1');
 assert.equal(pkg.version,'17.2.1');
});
test('release generator detects drift and reports one source of truth',()=>{
 const script=new URL('../scripts/release/sync-version.mjs',import.meta.url);
 const text=execFileSync(process.execPath,[script.pathname,'--check'],{encoding:'utf8',env:{...process.env,GITHUB_REF_NAME:'17.2'}});
 assert.match(text,/17\.2\.1 branch 17\.2 — verified/);
});
