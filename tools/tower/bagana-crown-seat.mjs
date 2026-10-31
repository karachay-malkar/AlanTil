/** Re-seat a fork, flat top or shallow saddle against the actual underside
 * of a roof log, without changing the stone foot or the logical 25-cm grid.
 * Usage: node tools/tower/bagana-crown-seat.mjs <source-dir> <output-dir>
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const smooth=(a,b,y)=>{const t=Math.max(0,Math.min(1,(y-a)/(b-a)));return t*t*(3-2*t);};
function parse(data){
 const bytes=Buffer.from(data),dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2||dv.getUint32(8,true)!==bytes.length)throw Error('Bad GLB');
 const len=dv.getUint32(12,true),json=bytes.toString('utf8',20,20+len),gltf=JSON.parse(json.trim());
 if(gltf.meshes?.length!==2||!gltf.asset.generator.includes('Common100'))throw Error('Unexpected model');
 const prim=gltf.meshes[0].primitives[0],acc=gltf.accessors;
 const pos=acc[prim.attributes.POSITION],nor=acc[prim.attributes.NORMAL],idx=acc[prim.indices];
 if(pos.componentType!==5126||nor.componentType!==5126||pos.count!==nor.count||![5123,5125].includes(idx.componentType))throw Error('Unexpected buffers');
 const off=a=>28+len+(gltf.bufferViews[a.bufferView].byteOffset||0)+(a.byteOffset||0);
 const po=off(pos),no=off(nor),io=off(idx);
 const vertices=Array.from({length:pos.count},(_,i)=>[dv.getFloat32(po+i*12,true),dv.getFloat32(po+i*12+4,true),dv.getFloat32(po+i*12+8,true)]);
 const indices=Array.from({length:idx.count},(_,i)=>idx.componentType===5123?dv.getUint16(io+i*2,true):dv.getUint32(io+i*4,true));
 return {bytes,dv,json,gltf,vertices,indices,po,no};
}
function surface(m,x=0,z=0){
 let result=-Infinity;const {vertices:p,indices}=m;
 for(let i=0;i<indices.length;i+=3){
  const a=p[indices[i]],b=p[indices[i+1]],c=p[indices[i+2]];
  const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  if(Math.abs(det)<1e-12)continue;
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det;
  const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det,w=1-u-v;
  if(u>=-1e-5&&v>=-1e-5&&w>=-1e-5)result=Math.max(result,u*a[1]+v*b[1]+w*c[1]);
 }
 return result;
}
function properties(m,{form,woodCells}){
 if(![1,2,3].includes(form)||![8,9,10,11,12].includes(woodCells))throw Error('Unsupported Bagana');
 const height=(woodCells+1)*.125,ys=m.vertices.map(p=>p[1]);
 return {logicalTop:height,seat:surface(m),top:Math.max(...ys),bottom:Math.min(...ys),
  generator:m.gltf.asset.generator,woodVertices:m.vertices.length,woodTriangles:m.indices.length/3};
}
export function measureBaganaCrown(data,spec){return properties(parse(data),spec);}
export function seatBaganaCrownGlb(input,spec){
 const m=parse(input),before=properties(m,spec);
 if(!before.generator.includes('timber v5'))throw Error('Source must contain timber v5; never rebake a seated crown');
 const target=before.logicalTop+.012,raise=target-before.seat;
 if(raise<.009||raise>.28)throw Error('Unexpected crown gap '+raise);
 const first=before.logicalTop-.9,last=before.logicalTop-.45;
 for(const p of m.vertices)p[1]+=raise*smooth(first,last,p[1]);
 const normals=Array.from({length:m.vertices.length},()=>[0,0,0]);
 for(let i=0;i<m.indices.length;i+=3){
  const ia=m.indices[i],ib=m.indices[i+1],ic=m.indices[i+2];
  const a=m.vertices[ia],b=m.vertices[ib],c=m.vertices[ic],ab=b.map((v,j)=>v-a[j]),ac=c.map((v,j)=>v-a[j]);
  const n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  for(const id of [ia,ib,ic])for(let j=0;j<3;j++)normals[id][j]+=n[j];
 }
 for(let i=0;i<m.vertices.length;i++){
  const magnitude=Math.hypot(...normals[i]);
  for(let j=0;j<3;j++){
   m.dv.setFloat32(m.po+i*12+j*4,m.vertices[i][j],true);
   m.dv.setFloat32(m.no+i*12+j*4,magnitude>1e-12?normals[i][j]/magnitude:0,true);
  }
 }
 const mark=m.json.indexOf('timber v5');
 if(mark<0)throw Error('Missing generator mark');
 m.bytes.write('timber v6',20+Buffer.byteLength(m.json.slice(0,mark),'utf8'),'ascii');
 const after=properties(parse(m.bytes),spec);
 if(Math.abs(after.seat-target)>.004||Math.abs(after.bottom-before.bottom)>1e-5||
 Math.abs(after.top-before.top-raise)>.001)throw Error('Incorrect mesh contact '+JSON.stringify({before,after}));
 return {bytes:m.bytes,before,after,raise};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [src,dst]=process.argv.slice(2);
 if(!src||!dst||path.resolve(src)===path.resolve(dst))throw Error('Provide distinct source and target directories');
 await mkdir(dst,{recursive:true});
 for(let form=1;form<=3;form++)for(const woodCells of [8,9,10,11,12]){
  const file='bagana-f'+form+'-3x'+(woodCells+1)+'x3-v2.glb';
  const result=seatBaganaCrownGlb(await readFile(path.join(src,file)),{form,woodCells});
  await writeFile(path.join(dst,file),result.bytes);
  console.log(file,JSON.stringify({raise:result.raise,seat:result.after.seat}));
 }
}