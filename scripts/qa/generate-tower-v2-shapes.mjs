/** Deterministic data migration from the existing 23 authored packed meshes.
 * No procedural faces, closed-mesh fabrication, or material redefinition. */
import {writeFileSync} from 'node:fs';
import {ROCK_PACK} from '../../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from '../../packages/tower-game/rock-shapes.mjs';
const rows=[];
for(const [type,category] of Object.entries({stone:'small',medium:'medium',long:'long',big:'big'})){
  for(const [variant,encoded] of ROCK_PACK[category].entries()){
    const m=originalRockMesh(encoded,variant);
    const verts=Array.from({length:m.positions.length/3},(_,i)=>Array.from(m.positions.slice(i*3,i*3+3),x=>+x.toFixed(8)));
    const faces=Array.from({length:m.indices.length/3},(_,i)=>Array.from(m.indices.slice(i*3,i*3+3)));
    const data=JSON.stringify({v:verts,f:faces});
    rows.push(`('${type}',${variant},'${data}'::jsonb)`);
  }
}
const sql=`-- GENERATED: node scripts/qa/generate-tower-v2-shapes.mjs\n-- Immutable positions and source triangle indices from assets/tower/processed-rocks.mjs.\n-- Geometry definitions are authoritative and stored in the private schema.\ninsert into private.tower_v2_shapes(type,variant,geometry) values\n${rows.join(',\n')}\non conflict(type,variant) do update set geometry=excluded.geometry;\n`;
writeFileSync(new URL('../../supabase/migrations/20261012180100_tower_v2_authored_shapes.sql',import.meta.url),sql);
console.log(`generated ${rows.length} authored sources, ${Buffer.byteLength(sql)} SQL bytes`);
