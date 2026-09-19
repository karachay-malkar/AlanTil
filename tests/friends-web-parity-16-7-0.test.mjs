import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('Web Community hides Extended statistics until activity_access is explicitly allowed',()=>{
  const web=read('src/features/friends/index.js');
  const access=read('src/shared/admin/admin-access.js');
  const router=read('src/app/router.js');
  assert.match(access,/export async function refreshActivityAccessForUser\(userId\)/);
  assert.match(access,/\.from\("profiles"\)[\s\S]*\.select\("activity_access"\)[\s\S]*\.eq\("user_id", userId\)/);
  assert.match(web,/statsAccessState==='allowed'\?\[\{id:'stats',label:t\('extendedStats'\)\}\]:\[\]/);
  assert.match(web,/requestedStats=params\.mode==='stats'/);
  assert.match(web,/initialMode=params\.mode==='friends'\?'friends':'rating'/);
  assert.match(web,/statsAccessState=allowed\?'allowed':'denied';syncTabs\(context\)/);
  assert.match(web,/if\(requestedStats\)\{if\(allowed\)await selectMode\(context,'stats'\);else context\.router\.canonicalize\('friends\.home',\{\}\);\}/);
  assert.match(web,/renderAdminUsersEmbedded/);
  assert.match(web,/whenActivityAccessReady\(\)\.then[\s\S]*statsAccessState!=='allowed'[\s\S]*canonicalize\('friends\.home',\{\}\)/);
  assert.match(router,/guardAdminTarget/);
  assert.match(router,/hasActivityAccess\(\)/);
  assert.doesNotMatch(web+"\n"+access,/Taulu07|dfcf124e-735b-4caa-81d2-99eb5f02218d/i);
});

test('Community header and search use the shared transparent chrome controls',()=>{
  const web=read('src/features/friends/index.js');
  const css=read('src/features/friends/friends-16-7.css');
  const chrome=read('src/shared/styles/chrome.css');
  assert.match(web,/renderExpandableSearch/);
  assert.match(web,/class="expandSearchInput"/);
  assert.match(web,/data-social-search-toggle/);
  assert.match(chrome,/\[data-feature="friends"\] \.socialHeader\{[\s\S]*background:transparent!important/);
  assert.match(chrome,/\.socialBody,/);
  assert.match(css,/\.socialSearchBar\{[^}]*background:transparent/);
  assert.match(css,/background:var\(--system-control-bg\)/);
  assert.doesNotMatch(css,/\.socialHeader\{[^}]*background:(?!transparent)/);
});

test('Web Friends action icons use the same outline contract as mobile icons',()=>{
  const web=read('src/features/friends/index.js');
  const css=read('src/features/friends/friends-16-7.css');
  const mobile=read('mobile/screens/friends.js');
  for(const name of ['add','accept','decline','pending','friend','remove','block','unblock']){
    assert.match(web,new RegExp(`\\b${name}:'<svg`));
  }
  assert.match(css,/\.socialView \.iconAction svg\{[^}]*fill:none[^}]*stroke:currentColor[^}]*stroke-width:1\.8[^}]*stroke-linecap:round[^}]*stroke-linejoin:round[^}]*\}/);
  assert.match(mobile,/UserPlusIcon/);
  assert.match(mobile,/PendingIcon/);
  assert.match(mobile,/CorrectIcon/);
});
