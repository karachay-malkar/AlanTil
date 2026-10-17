/** Offline quality audit for precomputed compact-stone placement recipes.
 * This is intentionally non-blocking until the 25 recipes have been rebaked.
 * The 'occupancy' field is an authoring metric, not a verified mesh-volume measurement.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const pack=JSON.parse(readFileSync(resolve(root,'assets/tower/prefabs/balkar71/placements-17_5_5.json'),'utf8'));
const target=.90;
const rows=[];
for(const [type,variants] of Object.entries(pack.variants)){
 if(variants.length!==5)throw new Error(type+': expected 5 variants');
 for(const [variant,recipe] of variants.entries()){
  const occupancy=Number(recipe.occupancy);
  if(!Number.isFinite(occupancy)||occupancy<0||occupancy>1)throw new Error(type+': invalid occupancy');
  const stones=recipe.placement.length;
  rows.push({type,variant,stones,occupancy,meetsTarget:occupancy>=target});
 }
}
if(rows.length!==25)throw new Error('Expected 25 masonry recipes');
console.log('Compact masonry audit: recipe-reported occupancy (NOT independently measured geometry)');
console.table(rows);
console.log('Target:',target,'Passing:',rows.filter(r=>r.meetsTarget).length,'of',rows.length);
if(process.argv.includes('--strict')&&rows.some(r=>!r.meetsTarget))process.exitCode=1;
