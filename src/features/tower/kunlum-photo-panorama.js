/**
 * Optional photographic 360° sky for the Kunlum DEM review.
 * Local user-selected images only: no downloading or republishing Foundation assets.
 * Equirectangular (2:1) imagery is view-only, not georeferenced or persisted.
 */
export function panoramaDimensionsValid(width,height){
 return Number.isFinite(width)&&Number.isFinite(height)&&width>=1024&&height>=512&&
  Math.abs(width/height-2)<=.05;
}
export function panoramaScaledWidth(width,maxWidth){
 if(!Number.isFinite(width)||!Number.isFinite(maxWidth)||width<1||maxWidth<1)
  throw new Error('Invalid panorama dimensions');
 return Math.max(2,Math.floor(Math.min(width,maxWidth)/2)*2);
}
export function createKunlumPhotoBackdrop(THREE,scene,camera,{maxTextureWidth=4096}={}){
 let dome=null,imageTexture=null,visible=true,yaw=0,opacity=1,serial=0;
 function release(){
  if(dome){scene.remove(dome);dome.geometry.dispose();dome.material.dispose();dome=null}
  if(imageTexture){imageTexture.dispose();imageTexture=null}
 }
 function setVisible(value){visible=!!value;if(dome)dome.visible=visible}
 function setYaw(degrees){yaw=Math.max(-180,Math.min(180,Number(degrees)||0));if(dome)dome.rotation.y=THREE.MathUtils.degToRad(yaw)}
 function setOpacity(value){opacity=Math.max(.25,Math.min(1,Number(value)||1));if(dome)dome.material.opacity=opacity}
 function update(){if(dome)dome.position.copy(camera.position)}
 async function loadFile(file){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))
   throw new Error('Выбери JPG, PNG или WebP панораму');
  if(file.size>40*1024*1024)throw new Error('Размер фото превышает 40 МБ');
  const request=++serial,url=URL.createObjectURL(file);
  try{
   const img=await new Promise((resolve,reject)=>{
    const candidate=new Image();candidate.onload=()=>resolve(candidate);
    candidate.onerror=()=>reject(new Error('Не удалось прочитать изображение'));
    candidate.src=url;
   });
   if(request!==serial)return false;
   if(!panoramaDimensionsValid(img.naturalWidth,img.naturalHeight))
    throw new Error('Нужна сферическая панорама 2:1 (например 4096×2048), не обычная фотография');
   const width=panoramaScaledWidth(img.naturalWidth,maxTextureWidth),height=width/2;
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext('2d',{alpha:false});
   if(!ctx)throw new Error('Браузер не поддерживает подготовку панорамы');
   ctx.drawImage(img,0,0,width,height);
   const nextTexture=new THREE.CanvasTexture(canvas);
   nextTexture.colorSpace=THREE.SRGBColorSpace;
   nextTexture.minFilter=THREE.LinearFilter;nextTexture.magFilter=THREE.LinearFilter;
   nextTexture.generateMipmaps=false;
   const material=new THREE.MeshBasicMaterial({
    map:nextTexture,side:THREE.BackSide,transparent:true,opacity,
    depthWrite:false,depthTest:true,fog:false,toneMapped:false
   });
   const nextDome=new THREE.Mesh(new THREE.SphereGeometry(6900,48,32),material);
   nextDome.name='Temporary user-supplied 360 panorama: alignment UNVERIFIED';
   nextDome.renderOrder=-1000;nextDome.frustumCulled=false;nextDome.visible=visible;
   nextDome.rotation.y=THREE.MathUtils.degToRad(yaw);
   nextDome.position.copy(camera.position);
   release();imageTexture=nextTexture;dome=nextDome;scene.add(dome);
   return {width,height,originalWidth:img.naturalWidth,originalHeight:img.naturalHeight};
  }finally{URL.revokeObjectURL(url)}
 }
 return {loadFile,setVisible,setYaw,setOpacity,update,
  dispose(){serial++;release()},
  get loaded(){return !!dome},
  get visible(){return visible},
  get yaw(){return yaw},
  get opacity(){return opacity}
 };
}
