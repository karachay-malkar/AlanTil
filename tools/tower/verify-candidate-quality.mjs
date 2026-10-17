/** Gate candidate quality gate: never promote incomplete masonry by version number alone.
 * Uses recorded convex-voxel estimates, NOT proof of watertight meshes or visual QA.
 * Run: node tools/tower/verify-candidate-quality.mjs <candidate.json> [--strict]
 */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const filename=process.argv[2];
if(!filename||filename.startsWith('--'))throw new Error('Supply a candidate JSON path');
const pack=JSON.parse(readFileSync(resolve(filename),'utf8'));
const expected=['1x1x1','2x2x2','2x2x3','2x3x4','4x4x4'];
const rows=[];
for(const type of expected){
 const variants=pack.variants?.[type];
 if(!Array.isArray(variants)||variants.length!==5)throw new Error(type+': expected 5 variants');
 const unique=new Set();
 for(let i=0;i<5;i++){
  const v=variants[i];
  const stones=v.placement?.length;
  const occupancy=Number(v.occupancy);
  const face=Number(v.minFaceCoverage);
  if(!Number.isInteger(stones)||stones<1||stones>512)throw new Error(type+'/'+i+': invalid stone count');
  if(!Number.isFinite(occupancy)||occupancy<0||occupancy>1)throw new Error(type+'/'+i+': invalid density');
  if(!Number.isFinite(face)||face<0||face>1)throw new Error(type+'/'+i+': missing six-face coverage');
  for(const row of v.placement){
   if(!Array.isArray(row)||row.length!==13||row.slice(1).some(x=>!Number.isFinite(x)))throw new Error(type+'/'+i+': invalid matrix');
  }
  const identity=JSON.stringify(v.placement);
  if(unique.has(identity))throw new Error(type+': duplicate variant');
  unique.add(identity);
  rows.push({type,variant:i,stones,occupancy,minimumFace:face,passes:occupancy>=.90&&face>=.90});
 }
}
console.table(rows);
console.log('RECORDED_PROXY_QUALITY',rows.filter(r=>r.passes).length+'/25','PASS; these are author-reported convex-voxel estimates, not visual certification');
if(process.argv.includes('--strict')&&rows.some(r=>!r.passes))process.exitCode=1;
