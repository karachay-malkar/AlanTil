import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const release=JSON.parse(await read('release.json'));

test('Release version follows branch and matches Web, SW, Android and analytics',async()=>{
 const branch=release.branch,version=release.version;
 assert.equal(branch,'17.2');
 assert.ok(version.startsWith(branch+'.'),'version must start with branch name');
 const [index,boot,router,worker,core,analytics]=await Promise.all(
 ['index.html','src/app/bootstrap.js','src/app/router.js','service-worker.js','packages/alantil-core/release.js','src/config/analytics.js'].map(read));
 for(const [source,marker] of [
  [index,'targetVersion = "'+version+'"'],
  [boot,'ASSET_VERSION = "'+version+'"'],
  [router,'ASSET_VERSION = "'+version+'"'],
  [worker,'VERSION = "'+version+'"'],
  [core,'APP_VERSION = "'+version+'"'],
  [core,'WEB_DEPLOY_BRANCH = "'+branch+'"'],
 ])assert.ok(source.includes(marker),'missing '+marker);
 assert.match(analytics,/appVersion = APP_VERSION/);
 const app=JSON.parse(await read('mobile/app.json'));
 const pkg=JSON.parse(await read('mobile/package.json'));
 assert.equal(app.expo.version,version);
 assert.equal(app.expo.android.versionCode,release.android_version_code);
 assert.equal(app.expo.ios.buildNumber,String(release.android_version_code));
 assert.equal(app.expo.extra.releaseVersion,version);
 assert.equal(pkg.version,version);
});
test('Release generator verifies checked-in files and the active numbered branch',()=>{
 const script=new URL('../scripts/release/sync-version.mjs',import.meta.url);
 const text=execFileSync(process.execPath,[script.pathname,'--check'],{
  encoding:'utf8',env:{...process.env,GITHUB_REF_NAME:release.branch}
 });
 assert.ok(text.includes('AlanTil '+release.version+' branch '+release.branch+' — verified'));
});
