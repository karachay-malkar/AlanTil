import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {towerModeUrl} from '../packages/tower-game/tower-mode-url.mjs';

const app=readFileSync(new URL('../src/features/tower/index.js',import.meta.url),'utf8');

test('mode changes preserve a tower deep link and unrelated query state',()=>{
 const here='https://alantil.ru/practice/tower/another-user?lang=ru&tower_v2_preview=1#section';
 assert.equal(towerModeUrl(here,'free'),'/practice/tower/another-user?lang=ru&tower_v2_play=1#section');
 assert.equal(towerModeUrl('https://alantil.ru/practice/tower?lang=ru&tower_v2_play=1','classic'),'/practice/tower?lang=ru');
});
test('invalid tower mode cannot redirect to another site',()=>{
 assert.throws(()=>towerModeUrl('https://alantil.ru/practice/tower','unknown'),/Invalid/);
});
test('17.2 exposes one editor and keeps legacy RPC for compatibility',()=>{
 assert.doesNotMatch(app,/towerModeSwitch|data-tower-mode/);
 assert.match(app,/v2Play:true/);
 assert.match(app,/v2Enabled:true/);
 assert.match(app,/loadTowerV2\(params\.userId\|\|null\):loadTower\(params\.userId\|\|null\)/);
 assert.match(app,/s\.v2Play\?mutateTowerV2\(operation\):mutateTower\(operation\)/);
});
