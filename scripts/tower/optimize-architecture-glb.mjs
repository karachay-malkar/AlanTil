/**
 * Validate and build Meshopt sidecars for the four heaviest authored GLBs.
 * Keeps the original GLBs untouched until each sidecar is verified.
 */
import {readFile,writeFile,mkdir,stat,rename,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const directory=join(root,'assets/tower/approved-library/architecture');
const names=['window-wood-v3','door-wood-v1','gate-18x10x2-v9','door-7x9x2-stone-v1'];
const cli=join(root,'node_modules/.bin/gltfpack');
function glbMeta(bytes){
 if(bytes.length<24||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2)
  throw Error('Not GLB 2.0');
 const length=bytes.readUInt32LE(12);
 if(bytes.readUInt32LE(16)!==0x4e4f534a||length>bytes.length-20)
  throw Error('Invalid GLB JSON chunk');
 const data=JSON.parse(bytes.toString('utf8',20,20+length));
 const nodes=(data.nodes||[]).map(node=>({
  name:node.name??null,matrix:node.matrix??null,
  translation:node.translation??null,rotation:node.rotation??null,
  scale:node.scale??null,mesh:node.mesh??null,children:node.children??null,
  skin:node.skin??null
 }));
 return {nodes,meshes:(data.meshes||[]).map(mesh=>mesh.name??null),
  materials:(data.materials||[]).map(x=>x.name??null),
  scenes:data.scenes||[],animations:(data.animations||[]).map(a=>({
   name:a.name??null,channels:a.channels?.length||0
  })), extensions:data.extensionsRequired||[]};
}
await mkdir(join(directory,'optimized'),{recursive:true});
await mkdir(join(root,'reports'),{recursive:true});
const results=[];
for(const name of names){
 const source=join(directory,name+'.glb'),output=join(directory,'optimized',name+'-meshopt.glb');
 const temporary=output+'.tmp.glb';
 const oldData=await readFile(source);
 try{
  execFileSync(cli,['-i',source,'-o',temporary,'-cc','-kn','-km','-ke','-vpf'],{
   cwd:root,stdio:'inherit',maxBuffer:32*1024*1024
  });
  const optData=await readFile(temporary);
  const oldMeta=glbMeta(oldData),newMeta=glbMeta(optData);
  const {extensions:oldExtensions,...oldShape}=oldMeta;
  const {extensions:newExtensions,...newShape}=newMeta;
  const preserved=JSON.stringify(oldShape)===JSON.stringify(newShape);
  const compressed=newExtensions.includes('EXT_meshopt_compression');
  const smaller=optData.length<oldData.length*.95;
  if(preserved&&compressed&&smaller){
   await rename(temporary,output);
   results.push({name,originalBytes:oldData.length,optimizedBytes:optData.length,
    reductionPercent:+((1-optData.length/oldData.length)*100).toFixed(1),structureVerified:true,status:'accepted'});
  }else{
   results.push({name,originalBytes:oldData.length,optimizedBytes:optData.length,
    reductionPercent:+((1-optData.length/oldData.length)*100).toFixed(1),structureVerified:preserved,
    meshoptExtension:compressed,status:'rejected'});
  }
 }catch(error){
  results.push({name,originalBytes:oldData.length,status:'conversion-failed',error:String(error?.message||error)});
 }finally{await rm(temporary,{force:true});}
}
await writeFile(join(root,'reports/tower-model-size.json'),
 JSON.stringify({sourceBranch:'17.2',models:results},null,2)+'\n');
console.log(JSON.stringify(results,null,2));
