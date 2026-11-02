/** Optimizes embedded wood/metal textures without changing model nodes. */
import {readFile,writeFile,mkdir,rm,rename} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const directory=join(root,'assets/tower/approved-library/architecture');
const cli=join(root,'node_modules/.bin/gltf-transform');
const names=['window-wood-v3','door-wood-v1','gate-18x10x2-v9'];
function metadata(bytes){
 if(bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2)throw Error('Invalid binary glTF');
 const n=bytes.readUInt32LE(12),j=JSON.parse(bytes.toString('utf8',20,20+n));
 const shape={
  nodes:(j.nodes||[]).map(x=>({name:x.name??null,matrix:x.matrix??null,
   translation:x.translation??null,rotation:x.rotation??null,scale:x.scale??null,
   mesh:x.mesh??null,children:x.children??null,skin:x.skin??null})),
  meshes:(j.meshes||[]).map(x=>x.name??null),
  materials:(j.materials||[]).map(x=>x.name??null),
  scenes:j.scenes||[],animations:(j.animations||[]).map(x=>({name:x.name??null,channels:x.channels?.length||0}))
 };
 return {shape,used:j.extensionsUsed||[],images:j.images?.length||0};
}
const results=[];
await mkdir(join(directory,'optimized'),{recursive:true});
await mkdir(join(root,'reports'),{recursive:true});
for(const name of names){
 const input=join(directory,name+'.glb');
 const output=join(directory,'optimized',name+'-webp.glb');
 const temporary=output+'.tmp.glb';
 const original=await readFile(input);
 try{
  execFileSync(cli,['webp',input,temporary,'--quality','95'],{cwd:root,stdio:'inherit',maxBuffer:32*1024*1024});
  const converted=await readFile(temporary),a=metadata(original),b=metadata(converted);
  const stable=JSON.stringify(a.shape)===JSON.stringify(b.shape);
  const extension=b.used.includes('EXT_texture_webp');
  const smaller=converted.length<original.length*.95;
  const status=stable&&extension&&smaller?'accepted':'rejected';
  if(status==='accepted')await rename(temporary,output);
  results.push({name,originalBytes:original.length,optimizedBytes:converted.length,
   reductionPercent:+((1-converted.length/original.length)*100).toFixed(1),
   structureVerified:stable,webpExtension:extension,images:a.images,status});
 }catch(error){
  results.push({name,originalBytes:original.length,status:'conversion-failed',error:String(error?.message||error)});
 }finally{await rm(temporary,{force:true});}
}
await writeFile(join(root,'reports/tower-wood-model-size.json'),JSON.stringify({sourceBranch:'17.2',models:results},null,2)+'\n');
console.log(JSON.stringify(results,null,2));
