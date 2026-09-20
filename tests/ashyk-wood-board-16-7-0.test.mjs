import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import path from'node:path';
import{fileURLToPath}from'node:url';
import{ASHYK_COLORS,BOARD,BOUNDARY_RADIUS}from'../packages/ashyk-game/constants.js';
import{UI_TOKENS}from'../packages/alantil-ui/tokens.js';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const exists=file=>fs.existsSync(path.join(ROOT,file));

test('Ashyk uses the Path system ivory background token',()=>{
  assert.equal(ASHYK_COLORS.background,UI_TOKENS.colors.appBg);
  assert.equal(UI_TOKENS.colors.appBg,'#eee9df');
});

test('Ashyk board uses vendored Walnut Veneer 02 PBR maps on Web and Mobile',()=>{
  const wood=read('packages/ashyk-game/model/wood-board.js');
  const web=read('packages/ashyk-game/web/scene.jsx');
  const mobile=read('mobile/game/ashyk-scene.js');
  assert.match(web,/createAshykBoardVisual\(THREE\)/);
  assert.match(web,/disposeAshykBoardVisual/);
  assert.match(mobile,/createAshykBoardVisual\(THREE,\{textures:woodTextures\}\)/);
  assert.match(mobile,/Asset\.fromModule/);
  assert.match(mobile,/Image\.getSize/);
  assert.match(mobile,/new THREE\.DataTexture/);
  assert.match(mobile,/loadNativeWoodPbrTextures/);
  for(const source of[web,mobile]){
    assert.match(source,/ACESFilmicToneMapping/);
    assert.doesNotMatch(source,/#c8c9c5|rimProfile/);
  }
  assert.match(wood,/ASHYK_WOOD_PBR_ASSETS/);
  assert.match(wood,/new THREE\.TextureLoader/);
  assert.match(wood,/normalMap/);
  assert.match(wood,/roughnessMap/);
  assert.match(wood,/aoMap/);
  assert.match(wood,/RepeatWrapping/);
  assert.match(wood,/rotation:Math\.PI\/2/);
  assert.match(wood,/addGrooveRing/);
  assert.match(wood,/addRadialGrooves/);
  assert.match(wood,/CylinderGeometry\(ASHYK_BOARD_VISUAL\.sideRadius/);
  assert.match(wood,/LatheGeometry\(bevelProfile,128\)/);
  for(const removed of['TEXTURE_SIZE','clamp255','fract','hash','smooth','function noise','function fbm','woodHeight','makeTexture','createAshykWoodPbrTextures'])assert.doesNotMatch(wood,new RegExp(removed));
  for(const filename of['walnut_veneer_02_diff_1k.jpg','walnut_veneer_02_nor_gl_1k.jpg','walnut_veneer_02_rough_1k.jpg','walnut_veneer_02_ao_1k.jpg'])assert.ok(exists('assets/ashyk/materials/walnut-veneer-02/'+filename),filename);
});

test('Wooden visual does not change Ashyk physics dimensions',()=>{
  assert.equal(BOARD,28);
  assert.ok(BOUNDARY_RADIUS>12&&BOUNDARY_RADIUS<14);
});
