/** Bake organic, irregular 3D timber into the existing approved Bagana GLBs.
 * This edits only the wooden POSITION/NORMAL buffer views. Stone geometry,
 * UVs, mesh topology, silhouette of the three tops, IDs and all transforms
 * are preserved. Source assets: AlanTil 17.2.43, before the organic bake.
 */
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const gaussian=(x,s)=>Math.exp(-.5*(x/s)**2);

export function sculptBaganaGlb(input,{form,woodCells}){
 if(![1,2,3].includes(form)||![8,9,10,11,12].includes(woodCells))throw Error('Unsupported Bagana variant');
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2||
    dv.getUint32(8,true)!==bytes.byteLength)throw Error('Invalid GLB');
 const jsonLen=dv.getUint32(12,true),jsonOffset=20;
 let text='';
 for(let i=jsonOffset;i<jsonOffset+jsonLen;i+=4096)
  text+=String.fromCharCode(...bytes.subarray(i,Math.min(jsonOffset+jsonLen,i+4096)));
 const gltf=JSON.parse(text.trim());
 const originalVersion=gltf.asset?.generator?.match(/timber v[34]/)?.[0];
 if(!originalVersion)throw Error('Source must be unbaked Bagana timber v3/v4');
 if(gltf.meshes?.length!==2||gltf.meshes[0].primitives.length!==1)throw Error('Unexpected Bagana geometry');
 const primitive=gltf.meshes[0].primitives[0],accessors=gltf.accessors;
 const posAcc=accessors[primitive.attributes.POSITION],norAcc=accessors[primitive.attributes.NORMAL];
 const idxAcc=accessors[primitive.indices],views=gltf.bufferViews,binOffset=20+jsonLen+8;
 if(posAcc.componentType!==5126||norAcc.componentType!==5126||
    idxAcc.componentType!==5123||posAcc.count!==norAcc.count)throw Error('Unexpected attribute layout');
 const offset=accessor=>binOffset+(views[accessor.bufferView].byteOffset||0)+(accessor.byteOffset||0);
 const p0=offset(posAcc),n0=offset(norAcc),i0=offset(idxAcc),count=posAcc.count;
 const pos=new Float32Array(count*3);
 let lo=Infinity,hi=-Infinity;
 for(let i=0;i<pos.length;i++){pos[i]=dv.getFloat32(p0+i*4,true);if(i%3===1){lo=Math.min(lo,pos[i]);hi=Math.max(hi,pos[i]);}}
 if(hi-lo<1.8||hi-lo>4)throw Error('Unexpected post height');
 const phase=form*1.67+woodCells*.17;
 let maxDelta=0,deformed=0;
 for(let i=0;i<count;i++){
  const x=pos[i*3],y=pos[i*3+1],z=pos[i*3+2],r=Math.hypot(x,z),theta=Math.atan2(z,x);
  const t=(y-lo)/(hi-lo);
  // Preserve stone contact and the existing flat, forked or saddled top exactly.
  const w=smooth(.008,.17,t)*(1-smooth(form===1?.59:.87,form===1?.75:.985,t));
  if(w<1e-8||r<.052)continue;
  const bendX=w*(.033*Math.sin(4.0*t+phase)+.010*Math.sin(11*t-phase));
  const bendZ=w*(.028*Math.cos(5.1*t+phase)+.010*Math.sin(9.2*t+phase));
  // Taper, elliptical/triangular growth, knots and locally flattened areas.
  const taper=.055*Math.sin(4.7*t+phase*.7)+.057*(1-t)-.018*t;
  const shape=.138*Math.sin(3*theta+2.8*t+phase)+
    .069*Math.sin(6*theta-3.7*t+phase*.6)+
    .036*Math.cos(10*theta+8*t-phase);
  let depth=0;
  // Three crooked grain cracks with tapered ends, nonuniform width and depth.
  for(let k=0;k<3;k++){
   const start=.19+.115*k, end=.70+.065*(k%2);
   const active=smooth(start,start+.07,t)*(1-smooth(end-.09,end,t));
   const angle=phase*.72+k*2.15+.17*Math.sin(t*7+k*1.8+phase);
   depth+=(.010+.003*(k%2))*active*gaussian(wrap(theta-angle),.135+.022*k);
  }
  // Small scars and pits: these are real depressions in the mesh, not decals.
  for(let k=0;k<5;k++){
   const ty=.22+.13*k+.024*Math.sin(k*3.2+phase);
   const angle=phase*.43+k*2.30;
   depth+=(.006+.002*(k%3))*gaussian(t-ty,.047+.014*(k%2))*
     gaussian(wrap(theta-angle),.20);
  }
  const shallowGrain=.0022*Math.sin(16*theta+28*t+phase);
  const nextR=Math.max(.070,r*(1+w*(taper+shape))-w*depth+w*shallowGrain);
  const nx=nextR*Math.cos(theta)+bendX,nz=nextR*Math.sin(theta)+bendZ;
  maxDelta=Math.max(maxDelta,Math.hypot(nx-x,nz-z));deformed++;
  pos[i*3]=nx;pos[i*3+2]=nz;
 }
 for(let i=0;i<pos.length;i++)dv.setFloat32(p0+i*4,pos[i],true);
 // Mark geometry as baked without changing the JSON chunk length or offsets.
 const marked=text.replace(originalVersion,'timber v5');
 if(marked.length!==text.length)throw Error('Nonconstant JSON stamp');
 for(let i=0;i<marked.length;i++)if(marked.charCodeAt(i)!==text.charCodeAt(i))bytes[jsonOffset+i]=marked.charCodeAt(i);
 // Area-weighted smooth vertex normals for the final, physical surface.
 const normal=new Float64Array(count*3);
 for(let i=0;i<idxAcc.count;i+=3){
  const ia=dv.getUint16(i0+i*2,true),ib=dv.getUint16(i0+(i+1)*2,true),ic=dv.getUint16(i0+(i+2)*2,true);
  const a=ia*3,b=ib*3,c=ic*3;
  const abx=pos[b]-pos[a],aby=pos[b+1]-pos[a+1],abz=pos[b+2]-pos[a+2];
  const acx=pos[c]-pos[a],acy=pos[c+1]-pos[a+1],acz=pos[c+2]-pos[a+2];
  const nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx;
  for(const v of [a,b,c]){normal[v]+=nx;normal[v+1]+=ny;normal[v+2]+=nz;}
 }
 for(let i=0;i<count;i++){
  const j=i*3,len=Math.hypot(normal[j],normal[j+1],normal[j+2]);
  if(len>1e-12){dv.setFloat32(n0+j*4,normal[j]/len,true);dv.setFloat32(n0+(j+1)*4,normal[j+1]/len,true);dv.setFloat32(n0+(j+2)*4,normal[j+2]/len,true);}
 }
 return {bytes,metrics:{form,woodCells,vertices:count,triangles:idxAcc.count/3,deformed,maxDelta,stonePreserved:true}};
}
