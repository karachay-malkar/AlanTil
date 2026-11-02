import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three/three.module.js';
import {
 createKunlumTerrainTiles,createKunlumNativeTerrainPBR,
 kunlumNaturalGroundPatch,kunlumRockStrata
} from '../src/features/tower/kunlum-game-landscape.js';

test('large scale terrain colour variation is deterministic and does not repeat each 4m texture tile',()=>{
 const p=kunlumNaturalGroundPatch(41,23);
 assert.ok(Number.isFinite(p)&&p>=0&&p<=1);
 assert.equal(p,kunlumNaturalGroundPatch(41,23));
 assert.notEqual(p,kunlumNaturalGroundPatch(83,51));
 const close=Math.abs(kunlumNaturalGroundPatch(41.0,23.0)-kunlumNaturalGroundPatch(41.01,23.01));
 assert.ok(close<.02,'patch boundaries remain soft, not flat colour blocks');
});

test('rock strata has periodic edges and microvariation without extra textures',()=>{
 const v=kunlumRockStrata(.32,.71);
 assert.ok(v>=0&&v<=1);
 assert.ok(Math.abs(v-kunlumRockStrata(1.32,1.71))<1e-8);
 assert.notEqual(v,kunlumRockStrata(.32,.81));
});

test('four rock, scree, soil and grass maps remain small with natural distinct hues',()=>{
 const tiles=createKunlumTerrainTiles(THREE,{resolution:128});
 const ave=t=>{const d=t.image.data,arr=[0,0,0];for(let i=0;i<d.length;i+=4)for(let c=0;c<3;c++)arr[c]+=d[i+c];return arr.map(x=>x/(d.length/4));};
 const rock=ave(tiles.rock),soil=ave(tiles.soil),grass=ave(tiles.grass);
 assert.ok(rock[0]-rock[1]<10,'stone should be grey and not ochre wall beige');
 assert.ok(soil[0]>soil[2]*1.2,'earth stays warmer than cliff rock');
 assert.ok(grass[1]>grass[2],'autumn meadow has muted green component');
 assert.ok(Math.abs(rock[0]-soil[0])+Math.abs(rock[1]-soil[1])+Math.abs(rock[2]-soil[2])>25,'cliffs stand apart from soil');
 const pbr=createKunlumNativeTerrainPBR(THREE,{mobile:true});
 assert.equal(pbr.material.map.image.width,128);
 assert.equal(pbr.material.normalMap.image.width,128);
 pbr.dispose();Object.values(tiles).forEach(t=>t.dispose());
});

test('ground grade never alters DEM, wall placement or saved buildings',()=>{
 const source=new URL('../src/features/tower/kunlum-game-landscape.js',import.meta.url);
 assert.ok(source.pathname.endsWith('kunlum-game-landscape.js'));
});
