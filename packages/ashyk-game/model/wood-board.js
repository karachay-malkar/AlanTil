import {BOARD_SCALE,BOUNDARY_RADIUS,HALF} from '../constants.js';

export const ASHYK_BOARD_VISUAL=Object.freeze({
  topY:.128,
  bottomY:-.58,
  topRadius:HALF-.07*BOARD_SCALE,
  sideRadius:HALF+.035*BOARD_SCALE,
  centerRing:5.1*BOARD_SCALE,
  middleRing:10.3*BOARD_SCALE,
  outerRing:BOUNDARY_RADIUS-.10*BOARD_SCALE,
  grooveWidth:.036,
});

export const ASHYK_WOOD_PBR_ASSETS=Object.freeze({
  baseColor:'/assets/ashyk/materials/walnut-veneer-02/walnut_veneer_02_diff_1k.jpg',
  normal:'/assets/ashyk/materials/walnut-veneer-02/walnut_veneer_02_nor_gl_1k.jpg',
  roughness:'/assets/ashyk/materials/walnut-veneer-02/walnut_veneer_02_rough_1k.jpg',
  ao:'/assets/ashyk/materials/walnut-veneer-02/walnut_veneer_02_ao_1k.jpg',
});

const ASHYK_WOOD_FALLBACK_COLORS=Object.freeze({
  top:'#8b6548',
  bevel:'#7d573f',
  side:'#694832',
  bottom:'#5a3c2b',
});

const ASHYK_WOOD_TEXTURE_TINTS=Object.freeze({
  top:'#f1f0ec',
  bevel:'#e8e7e2',
  side:'#dfded9',
  bottom:'#d4d3cf',
});

function configureTexture(THREE,texture,{color=false}={}){
  if(!texture)return null;
  texture.wrapS=THREE.RepeatWrapping;
  texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.anisotropy=4;
  texture.flipY=false;
  if(color)texture.colorSpace=THREE.SRGBColorSpace;
  texture.needsUpdate=true;
  return texture;
}

export function loadAshykWoodPbrTextures(THREE,{loadTexture,sources=ASHYK_WOOD_PBR_ASSETS}={}){
  const loader=loadTexture?null:new THREE.TextureLoader();
  const load=loadTexture||((url)=>loader.load(url));
  return{
    baseColor:configureTexture(THREE,load(sources.baseColor),{color:true}),
    normal:configureTexture(THREE,load(sources.normal)),
    roughness:configureTexture(THREE,load(sources.roughness)),
    ao:configureTexture(THREE,load(sources.ao)),
  };
}

function disposeTextureSet(textures){
  textures?.baseColor?.dispose?.();
  textures?.normal?.dispose?.();
  textures?.roughness?.dispose?.();
  textures?.ao?.dispose?.();
}

export async function loadAshykWoodPbrTexturesAsync(THREE,{loadTextureAsync,sources=ASHYK_WOOD_PBR_ASSETS}={}){
  const loader=loadTextureAsync?null:new THREE.TextureLoader();
  const load=loadTextureAsync||((url)=>loader.loadAsync(url));
  const entries=[
    ['baseColor',sources.baseColor,true],
    ['normal',sources.normal,false],
    ['roughness',sources.roughness,false],
    ['ao',sources.ao,false],
  ];
  const settled=await Promise.allSettled(entries.map(([,url])=>load(url)));
  const failed=settled.find((result)=>result.status==='rejected');
  if(failed){
    settled.forEach((result)=>{if(result.status==='fulfilled')result.value?.dispose?.();});
    throw failed.reason instanceof Error?failed.reason:new Error('ASHYK_WOOD_PBR_LOAD_FAILED');
  }
  const textures={};
  entries.forEach(([key,,color],index)=>{textures[key]=configureTexture(THREE,settled[index].value,{color});});
  return textures;
}

function cloneTexture(THREE,texture,{repeatX=1,repeatY=1,rotation=0}={}){
  if(!texture)return null;
  const next=texture.clone();
  next.wrapS=THREE.RepeatWrapping;
  next.wrapT=THREE.RepeatWrapping;
  next.center.set(.5,.5);
  next.repeat.set(repeatX,repeatY);
  next.rotation=rotation;
  next.anisotropy=4;
  next.needsUpdate=true;
  return next;
}

