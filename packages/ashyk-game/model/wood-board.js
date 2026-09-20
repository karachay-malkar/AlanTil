import {BOARD_SCALE,BOUNDARY_RADIUS,HALF} from '../constants.js';

export const ASHYK_BOARD_VISUAL=Object.freeze({
  topY:.128,
  bottomY:-.58,
  topRadius:HALF-.07*BOARD_SCALE,
  sideRadius:HALF+.035*BOARD_SCALE,
  centerRing:5.1*BOARD_SCALE,
  middleRing:10.3*BOARD_SCALE,
  outerRing:BOUNDARY_RADIUS-.10*BOARD_SCALE,
  grooveWidth:.052,
});

const TEXTURE_SIZE=256;
const clamp255=value=>Math.max(0,Math.min(255,Math.round(value)));
const fract=value=>value-Math.floor(value);
const hash=(x,y,seed=0)=>fract(Math.sin(x*127.1+y*311.7+seed*74.7)*43758.5453123);
const smooth=t=>t*t*(3-2*t);
function noise(x,y,seed=0){
  const x0=Math.floor(x),y0=Math.floor(y),tx=smooth(x-x0),ty=smooth(y-y0);
  const a=hash(x0,y0,seed),b=hash(x0+1,y0,seed),c=hash(x0,y0+1,seed),d=hash(x0+1,y0+1,seed);
  return(a+(b-a)*tx)+((c+(d-c)*tx)-(a+(b-a)*tx))*ty;
}
function fbm(x,y,seed=0){
  let value=0,amplitude=.56,frequency=1,total=0;
  for(let octave=0;octave<5;octave+=1){value+=noise(x*frequency,y*frequency,seed+octave*17)*amplitude;total+=amplitude;frequency*=2.03;amplitude*=.48;}
  return value/Math.max(.001,total);
}
function woodHeight(u,v){
  const longNoise=fbm(u*3.1,v*.62,19),fine=fbm(u*16.8,v*2.4,73),micro=fbm(u*44,v*7.2,131);
  const warp=(fbm(u*2.2,v*1.8,41)-.5)*.095;
  const bands=.5+.5*Math.sin((v+warp)*Math.PI*35+(longNoise-.5)*5.8);
  const pores=Math.pow(Math.max(0,.57-fine),3)*5.2;
  const knotA=Math.hypot((u-.29)*1.2,(v-.64)*2.0),knotB=Math.hypot((u-.76)*1.1,(v-.31)*2.25);
  const knots=(Math.sin(knotA*98+longNoise*5)*Math.exp(-knotA*8)+Math.sin(knotB*105+fine*4)*Math.exp(-knotB*9))*.075;
  return Math.max(0,Math.min(1,.20+bands*.43+longNoise*.25+micro*.08-pores*.09+knots));
}
function makeTexture(THREE,data,{color=false}={}){
  const texture=new THREE.DataTexture(data,TEXTURE_SIZE,TEXTURE_SIZE,THREE.RGBAFormat,THREE.UnsignedByteType);
  texture.wrapS=THREE.MirroredRepeatWrapping;texture.wrapT=THREE.MirroredRepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.anisotropy=4;
  if(color)texture.colorSpace=THREE.SRGBColorSpace;
  texture.needsUpdate=true;return texture;
}
export function createAshykWoodPbrTextures(THREE){
  const pixels=TEXTURE_SIZE*TEXTURE_SIZE,heights=new Float32Array(pixels);
  for(let y=0;y<TEXTURE_SIZE;y+=1)for(let x=0;x<TEXTURE_SIZE;x+=1)heights[y*TEXTURE_SIZE+x]=woodHeight(x/(TEXTURE_SIZE-1),y/(TEXTURE_SIZE-1));
  const albedo=new Uint8Array(pixels*4),normal=new Uint8Array(pixels*4),roughness=new Uint8Array(pixels*4);
  const sample=(x,y)=>heights[((y+TEXTURE_SIZE)%TEXTURE_SIZE)*TEXTURE_SIZE+((x+TEXTURE_SIZE)%TEXTURE_SIZE)];
  for(let y=0;y<TEXTURE_SIZE;y+=1){
    for(let x=0;x<TEXTURE_SIZE;x+=1){
      const p=y*TEXTURE_SIZE+x,h=heights[p],i=p*4,large=fbm(x/72,y/120,211),speck=fbm(x/13,y/19,277);
      const dark=Math.pow(1-h,1.65),warm=(large-.5)*12+(speck-.5)*3.5;
      albedo[i]=clamp255(151+h*62-dark*42+warm);
      albedo[i+1]=clamp255(91+h*47-dark*30+warm*.46);
      albedo[i+2]=clamp255(52+h*31-dark*18+warm*.22);
      albedo[i+3]=255;
      const dx=(sample(x+1,y)-sample(x-1,y))*3.2,dy=(sample(x,y+1)-sample(x,y-1))*3.2;
      let nx=-dx,ny=-dy,nz=1,length=Math.hypot(nx,ny,nz)||1;nx/=length;ny/=length;nz/=length;
      normal[i]=clamp255((nx*.5+.5)*255);normal[i+1]=clamp255((ny*.5+.5)*255);normal[i+2]=clamp255((nz*.5+.5)*255);normal[i+3]=255;
      const r=clamp255(205+(1-h)*24+speck*9);roughness[i]=r;roughness[i+1]=r;roughness[i+2]=r;roughness[i+3]=255;
    }
  }
  return{albedo:makeTexture(THREE,albedo,{color:true}),normal:makeTexture(THREE,normal),roughness:makeTexture(THREE,roughness)};
}
function cloneTexture(THREE,texture,{repeatX=1,repeatY=1,rotation=0}={}){
  const next=texture.clone();next.wrapS=THREE.MirroredRepeatWrapping;next.wrapT=THREE.MirroredRepeatWrapping;
  next.center.set(.5,.5);next.repeat.set(repeatX,repeatY);next.rotation=rotation;next.anisotropy=4;next.needsUpdate=true;return next;
}
function bindTextures(THREE,material,textures,variant){
  const map=cloneTexture(THREE,textures.albedo,variant),normalMap=cloneTexture(THREE,textures.normal,variant),roughnessMap=cloneTexture(THREE,textures.roughness,variant);
  material.map=map;material.normalMap=normalMap;material.roughnessMap=roughnessMap;material.userData.ashykWoodTextures=[map,normalMap,roughnessMap];material.needsUpdate=true;
}
function addGrooveRing(THREE,group,radius,width,material,y){
  const ring=new THREE.Mesh(new THREE.RingGeometry(radius-width/2,radius+width/2,160),material);
  ring.rotation.x=-Math.PI/2;ring.position.y=y;ring.renderOrder=4;group.add(ring);
}
function addRadialGrooves(THREE,group,innerRadius,outerRadius,material,y){
  const length=outerRadius-innerRadius,mid=(outerRadius+innerRadius)/2,geometry=new THREE.BoxGeometry(length,.014,.046);
  for(let index=0;index<4;index+=1){const angle=index*Math.PI/2,line=new THREE.Mesh(geometry,material);line.position.set(Math.cos(angle)*mid,y,Math.sin(angle)*mid);line.rotation.y=-angle;line.renderOrder=4;group.add(line);}
}
export function createAshykBoardVisual(THREE){
  const textures=createAshykWoodPbrTextures(THREE),group=new THREE.Group();group.name='ashyk-wood-board';
  group.userData.ashykWoodBaseTextures=textures;
  const topMaterial=new THREE.MeshStandardMaterial({color:'#fff8ee',roughness:.93,metalness:0,normalScale:new THREE.Vector2(.48,.48)});
  const bevelMaterial=new THREE.MeshStandardMaterial({color:'#d6a174',roughness:.96,metalness:0,normalScale:new THREE.Vector2(.58,.58),side:THREE.DoubleSide});
  const sideMaterial=new THREE.MeshStandardMaterial({color:'#b6794f',roughness:.98,metalness:0,normalScale:new THREE.Vector2(.68,.68),side:THREE.DoubleSide});
  const bottomMaterial=new THREE.MeshStandardMaterial({color:'#98613f',roughness:1,metalness:0,normalScale:new THREE.Vector2(.38,.38)});
  bindTextures(THREE,topMaterial,textures,{repeatX:1.12,repeatY:1.12,rotation:-.03});
  bindTextures(THREE,bevelMaterial,textures,{repeatX:1.42,repeatY:.92,rotation:-.03});
  bindTextures(THREE,sideMaterial,textures,{repeatX:4.4,repeatY:.58,rotation:Math.PI/2});
  bindTextures(THREE,bottomMaterial,textures,{repeatX:1.08,repeatY:1.08,rotation:.04});
  const top=new THREE.Mesh(new THREE.CircleGeometry(ASHYK_BOARD_VISUAL.topRadius,128),topMaterial);top.rotation.x=-Math.PI/2;top.position.y=ASHYK_BOARD_VISUAL.topY;top.receiveShadow=true;top.castShadow=true;group.add(top);
  const sideTop=-.035,sideHeight=sideTop-ASHYK_BOARD_VISUAL.bottomY;
  const side=new THREE.Mesh(new THREE.CylinderGeometry(ASHYK_BOARD_VISUAL.sideRadius,ASHYK_BOARD_VISUAL.sideRadius,sideHeight,128,1,true),sideMaterial);side.position.y=ASHYK_BOARD_VISUAL.bottomY+sideHeight/2;side.receiveShadow=true;side.castShadow=true;group.add(side);
  const bevelProfile=[new THREE.Vector2(ASHYK_BOARD_VISUAL.topRadius,ASHYK_BOARD_VISUAL.topY),new THREE.Vector2(HALF-.025*BOARD_SCALE,ASHYK_BOARD_VISUAL.topY-.012),new THREE.Vector2(ASHYK_BOARD_VISUAL.sideRadius,.055),new THREE.Vector2(ASHYK_BOARD_VISUAL.sideRadius,sideTop)];
  const bevel=new THREE.Mesh(new THREE.LatheGeometry(bevelProfile,128),bevelMaterial);bevel.receiveShadow=true;bevel.castShadow=true;group.add(bevel);
  const bottom=new THREE.Mesh(new THREE.CircleGeometry(ASHYK_BOARD_VISUAL.sideRadius,128),bottomMaterial);bottom.rotation.x=Math.PI/2;bottom.position.y=ASHYK_BOARD_VISUAL.bottomY;bottom.receiveShadow=true;group.add(bottom);
  const grooveMaterial=new THREE.MeshStandardMaterial({color:'#3f281b',roughness:1,metalness:0,transparent:true,opacity:.82,depthWrite:false});
  const grooveY=ASHYK_BOARD_VISUAL.topY+.014;
  addGrooveRing(THREE,group,ASHYK_BOARD_VISUAL.centerRing,ASHYK_BOARD_VISUAL.grooveWidth,grooveMaterial,grooveY);
  addGrooveRing(THREE,group,ASHYK_BOARD_VISUAL.middleRing,ASHYK_BOARD_VISUAL.grooveWidth,grooveMaterial,grooveY);
  addGrooveRing(THREE,group,ASHYK_BOARD_VISUAL.outerRing,ASHYK_BOARD_VISUAL.grooveWidth*.9,grooveMaterial,grooveY);
  addRadialGrooves(THREE,group,ASHYK_BOARD_VISUAL.centerRing,ASHYK_BOARD_VISUAL.outerRing,grooveMaterial,grooveY+.002);
  return group;
}
export function disposeAshykBoardVisual(board){
  if(!board)return;
  const materials=new Set(),base=board.userData?.ashykWoodBaseTextures;
  board.traverse?.(object=>{object.geometry?.dispose?.();if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);});
  for(const material of materials){for(const texture of material.userData?.ashykWoodTextures||[])texture?.dispose?.();material.dispose?.();}
  base?.albedo?.dispose?.();base?.normal?.dispose?.();base?.roughness?.dispose?.();
}
