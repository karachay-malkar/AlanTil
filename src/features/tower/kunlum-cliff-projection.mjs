/** Only close, steep rock faces need side-on detail to avoid stretched UVs.
 * Builds on MeshStandardMaterial, retaining lighting, vertex-colour biomes,
 * normal maps and a fully usable generated-texture fallback.
 */
export function installKunlumCliffTriplanar(material,{textureScale=.27}={}){
 if(!material||!(textureScale>0&&Number.isFinite(textureScale)))
  throw new TypeError('Invalid cliff material/projection scale');
 const previous=material.onBeforeCompile;
 const previousKey=material.customProgramCacheKey?.bind(material);
 material.onBeforeCompile=shader=>{
  previous?.(shader);
  const v=shader.vertexShader,f=shader.fragmentShader;
  if(!v.includes('#include <begin_vertex>')||!f.includes('#include <map_fragment>'))return;
  shader.vertexShader=v
   .replace('#include <common>','#include <common>\nvarying vec3 vKunlumCliffPosition;\nvarying vec3 vKunlumCliffNormal;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvKunlumCliffPosition=(modelMatrix*vec4(transformed,1.0)).xyz;\nvKunlumCliffNormal=normalize(mat3(modelMatrix)*normal);');
  shader.fragmentShader=f
   .replace('#include <common>','#include <common>\nvarying vec3 vKunlumCliffPosition;\nvarying vec3 vKunlumCliffNormal;')
   .replace('#include <map_fragment>',`
#ifdef USE_MAP
 vec4 sampledDiffuseColor=texture2D(map,vMapUv);
 vec3 cliffNormal=normalize(vKunlumCliffNormal);
 float cliffSteepness=1.0-abs(cliffNormal.y);
 float cliffNear=1.0-smoothstep(90.0,210.0,length(vKunlumCliffPosition-cameraPosition));
 float cliffBlend=smoothstep(0.36,0.72,cliffSteepness)*cliffNear;
 if(cliffBlend>0.015){
  vec3 cliffWeight=pow(abs(cliffNormal),vec3(5.0));
  cliffWeight/=max(dot(cliffWeight,vec3(1.0)),0.00001);
  vec4 cliffSample=
   texture2D(map,vKunlumCliffPosition.yz*${textureScale.toFixed(6)})*cliffWeight.x+
   texture2D(map,vKunlumCliffPosition.xz*${textureScale.toFixed(6)})*cliffWeight.y+
   texture2D(map,vKunlumCliffPosition.xy*${textureScale.toFixed(6)})*cliffWeight.z;
  sampledDiffuseColor=mix(sampledDiffuseColor,cliffSample,cliffBlend);
 }
 diffuseColor *= sampledDiffuseColor;
#endif
`);
 };
 material.customProgramCacheKey=()=> (previousKey?.()||'standard')+'-kunlum-cliff-triplanar-v1';
 material.needsUpdate=true;
 return material;
}