function bindTextures(THREE,material,textures,variant,{normal=true,ao=true}={}){
  for(const texture of material.userData?.ashykWoodTextures||[])texture?.dispose?.();
  const bound=[];
  const map=cloneTexture(THREE,textures.baseColor,variant);
  const roughnessMap=cloneTexture(THREE,textures.roughness,variant);
  if(map){material.map=map;bound.push(map);}
  if(roughnessMap){material.roughnessMap=roughnessMap;bound.push(roughnessMap);}
  if(normal){
    const normalMap=cloneTexture(THREE,textures.normal,variant);
    if(normalMap){material.normalMap=normalMap;bound.push(normalMap);}
  }
  if(ao){
    const aoMap=cloneTexture(THREE,textures.ao,variant);
    if(aoMap){material.aoMap=aoMap;material.aoMapIntensity=.48;bound.push(aoMap);}
  }
  material.userData.ashykWoodTextures=bound;
  material.needsUpdate=true;
}

function enableAoUv(geometry){
  if(geometry?.attributes?.uv&&!geometry.attributes.uv1)geometry.setAttribute('uv1',geometry.attributes.uv);
  return geometry;
}

function addGrooveRing(THREE,group,radius,width,material,y){
  const ring=new THREE.Mesh(new THREE.RingGeometry(radius-width/2,radius+width/2,160),material);
  ring.rotation.x=-Math.PI/2;
  ring.position.y=y;
  ring.renderOrder=4;
  group.add(ring);
}

function addRadialGrooves(THREE,group,innerRadius,outerRadius,material,y){
  const length=outerRadius-innerRadius,mid=(outerRadius+innerRadius)/2,geometry=new THREE.BoxGeometry(length,.010,.028);
  for(let index=0;index<4;index+=1){
    const angle=index*Math.PI/2,line=new THREE.Mesh(geometry,material);
    line.position.set(Math.cos(angle)*mid,y,Math.sin(angle)*mid);
    line.rotation.y=-angle;
    line.renderOrder=4;
    group.add(line);
  }
}

function applyBoardTextures(THREE,group,textures){
  if(!group||group.userData?.ashykWoodDisposed)return false;
  const materials=group.userData?.ashykWoodMaterials;
  if(!materials){
    disposeTextureSet(textures);
    return false;
  }
  materials.top.color.set(ASHYK_WOOD_TEXTURE_TINTS.top);
  materials.bevel.color.set(ASHYK_WOOD_TEXTURE_TINTS.bevel);
  materials.side.color.set(ASHYK_WOOD_TEXTURE_TINTS.side);
  materials.bottom.color.set(ASHYK_WOOD_TEXTURE_TINTS.bottom);
  bindTextures(THREE,materials.top,textures,{repeatX:1.10,repeatY:1.10,rotation:0});
  bindTextures(THREE,materials.bevel,textures,{repeatX:1.38,repeatY:.90,rotation:0});
  bindTextures(THREE,materials.side,textures,{repeatX:4.2,repeatY:.62,rotation:Math.PI/2});
  bindTextures(THREE,materials.bottom,textures,{repeatX:1.05,repeatY:1.05,rotation:0},{normal:false,ao:false});
  group.userData.ashykWoodBaseTextures=textures;
  group.userData.ashykWoodPbrReady=true;
  return true;
}

