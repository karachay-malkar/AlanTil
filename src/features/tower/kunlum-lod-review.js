import * as THREE from '../../vendor/three/three.module.js';
import {enhanceKunlumStoneWalls} from './kunlum-stone-facing.js';
import {createKunlumMonument} from './kunlum-monument.js';
import {getRockSurface} from './rock-surface.js';

const $=id=>document.getElementById(id);
const ground=(x,z)=>.04*x+.06*z;
const mobile=matchMedia('(pointer:coarse), (max-width:749px)').matches;
const camera=new THREE.PerspectiveCamera(42,1,.1,500);
let angle=.28;

function view(id){
 const canvas=$(id);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 const scene=new THREE.Scene();
 scene.background=new THREE.Color('#bacad1');
 const sun=new THREE.DirectionalLight(0xffecd3,2.1);
 sun.position.set(-15,24,17);
 scene.add(sun,new THREE.HemisphereLight(0xebf5ff,0x958267,1.6));
 const subjects={fence:new THREE.Group(),tower:new THREE.Group()};
 scene.add(...Object.values(subjects));
 return {canvas,renderer,scene,subjects,id};
}

function makeFarMesh(positions,material){
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.computeVertexNormals();
 return new THREE.Mesh(geometry,material);
}

async function start(){
 const current=view('current'),far=view('far');
 const models=await fetch(new URL('../../../assets/tower/approved-library/lod-review/models.json',import.meta.url))
  .then(response=>{if(!response.ok)throw Error('Дальние модели недоступны');return response.json();});
 const materialPromise=getRockSurface(current.renderer);
 const segments=models.path.slice(1).map((b,i)=>({
  a:models.path[i],b,width:models.width,height:models.height,heightAt:ground
 }));
 const monument=createKunlumMonument(THREE,{x:0,z:0,baseY:0,mobile});
 current.subjects.tower.add(monument);
 const fences=await enhanceKunlumStoneWalls(THREE,current.subjects.fence,[
  {group:current.subjects.fence,segments}
 ],{materialPromise,mobile});
 await enhanceKunlumStoneWalls(THREE,current.subjects.tower,[],{materialPromise,mobile,monument});
 const rock=new THREE.MeshStandardMaterial({
  color:'#a99b83',roughness:1,side:THREE.DoubleSide
 });
 for(const key of ['fence','tower'])far.subjects[key].add(makeFarMesh(models[key],rock));

 function render(){
  const key=$('subject').value,distance=Number($('distance').value),target=key==='tower'?7.8:.65;
  $('meters').value=distance+' м';
  camera.position.set(Math.sin(angle)*distance,target+distance*.13,Math.cos(angle)*distance);
  camera.lookAt(0,target,0);
  fences.update(camera);
  for(const {canvas,renderer,scene,subjects,id} of [current,far]){
   for(const name in subjects)subjects[name].visible=name===key;
   const width=canvas.clientWidth,height=canvas.clientHeight;
   if(!width||!height)continue;
   renderer.setSize(width,height,false);
   camera.aspect=width/height;
   camera.updateProjectionMatrix();
   renderer.render(scene,camera);
   $(id+'-count').textContent=renderer.info.render.triangles.toLocaleString('ru')+' треугольников';
  }
 }
 for(const {canvas} of [current,far]){
  let last=null;
  canvas.addEventListener('pointerdown',event=>{
   last=event.clientX;
   canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
   if(last===null)return;
   angle+=(last-event.clientX)*.008;
   last=event.clientX;
   render();
  });
  canvas.addEventListener('lostpointercapture',()=>{last=null;});
 }
 $('subject').addEventListener('change',render);
 $('distance').addEventListener('input',render);
 window.addEventListener('resize',render);
 render();
 $('status').textContent='Потяните модель, чтобы повернуть камеру';
}
start().catch(error=>{$('status').textContent=error.message;console.error(error);});
