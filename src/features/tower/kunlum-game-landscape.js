/**
 * Procedural game-terrain PBR layer for Kunlum. No satellite imagery or external
 * texture downloads. Albedo, grain and roughness are artistic, not mapped landcover.
 * 4 seamless, deterministic texture maps, generated once per preview instance.
 * DEM positions, wall geometry and tower alignment are never modified here.
 */
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const blend=(a,b,t)=>a+(b-a)*t;
const wrap=(v,size)=>((v%size)+size)%size;
const hash=(x,y,seed)=>{
 let v=(Math.imul(x+seed,374761393)+Math.imul(y-seed,668265263))|0;
 v=Math.imul(v^(v>>>13),1274126177);
 return ((v^(v>>>16))>>>0)/4294967295;
};
export function kunlumTileNoise(x,y,frequency,seed=1){
 const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b;
 const smooth=t=>t*t*(3-2*t);
 const fx=smooth(u),fy=smooth(v);
 const aa=hash(wrap(a,frequency),wrap(b,frequency),seed);
 const ab=hash(wrap(a+1,frequency),wrap(b,frequency),seed);
 const ba=hash(wrap(a,frequency),wrap(b+1,frequency),seed);
 const bb=hash(wrap(a+1,frequency),wrap(b+1,frequency),seed);
 return blend(blend(aa,ab,fx),blend(ba,bb,fx),fy);
}
export function kunlumTerrainMasks(elevation,slope,patch){
 const p=clamp(patch),s=Math.max(0,slope);
 // The DEM gradient is a rise/run ratio, not an angle. Earlier dividing it by
 // 1+slope suppressed gray-rock coverage and made the hills uniformly green.
 const sharp=s+(elevation-1550)*.00024+(p-.5)*.18;
 const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t)};
 const rock=smooth(.23,.88,sharp);
 const scree=smooth(.13,.65,s+(p-.5)*.26)*(1-rock*.64);
 const soil=clamp(.22+p*.48+(s-.3)*.10)*(1-rock*.72);
 return {rock,scree,soil};
}
export function createKunlumTerrainTiles(THREE,{resolution=256}={}){
 if(!THREE||!Number.isInteger(resolution)||resolution<32||resolution>512)
  throw Error('Invalid game-landscape texture settings');
 const palettes={
  grass:{lo:[112,135,78],hi:[174,180,112],seed:37,contrast:30},
  soil:{lo:[132,99,65],hi:[189,155,110],seed:83,contrast:28},
  scree:{lo:[150,139,118],hi:[213,197,164],seed:173,contrast:34},
  rock:{lo:[139,140,130],hi:[218,211,191],seed:271,contrast:34}
 };
 // Compute periodic fractal texture grain once; each material uses a different
 // wrapped phase offset, avoiding four expensive rounds of noise generation.
 const grainBase=new Float32Array(resolution*resolution);
 const fineBase=new Float32Array(resolution*resolution);
 for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
  const nx=x/resolution,ny=y/resolution,p=y*resolution+x;
  const coarse=kunlumTileNoise(nx*8,ny*8,8,37);
  const mid=kunlumTileNoise(nx*32,ny*32,32,42);
  const fine=kunlumTileNoise(nx*64,ny*64,64,46);
  grainBase[p]=clamp(.55*coarse+.31*mid+.14*fine);
  fineBase[p]=fine;
 }
 const textures={};
 for(const [name,type] of Object.entries(palettes)){
  const arr=new Uint8Array(resolution*resolution*4);
  const phaseX=(type.seed*37)%resolution,phaseY=(type.seed*19)%resolution;
  for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
   const at=((y+phaseY)%resolution)*resolution+(x+phaseX)%resolution;
   const grain=grainBase[at],fine=fineBase[at],p=(y*resolution+x)*4;
   for(let c=0;c<3;c++){
    const shade=blend(type.lo[c],type.hi[c],grain);
    arr[p+c]=Math.round(clamp((shade+(fine-.5)*type.contrast)/255)*255);
   }
   arr[p+3]=Math.round(grain*255);
  }
  const t=new THREE.DataTexture(arr,resolution,resolution,THREE.RGBAFormat);
  t.wrapS=THREE.RepeatWrapping;t.wrapT=THREE.RepeatWrapping;
  t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;
  t.generateMipmaps=true;t.colorSpace=THREE.SRGBColorSpace;
  t.needsUpdate=true;t.name='Kunlum generated '+name+' PBR albedo/grain';
  textures[name]=t;
 }
 return textures;
}
/**
 * Shader injection deliberately retains MeshStandardMaterial PBR lighting.
 * Texture UVs are generated from local x/z in metres; no map UV dependencies.
 */