export function createAshykBoardVisual(THREE,{textures:providedTextures}={}){
  const group=new THREE.Group();
  group.name='ashyk-wood-board';
  group.userData.ashykWoodBaseTextures=null;
  group.userData.ashykWoodPbrReady=false;
  group.userData.ashykWoodDisposed=false;

  const topMaterial=new THREE.MeshStandardMaterial({color:ASHYK_WOOD_FALLBACK_COLORS.top,roughness:.82,metalness:0,normalScale:new THREE.Vector2(.30,.30)});
  const bevelMaterial=new THREE.MeshStandardMaterial({color:ASHYK_WOOD_FALLBACK_COLORS.bevel,roughness:.86,metalness:0,normalScale:new THREE.Vector2(.31,.31),side:THREE.DoubleSide});
  const sideMaterial=new THREE.MeshStandardMaterial({color:ASHYK_WOOD_FALLBACK_COLORS.side,roughness:.88,metalness:0,normalScale:new THREE.Vector2(.34,.34),side:THREE.DoubleSide});
  const bottomMaterial=new THREE.MeshStandardMaterial({color:ASHYK_WOOD_FALLBACK_COLORS.bottom,roughness:.94,metalness:0});
  group.userData.ashykWoodMaterials={top:topMaterial,bevel:bevelMaterial,side:sideMaterial,bottom:bottomMaterial};

  if(providedTextures){
    configureTexture(THREE,providedTextures.baseColor,{color:true});
    configureTexture(THREE,providedTextures.normal);
    configureTexture(THREE,providedTextures.roughness);
    configureTexture(THREE,providedTextures.ao);
    applyBoardTextures(THREE,group,providedTextures);
  }

  const topGeometry=enableAoUv(new THREE.CircleGeometry(ASHYK_BOARD_VISUAL.topRadius,128));
  const top=new THREE.Mesh(topGeometry,topMaterial);
  top.rotation.x=-Math.PI/2;
  top.position.y=ASHYK_BOARD_VISUAL.topY;
  top.receiveShadow=true;
  top.castShadow=true;
  group.add(top);

  const sideTop=-.035,sideHeight=sideTop-ASHYK_BOARD_VISUAL.bottomY;
  const sideGeometry=enableAoUv(new THREE.CylinderGeometry(ASHYK_BOARD_VISUAL.sideRadius,ASHYK_BOARD_VISUAL.sideRadius,sideHeight,128,1,true));
  const side=new THREE.Mesh(sideGeometry,sideMaterial);
  side.position.y=ASHYK_BOARD_VISUAL.bottomY+sideHeight/2;
  side.receiveShadow=true;
  side.castShadow=true;
  group.add(side);

  const bevelProfile=[
    new THREE.Vector2(ASHYK_BOARD_VISUAL.topRadius,ASHYK_BOARD_VISUAL.topY),
    new THREE.Vector2(HALF-.025*BOARD_SCALE,ASHYK_BOARD_VISUAL.topY-.012),
    new THREE.Vector2(ASHYK_BOARD_VISUAL.sideRadius,.055),
    new THREE.Vector2(ASHYK_BOARD_VISUAL.sideRadius,sideTop),
  ];
  const bevelGeometry=enableAoUv(new THREE.LatheGeometry(bevelProfile,128));
  const bevel=new THREE.Mesh(bevelGeometry,bevelMaterial);
  bevel.receiveShadow=true;
  bevel.castShadow=true;
  group.add(bevel);

  const bottom=new THREE.Mesh(new THREE.CircleGeometry(ASHYK_BOARD_VISUAL.sideRadius,128),bottomMaterial);
  bottom.rotation.x=Math.PI/2;
  bottom.position.y=ASHYK_BOARD_VISUAL.bottomY;
  bottom.receiveShadow=true;
  group.add(bottom);

  const grooveMaterial=new THREE.MeshStandardMaterial({color:'#27231f',roughness:1,metalness:0,transparent:true,opacity:.56,depthWrite:false});
  const grooveY=ASHYK_BOARD_VISUAL.topY+.014;
  addGrooveRing(THREE,group,ASHYK_BOARD_VISUAL.centerRing,ASHYK_BOARD_VISUAL.grooveWidth,grooveMaterial,grooveY);
  addGrooveRing(THREE,group,ASHYK_BOARD_VISUAL.middleRing,ASHYK_BOARD_VISUAL.grooveWidth,grooveMaterial,grooveY);
  addGrooveRing(THREE,group,ASHYK_BOARD_VISUAL.outerRing,ASHYK_BOARD_VISUAL.grooveWidth*.9,grooveMaterial,grooveY);
  addRadialGrooves(THREE,group,ASHYK_BOARD_VISUAL.centerRing,ASHYK_BOARD_VISUAL.outerRing,grooveMaterial,grooveY+.002);
  return group;
}

export async function hydrateAshykBoardVisual(THREE,board,options={}){
  if(!board||board.userData?.ashykWoodDisposed)return false;
  if(board.userData?.ashykWoodPbrReady)return true;
  if(board.userData?.ashykWoodPbrPromise)return board.userData.ashykWoodPbrPromise;
  const promise=(async()=>{
    const textures=await loadAshykWoodPbrTexturesAsync(THREE,options);
    if(board.userData?.ashykWoodDisposed){
      disposeTextureSet(textures);
      return false;
    }
    return applyBoardTextures(THREE,board,textures);
  })();
  board.userData.ashykWoodPbrPromise=promise;
  try{return await promise;}
  finally{if(board.userData)board.userData.ashykWoodPbrPromise=null;}
}

export function disposeAshykBoardVisual(board){
  if(!board)return;
  board.userData.ashykWoodDisposed=true;
  const materials=new Set(),base=board.userData?.ashykWoodBaseTextures;
  board.traverse?.(object=>{
    object.geometry?.dispose?.();
    if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);
  });
  for(const material of materials){
    for(const texture of material.userData?.ashykWoodTextures||[])texture?.dispose?.();
    material.dispose?.();
  }
  base?.baseColor?.dispose?.();
  base?.normal?.dispose?.();
  base?.roughness?.dispose?.();
  base?.ao?.dispose?.();
}
