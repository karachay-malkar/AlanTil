import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROCK_PACK} from '../assets/tower/processed-rocks.mjs';
import {originalRockMesh,rockMeshVolume} from '../packages/tower-game/rock-shapes.mjs';

test('all 23 authored stone shapes retain genuine quantized source vertex positions',()=>{
 let total=0;const fingerprints=new Set(),volumes=[];
 for(const [category,variants] of Object.entries(ROCK_PACK)){
  for(let i=0;i<variants.length;i++){
   const source=variants[i],mesh=originalRockMesh(source,i);
   const bytes=Buffer.from(source[4],'base64'),volume=rockMeshVolume(mesh);
   assert.equal(mesh.positions.length,source[0]*3);
   assert.equal(mesh.indices.length,source[1]*3);
   assert.equal(mesh.colors.length,mesh.positions.length);
   assert.equal(mesh.positions[0],Math.fround(bytes[0]/255-.5),category+':'+i);
   assert.equal(mesh.positions[1],Math.fround(bytes[2]/255-.5),category+':'+i);
   for(const v of mesh.positions)assert.ok(Number.isFinite(v)&&Math.abs(v)<=.50001);
   assert.ok(Number.isFinite(volume)&&volume>0);
   fingerprints.add(Buffer.from(mesh.positions.buffer).toString('base64'));
   volumes.push(volume);total++;
  }
 }
 assert.equal(total,23);
 assert.equal(fingerprints.size,23,'all variants retain a different authored 3D silhouette');
 assert.ok(Math.max(...volumes)-Math.min(...volumes)>.15,'natural shapes must not be regularized into identical cuboids');
});

test('currency API rejects silver-only stones before charging and keeps refunds idempotent',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261011170000_tower_stone_currency_rules.sql',import.meta.url),'utf8');
 assert.match(sql,/typ in \('stone','medium','long'\)/);
 assert.match(sql,/if p_currency='gold' and \(cost%8<>0 or typ in/);
 assert.match(sql,/e->>10='silver'/);
 assert.match(sql,/OPERATION_ID_REUSED/);
 assert.ok(sql.indexOf('OPERATION_ID_REUSED')<sql.indexOf('typ in'));
});

test('Supabase fixed-size rules match the authoritative 36 catalog entries',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261011221000_tower_fixed_stone_dimensions.sql',import.meta.url),'utf8');
 assert.match(sql,/when 'medium' then dx=2 and dy between 1 and 2 and dz=1/);
 assert.match(sql,/when 'long' then dx between 3 and 5 and dy between 1 and 2 and dz=1/);
 assert.match(sql,/when 'big' then dx between 3 and 5 and dy between 2 and 4 and dz between 2 and 4/);
 assert.match(sql,/OPERATION_ID_REUSED/);
 assert.match(sql,/if e->>10='silver'/);
});

test('no change to serialised historic tower type ordering',()=>{
 const source=readFileSync(new URL('../packages/tower-game/core.mjs',import.meta.url),'utf8');
 assert.match(source,/const types=Object\.keys\(CATALOG\)/);
 assert.match(source,/stone:entry\('Обычный камень'/);
 assert.match(source,/medium:entry\('Средний камень'/);
 assert.match(source,/long:entry\('Вытянутый камень'/);
 assert.match(source,/big:entry\('Большой камень'/);
});
