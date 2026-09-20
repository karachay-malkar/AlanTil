import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import path from'node:path';
import{fileURLToPath}from'node:url';
import{ASHYK_COLORS,BOARD,BOUNDARY_RADIUS}from'../packages/ashyk-game/constants.js';
import{UI_TOKENS}from'../packages/alantil-ui/tokens.js';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('Ashyk uses the Path system ivory background token',()=>{
  assert.equal(ASHYK_COLORS.background,UI_TOKENS.colors.appBg);
  assert.equal(UI_TOKENS.colors.appBg,'#eee9df');
});

test('Ashyk board is a shared PBR wooden visual on Web and Mobile',()=>{
  const wood=read('packages/ashyk-game/model/wood-board.js');
  const web=read('packages/ashyk-game/web/scene.jsx');
  const mobile=read('mobile/game/ashyk-scene.js');
  for(const source of[web,mobile]){
    assert.match(source,/createAshykBoardVisual\(THREE\)/);
    assert.match(source,/disposeAshykBoardVisual/);
    assert.match(source,/ACESFilmicToneMapping/);
    assert.doesNotMatch(source,/#c8c9c5|rimProfile/);
  }
  assert.match(wood,/createAshykWoodPbrTextures/);
  assert.match(wood,/new THREE\.DataTexture/);
  assert.match(wood,/normalMap/);
  assert.match(wood,/roughnessMap/);
  assert.match(wood,/addGrooveRing/);
  assert.match(wood,/addRadialGrooves/);
  assert.match(wood,/CylinderGeometry\(ASHYK_BOARD_VISUAL\.sideRadius/);
  assert.match(wood,/LatheGeometry\(bevelProfile,128\)/);
});

test('Wooden visual does not change Ashyk physics dimensions',()=>{
  assert.equal(BOARD,28);
  assert.ok(BOUNDARY_RADIUS>12&&BOUNDARY_RADIUS<14);
});
