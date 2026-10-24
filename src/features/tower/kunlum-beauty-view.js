/**
 * A stylised atmospheric sky for high-quality Kunlum DEM preview.
 * Visual only. The distant skyline still comes from the true DEM, not sky geometry.
 */
export function createKunlumBeautySky(THREE,scene,camera){
 const skyMaterial=new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,depthTest:true,fog:false,
  uniforms:{uSun:{value:new THREE.Vector3(-.34,.75,.56).normalize()}},
  vertexShader:`
varying vec3 vSkyRay;
void main(){
 vSkyRay=normalize(position);
 gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}
`,
  fragmentShader:`
precision highp float;
varying vec3 vSkyRay;
uniform vec3 uSun;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
 mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
void main(){
 vec3 dir=normalize(vSkyRay);
 float h=clamp(dir.y*.75+.16,0.,1.);
 vec3 low=vec3(.76,.83,.84),upper=vec3(.20,.43,.70);
 vec3 color=mix(low,upper,pow(h,.6));
 float sun=max(dot(dir,normalize(uSun)),0.);
 color+=vec3(1.00,.79,.49)*pow(sun,22.)*.12;
 color+=vec3(1.00,.88,.70)*pow(sun,160.)*.30;
 float clouds=noise(vec2(atan(dir.z,dir.x)*8.,dir.y*18.));
 clouds=.65*clouds+.35*noise(vec2(dir.x,dir.z)*38.);
 float cloud=(smoothstep(.59,.76,clouds))*(smoothstep(.02,.20,dir.y));
 color=mix(color,vec3(.93,.92,.90),cloud*.47);
 gl_FragColor=vec4(color,1.);
}
`
 });
 const sky=new THREE.Mesh(new THREE.SphereGeometry(6800,48,24),skyMaterial);
 sky.name='Procedural atmospheric sky (not a surveyed panorama)';
 sky.renderOrder=-10000;sky.frustumCulled=false;
 sky.visible=false;scene.add(sky);
 return {sky,setVisible:v=>{sky.visible=!!v},update(){sky.position.copy(camera.position)},
  dispose(){sky.geometry.dispose();skyMaterial.dispose();scene.remove(sky)}};
}
