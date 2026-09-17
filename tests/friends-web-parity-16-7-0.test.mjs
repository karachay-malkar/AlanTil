import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('Web Friends resolves activity_access for the authenticated user before rendering tabs',()=>{
  const web=read('src/features/friends/index.js');
  const access=read('src/shared/admin/admin-access.js');
  const router=read('src/app/router.js');
  assert.match(access,/export async function refreshActivityAccessForUser\(userId\)/);
  assert.match(access,/\.from\("profiles"\)[\s\S]*\.select\("activity_access"\)[\s\S]*\.eq\("user_id", userId\)/);
  assert.match(web,/refreshActivityAccessForUser\(context\.selfId\)/);
  assert.match(web,/const showStats=await refreshActivityAccessForUser\(context\.selfId\)\.catch\(\(\)=>false\);[\s\S]*shellHtml\(showStats\)/);
  assert.match(web,/extendedStats/);
  assert.match(router,/guardAdminTarget/);
  assert.match(router,/hasActivityAccess\(\)/);
  assert.doesNotMatch(`${web}\n${access}`,/Taulu07|dfcf124e-735b-4caa-81d2-99eb5f02218d/i);
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
