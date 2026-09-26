import {MAX_PULL,SHOT_CANCEL_RADIUS} from './constants.js';
import {validateTrajectoryPacket} from './trajectory.js';
const visualActionId=()=>globalThis.crypto?.randomUUID?.()||`visual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const finite=(value,min=-Infinity,max=Infinity)=>Number.isFinite(Number(value))&&Number(value)>=min&&Number(value)<=max;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function validField(state,{motion=false}={}){
  if(!state||!Array.isArray(state.pieces)||state.pieces.length>20)return false;
  return state.pieces.every((piece)=>Number.isInteger(piece?.id)&&piece.id>=0&&piece.id<64&&typeof piece.alive==='boolean'&&Array.isArray(piece.position)&&piece.position.length===3&&piece.position.every((value)=>finite(value,-100,100))&&Array.isArray(piece.quaternion)&&piece.quaternion.length===4&&piece.quaternion.every((value)=>finite(value,-2,2))&&(!motion||!piece.alive||(Array.isArray(piece.velocity)&&piece.velocity.length===3&&piece.velocity.every((value)=>finite(value,-100,100))&&Array.isArray(piece.angularVelocity)&&piece.angularVelocity.length===3&&piece.angularVelocity.every((value)=>finite(value,-100,100)))));
}
export function createAshykOnlineSessionController({online,userId,store,engine,getRoom,applyRoom,setConnection=()=>{},setVisualConnection=()=>{}}={}){
  let retryFlush=null,queue=[],flushing=false,resolvingTimeout=false,destroyed=false,visualStream=null,visualRoomId=null,localShotId=null,localShotPhaseSeq=null,localShotCommit=null,trajectoryGeneration=0,lastAimSentAt=0;
  const seenRemoteShotIds=new Set();
  const seenActionIds=new Set();
  const currentRoom=()=>getRoom?.()||null;
  const nextActiveFor=(room,player)=>player===1?room?.host_user_id:room?.guest_user_id;
  async function recover(roomId){if(destroyed||!online||!roomId)return null;try{const room=await online.getRoom(roomId);if(destroyed||currentRoom()?.id!==roomId)return null;if(room){const preserveLocal=Boolean(localShotId&&engine?.isLocalTrajectoryActive?.()&&String(room.shot_in_flight_id||'')===String(localShotId)&&Number(room.phase_seq||0)===Number(localShotPhaseSeq||0));applyRoom?.(room,true,!preserveLocal);}setConnection('online');return room;}catch{if(!destroyed)setConnection('reconnecting');return null;}}
  function enqueue(action){if(destroyed||!action?.id||!action?.type||seenActionIds.has(action.id))return false;const room=currentRoom(),state=store?.getState?.();if(!room||!state||room.status!=='playing'||room.active_user_id!==userId)return false;seenActionIds.add(action.id);if(seenActionIds.size>256){const keep=[...seenActionIds].slice(-128);seenActionIds.clear();keep.forEach((id)=>seenActionIds.add(id));}const snapshot=store.onlineGameState(),status=state.status==='finished'?'finished':'playing',nextActive=status==='finished'?userId:nextActiveFor(room,snapshot.currentPlayer);queue.push({id:String(action.id),type:String(action.type),state:snapshot,status,nextActive});void flush();return true;}
  async function flush(){if(destroyed||flushing||!online)return;flushing=true;try{while(queue.length&&!destroyed){let room=currentRoom();const item=queue[0];if(!room||room.status!=='playing'||room.active_user_id!==userId){queue=[];if(room)applyRoom?.(room,true,true);break;}try{if(item.type==='shot_result'&&item.id===localShotId&&localShotCommit){const committed=await localShotCommit;if(destroyed||currentRoom()?.id!==room.id)return;room=currentRoom();if(!committed||String(committed.shot_in_flight_id||'')!==String(item.id)||!room||room.status!=='playing'||room.active_user_id!==userId){queue=[];localShotId=null;localShotPhaseSeq=null;localShotCommit=null;if(committed)applyRoom?.(committed,true,true);break;}}const next=await online.submitAction(room,Number(room.phase_seq||0),item.id,item.type,item.state,item.nextActive,item.status);if(destroyed||currentRoom()?.id!==room.id)return;queue.shift();if(!next)continue;const accepted=String(next.last_action_id||'')===item.id;if(!accepted){queue=[];applyRoom?.(next,true,true);break;}if(item.type==='shot_result'&&item.id===localShotId){localShotId=null;localShotPhaseSeq=null;localShotCommit=null;}applyRoom?.(next,true,queue.length===0);setConnection('online');}catch{if(destroyed||currentRoom()?.id!==room.id)return;setConnection('reconnecting');const recovered=await recover(room.id);if(destroyed||currentRoom()?.id!==room.id)return;if(item.type==='shot_result'&&recovered&&String(recovered.shot_in_flight_id||'')===String(item.id)&&recovered.active_user_id===userId)break;queue=[];if(item.type==='shot_result'&&item.id===localShotId){localShotId=null;localShotPhaseSeq=null;localShotCommit=null;}break;}}}finally{flushing=false;if(queue.length&&!destroyed&&retryFlush===null)retryFlush=setTimeout(()=>{retryFlush=null;void flush();},1000);}}
  async function resolveTimeoutIfDue(){if(destroyed||resolvingTimeout||flushing||queue.length||localShotId||!online)return null;const room=currentRoom();if(!room||room.status!=='playing'||room.shot_in_flight_id||!room.phase_deadline_at)return null;const deadline=Date.parse(room.phase_deadline_at);if(!Number.isFinite(deadline)||Date.now()<deadline)return null;resolvingTimeout=true;try{const next=await online.resolveTimeout(room.id);if(destroyed||currentRoom()?.id!==room.id)return null;if(next)applyRoom?.(next,true,true);setConnection('online');return next;}catch{if(destroyed||currentRoom()?.id!==room.id)return null;setConnection('reconnecting');return recover(room.id);}finally{resolvingTimeout=false;}}
  function baseEnvelope(payload,room){return Boolean(payload&&room&&room.status==='playing'&&String(payload.roomId||'')===String(room.id||'')&&String(payload.actorUserId||'')===String(room.active_user_id||'')&&String(payload.actorUserId||'')!==String(userId||'')&&Number(payload.phaseSeq)===Number(room.phase_seq||0));}
  function shotEnvelope(payload,room){
    if(!payload||!room||!['playing','finished'].includes(room.status)||String(payload.roomId||'')!==String(room.id||'')||String(payload.actorUserId||'')===String(userId||''))return false;
    if(typeof payload.shotId!=='string'||!payload.shotId||payload.shotId.length>=160)return false;
    const actor=String(payload.actorUserId||''),member=actor===String(room.host_user_id||'')||actor===String(room.guest_user_id||'');
    if(!member)return false;
    const phaseSeq=Number(payload.phaseSeq),currentSeq=Number(room.phase_seq||0);
    return room.status==='playing'&&phaseSeq===currentSeq&&actor===String(room.active_user_id||'')||phaseSeq+1===currentSeq&&String(room.last_action_type||'')==='shot_result'&&String(room.last_action_id||'')===String(payload.shotId||'')&&String(room.last_action_actor_user_id||'')===actor;
  }
  function rememberRemoteShot(shotId){seenRemoteShotIds.add(shotId);if(seenRemoteShotIds.size>128){const keep=[...seenRemoteShotIds].slice(-64);seenRemoteShotIds.clear();keep.forEach((id)=>seenRemoteShotIds.add(id));}}
  function receiveVisual(event,payload){
    if(destroyed||!engine)return;
    const room=currentRoom();
    if(event==='shot-trajectory'){
      if(!shotEnvelope(payload,room)||!validateTrajectoryPacket(payload)||seenRemoteShotIds.has(payload.shotId))return;
      rememberRemoteShot(payload.shotId);engine.setRemoteAim?.(null);engine.setRemoteSelection?.(null);store?.applyRemoteVisual?.('shot-mode',{mode:payload.mode});if(engine.playRemoteTrajectory?.(payload)&&Number(payload.phaseSeq)+1===Number(room.phase_seq||0)&&String(room.last_action_type||'')==='shot_result'&&String(room.last_action_id||'')===String(payload.shotId||''))engine.applyAuthoritativeSnapshot?.(room.game_state?.field);return;
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
  function detachVisual(){trajectoryGeneration+=1;visualStream?.close?.();visualStream=null;visualRoomId=null;localShotId=null;localShotPhaseSeq=null;localShotCommit=null;seenRemoteShotIds.clear();lastAimSentAt=0;engine?.setRemoteSelection?.(null);engine?.setRemoteAim?.(null);setVisualConnection('offline');}
  function attachVisual(roomId){
    if(destroyed||!online||!roomId||!engine||currentRoom()?.id!==roomId||currentRoom()?.status!=='playing')return false;
    if(visualStream&&visualRoomId===String(roomId))return true;
    detachVisual();visualRoomId=String(roomId);setVisualConnection('connecting');
    visualStream=online.openVisualStream(roomId,receiveVisual,(status)=>setVisualConnection(status),(error)=>{void error;});
    return true;
  }
  function launchOnlineShot(pieceId,command={}){
    if(destroyed||!visualStream||!online||!engine||localShotId)return false;
    const room=currentRoom(),state=store?.getState?.();if(!room||room.status!=='playing'||room.active_user_id!==userId||state?.gameMode!=='online'||!engine.isReady?.()||engine.isShotActive?.())return false;
    const deadline=Date.parse(String(room.phase_deadline_at||''));if(Number.isFinite(deadline)&&Date.now()>=deadline){void resolveTimeoutIfDue();return false;}
    const id=Number(pieceId),mode=command.mode==='hop'?'hop':'flat',rawX=Number(command.directionX),rawZ=Number(command.directionZ),length=Math.hypot(rawX,rawZ),pullLength=clamp(Number(command.pullLength)||0,0,MAX_PULL);
    if(!Number.isInteger(id)||id<0||id>=64||!Number.isFinite(length)||length<.0001||pullLength<=SHOT_CANCEL_RADIUS)return false;
    const directionX=rawX/length,directionZ=rawZ/length,pullRatio=clamp(Number.isFinite(Number(command.pullRatio))?Number(command.pullRatio):pullLength/MAX_PULL,0,1),initialState=engine.physicsSnapshot?.();
    if(!validField(initialState,{motion:true})||typeof engine.simulateShotTrajectory!=='function'||typeof engine.playLocalTrajectory!=='function')return false;
    const generation=trajectoryGeneration,stream=visualStream,roomId=String(room.id),shotId=visualActionId(),phaseSeq=Number(room.phase_seq||0);
    localShotId=shotId;localShotPhaseSeq=phaseSeq;
    let packet=null;
    localShotCommit=Promise.resolve(online.commitShot(room,phaseSeq,shotId)).catch(async()=>{setConnection('reconnecting');return recover(room.id);}).then((next)=>{
      const accepted=Boolean(next&&String(next.shot_in_flight_id||'')===shotId&&Number(next.shot_in_flight_phase_seq)===phaseSeq&&String(next.active_user_id||'')===String(userId||''));
      if(next&&generation===trajectoryGeneration&&stream===visualStream&&visualRoomId===roomId)applyRoom?.(next,false,!accepted);
      if(accepted&&packet&&localShotId===shotId&&generation===trajectoryGeneration&&stream===visualStream&&visualRoomId===roomId)stream.send('shot-trajectory',packet);
      return next;
    });
    try{
      const trajectory=engine.simulateShotTrajectory({initialState,pieceId:id,mode,directionX,directionZ,pullLength,pullRatio});packet={roomId,actorUserId:userId,phaseSeq,eventId:visualActionId(),shotId,pieceId:id,mode,directionX,directionZ,pullLength,pullRatio,...trajectory};
      if(!validateTrajectoryPacket(packet)||!engine.playLocalTrajectory(packet)){localShotId=null;localShotPhaseSeq=null;localShotCommit=null;return false;}
      return true;
    }catch(error){console.warn('Ashyk canonical trajectory precompute failed',error);localShotId=null;localShotPhaseSeq=null;localShotCommit=null;setConnection('reconnecting');void recover(room.id);return false;}
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
    if(event.type==='shotCancelled'&&(!event.shotId||String(event.shotId)===String(localShotId||''))){localShotId=null;localShotPhaseSeq=null;localShotCommit=null;}
  }
  function destroy(){destroyed=true;if(retryFlush!==null)clearTimeout(retryFlush);queue=[];seenActionIds.clear();detachVisual();}
  return{enqueue,flush,resolveTimeoutIfDue,recover,attachVisual,detachVisual,launchOnlineShot,sendLive,handleEngineEvent,destroy,getQueueLength:()=>queue.length,getLocalShotId:()=>localShotId};
}
