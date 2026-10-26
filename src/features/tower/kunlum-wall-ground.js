/**
 * One deterministic ruin profile and foundation for mapped Kunlum wall bodies,
 * near Common100 faces and distant faceted faces. Render-only: terrain DEM,
 * archaeological polylines, openings and save data are never changed.
 */
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const hash=(x,z)=>{const h=Math.sin(x*127.1+z*311.7)*43758.5453123;return h-Math.floor(h)};
function noise(x,z,period){
 const a=Math.floor(x/period),b=Math.floor(z/period);
 const u=x/period-a,v=z/period-b;
 const s=t=>t*t*(3-2*t),tx=s(u),tz=s(v);
 const lo=(1-tx)*hash(a,b)+tx*hash(a+1,b);
 const hi=(1-tx)*hash(a,b+1)+tx*hash(a+1,b+1);
 return lo*(1-tz)+hi*tz;
}
/** Removed stones break the crown, never the lower structural courses. */
export function kunlumRuinCrown(height,x,z){
 if(!Number.isFinite(height)||height<=0||!Number.isFinite(x)||!Number.isFinite(z))
  throw Error('Invalid wall crown input');
 const broad=noise(x+17.3,z-9.1,3.3);
 const chips=noise(x-1.8,z+22.2,.83);
 const rare=clamp((chips-.71)/.29);
 const loss=.035+.105*broad+.103*chips+.13*rare*rare;
 return Math.max(height*.58,height-Math.min(.37,loss));
}
/** Footings lie BELOW the lowest terrain contact across the width and run.
 * The downhill side is supported, the uphill side is naturally buried.
 */
export function kunlumRuinFoot(x,z,width,heightAt,axis=[1,0]){
 if(!Number.isFinite(x)||!Number.isFinite(z)||!(width>0)||typeof heightAt!=='function')
  throw Error('Invalid wall foundation input');
 const [nx,nz]=axis,l=Math.hypot(nx,nz)||1,u=nx/l,v=nz/l;
 const side=width*.58;
 const values=[
  heightAt(x,z),
  heightAt(x+u*side,z+v*side),heightAt(x-u*side,z-v*side),
  heightAt(x-v*.30,z+u*.30),heightAt(x+v*.30,z-u*.30)
 ];
 if(values.some(y=>!Number.isFinite(y)))return NaN;
 return Math.min(...values)-.18;
}
/**
 * Soil sediment bands and angular fallen stones along the REAL uncut wall
 * intervals. No scatter is placed over doorway/passage gaps or build meshes.
 */
export function createKunlumWallFootings(THREE,segments,heightAt,{mobile=false}={}){
 const root=new THREE.Group();root.name='Kunlum wall embedded sediment and fallen stones';
 const owned=[],points=[],tones=[],seeds=[],rubble=[];
 const tint=new THREE.Color();
 const maxRubble=mobile?1300:3600;
 let accepted=0,unitIndex=0;
 for(const segment of segments){
  const {a,b,width}=segment;
  const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  if(len<.05)continue;
  const nx=-dz/len,nz=dx/len;
  const steps=Math.max(1,Math.ceil(len/.72));
  for(let i=0;i<steps;i++){
   const t0=i/steps,t1=(i+1)/steps,tm=(t0+t1)*.5;
   const key=hash(a[0]*2.6+unitIndex,a[1]*1.7+i);
   for(const side of [-1,1]){
    const base=width*.48,spread=.38+.31*hash(unitIndex+i*1.9,side*5);
    const k0=base+spread*(.85+.25*hash(i+unitIndex,side));
    const k1=base+spread*(.85+.25*hash(i+1+unitIndex,side));
    const at=(t,d)=>{const x=a[0]+dx*t+nx*d*side,z=a[1]+dz*t+nz*d*side;
     return [x,heightAt(x,z)+.022,z]};
    const A=at(t0,base),B=at(t1,base),C=at(t1,k1),D=at(t0,k0);
    // Two actual triangles, matching the rendered terrain height sample.
    if([A,B,C,D].every(p=>Number.isFinite(p[1]))){
     points.push(...A,...B,...C,...A,...C,...D);
     const stain=.69+.21*key+.07*hash(i+7,side);
     tint.set('#a59b7d').multiplyScalar(stain);
     for(let j=0;j<6;j++)tones.push(tint.r,tint.g,tint.b);
    }
    if(accepted>=maxRubble||hash(unitIndex+i*7.3,side*13)<.38)continue;
    const dist=base+.11+.54*hash(unitIndex+3*i,side+7);
    const t=tm+(hash(i+unitIndex,side+11)-.5)*.5/steps;
    const x=a[0]+dx*t+nx*dist*side,z=a[1]+dz*t+nz*dist*side;
    const y=heightAt(x,z);
    if(!Number.isFinite(y))continue;
    const r=.08+.23*Math.pow(hash(x*3,z*2),2);
    // Keep one rough shoulder visible while burying the lower half.
    rubble.push({x,y:y-r*.15,z,r,angle:hash(x,z)*Math.PI*2});
    accepted++;
   }
  }
  unitIndex++;
 }
 if(points.length){
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(tones,3));
  geo.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({
   color:0xffffff,vertexColors:true,roughness:1,
   side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,
   polygonOffsetFactor:-1,polygonOffsetUnits:-1
  });
  const soil=new THREE.Mesh(geo,mat);
  soil.name='Eroded soil under wall edges';soil.frustumCulled=false;
  soil.renderOrder=2;root.add(soil);owned.push(geo,mat);
 }
 if(rubble.length){
  const geo=new THREE.IcosahedronGeometry(1,0);
  const mat=new THREE.MeshStandardMaterial({color:'#93877a',roughness:1,flatShading:true});
  const mesh=new THREE.InstancedMesh(geo,mat,rubble.length),dummy=new THREE.Object3D();
  mesh.name='Embedded fallen 3D wall stone fragments';mesh.frustumCulled=false;
  const color=new THREE.Color();
  rubble.forEach((p,i)=>{
   dummy.position.set(p.x,p.y,p.z);
   dummy.rotation.set(.12,p.angle,-.13);
   dummy.scale.set(p.r*(.85+hash(i,2)*1.1),p.r*(.44+hash(i,3)*.6),p.r*(.8+hash(i,4)*.7));
   dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   color.set('#a89b88').multiplyScalar(.77+.27*hash(i,9));mesh.setColorAt(i,color);
  });
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  root.add(mesh);owned.push(geo,mat,mesh);
 }
 return {root,counts:{soilTriangles:points.length/9,stones:rubble.length},
  dispose(){for(const o of owned)o.dispose?.()}};
}