export function installKunlumGameMaterials(THREE,materials,{mobile=false}={}){
 const tiles=createKunlumTerrainTiles(THREE,{resolution:mobile?128:256});
 const state={enabled:1,verticalScale:1,detail:1,uniforms:[]};
 for(const material of materials){
  if(!material)throw Error('Missing terrain material');
  const previous=material.onBeforeCompile;
  const key=material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile=shader=>{
   if(previous)previous(shader);
   const on={value:state.enabled},height={value:state.verticalScale},detail={value:state.detail};
   const u={uKunlumGameEnabled:on,uKunlumVerticalScale:height,uKunlumGameDetail:detail,
    uKunlumGrass:{value:tiles.grass},uKunlumRock:{value:tiles.rock},
    uKunlumScree:{value:tiles.scree},uKunlumSoil:{value:tiles.soil}};
   Object.assign(shader.uniforms,u);
   state.uniforms.push({on,height,detail});
   shader.vertexShader=shader.vertexShader.replace('#include <common>',
    '#include <common>\nvarying vec3 vKunlumGameWorld;\nvarying vec3 vKunlumGameNormal;');
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\nvKunlumGameWorld=position;\nvKunlumGameNormal=normal;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
    `#include <common>
varying vec3 vKunlumGameWorld;
varying vec3 vKunlumGameNormal;
uniform sampler2D uKunlumGrass;
uniform sampler2D uKunlumRock;
uniform sampler2D uKunlumScree;
uniform sampler2D uKunlumSoil;
uniform float uKunlumGameEnabled;
uniform float uKunlumVerticalScale;
uniform float uKunlumGameDetail;
`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
    `#include <color_fragment>
if(uKunlumGameEnabled > 0.5){
 vec3 worldPos=vKunlumGameWorld;
 float altitude=worldPos.y/max(.0001,uKunlumVerticalScale)+1251.24;
 float steep=1.0-abs(normalize(vKunlumGameNormal).y);
 vec2 horizontalUV=worldPos.xz;
 // Seamless metre-scale PBR maps, with larger mineral patches.
 vec4 grass=texture2D(uKunlumGrass,horizontalUV*.092);
 vec4 soil=texture2D(uKunlumSoil,horizontalUV*.073);
 vec4 scree=texture2D(uKunlumScree,horizontalUV*.087);
 vec4 rock=texture2D(uKunlumRock,horizontalUV*.106);
 float patch=texture2D(uKunlumSoil,horizontalUV*.0073).a;
 float rockWeight=clamp((steep-.16)*2.1+(altitude-1900.)/1700.+(patch-.5)*.26,0.,1.);
 float screeWeight=clamp((steep-.10)*1.05+(altitude-1550.)/2300.+(patch-.55)*.7,0.,1.)*(1.-rockWeight*.64);
 float soilWeight=clamp(.15+patch*.42+(steep-.30)*.18,0.,1.)*(1.-rockWeight*.74);
 vec3 painted=mix(grass.rgb,soil.rgb,soilWeight);
 painted=mix(painted,scree.rgb,screeWeight);
 painted=mix(painted,rock.rgb,rockWeight);
 diffuseColor.rgb=painted;
}
`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
    `#include <roughnessmap_fragment>
if(uKunlumGameEnabled > 0.5){
 float highRock=clamp((1.0-abs(normalize(vKunlumGameNormal).y))*2.3,0.,1.);
 float mineralGrain=texture2D(uKunlumRock,vKunlumGameWorld.xz*.106).a;
 roughnessFactor=clamp(mix(.97,.82,highRock)+(mineralGrain-.5)*.08,.65,1.);
}
`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',
    `#include <normal_fragment_maps>
if(uKunlumGameEnabled > 0.5 && uKunlumGameDetail > 0.5){
 // Fine bump comes from the same generated height/grain map.
 // Keep PBR world surface and vertex normals intact; only shade microdetail.
 float microHeight=texture2D(uKunlumRock,vKunlumGameWorld.xz*.106).a;
 normal=normalize(normal+vec3(-dFdx(microHeight),-dFdy(microHeight),0.)*.10);
}
`);
  };
  material.customProgramCacheKey=()=> (key?key():'standard')+'-kunlum-game-four-mats-v1';
  material.needsUpdate=true;
 }
 const update=()=>{for(const t of state.uniforms){t.on.value=state.enabled;t.height.value=state.verticalScale;t.detail.value=state.detail}};
 return {textures:tiles,
  setEnabled(value){state.enabled=value?1:0;update()},
  setDetail(value){state.detail=value?1:0;update()},
  setVerticalScale(value){if(!Number.isFinite(value)||value<=0)throw Error('Invalid DEM vertical scale');state.verticalScale=value;update()},
  dispose(){for(const t of Object.values(tiles))t.dispose()},
  get enabled(){return !!state.enabled}
 };
}


