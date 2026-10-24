/**
 * Render-only Kunlum terrain detail. Does not modify DEM coordinates, raycasts or saves.
 * Fractal rock/soil/vegetation grain is artistic, not a geospatial observation.
 * The shader retains Three.js PBR lighting and existing satellite imagery.
 */
export function installKunlumDetailShader(material){
 if(!material||typeof material!=='object')throw new Error('Missing terrain material');
 const previous=material.onBeforeCompile;
 material.onBeforeCompile=shader=>{
  if(typeof previous==='function')previous(shader);
  shader.vertexShader=shader.vertexShader.replace(
   '#include <common>',
   '#include <common>\nvarying vec3 vKunlumTerrainWorld;\nvarying float vKunlumSlope;'
  );
  shader.vertexShader=shader.vertexShader.replace(
   '#include <begin_vertex>',
   '#include <begin_vertex>\nvKunlumTerrainWorld=(modelMatrix*vec4(transformed,1.0)).xyz;\nvKunlumSlope=1.0-abs(normalize(mat3(modelMatrix)*normal).y);'
  );
  shader.fragmentShader=shader.fragmentShader.replace(
   '#include <common>',
   `#include <common>
varying vec3 vKunlumTerrainWorld;
varying float vKunlumSlope;
float kunlumHash(vec2 p) {
  vec3 p3=fract(vec3(p.xyx)*.1031);
  p3+=dot(p3,p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z);
}
float kunlumNoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(kunlumHash(i),kunlumHash(i+vec2(1.,0.)),f.x),
             mix(kunlumHash(i+vec2(0.,1.)),kunlumHash(i+vec2(1.,1.)),f.x),f.y);
}
float kunlumFbm(vec2 p){
  return .57*kunlumNoise(p)+.29*kunlumNoise(p*2.07)+.14*kunlumNoise(p*4.13);
}`
  );
  shader.fragmentShader=shader.fragmentShader.replace(
   '#include <color_fragment>',
   `#include <color_fragment>
  // Multi-scale albedo only: no invented displacement or new topographic features.
  vec2 uvWorld=vKunlumTerrainWorld.xz;
  float large=kunlumFbm(uvWorld*.17);
  float small=kunlumFbm(uvWorld*.9);
  float micro=kunlumNoise(uvWorld*2.7);
  float gravel=smoothstep(.56,.82,large+.10*(small-.5));
  float steep=clamp(vKunlumSlope*3.5,0.,1.);
  float rock=clamp(steep*.72+gravel*.30,0.,.9);
  float soil=clamp((large-.38)*.8,0.,.35);
  vec3 grassTint=mix(vec3(.93,1.06,.88),vec3(1.10,1.03,.91),soil);
  vec3 rockTint=mix(vec3(.98,.98,.94),vec3(1.10,1.04,.96),large);
  vec3 tint=mix(grassTint,rockTint,rock);
  tint*=.82+.33*small+.10*(micro-.5);
  diffuseColor.rgb*=clamp(tint,vec3(.65),vec3(1.22));`
  );
 };
 material.customProgramCacheKey=()=> 'kunlum-pbr-detail-v1';
 material.needsUpdate=true;
 return material;
}
export function kunlumDetailSubdivision({half,quality='interactive',mobile=false}){
 if(!Number.isInteger(half)||half<1||half>60)throw new Error('Invalid DEM region');
 if(quality!=='beautiful')return 1;
 // No fabricated elevations: only tessellate the original linear DEM facets.
 return half<=20?4:(mobile?2:2);
}
export function getKunlumTerrainMeshStats(half,divisions){
 const cells=2*half*divisions;
 return {vertices:(cells+1)*(cells+1),triangles:2*cells*cells};
}

/**
 * Selective satellite-green colour grade; keeps rock, water and stone walls alone.
 * Uses source pixel colour instead of tinting the entire scene. No new textures.
 * Shared by fast and beautiful terrain shaders. Bare DEM remains ungraded.
 */
export function installKunlumSlopeGrade(materials,{vegetationLift=.22}={}){
 if(!Array.isArray(materials)||!materials.length)throw Error('Terrain materials required');
 if(!(vegetationLift>=0&&vegetationLift<=.5))throw Error('Bad vegetation lift');
 const state={active:1,uniforms:[]};
 for(const material of materials){
  const prior=material.onBeforeCompile;
  const key=material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile=shader=>{
   if(typeof prior==='function')prior(shader);
   const uniform={value:state.active};
   state.uniforms.push(uniform);
   shader.uniforms.uKunlumGreenGrade=uniform;
   shader.fragmentShader=shader.fragmentShader.replace(
    '#include <common>',
    '#include <common>\nuniform float uKunlumGreenGrade;'
   );
   shader.fragmentShader=shader.fragmentShader.replace(
    '#include <color_fragment>',
    `#include <color_fragment>
    // Warm, gently desaturate and lift only genuinely green satellite pixels.
    float greenDominance=(diffuseColor.g-max(diffuseColor.r,diffuseColor.b))
      /max(diffuseColor.g,.05);
    float plantMask=smoothstep(.12,.40,greenDominance)*uKunlumGreenGrade;
    vec3 sunlitGreen=diffuseColor.rgb*vec3(1.30,1.21,1.14)
      +vec3(.012,.008,.005);
    diffuseColor.rgb=mix(diffuseColor.rgb,sunlitGreen,plantMask);`
   );
  };
  material.customProgramCacheKey=()=> (key?key():'standard')+'-kunlum-green-v1';
  material.needsUpdate=true;
 }
 return {setActive(value){
  state.active=value?vegetationLift/.22:0;
  for(const uniform of state.uniforms)uniform.value=state.active;
 },get active(){return state.active}};
}
