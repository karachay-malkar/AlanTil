import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const tower=read('src/features/tower/index.js');
const css=read('src/features/tower/tower.css');
const icons=read('src/shared/ui/icons.js');
test('construction uses its current bounded camera and plot reset control',()=>{
 assert.match(tower,/data-home/);
 assert.match(tower,/s\.scene\.home\(\)/);
 assert.doesNotMatch(tower,/data-world/);
 assert.match(tower,/catalogVisible\(false\);closeSettings\(\)/);
});
test('catalog hidden on entry and folded during placement',()=>{
 assert.match(tower,/<aside class="towerSide" data-side/);
 assert.match(tower,/data-catalog-close/);
 assert.match(tower,/if\(next==='placing'\|\|next==='saving-place'\|\|roofing\)/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 for(const symbol of ['devicePortrait','deviceLandscape','arrowUp','arrowDown','doorClosed','appWindow','gate'])
  assert.ok(icons.includes('  '+symbol+':'),symbol+' missing');
});
test('orientation icon stays visible after landscape and portrait transitions',()=>{
 assert.match(tower,/data-orientation aria-label/);
 assert.match(tower,/requestTowerOrientation\('landscape'\)/);
 assert.match(tower,/requestTowerOrientation\(isPortrait\(\)\?'landscape':'portrait'/);
 assert.doesNotMatch(css,/@media\(orientation:landscape\).*display:none/);
 assert.match(tower,/orientationchange.*syncOrientationButton/);
});
test('four placement nudges replace removed permanent flight controls',()=>{
 assert.match(tower,/class="towerNudge"/);
 assert.match(tower,/data-nudge-direction="up"/);
 assert.match(tower,/data-nudge-direction="down"/);
 assert.match(tower,/data-nudge-direction="left"/);
 assert.match(tower,/data-nudge-direction="right"/);
 assert.doesNotMatch(tower,/data-fly|data-ground|setFly\(/);
 assert.doesNotMatch(css,/towerFlightPanel|towerAltitude|data-flying/);
 assert.match(css,/background:var\(--surface-0\)/);
 assert.match(css,/color:var\(--text-1\)/);
 assert.match(tower,/data-clear aria-label/);
 assert.match(tower,/context\.modal\.confirm/);
});

test('construction catalog waits for a safe server snapshot and exposes retry',()=>{
 assert.match(tower,/name==='hammer'&&\(!s\.ready\|\|s\.loadFailed\|\|batchMode\)/);
 assert.match(tower,/data-load-status/);
 assert.match(tower,/data-retry/);
 assert.match(tower,/if\(s\.busy\|\|!s\.ready\|\|s\.loadFailed\)return/);
});
