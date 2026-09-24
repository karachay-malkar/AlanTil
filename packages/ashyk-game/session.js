import {validateTrajectoryPacket} from './trajectory.js';
const visualActionId=()=>globalThis.crypto?.randomUUID?.()||`visual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const finite=(value,min=-Infinity,max=Infinity)=>Number.isFinite(Number(value))&&Number(value)>=min&&Number(value)<=max;
function validField(state,{motion=false}={}){
  if(!state||!Array.isArray(state.pieces)||state.pieces.length>20)return false;
  return state.pieces.every((piece)=>Number.isInteger(piece?.id)&&piece.id>=0&&piece.id<64&&typeof piece.alive==='boolean'&&Array.isArray(piece.position)&&piece.position.length===3&&piece.position.every((value)=>finite(value,-100,100))&&Array.isArray(piece.quaternion)&&piece.quaternion.length===4&&piece.quaternion.every((value)=>finite(value,-2,2))&&(!motion||!piece.alive||(Array.isArray(piece.velocity)&&piece.velocity.length===3&&piece.velocity.every((value)=>finite(value,-100,100))&&Array.isArray(piece.angularVelocity)&&piece.angularVelocity.length===3&&piece.angularVelocity.every((value)=>finite(value,-100,100)))));
}
export function createAshykOnlineSessionController({online,userId,store,engine,getRoom,applyRoom,setConnection=()=>{},setVisualConnection=()=>{}}={}){
  let queue=[],flushing=false,resolvingTimeout=false,destroyed=false,visualStream=null,visualRoomId=null,localShotId=null,localShotPhaseSeq=null,trajectoryGeneration=0,lastAimSentAt=0;
  const seenRemoteShotIds=new Set();
  const seenActionIds=new Set();
  const currentRoom=()=>getRoom?.()||null;
  const nextActiveFor=(room,player)=>player===1?room?.host_user_id:room?.guest_user_id;
  async function recover(roomId){if(!online||!roomId)return null;try{const room=await online.getRoom(roomId);if(room)applyRoom?.(room,true,true);setConnection('online');return room;}catch{setConnection('reconnecting');return null;}}
  function enqueue(action){if(destroyed||!action?.id||!action?.type||seenActionIds.has(action.id))return false;const room=currentRoom(),state=store?.getState?.();if(!room||!state||room.status!=='playing'||room.active_user_id!==userId)return false;seenActionIds.add(action.id);if(seenActionIds.size>256){const keep=[...seenActionIds].slice(-128);seenActionIds.clear();keep.forEach((id)=>seenActionIds.add(id));}const snapshot=store.onlineGameState(),status=state.status==='finished'?'finished':'playing',nextActive=status==='finished'?userId:nextActiveFor(room,snapshot.currentPlayer);queue.push({id:String(action.id),type:String(action.type),state:snapshot,status,nextActive});void flush();return true;}
  async function flush(){if(destroyed||flushing||!online)return;flushing=true;try{while(queue.length&&!destroyed){const room=currentRoom(),item=queue[0];if(!room||room.status!=='playing'||room.active_user_id!==userId){queue=[];if(room)applyRoom?.(room,true,true);break;}try{const next=await online.submitAction(room,Number(room.phase_seq||0),item.id,item.type,item.state,item.nextActive,item.status);queue.shift();if(!next)continue;const accepted=String(next.last_action_id||'')===item.id||Number(next.protocol_version||1)<2;if(!accepted){queue=[];applyRoom?.(next,true,true);break;}applyRoom?.(next,true,queue.length===0);setConnection('online');}catch{queue=[];setConnection('reconnecting');await recover(room.id);break;}}}finally{flushing=false;if(queue.length&&!destroyed)queueMicrotask(()=>void flush());}}
  async function resolveTimeoutIfDue(){if(destroyed||resolvingTimeout||flushing||queue.length||!online)return null;const room=currentRoom();if(!room||room.status!=='playing'||!room.phase_deadline_at)return null;const deadline=Date.parse(room.phase_deadline_at);if(!Number.isFinite(deadline)||Date.now()<deadline)return null;resolvingTimeout=true;try{const next=await online.resolveTimeout(room.id);if(next)applyRoom?.(next,true,true);setConnection('online');return next;}catch{setConnection('reconnecting');return recover(room.id);}finally{resolvingTimeout=false;}}
  function baseEnvelope(payload,room){return Boolean(payload&&room&&room.status==='playing'&&String(payload.roomId||'')===String(room.id||'')&&String(payload.actorUserId||'')===String(room.active_user_id||'')&&String(payload.actorUserId||'')!==String(userId||'')&&Number(payload.phaseSeq)===Number(room.phase_seq||0));}
  function shotEnvelope(payload,room){
    if(!payload||!room||room.status!=='playing'||String(payload.roomId||'')!==String(room.id||'')||String(payload.actorUserId||'')===String(userId||''))return false;
    if(typeof payload.shotId!=='string'||!payload.shotId||payload.shotId.length>=160)return false;
    const actor=String(payload.actorUserId||''),member=actor===String(room.host_user_id||'')||actor===String(room.guest_user_id||'');
    if(!member)return false;
    const phaseSeq=Number(payload.phaseSeq),currentSeq=Number(room.phase_seq||0);
    if(phaseSeq===currentSeq)return actor===String(room.active_user_id||'');
    return phaseSeq+1===currentSeq&&String(room.last_action_actor_user_id||'')===actor&&String(room.last_action_type||'')==='shot_result';
  }
  function rememberRemoteShot(shotId){seenRemoteShotIds.add(shotId);if(seenRemoteShotIds.size>128){const keep=[...seenRemoteShotIds].slice(-64);seenRemoteShotIds.clear();keep.forEach((id)=>seenRemoteShotIds.add(id));}}
  function scheduleTrajectory(fn){if(typeof globalThis.requestAnimationFrame==='function')globalThis.requestAnimationFrame(()=>globalThis.setTimeout(fn,0));else globalThis.setTimeout(fn,0);}
  function receiveVisual(event,payload){
    if(destroyed||!engine)return;
    const room=currentRoom();
    if(event==='shot-trajectory'){
      if(!shotEnvelope(payload,room)||!validateTrajectoryPacket(payload)||seenRemoteShotIds.has(payload.shotId))return;
      rememberRemoteShot(payload.shotId);engine.setRemoteAim?.(null);engine.setRemoteSelection?.(null);store?.applyRemoteVisual?.('shot-mode',{mode:payload.mode});engine.playRemoteTrajectory?.(payload);return;
    }
    if(!baseEnvelope(payload,room))return;
    if(event==='piece-selected'){const id=Number(payload.pieceId);if(Number.isInteger(id)&&id>=0&&id<64)engine.setRemoteSelection?.(id);return;}
    if(event==='piece-deselected'){engine.setRemoteSelection?.(null);engine.setRemoteAim?.(null);return;}
    if(event==='shot-mode'){if(payload.mode==='flat'||payload.mode==='hop')store?.applyRemoteVisual?.('shot-mode',{mode:payload.mode});return;}
    if(event==='aim-clear'){engine.setRemoteAim?.(null);return;}
    if(event==='aim-update'){
      if(!Number.isInteger(payload.pieceId)||payload.pieceId<0||payload.pieceId>=64||!['flat','hop'].includes(payload.mode)||!finite(payload.directionX,-1.01,1.01)||!finite(payload.directionZ,-1.01,1.01)||!finite(payload.pullLength,0,20))return;
      engine.setRemoteAim?.(payload);store?.applyRemoteVisual?.('shot-mode',{mode:payload.mode});return;
    }
    if(event==='question-select'){if(room.phase==='bonus-question'&&typeof payload.optionId==='string')store?.applyRemoteVisual?.('question-select',{optionId:payload.optionId});return;}
    if(event==='question-submit'){if(room.phase==='bonus-question')store?.applyRemoteVisual?.('question-submit',{optionId:String(payload.optionId||'')});return;}
    if(event==='question-skip'){if(room.phase==='bonus-question')store?.applyRemoteVisual?.('question-skip',{});return;}
  }
  function detachVisual(){trajectoryGeneration+=1;visualStream?.close?.();visualStream=null;visualRoomId=null;localShotId=null;localShotPhaseSeq=null;seenRemoteShotIds.clear();lastAimSentAt=0;engine?.setRemoteSelection?.(null);engine?.setRemoteAim?.(null);setVisualConnection('offline');}
  function attachVisual(roomId){
    if(destroyed||!online||!roomId||!engine)return false;
    if(visualStream&&visualRoomId===String(roomId))return true;
    detachVisual();visualRoomId=String(roomId);setVisualConnection('connecting');
    visualStream=online.openVisualStream(roomId,receiveVisual,(status)=>setVisualConnection(status),(error)=>{void error;});
    return true;
  }
  function sendLive(event,payload={}){
    if(destroyed||!visualStream)return false;const room=currentRoom(),state=store?.getState?.();if(!room||room.status!=='playing'||room.active_user_id!==userId||state?.gameMode!=='online')return false;
    return visualStream.send(event,{...payload,roomId:room.id,actorUserId:userId,phaseSeq:Number(room.phase_seq||0),eventId:visualActionId()});
  }
  function handleEngineEvent(event){
    if(destroyed||!visualStream||!event)return;
    const room=currentRoom(),state=store?.getState?.();if(!room||room.status!=='playing'||room.active_user_id!==userId||state?.gameMode!=='online')return;
    if(event.type==='selection'){if(Number.isInteger(event.selectedId))sendLive('piece-selected',{pieceId:event.selectedId});else sendLive('piece-deselected',{});return;}
    if(event.type==='aim'){const time=Date.now();if(time-lastAimSentAt<65)return;lastAimSentAt=time;sendLive('aim-update',{pieceId:Number(event.pieceId),mode:event.mode,directionX:event.directionX,directionZ:event.directionZ,pullLength:event.pullLength});return;}
    if(event.type==='aimClear'){sendLive('aim-clear',{});return;}
    if(event.type==='shot'){
      if(!validField(event.preShotState,{motion:true})||!Number.isInteger(event.id)||!['flat','hop'].includes(event.mode)||typeof engine.simulateShotTrajectory!=='function')return;
      const generation=trajectoryGeneration,stream=visualStream,roomId=String(room.id),shotId=visualActionId(),phaseSeq=Number(room.phase_seq||0),shot={initialState:event.preShotState,pieceId:event.id,mode:event.mode,directionX:event.directionX,directionZ:event.directionZ,pullLength:event.pullLength,pullRatio:event.pullRatio};
      localShotId=shotId;localShotPhaseSeq=phaseSeq;
      scheduleTrajectory(()=>{
        if(destroyed||generation!==trajectoryGeneration||stream!==visualStream||visualRoomId!==roomId)return;
        try{
          const trajectory=engine.simulateShotTrajectory(shot),packet={roomId,actorUserId:userId,phaseSeq,eventId:visualActionId(),shotId,pieceId:event.id,mode:event.mode,directionX:event.directionX,directionZ:event.directionZ,pullLength:event.pullLength,pullRatio:event.pullRatio,...trajectory};
          if(validateTrajectoryPacket(packet))stream.send('shot-trajectory',packet);
        }catch(error){console.warn('Ashyk trajectory precompute failed',error);}
      });
      return;
    }
    if(event.type==='shotSettled'){localShotId=null;localShotPhaseSeq=null;}
  }
  function destroy(){destroyed=true;queue=[];seenActionIds.clear();detachVisual();}
  return{enqueue,flush,resolveTimeoutIfDue,recover,attachVisual,detachVisual,sendLive,handleEngineEvent,destroy,getQueueLength:()=>queue.length};
}