/**
 * Compatible PBR renderer that uses only native MeshStandardMaterial shaders.
 * Four PBR biome textures are composited at DEM vertices and an additional
 * neutral tiling albedo + tangent-space normal map supplies fragment detail.
 * This is a reliable fallback for mobile GPUs that reject custom GLSL programs.
 * It has no extra vertex varyings or onBeforeCompile injections.
 */
const srgbToLinear=c=>{
 c=clamp(c/255);return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);
};
export function kunlumNativeTerrainColor(elevation,slope,x,z,tiles){
 if(!Number.isFinite(elevation)||!Number.isFinite(slope)||!Number.isFinite(x)||!Number.isFinite(z))
  throw Error('Terrain colour coordinates must be finite');
 const data=(name,frequency)=>{
  const t=tiles[name],src=t?.image?.data;
  if(!src)throw Error('Missing native PBR texture '+name);
  const w=t.image.width,h=t.image.height;
  const u=((x*frequency%1)+1)%1,v=((z*frequency%1)+1)%1;
  const index=(Math.floor(v*h)*w+Math.floor(u*w))*4;
  return [src[index],src[index+1],src[index+2],src[index+3]/255];
 };
 const grass=data('grass',.092),soil=data('soil',.073),
  scree=data('scree',.087),rock=data('rock',.106);
 const patch=data('soil',.0073)[3];
 const masks=kunlumTerrainMasks(elevation,slope,patch);
 const rgb=[0,1,2].map(c=>{
  const base=blend(grass[c],soil[c],masks.soil);
  const gravel=blend(base,scree[c],masks.scree);
  return srgbToLinear(blend(gravel,rock[c],masks.rock));
 });
 return rgb;
}
export function createKunlumNativeTerrainPBR(THREE,{mobile=false}={}){
 const size=mobile?128:256;
 const tiles=createKunlumTerrainTiles(THREE,{resolution:size});
 const neutral=new Uint8Array(size*size*4),normals=new Uint8Array(size*size*4);
 const grain=tiles.rock.image.data;
 const sample=(x,y)=>grain[((((y+size)%size)*size)+((x+size)%size))*4+3];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const p=(y*size+x)*4,detail=sample(x,y)/255;
  // Neutral (almost white) albedo maintains distinct terrain biomes from vertices.
  const factor=clamp(.89+(detail-.5)*.23,.73,1);
  neutral[p]=Math.round(255*factor);
  neutral[p+1]=Math.round(255*factor);
  neutral[p+2]=Math.round(255*factor);neutral[p+3]=255;
  const gx=(sample(x+1,y)-sample(x-1,y))/255;
  const gy=(sample(x,y+1)-sample(x,y-1))/255;
  const nz=1/Math.sqrt(1+gx*gx*.3+gy*gy*.3);
  normals[p]=Math.round(127.5*(1-gx*.5*nz));
  normals[p+1]=Math.round(127.5*(1-gy*.5*nz));
  normals[p+2]=Math.round(127.5*(1+nz));
  normals[p+3]=255;
 }
 const map=new THREE.DataTexture(neutral,size,size,THREE.RGBAFormat);
 const normalMap=new THREE.DataTexture(normals,size,size,THREE.RGBAFormat);
 for(const t of [map,normalMap]){
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.minFilter=THREE.LinearMipmapLinearFilter;
  t.magFilter=THREE.LinearFilter;
  t.generateMipmaps=true;t.needsUpdate=true;
 }
 map.colorSpace=THREE.SRGBColorSpace;
 const material=new THREE.MeshStandardMaterial({
  vertexColors:true,map,normalMap,
  normalScale:new THREE.Vector2(.24,.24),
  side:THREE.DoubleSide,metalness:0,roughness:.95
 });
 const bareMaterial=new THREE.MeshStandardMaterial({
  vertexColors:true,side:THREE.DoubleSide,roughness:1,metalness:0
 });
 return {
  material,bareMaterial,
  terrainColor:(height,slope,x,z)=>kunlumNativeTerrainColor(height,slope,x,z,tiles),
  texScale:.1,
  dispose(){
   material.dispose();bareMaterial.dispose();map.dispose();normalMap.dispose();
   Object.values(tiles).forEach(t=>t.dispose());
  }
 };
}
