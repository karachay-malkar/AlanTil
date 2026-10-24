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
 const p=clamp(patch),s=clamp(slope);
 const rock=clamp((s-.16)*2.1+(elevation-1900)/1700+(p-.5)*.26);
 const scree=clamp((s-.10)*1.05+(elevation-1550)/2300+(p-.55)*.7)*(1-rock*.64);
 const soil=clamp(.15+p*.42+(s-.30)*.18)*(1-rock*.74);
 return {rock,scree,soil};
}
export function createKunlumTerrainTiles(THREE,{resolution=256}={}){
 if(!THREE||!Number.isInteger(resolution)||resolution<32||resolution>512)
  throw Error('Invalid game-landscape texture settings');
 const palettes={
  grass:{lo:[103,125,75],hi:[168,170,98],seed:37,contrast:26},
  soil:{lo:[117,91,67],hi:[168,138,99],seed:83,contrast:22},
  scree:{lo:[135,129,117],hi:[202,184,159],seed:173,contrast:35},
  rock:{lo:[113,113,107],hi:[184,181,167],seed:271,contrast:28}
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
