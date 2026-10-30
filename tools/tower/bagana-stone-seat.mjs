/** Restore full physical support of each Bagana timber foot on its own Common100 stone.
 * Modifies only stone POSITION/NORMAL data in approved GLBs; wood, UVs,
 * topology, materials, height and model IDs remain untouched.
 * Usage: node tools/tower/bagana-stone-seat.mjs <input-dir> <output-dir>
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

function meshData(bytes,gltf,meshIndex,binOffset){
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const primitive=gltf.meshes[meshIndex].primitives[0],accessors=gltf.accessors;
 const position=accessors[primitive.attributes.POSITION],normal=accessors[primitive.attributes.NORMAL],index=accessors[primitive.indices];
 const offset=a=>binOffset+(gltf.bufferViews[a.bufferView].byteOffset||0)+(a.byteOffset||0);
 if(position.componentType!==5126||normal.componentType!==5126)throw Error('Unsupported float mesh');
 const pOffset=offset(position),nOffset=offset(normal),iOffset=offset(index);
 const positions=Array.from({length:position.count},(_,i)=>[
   dv.getFloat32(pOffset+i*12,true),dv.getFloat32(pOffset+i*12+4,true),dv.getFloat32(pOffset+i*12+8,true)]);
 const indices=Array.from({length:index.count},(_,i)=>index.componentType===5123
  ?dv.getUint16(iOffset+i*2,true):dv.getUint32(iOffset+i*4,true));
 return {positions,indices,pOffset,nOffset};
}

function inspect(bytes){
 if(!Buffer.isBuffer(bytes))bytes=Buffer.from(bytes);
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2||dv.getUint32(8,true)!==bytes.length)
  throw Error('Invalid Bagana GLB');
 const jsonLength=dv.getUint32(12,true);
 const gltf=JSON.parse(bytes.toString('utf8',20,20+jsonLength).trim());
 if(gltf.meshes?.length!==2||!gltf.asset.generator.includes('Common100'))
  throw Error('Expected one Common100 rock and one timber mesh');
 const binOffset=28+jsonLength;
 return {bytes,gltf,wood:meshData(bytes,gltf,0,binOffset),stone:meshData(bytes,gltf,1,binOffset)};
}

function contactSamples(wood){
 const bottom=Math.min(...wood.positions.map(p=>p[1]));
 const points=wood.positions.filter(p=>p[1]<bottom+.001).map(p=>[p[0],p[2]]);
 for(const radius of [.03,.08,.13])for(let i=0;i<32;i++){
  const angle=i*Math.PI/16;points.push([radius*Math.cos(angle),radius*Math.sin(angle)]);
 }
 points.push([0,0]);
 return {bottom,points};
}

/** Intersect vertical line with actual indexed triangles, not bounding boxes. */
function supportAt(rock,x,z){
 let height=-Infinity,triangle=-1;
 const {positions,indices}=rock;
 for(let i=0;i<indices.length;i+=3){
  const a=positions[indices[i]],b=positions[indices[i+1]],c=positions[indices[i+2]];
  const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  if(Math.abs(det)<1e-12)continue;
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det;
  const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;
  const w=1-u-v;
  if(u>=-1e-5&&v>=-1e-5&&w>=-1e-5){
   const y=u*a[1]+v*b[1]+w*c[1];
   if(y>height){height=y;triangle=i;}
  }
 }
 return {height,triangle};
}

function metrics(wood,stone){
 const {bottom,points}=contactSamples(wood);
 const hits=points.map(([x,z])=>supportAt(stone,x,z));
 const uncovered=hits.filter(p=>p.triangle<0).length;
 const gaps=hits.map(p=>bottom-p.height);
 return {bottom,sampleCount:points.length,uncovered,maxGap:Math.max(...gaps),
  maxPenetration:-Math.min(...gaps),hits,points};
}

