/** Freeze the exact Mapzen/AWS Terrarium z13 tiles used by Kunlum wide review.
 * Keeping source height pixels unchanged makes the wide scene reproducible and
 * prevents the game's terrain from disappearing with external network errors.
 */
import {wideDemTilePlan} from '../../src/features/tower/kunlum-wide-dem.js';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
const plan=wideDemTilePlan();
if(plan.zoom!==13||plan.tiles>18)throw Error('Unexpected Mapzen tile plan');
const root='assets/tower/environment/mapzen-terrarium-z13';
await mkdir(root,{recursive:true});
const files=[];
for(let y=plan.y0;y<=plan.y1;y++)for(let x=plan.x0;x<=plan.x1;x++){
 const name=x+'-'+y+'.png',file=join(root,name);
 let data;
 try{data=await readFile(file);}catch{}
 if(!data){
  const url='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/'+x+'/'+y+'.png';
  const response=await fetch(url,{headers:{'User-Agent':'AlanTil-Kunlum-Digital-Heritage/1.0'}});
  if(!response.ok)throw Error('Mapzen '+url+': HTTP '+response.status);
  data=Buffer.from(await response.arrayBuffer());
 }
 if(data.length<100||data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||
  data.readUInt32BE(16)!==256||data.readUInt32BE(20)!==256)
  throw Error('Invalid Terrarium tile '+name);
 await writeFile(file,data);
 files.push(name);
 console.log('Frozen Terrarium tile',name,data.length,'bytes');
}
await writeFile(join(root,'manifest.json'),JSON.stringify({
 schema:'alantil.kunlum.mapzen-terrarium.v1',
 source:'Mapzen / AWS Terrain Tiles',
 url:'https://registry.opendata.aws/terrain-tiles/',
 license:'Mixed upstream DEM sources; preserve Mapzen and provider attribution',
 projection:'WebMercator z13 Terrarium PNG',
 zoom:plan.zoom,bounds:plan.bounds,grid:[plan.x0,plan.x1,plan.y0,plan.y1],
 tiles:files
},null,2)+'\n');
console.log('Pinned',files.length,'original Mapzen 256x256px tiles');
