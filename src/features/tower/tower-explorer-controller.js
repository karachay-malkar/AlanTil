/** First-person controller is visual only: no prefab placement or save mutations. */
import {canTowerExplorerLand,moveTowerExplorer,TOWER_EXPLORER} from './first-person-navigation.js';
const keys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown',
 'ArrowLeft','ArrowRight','KeyQ','KeyE','Space','ShiftLeft']);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function createTowerExplorerController({
 camera,controls,canvas,groundAt,getObstacles,requestRender
}){
 const pressed=new Set();
 let enabled=false,flying=false,yaw=0,pitch=0,lastFrame=0;
 let motion={forward:0,strafe:0,up:0},lookTouch=null;
 function state(){return {active:enabled,flying,position:camera.position.toArray(),yaw,pitch};}
 function input(){
  const num=key=>Number(pressed.has(key));
  return {
   forward:clamp(motion.forward+num('KeyW')+num('ArrowUp')-num('KeyS')-num('ArrowDown'),-1,1),
   strafe:clamp(motion.strafe+num('KeyD')+num('ArrowRight')-num('KeyA')-num('ArrowLeft'),-1,1),
   up:flying?clamp(motion.up+num('Space')+num('KeyE')-num('KeyQ')-num('ShiftLeft'),-1,1):0
  };
 }
 function moving(){const m=input();return !!(m.forward||m.strafe||m.up);}
 function resetInput(){pressed.clear();motion={forward:0,strafe:0,up:0};lastFrame=0;lookTouch=null;}
 function lookBy(dx,dy){
  if(!enabled)return;
  yaw-=clamp(Number(dx)||0,-80,80)*.003;
  pitch=clamp(pitch-clamp(Number(dy)||0,-80,80)*.003,-Math.PI*.475,Math.PI*.475);
  camera.rotation.set(pitch,yaw,0,'YXZ');requestRender();
 }
 function setMotion(next={}){
  // If WebGL blocked animation frames during a held button, flush elapsed
  // movement *before* changing the input. Otherwise pointerup loses flight.
  if(enabled&&lastFrame&&moving())frame(performance.now());
  motion={forward:clamp(Number(next.forward)||0,-1,1),
   strafe:clamp(Number(next.strafe)||0,-1,1),
   up:clamp(Number(next.up)||0,-1,1)};
  if(enabled)requestRender();
 }
 function setFly(value){
  if(!enabled)return false;
  if(!value&&!canTowerExplorerLand(camera.position,groundAt,getObstacles())){
   // The player must fly sideways to clear the roof before touching down.
   return true;
  }
  flying=!!value;
  if(!flying)camera.position.y=groundAt(camera.position.x,camera.position.z)+TOWER_EXPLORER.eyeHeight;
  requestRender();
  return flying;
 }
 function enter(){
  enabled=true;flying=false;controls.enabled=false;resetInput();
  controls.maxDistance=85;camera.far=5000;camera.updateProjectionMatrix();
  // Spawns at a free corner instead of inside a saved stone section.
  const obstacles=getObstacles();
  const corners=[[2,2],[18,2],[2,18],[18,18],[10,2],[10,18],[2,10],[18,10]];
  const free=([x,z])=>!obstacles.some(b=>x+.35>b.min.x&&x-.35<b.max.x&&
    z+.35>b.min.z&&z-.35<b.max.z&&b.min.y<1.9&&b.max.y>0);
  const [x,z]=corners.find(free)||[2,2];
  camera.position.set(x,groundAt(x,z)+TOWER_EXPLORER.eyeHeight,z);
  yaw=0;pitch=0;camera.rotation.set(0,0,0,'YXZ');
  requestRender();return true;
 }
 function exit(){
  if(!enabled)return;
  enabled=false;flying=false;controls.enabled=true;resetInput();
  camera.rotation.set(0,0,0,'XYZ');
 }
 function frame(now){
  if(!enabled)return false;
  // Use wall-clock time even on low-FPS Android: step in small increments to
  // preserve collision integrity instead of slowing flight with dropped frames.
  const elapsed=lastFrame?Math.min(1.25,Math.max(0,(now-lastFrame)/1000)):0;lastFrame=now;
  if(!moving())return false;
  const steps=Math.max(1,Math.ceil(elapsed/.05)),dt=elapsed/steps;
  let point=camera.position;
  const obstacles=getObstacles(),ground=groundAt,keys=input();
  for(let i=0;i<steps;i++)
   point=moveTowerExplorer(point,keys,yaw,dt,{groundAt:ground,fly:flying,obstacles});
  if(Math.abs(point.x-camera.position.x)+Math.abs(point.y-camera.position.y)+Math.abs(point.z-camera.position.z)>1e-8)
   camera.position.set(point.x,point.y,point.z);
  return true;
 }
 function onKey(e){
  if(!enabled||!keys.has(e.code)||e.ctrlKey||e.metaKey||
    e.target?.closest?.('input,textarea,select,[contenteditable]')||
    document.body.classList.contains('modal-open'))return;
  e.preventDefault();
  if(lastFrame&&moving())frame(performance.now());
  if(e.type==='keydown')pressed.add(e.code);else pressed.delete(e.code);
  requestRender();
 }
 function onPointerDown(e){
  if(!enabled||lookTouch!==null)return;
  lookTouch={id:e.pointerId,x:e.clientX,y:e.clientY};
  try{canvas.setPointerCapture(e.pointerId);}catch{}
 }
 function onPointerMove(e){
  if(!enabled||lookTouch?.id!==e.pointerId)return;
  const dx=e.clientX-lookTouch.x,dy=e.clientY-lookTouch.y;
  lookTouch.x=e.clientX;lookTouch.y=e.clientY;lookBy(dx,dy);
 }
 function onPointerUp(e){if(lookTouch?.id===e.pointerId)lookTouch=null;}
 function clear(){resetInput();}
 window.addEventListener('keydown',onKey);
 window.addEventListener('keyup',onKey);
 window.addEventListener('blur',clear);
 canvas.addEventListener('pointerdown',onPointerDown);
 canvas.addEventListener('pointermove',onPointerMove);
 canvas.addEventListener('pointerup',onPointerUp);
 canvas.addEventListener('pointercancel',onPointerUp);
 return {enter,exit,setFly,setMotion,lookBy,state,frame,moving,clear,
  get active(){return enabled},
  dispose(){
   exit();window.removeEventListener('keydown',onKey);window.removeEventListener('keyup',onKey);
   window.removeEventListener('blur',clear);
   canvas.removeEventListener('pointerdown',onPointerDown);
   canvas.removeEventListener('pointermove',onPointerMove);
   canvas.removeEventListener('pointerup',onPointerUp);
   canvas.removeEventListener('pointercancel',onPointerUp);
  }};
}
