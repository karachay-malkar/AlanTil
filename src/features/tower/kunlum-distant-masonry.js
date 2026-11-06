import {kunlumRuinCrown,kunlumRuinFoot} from './kunlum-wall-ground.js?v=17.2.77';

const reviewAsset=new URL('../../../assets/tower/approved-library/lod-review/models.json',import.meta.url);
let towerPositions;

export function loadDistantTower(){
 if(!towerPositions) towerPositions=fetch(reviewAsset).then(response=>{
  if(!response.ok)throw Error('Kunlum distant masonry HTTP '+response.status);
  return response.json();
 }).then(({tower})=>tower).catch(error=>{
  towerPositions=null;
  throw error;
 });
 return towerPositions;
}

export function createDistantMasonry(THREE,positions,material){
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.computeVertexNormals();
 geometry.computeBoundingSphere();
 return new THREE.Mesh(geometry,material);
}

export function distantWallPositions(segments){
 const positions=[];
 function quad(a,b,c,d){
  positions.push(...a,...b,...c,...a,...c,...d);
 }
 const paths=[];
 for(const segment of segments){
  const {a,b}=segment,dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  if(length<.01)continue;
  const lastPath=paths.at(-1),last=lastPath?.at(-1);
  const part={...segment,dx,dz,length,axis:[-dz/length,dx/length]};
  if(last&&last.featureId===part.featureId&&last.width===part.width&&last.height===part.height&&
   Math.hypot(last.b[0]-a[0],last.b[1]-a[1])<.001&&last.axis[0]*part.axis[0]+last.axis[1]*part.axis[1]>-.4)
   lastPath.push(part);
  else paths.push([part]);
 }
 for(const path of paths){
  let previous;
  for(const [index,{a,width,height,heightAt,dx,dz,length,axis}] of path.entries()){
   const steps=Math.ceil(length/1.35);
   const next=path[index+1];
   for(let i=index===0?0:1;i<=steps;i++){
    const x=a[0]+dx*i/steps,z=a[1]+dz*i/steps;
    const joint=i===steps&&next;
    const nx=axis[0]+(joint?next.axis[0]:0),nz=axis[1]+(joint?next.axis[1]:0);
    const normalLength=Math.hypot(nx,nz);
    const normal=[nx/normalLength,nz/normalLength];
    const bottom=kunlumRuinFoot(x,z,width,heightAt,normal);
    const top=heightAt(x,z)+kunlumRuinCrown(height,x,z);
    const side=(sign,y)=>[x+sign*normal[0]*width*.5,y,z+sign*normal[1]*width*.5];
    const ring=[side(1,bottom),side(-1,bottom),side(-1,top),side(1,top)];
    if(previous){
     for(let j=0;j<4;j++){
      const k=(j+1)%4;
      quad(previous[k],ring[k],ring[j],previous[j]);
     }
    }else quad(...ring.slice().reverse());
    previous=ring;
   }
  }
  quad(...previous);
 }
 return positions;
}

export function masonryFade(source,{start,end,distant}){
 const material=source.clone();
 const compile=source.onBeforeCompile;
 material.customProgramCacheKey=()=>source.customProgramCacheKey()+':masonry:'+start+':'+end+':'+distant;
 material.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);
  shader.vertexShader='varying vec3 vMasonryWorld;\nvarying float vMasonryZoom;\n'+shader.vertexShader.replace(
   '#include <project_vertex>',`#include <project_vertex>
   vec4 masonryPoint = vec4(transformed, 1.0);
   #ifdef USE_INSTANCING
    masonryPoint = instanceMatrix * masonryPoint;
   #endif
   vMasonryWorld = (modelMatrix * masonryPoint).xyz;
   vMasonryZoom = abs(projectionMatrix[1][1]);`
  );
  shader.fragmentShader='varying vec3 vMasonryWorld;\nvarying float vMasonryZoom;\n'+shader.fragmentShader.replace(
   '#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
   float masonryDistance = distance(cameraPosition, vMasonryWorld) * 2.60509 / vMasonryZoom;
   float masonryMix = smoothstep(${start}.0, ${end}.0, masonryDistance);
   vec2 masonryPixel = floor(gl_FragCoord.xy) + vec2(17.0, 41.0);
   float masonryNoise = fract(52.9829189 * fract(dot(masonryPixel, vec2(0.06711056, 0.00583715))));
   if (${distant?'masonryNoise >= masonryMix':'masonryNoise < masonryMix'}) discard;`
  );
 };
 return material;
}
