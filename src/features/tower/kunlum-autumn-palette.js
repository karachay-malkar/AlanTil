/** Shared golden-autumn palette for Kunlum. Visual only; DEM and saved structures unchanged. */
export const KUNLUM_AUTUMN=Object.freeze({
 skyTop:'#96B4C3',skyMiddle:'#AEBFCD',skyHorizon:'#C7D2D7',
 fog:'#BFC8CC',sun:'#F3DFC2',skyLight:'#E2EBEF',groundLight:'#81745B',
 dryGrass:'#B89C5E',soil:'#AD9671',scree:'#C7B08E',rock:'#79736B',shrub:'#85815B'
});
export const KUNLUM_AUTUMN_TERRAIN=Object.freeze({
 grass:{lo:[129,111,66],hi:[205,176,101],seed:37,contrast:30},
 soil:{lo:[143,117,86],hi:[205,174,126],seed:83,contrast:28},
 scree:{lo:[163,147,124],hi:[222,199,161],seed:173,contrast:34},
 rock:{lo:[106,106,104],hi:[171,162,151],seed:271,contrast:34}
});
/** Camera-centred sky uses low-poly vertex colours: no texture, shaders or network. */
export function createKunlumAutumnSky(THREE,scene,camera){
 const geometry=new THREE.SphereGeometry(4800,36,22);
 const positions=geometry.getAttribute('position');
 const stops=[
  [-1,KUNLUM_AUTUMN.fog],[-.075,KUNLUM_AUTUMN.fog],
  [0,KUNLUM_AUTUMN.skyHorizon],[.38,KUNLUM_AUTUMN.skyMiddle],
  [.90,KUNLUM_AUTUMN.skyTop],[1,KUNLUM_AUTUMN.skyTop]
 ].map(([y,hex])=>[y,new THREE.Color(hex)]);
 const rgb=new Float32Array(positions.count*3);
 const mixed=new THREE.Color();
 for(let i=0;i<positions.count;i++){
  const y=positions.getY(i)/4800;
  let j=1;while(j<stops.length-1&&y>stops[j][0])j++;
  const [min,a]=stops[j-1],[max,b]=stops[j];
  const t=Math.max(0,Math.min(1,(y-min)/(max-min))),ease=t*t*(3-2*t);
  mixed.copy(a).lerp(b,ease);
  rgb[i*3]=mixed.r;rgb[i*3+1]=mixed.g;rgb[i*3+2]=mixed.b;
 }
 geometry.setAttribute('color',new THREE.BufferAttribute(rgb,3));
 const material=new THREE.MeshBasicMaterial({
  vertexColors:true,side:THREE.BackSide,depthWrite:false,
  depthTest:false,fog:false,toneMapped:false
 });
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name='Kunlum golden autumn atmospheric gradient';
 mesh.renderOrder=-1000;mesh.frustumCulled=false;
 mesh.position.copy(camera.position);scene.add(mesh);
 return {
  mesh,update(){mesh.position.copy(camera.position);},
  dispose(){scene.remove(mesh);geometry.dispose();material.dispose();}
 };
}
