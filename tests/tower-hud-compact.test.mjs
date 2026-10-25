import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const tower=read('src/features/tower/index.js');
const css=read('src/features/tower/tower.css');
const icons=read('src/shared/ui/icons.js');
test('only first-person and overview camera actions remain',()=>{
 assert.match(tower,/data-world/);
 assert.match(tower,/scene\.worldView\(\)/);
 assert.doesNotMatch(tower,/data-camera="home"/);
 assert.match(tower,/catalogVisible\(false\);closeSettings\(\)/);
});
test('catalog hidden on entry and folded during placement',()=>{
 assert.match(tower,/<aside class="towerSide" data-side/);
 assert.match(tower,/data-catalog-close/);
 assert.match(tower,/if\(next==='placing'\|\|next==='saving-place'\)catalogVisible\(false\)/);
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
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
test('two permanent height arrows use the original app colors',()=>{
 assert.match(tower,/class="towerElevationControls"/);
 assert.match(tower,/data-rise aria-label/);
 assert.match(tower,/data-fall aria-label/);
 assert.doesNotMatch(tower,/data-fly|data-ground|setFly\(/);
 assert.doesNotMatch(css,/towerFlightPanel|towerAltitude|data-flying/);
 assert.match(css,/background:var\(--surface-0\)/);
 assert.match(css,/color:var\(--text-1\)/);
 assert.match(tower,/data-clear aria-label/);
 assert.match(tower,/context\.modal\.confirm/);
});
