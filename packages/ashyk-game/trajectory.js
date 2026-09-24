const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=(value,min=-Infinity,max=Infinity)=>Number.isFinite(Number(value))&&Number(value)>=min&&Number(value)<=max;
const round=(value,digits=5)=>{const factor=10**digits;return Math.round(Number(value)*factor)/factor;};

export const TRAJECTORY_FRAME_MS=50;
export const TRAJECTORY_MAX_DURATION_MS=6500;
export const TRAJECTORY_MAX_FRAMES=Math.ceil(TRAJECTORY_MAX_DURATION_MS/TRAJECTORY_FRAME_MS)+2;

function normalizeQuaternion(value){
  if(!Array.isArray(value)||value.length!==4)return null;
  const q=value.map((entry)=>Number(entry));
  if(!q.every((entry)=>Number.isFinite(entry)))return null;
  const length=Math.hypot(...q);
  if(length<1e-8)return[0,0,0,1];
  return q.map((entry)=>round(entry/length,6));
}

export function normalizeTrajectoryState(state){
  if(!state||!Array.isArray(state.pieces)||state.pieces.length>20)return null;
  const pieces=[],ids=new Set();
  for(const item of state.pieces){
    const id=Number(item?.id);
    if(!Number.isInteger(id)||id<0||id>=64||ids.has(id)||typeof item.alive!=='boolean')return null;
    ids.add(id);
    if(!Array.isArray(item.position)||item.position.length!==3||!item.position.every((value)=>finite(value,-100,100)))return null;
    const quaternion=normalizeQuaternion(item.quaternion);
    if(!quaternion)return null;
    pieces.push({id,alive:item.alive,position:item.position.map((value)=>round(value,5)),quaternion});
  }
  return{pieces};
}

export function makeTrajectoryFrame(t,state){
  const normalized=normalizeTrajectoryState(state);
  if(!normalized)return null;
  return{t:round(clamp(Number(t)||0,0,TRAJECTORY_MAX_DURATION_MS),2),pieces:normalized.pieces};
}

export function normalizeTrajectoryImpact(impact){
  if(!impact||!finite(impact.t,0,TRAJECTORY_MAX_DURATION_MS)||!['ashyk','board','rim'].includes(impact.kind)||!finite(impact.strength,0,100))return null;
  return{t:round(Number(impact.t),2),kind:impact.kind,strength:round(Number(impact.strength),4),key:String(impact.key||impact.kind).slice(0,160),pan:round(clamp(Number(impact.pan)||0,-.82,.82),4)};
}

export function normalizeTrajectoryImpacts(impacts=[]){
  if(!Array.isArray(impacts))return[];
  return impacts.map(normalizeTrajectoryImpact).filter(Boolean).sort((a,b)=>a.t-b.t).slice(0,512);
}

function pieceMap(frame){return new Map((frame?.pieces||[]).map((piece)=>[piece.id,piece]));}
function lerp(a,b,t){return a+(b-a)*t;}
function lerpQuaternion(a,b,t){
  let bx=b[0],by=b[1],bz=b[2],bw=b[3];
  if(a[0]*bx+a[1]*by+a[2]*bz+a[3]*bw<0){bx=-bx;by=-by;bz=-bz;bw=-bw;}
  const q=[lerp(a[0],bx,t),lerp(a[1],by,t),lerp(a[2],bz,t),lerp(a[3],bw,t)],length=Math.hypot(...q)||1;
  return q.map((value)=>value/length);
}

export function interpolateTrajectoryFrames(a,b,elapsedMs){
  if(!a||!b)return null;
  const span=Math.max(.001,Number(b.t)-Number(a.t)),ratio=clamp((Number(elapsedMs)-Number(a.t))/span,0,1),bm=pieceMap(b),pieces=[];
  for(const left of a.pieces||[]){
    const right=bm.get(left.id)||left,alive=ratio>=1?right.alive:left.alive,position=[0,1,2].map((index)=>lerp(left.position[index],right.position[index],ratio));
    pieces.push({id:left.id,alive,position,quaternion:lerpQuaternion(left.quaternion,right.quaternion,ratio)});
  }
  return{pieces};
}

export function validateTrajectoryPacket(packet){
  if(!packet||typeof packet!=='object')return false;
  if(typeof packet.roomId!=='string'||!packet.roomId||typeof packet.actorUserId!=='string'||!packet.actorUserId)return false;
  if(!Number.isInteger(Number(packet.phaseSeq))||Number(packet.phaseSeq)<0)return false;
  if(typeof packet.shotId!=='string'||!packet.shotId||packet.shotId.length>160)return false;
  if(!Number.isInteger(Number(packet.pieceId))||Number(packet.pieceId)<0||Number(packet.pieceId)>=64)return false;
  if(!['flat','hop'].includes(packet.mode)||!finite(packet.directionX,-1.01,1.01)||!finite(packet.directionZ,-1.01,1.01)||!finite(packet.pullLength,0,20)||!finite(packet.pullRatio,0,1.01))return false;
  if(!finite(packet.durationMs,0,TRAJECTORY_MAX_DURATION_MS)||!Array.isArray(packet.frames)||packet.frames.length<2||packet.frames.length>TRAJECTORY_MAX_FRAMES)return false;
  let lastT=-1;
  for(const frame of packet.frames){
    if(!frame||!finite(frame.t,0,TRAJECTORY_MAX_DURATION_MS)||Number(frame.t)<lastT||!normalizeTrajectoryState({pieces:frame.pieces}))return false;
    lastT=Number(frame.t);
  }
  if(Math.abs(Number(packet.frames[0].t))>.01||Math.abs(lastT-Number(packet.durationMs))>TRAJECTORY_FRAME_MS+.01)return false;
  if(!Array.isArray(packet.impacts)||packet.impacts.length>512||packet.impacts.some((impact)=>!normalizeTrajectoryImpact(impact)))return false;
  if(!normalizeTrajectoryState(packet.finalState))return false;
  return packet.result===null||packet.result===undefined||typeof packet.result==='object';
}
