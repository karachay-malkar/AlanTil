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
test('the tower UI exposes both modes without auto migrating legacy blocks',()=>{
 assert.match(app,/towerModeSwitch/);
 assert.match(app,/data-tower-mode="free"/);
 assert.match(app,/data-tower-mode="classic"/);
 assert.match(app,/towerModeUrl/);
 assert.match(app,/loadTowerV2\(params\.userId\|\|null\):loadTower\(params\.userId\|\|null\)/);
 assert.match(app,/s\.v2Play\?mutateTowerV2\(operation\):mutateTower\(operation\)/);
});
