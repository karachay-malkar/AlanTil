import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROCK_PACK} from '../assets/tower/processed-rocks.mjs';
import {regularizedRockMesh,rockMeshVolume} from '../packages/tower-game/rock-shapes.mjs';

test('all 23 authored stone indices produce near-cuboid but individually varied 3D meshes',()=>{
 let total=0;const fingerprints=new Set();
 for(const [category,variants]of Object.entries(ROCK_PACK)){
  for(let i=0;i<variants.length;i++){
   const mesh=regularizedRockMesh(variants[i],i),volume=rockMeshVolume(mesh);
   assert.ok(volume>=.928&&volume<=.97,category+' '+i+': volume '+volume);
   assert.equal(mesh.indices.length%3,0);
   assert.equal(mesh.positions.length,mesh.colors.length);
   for(const v of mesh.positions)assert.ok(Number.isFinite(v)&&Math.abs(v)<=.5);
   fingerprints.add(Array.from(mesh.positions.slice(0,45)).map(n=>n.toFixed(4)).join(',')+'|'+variants[i][2].join(','));
   total++;
  }
 }
 assert.equal(total,23);
 assert.equal(fingerprints.size,23);
});

test('currency API rejects silver-only stones before charging and keeps refunds idempotent',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261011170000_tower_stone_currency_rules.sql',import.meta.url),'utf8');
 assert.match(sql,/typ in \('stone','medium','long'\)/);
 assert.match(sql,/if p_currency='gold' and \(cost%8<>0 or typ in/);
 assert.match(sql,/e->>10='silver'/);
 assert.match(sql,/OPERATION_ID_REUSED/);
 assert.ok(sql.indexOf('OPERATION_ID_REUSED')<sql.indexOf('typ in'));
});

test('no change to serialised historic tower type ordering',()=>{
 const source=readFileSync(new URL('../packages/tower-game/core.mjs',import.meta.url),'utf8');
 assert.match(source,/const types=Object\.keys\(CATALOG\)/);
 assert.match(source,/stone:entry\('Обычный камень'/);
 assert.match(source,/medium:entry\('Средний камень'/);
 assert.match(source,/long:entry\('Вытянутый камень'/);
 assert.match(source,/big:entry\('Большой камень'/);
});
