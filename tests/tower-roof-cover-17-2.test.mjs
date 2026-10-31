import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {roofCoverCells,roofPrice,validRoofPoints,checkRoofPlacement,ROOF_PRICE_PER_CELL} from '../packages/tower-game/roof-cover.mjs';

const roof=[[4,7],[7,7],[7,9],[4,9]];
test('one tapped CELL CENTRE is one real roofing module for four coins',()=>{
 assert.deepEqual(roofCoverCells([[4,7]]),[[4,7]]);
 assert.equal(roofPrice([[4,7]]),4);
 assert.equal(ROOF_PRICE_PER_CELL,4);
});
test('closed polygon fills a nonrectangular footprint deterministically',()=>{
 assert.equal(roofCoverCells(roof).length,12);
 assert.equal(roofPrice(roof),48);
 const l=[[1,1],[6,1],[6,3],[3,3],[3,6],[1,6]];
 assert.equal(roofCoverCells(l).length,27);
 assert.equal(roofPrice(l),108);
 assert.equal(new Set(roofCoverCells(l).map(c=>c.join(','))).size,27);
 assert.deepEqual(roofCoverCells(l),roofCoverCells(l));
});
test('two points build a contiguous narrow strip, not a giant box',()=>{
 assert.deepEqual(roofCoverCells([[4,7],[7,7]]),[[4,7],[5,7],[6,7],[7,7]]);
});
test('invalid and self-intersecting polygons are rejected',()=>{
 assert.equal(validRoofPoints([[1,1],[5,5],[1,5],[5,1]]),false);
 assert.equal(validRoofPoints([[0,0],[60,0]]),false);
 assert.equal(validRoofPoints([[1,1],[1,1]]),false);
});
test('support and overlap are validated on ALL covered cells',()=>{
 const points=[[3,3]];
 const beam={type:'roof_beam',_roofBounds:{min:[3,1,3],max:[4,2,4]}};
 assert.equal(checkRoofPlacement(points,2,[beam]).ok,true);
 assert.equal(checkRoofPlacement(points,3,[beam]).ok,false);
 assert.equal(checkRoofPlacement(points,2,[]).reason,'ROOF_SUPPORT_REQUIRED');
 assert.equal(checkRoofPlacement(points,2,[beam],[{level:2,cells:[[3,3]]}]).reason,'ROOF_OVERLAP');
 const masonry={type:'masonry_section',_roofBounds:{min:[3,2,3],max:[4,3,4]}};
 assert.equal(checkRoofPlacement(points,2,[beam,masonry]).reason,'ROOF_COLLISION');
});
test('real 3D layers and minimal HUD are wired into the tower',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const geom=read('src/features/tower/roof-cover-scene.js');
 const ui=read('src/features/tower/index.js');
 const sql=read('supabase/migrations/20261031154400_tower_polygon_roof_25cm_paid_cells.sql');
 assert.match(geom,/InstancedMesh/);
 for(const layer of ['soilGeo','strawGeo','scrubGeo','logGeo','grassGeo'])assert.match(geom,new RegExp(layer));
 assert.match(ui,/data-roof-price/);
 assert.match(ui,/pickRoof\(hit\)/);
 assert.match(ui,/placeTowerRoof/);
 assert.match(sql,/price:=cnt\*4/);
 assert.match(sql,/INSUFFICIENT_COINS/);
});
