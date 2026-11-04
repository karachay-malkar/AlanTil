import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mayOpenTower,TOWER_ACCESS_USER_ID} from '../src/features/tower/access.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('owner recognized by account ID only; guests and other accounts cannot open Tower',()=>{
 assert.equal(mayOpenTower(TOWER_ACCESS_USER_ID),true);
 assert.equal(mayOpenTower('9ecab0b5-2b8d-4381-b8ad-057dc28efaee'),false);
 for(const value of ['as_alan','as-alan',null,undefined,'',{},TOWER_ACCESS_USER_ID.toUpperCase()])
  assert.equal(mayOpenTower(value),false,'must not authorize '+String(value));
});

test('practice menu entry is hidden for non-owners and responds to auth changes',()=>{
 const s=read('src/features/practice/index.js');
 assert.match(s,/data-tower-private/);
 assert.match(s,/mayOpenTower\(getCurrentAuthState\(\)\.user\?\.id\)/);
 assert.match(s,/subscribeToAuth\(/);
 assert.match(s,/towerEntry\.style\.display=mayOpenTower/);
});

test('router redirects direct Tower URL before loading game module',()=>{
 const router=read('src/app/router.js');
 assert.match(router,/target\.route === "practice\.tower"/);
 assert.match(router,/mayOpenTower\(getCurrentAuthState\(\)\.user\?\.id\)/);
 assert.match(router,/route: "practice\.home"/);
});

test('direct module mount fails closed without disclosing authorized username',()=>{
 const tower=read('src/features/tower/index.js');
 assert.match(tower,/if\(!mayOpenTower\(towerUserId\(\)\)\)/);
 assert.match(tower,/Раздел временно недоступен/);
 assert.match(tower,/subscribeToAuth\(/);
 for(const s of [tower,read('src/features/practice/index.js'),read('src/app/router.js')])
  assert.doesNotMatch(s,/as_alan|as-alan/);
});

test('database guard covers legacy and current build, read, delete and roof endpoints',()=>{
 const sql=read('supabase/migrations/20261104141500_tower_owner_only_access_172.sql');
 assert.match(sql,/TOWER_ACCESS_RESTRICTED/);
 assert.match(sql,/auth\.uid\(\) IS DISTINCT FROM/);
 for(const name of ['get_tower_roof_snapshot','get_tower_v3_snapshot','get_tower_snapshot',
   'mutate_tower_v3','mutate_tower_v3_line','remove_tower_v3_sections','clear_tower_all','mutate_tower_roof'])
  assert.ok(sql.includes(name),'missing guard for '+name);
});
