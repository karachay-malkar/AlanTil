const visualActionId=()=>globalThis.crypto?.randomUUID?.()||`shot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const finite=(value,min=-Infinity,max=Infinity)=>Number.isFinite(Number(value))&&Number(value)>=min&&Number(value)<=max;
function validField(state){
  if(!state||!Array.isArray(state.pieces)||state.pieces.length>20)return false;
  return state.pieces.every((piece)=>Number.isInteger(piece?.id)&&piece.id>=0&&piece.id<64&&typeof piece.alive==='boolean'&&Array.isArray(piece.position)&&piece.position.length===3&&piece.position.every((value)=>finite(value,-100,100))&&Array.isArray(piece.quaternion)&&piece.quaternion.length===4&&piece.quaternion.every((value)=>finite(value,-2,2)));
}
export function createAshykOnlineSessionController({online,userId,store,engine,getRoom,applyRoom,setConnection=()=>{}}={}){
  let queue=[],flushing=false,resolvingTimeout=false,destroyed=false,visualStream=null,visualRoomId=null,localShotId=null,localShotPhaseSeq=null,localFrameSeq=0,remoteShotId=null,remoteFrameSeq=-1;
  const seenActionIds=new Set();
  const currentRoom=()=>getRoom?.()||null;
  const nextActiveFor=(room,player)=>player===1?room?.host_user_id:room?.guest_user_id;
  async function recover(roomId){if(!online||!roomId)return null;try{const room=await online.getRoom(roomId);if(room)applyRoom?.(room,true,true);setConnection('online');return room;}catch{setConnection('reconnecting');return null;}}
  function enqueue(action){if(destroyed||!action?.id||!action?.type||seenActionIds.has(action.id))return false;const room=currentRoom(),state=store?.getState?.();if(!room||!state||room.status!=='playing'||room.active_user_id!==userId)return false;seenActionIds.add(action.id);if(seenActionIds.size>256){const keep=[...seenActionIds].slice(-128);seenActionIds.clear();keep.forEach((id)=>seenActionIds.add(id));}const snapshot=store.onlineGameState(),status=state.status==='finished'?'finished':'playing',nextActive=status==='finished'?userId:nextActiveFor(room,snapshot.currentPlayer);queue.push({id:String(action.id),type:String(action.type),state:snapshot,status,nextActive});void flush();return true;}
  async function flush(){if(destroyed||flushing||!online)return;flushing=true;try{while(queue.length&&!destroyed){const room=currentRoom(),item=queue[0];if(!room||room.status!=='playing'||room.active_user_id!==userId){queue=[];if(room)applyRoom?.(room,true,true);break;}try{const next=await online.submitAction(room,Number(room.phase_seq||0),item.id,item.type,item.state,item.nextActive,item.status);queue.shift();if(!next)continue;const accepted=String(next.last_action_id||'')===item.id||Number(next.protocol_version||1)<2;if(!accepted){queue=[];applyRoom?.(next,true,true);break;}applyRoom?.(next,true,queue.length===0);setConnection('online');}catch{queue=[];setConnection('reconnecting');await recover(room.id);break;}}}finally{flushing=false;if(queue.length&&!destroyed)queueMicrotask(()=>void flush());}}
  async function resolveTimeoutIfDue(){if(destroyed||resolvingTimeout||flushing||queue.length||!online)return null;const room=currentRoom();if(!room||room.status!=='playing'||!room.phase_deadline_at)return null;const deadline=Date.parse(room.phase_deadline_at);if(!Number.isFinite(deadline)||Date.now()<deadline)return null;resolvingTimeout=true;try{const next=await online.resolveTimeout(room.id);if(next)applyRoom?.(next,true,true);setConnection('online');return next;}catch{setConnection('reconnecting');return recover(room.id);}finally{resolvingTimeout=false;}}
  function validVisualEnvelope(payload,room){return Boolean(payload&&room&&room.status==='playing'&&String(payload.roomId||'')===String(room.id||'')&&String(payload.actorUserId||'')===String(room.active_user_id||'')&&String(payload.actorUserId||'')!==String(userId||'')&&Number(payload.phaseSeq)===Number(room.phase_seq||0)&&typeof payload.shotId==='string'&&payload.shotId.length>0&&payload.shotId.length<160);}
  function receiveVisual(event,payload){
    if(destroyed||!engine)return;
    const room=currentRoom();
    if(!validVisualEnvelope(payload,room))return;
    if(event==='shot-start'){
      if(remoteShotId===payload.shotId&&remoteFrameSeq>=0)return;
      if(!Number.isInteger(payload.pieceId)||payload.pieceId<0||payload.pieceId>=64||!['flat','hop'].includes(payload.mode)||!finite(payload.directionX,-1.01,1.01)||!finite(payload.directionZ,-1.01,1.01)||!finite(payload.pullRatio,0,1.01)||!finite(payload.pullLength,0,20)||!validField(payload.state))return;
      remoteShotId=payload.shotId;remoteFrameSeq=0;
      engine.applySnapshot(payload.state);
      const launched=engine.launchRemote(payload.pieceId,{mode:payload.mode,directionX:Number(payload.directionX),directionZ:Number(payload.directionZ),pullRatio:Number(payload.pullRatio),pullLength:Number(payload.pullLength)});
      if(!launched){remoteShotId=null;remoteFrameSeq=-1;}
      return;
    }
    if(event==='shot-frame'){
      const seq=Number(payload.seq);
      if(!Number.isInteger(seq)||seq<=remoteFrameSeq||!validField(payload.state))return;
      if(remoteShotId&&payload.shotId!==remoteShotId)return;
      if(!remoteShotId)remoteShotId=payload.shotId;
      remoteFrameSeq=seq;
      engine.applyRemoteFrame(payload.state);
    }
  }
  function detachVisual(){visualStream?.close?.();visualStream=null;visualRoomId=null;localShotId=null;localShotPhaseSeq=null;localFrameSeq=0;remoteShotId=null;remoteFrameSeq=-1;}
  function attachVisual(roomId){
    if(destroyed||!online||!roomId||!engine)return false;
    if(visualStream&&visualRoomId===String(roomId))return true;
    detachVisual();visualRoomId=String(roomId);
    visualStream=online.openShotStream(roomId,receiveVisual,()=>setConnection('reconnecting'));
    return true;
  }
  function handleEngineEvent(event){
    if(destroyed||!visualStream||!event)return;
    const room=currentRoom(),state=store?.getState?.();
    if(!room||room.status!=='playing'||room.active_user_id!==userId||state?.gameMode!=='online')return;
    if(event.type==='shot'){
      if(!validField(event.state)||!Number.isInteger(event.id)||!['flat','hop'].includes(event.mode))return;
      localShotId=visualActionId();localShotPhaseSeq=Number(room.phase_seq||0);localFrameSeq=0;
      visualStream.send('shot-start',{roomId:room.id,actorUserId:userId,phaseSeq:localShotPhaseSeq,shotId:localShotId,pieceId:event.id,mode:event.mode,directionX:event.directionX,directionZ:event.directionZ,pullLength:event.pullLength,pullRatio:event.pullRatio,state:event.state});
      return;
    }
    if(event.type==='shotFrame'&&localShotId&&localShotPhaseSeq===Number(room.phase_seq||0)&&validField(event.state)){
      localFrameSeq+=1;
      visualStream.send('shot-frame',{roomId:room.id,actorUserId:userId,phaseSeq:localShotPhaseSeq,shotId:localShotId,seq:localFrameSeq,final:Boolean(event.final),state:event.state});
      return;
    }
    if(event.type==='shotSettled'){localShotId=null;localShotPhaseSeq=null;localFrameSeq=0;}
  }
  function destroy(){destroyed=true;queue=[];seenActionIds.clear();detachVisual();}
  return{enqueue,flush,resolveTimeoutIfDue,recover,attachVisual,detachVisual,handleEngineEvent,destroy,getQueueLength:()=>queue.length};
}