function saveStone(bytes,stone){
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const {positions,indices,pOffset,nOffset}=stone;
 const normals=Array.from({length:positions.length},()=>[0,0,0]);
 for(let i=0;i<indices.length;i+=3){
  const ia=indices[i],ib=indices[i+1],ic=indices[i+2],a=positions[ia],b=positions[ib],c=positions[ic];
  const ab=b.map((v,j)=>v-a[j]),ac=c.map((v,j)=>v-a[j]);
  const nx=ab[1]*ac[2]-ab[2]*ac[1],ny=ab[2]*ac[0]-ab[0]*ac[2],nz=ab[0]*ac[1]-ab[1]*ac[0];
  for(const j of [ia,ib,ic]){normals[j][0]+=nx;normals[j][1]+=ny;normals[j][2]+=nz;}
 }
 for(let i=0;i<positions.length;i++){
  const p=positions[i],n=normals[i],length=Math.hypot(...n);
  for(let axis=0;axis<3;axis++){
   dv.setFloat32(pOffset+i*12+axis*4,p[axis],true);
   dv.setFloat32(nOffset+i*12+axis*4,length>1e-10?n[axis]/length:0,true);
  }
 }
}

export function measureBaganaSupport(input){
 const {wood,stone}=inspect(input),{hits,points,...data}=metrics(wood,stone);
 const heights=stone.positions.map(p=>p[1]);
 const extents=[0,2].map(axis=>Math.max(...stone.positions.map(p=>p[axis]))-Math.min(...stone.positions.map(p=>p[axis])));
 return {...data,stoneHeight:Math.max(...heights)-Math.min(...heights),stoneExtents:extents};
}

export function seatBaganaStoneGlb(input,{form}){
 if(![1,2,3].includes(form))throw Error('Invalid Bagana form');
 const {bytes,wood,stone}=inspect(input);
 const before=metrics(wood,stone);
 if(before.uncovered===0&&before.maxGap<=.005)return {bytes,modified:false,before:measureBaganaSupport(bytes),after:measureBaganaSupport(bytes)};
 // Enlarge the *natural stone*, never shift, shorten or thin the timber.
 // Form 3 has a missing area of stone directly below the right-hand foot.
 const scaleX=form===3?1.12:1.04,scaleZ=form===3?1.30:1.08;
 for(const p of stone.positions){p[0]*=scaleX;p[2]*=scaleZ;}
 const {bottom,points}=contactSamples(wood),required=new Set();
 for(const [x,z] of points){
  const {height,triangle}=supportAt(stone,x,z);
  if(triangle<0)throw Error('Stone outline still does not cover the wooden foot');
  if(height<bottom-.005)for(let i=0;i<3;i++)required.add(stone.indices[triangle+i]);
 }
 // Flatten only the selected bearing facets of the natural stone.
 // Irregular outside silhouette, original 25cm height and lower facets remain.
 const level=bottom+(form===1?.013:.009);
 for(const idx of required)stone.positions[idx][1]=Math.max(stone.positions[idx][1],level);
 saveStone(bytes,stone);
 const after=measureBaganaSupport(bytes);
 if(after.uncovered!==0||after.maxGap>.005||after.maxPenetration>.028||Math.abs(after.stoneHeight-.25)>.001
  ||after.stoneExtents.some(s=>s>.75))throw Error('Bad support after stone fitting: '+JSON.stringify(after));
 return {bytes,modified:true,before:{uncovered:before.uncovered,maxGap:before.maxGap},after,raisedVertices:required.size};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [sourceDir,targetDir]=process.argv.slice(2);
 if(!sourceDir||!targetDir||path.resolve(sourceDir)===path.resolve(targetDir))
  throw Error('Provide different source and output directories');
 await mkdir(targetDir,{recursive:true});
 let modified=0;
 for(let form=1;form<=3;form++)for(const woodCells of [8,9,10,11,12]){
  const name='bagana-f'+form+'-3x'+(woodCells+1)+'x3-v2.glb';
  const result=seatBaganaStoneGlb(await readFile(path.join(sourceDir,name)),{form});
  await writeFile(path.join(targetDir,name),result.bytes);
  console.log(name,JSON.stringify({modified:result.modified,gapBefore:result.before.maxGap,gapAfter:result.after.maxGap}));
  if(result.modified)modified++;
 }
 console.log('Modified Bagana stone models:',modified);
}
