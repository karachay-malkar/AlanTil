/** Tower HUD regression: fullscreen, context-sensitive controls, safe-area layout. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const js=read('src/features/tower/index.js');
const css=read('src/features/tower/tower.css');
const icons=read('src/shared/ui/icons.js');
const index=read('index.html');
const shell=read('src/app/shell.js');

test('the unused panoramic second mode is absent from construction HUD',()=>{
 assert.doesNotMatch(js,/data-world|\[data-world\]|on\('\[data-world\]'/);
 assert.match(js,/data-home[\s\S]*?uiIcon\('house'\)/);
});

test('rightward beam shift uses a real right arrow, undo does not look like Back',()=>{
 assert.match(icons,/arrowRight:/);
 assert.match(js,/data-beam-forward[\s\S]*?uiIcon\('arrowRight'\)/);
 assert.match(js,/undo:'undo2'/);
 assert.match(js,/remove:'trash2'/);
 assert.equal((js.match(/class="towerBeamRow"/g)||[]).length,2);
});

test('orientation fullscreen must retain the global Back and confirmation modal',()=>{
 assert.match(js,/document\.documentElement\.requestFullscreen\(\)/);
 assert.doesNotMatch(js,/game\.requestFullscreen\(\)/);
 assert.match(js,/screen\.orientation\.lock\(target\)/);
 assert.match(js,/document\.exitFullscreen\?/);
 assert.match(index,/id="btnBackArrow"/);
 assert.match(index,/id="modalRoot"/);
 assert.match(shell,/setBackVisible\(visible\)/);
 assert.doesNotMatch(css,/\.appHeader\{display:none\}/);
});

test('global full clear still confirms, includes roof and explains disabled state',()=>{
 assert.match(js,/data-clear-note/);
 assert.match(js,/s\.sections\.length&&!s\.roofs\.length/);
 assert.match(js,/context\.modal\.confirm\(/);
 assert.match(js,/confirmText:'Удалить всё'/);
 assert.match(js,/await clearTowerV3/);
 assert.match(js,/s\.roofs=\[\]/);
 assert.match(css,/\.towerSettingsHint/);
});

test('header balance uses exact center and no separate floating large wallet',()=>{
 assert.match(css,/\.towerTekmetWallet\{[^}]*left:50%;transform:translateX\(-50%\)/);
 assert.match(css,/\.towerTekmetWallet\{[^}]*height:32px/);
 assert.match(css,/\.towerTekmetIcon\{[^}]*width:18px/);
 assert.match(css,/\.towerQuickActions\{[^}]*top:calc\(var\(--safe-top/);
});

test('landscape uses a right drawer and proper touch-target sizes',()=>{
 assert.match(css,/@media\(orientation:landscape\)/);
 assert.match(css,/\.towerSide\{top:calc\(var\(--safe-top/);
 assert.match(css,/\.towerBeamControls \.btn\{[^}]*min-width:44px;min-height:44px/);
 assert.match(css,/\.towerGame \.towerCatalogClose\{[^}]*min-width:44px;min-height:44px/);
 assert.match(css,/\.towerBaganaHeights \.btn\{[^}]*min-width:44px;min-height:44px/);
 assert.match(css,/\.towerPlacementBar,\.towerSelectionBar\{[^}]*max-width:calc\(100% - 20px\)/);
});

test('roof actions preserve Back and avoid overlapping build controls',()=>{
 assert.doesNotMatch(css,/\.towerGame\[data-mode="roof"\][\s\S]{0,140}\.appHeader/);
 assert.match(css,/\.towerGame\[data-mode="roof"\] \[data-hammer\]/);
 assert.match(js,/q\('\[data-beam-controls\]'\)\.hidden=!beamMode/);
 assert.match(js,/q\('\[data-placement\]'\)\.hidden=/);
 assert.match(js,/if\(next==='placing'\|\|next==='saving-place'\|\|roofing\)\{catalogVisible\(false\);closeSettings\(\);\}/);
});
