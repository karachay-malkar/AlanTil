const single=(value)=>Array.isArray(value)?(value[0]||null):(value||null);
const ACTIVE_ROOM_STATUSES=new Set(['waiting','playing']);
const VISUAL_EVENTS=Object.freeze(['piece-selected','piece-deselected','shot-mode','aim-update','aim-clear','question-select','question-submit','question-skip','shot-trajectory']);
function inviteResult(value){const row=single(value)||{};return{invite:row.invite||null,room:row.room||null};}
export function isActiveAshykRoom(room){return Boolean(room?.id&&ACTIVE_ROOM_STATUSES.has(room.status));}
export function createAshykOnlineAdapter(client,{setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout}={}){
  if(!client)throw new Error('Ashyk online client is required');
  async function rpc(name,args){
    let timer;
    try{const {data,error}=await Promise.race([client.rpc(name,args),new Promise((_,reject)=>{timer=globalThis.setTimeout(()=>reject(new Error('ASHYK_RPC_TIMEOUT')),8000);})]);if(error)throw error;return single(data);}
    finally{globalThis.clearTimeout(timer);}
  }
  async function restoreInviteResult(error){const room=await getActiveRoom().catch(()=>null);if(isActiveAshykRoom(room))return{room,invite:null};throw error;}
  async function createFriendInvite(friendUserId,initialState){try{return inviteResult(await rpc('ashyk_invite_create',{p_friend_user_id:String(friendUserId||''),p_initial_state:initialState||{}}));}catch(error){return restoreInviteResult(error);}}
  async function acceptInvite(inviteId){try{return inviteResult(await rpc('ashyk_invite_accept',{p_invite_id:inviteId}));}catch(error){return restoreInviteResult(error);}}
  async function declineInvite(inviteId){if(!inviteId)return null;return rpc('ashyk_invite_decline',{p_invite_id:inviteId});}
  async function cancelInvite(inviteId){if(!inviteId)return null;return rpc('ashyk_invite_cancel',{p_invite_id:inviteId});}
  async function getRoom(roomId){if(!roomId)return null;return rpc('ashyk_room_get',{p_room_id:roomId});}
  async function getActiveRoom(){return rpc('ashyk_active_room',{});}
  async function getPlayersSnapshot(){const{data,error}=await client.rpc('ashyk_players_snapshot',{});if(error)throw error;return Array.isArray(data)?data:[];}
  async function markReady(roomId){if(!roomId)return null;return rpc('ashyk_room_ready',{p_room_id:roomId});}
  async function markNotReady(roomId){if(!roomId)return null;return rpc('ashyk_room_not_ready',{p_room_id:roomId});}
  async function pingRoom(roomId){if(!roomId)return null;return rpc('ashyk_room_ping',{p_room_id:roomId});}
  async function commitShot(room,expectedPhaseSeq,shotId){if(!room?.id||!shotId)throw new Error('Missing Ashyk shot commit');return rpc('ashyk_shot_commit',{p_room_id:room.id,p_expected_revision:Number(room.revision||0),p_expected_phase_seq:Number(expectedPhaseSeq||0),p_shot_id:String(shotId)});}
  async function submitAction(room,expectedPhaseSeq,actionId,actionType,state,nextActiveUserId,status='playing'){if(!room?.id)throw new Error('Missing Ashyk room');return rpc('ashyk_submit_action',{p_room_id:room.id,p_expected_revision:Number(room.revision||0),p_expected_phase_seq:Number(expectedPhaseSeq||0),p_action_id:String(actionId||''),p_action_type:String(actionType||''),p_state:state||{},p_next_active_user_id:nextActiveUserId||null,p_status:status});}
  async function resolveTimeout(roomId){if(!roomId)return null;return rpc('ashyk_resolve_timeout',{p_room_id:roomId});}
  async function claimForfeit(roomId){if(!roomId)return null;return rpc('ashyk_claim_forfeit',{p_room_id:roomId});}
  async function leaveRoom(roomId){if(!roomId)return null;return rpc('ashyk_leave_room',{p_room_id:roomId});}
  function channelFor(key){return client.channel(`${key}:${Math.random().toString(36).slice(2)}`);}
  function subscribeRoom(roomId,onRoom,onError=()=>{}){
    let channel=null,disposed=false,refreshing=false,queued=false,retry=null,attempt=0;
    const refresh=async()=>{if(disposed)return;if(refreshing){queued=true;return;}refreshing=true;try{const room=await getRoom(roomId);if(!disposed&&room)onRoom(room);}catch(error){if(!disposed)onError(error);}finally{refreshing=false;if(queued&&!disposed){queued=false;void refresh();}}};
    const reconnect=()=>{if(disposed||retry!==null)return;retry=setTimer(async()=>{retry=null;const old=channel;channel=null;if(old)try{await client.removeChannel(old);}catch{}if(!disposed)connect();},Math.min(8000,500*2**Math.min(attempt++,4)));};
    const connect=()=>{if(disposed)return;const next=channelFor(`ashyk-room:${roomId}`);channel=next;next.on('postgres_changes',{event:'UPDATE',schema:'public',table:'ashyk_rooms',filter:`id=eq.${roomId}`},()=>{if(channel===next)void refresh();}).subscribe(status=>{if(disposed||channel!==next)return;if(status==='SUBSCRIBED'){attempt=0;if(retry!==null){clearTimer(retry);retry=null;}void refresh();}else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){onError(status);void refresh();reconnect();}});};
    connect();
    return()=>{disposed=true;if(retry!==null)clearTimer(retry);const old=channel;channel=null;if(old)try{Promise.resolve(client.removeChannel(old)).catch(()=>{});}catch{}};
  }
  function subscribeInvite(inviteId,onInvite,onError=()=>{}){let channel=channelFor(`ashyk-invite:${inviteId}`);channel.on('postgres_changes',{event:'UPDATE',schema:'public',table:'ashyk_invites',filter:`id=eq.${inviteId}`},payload=>{if(payload.new)onInvite(single(payload.new));}).subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')onError(status);});return()=>{if(!channel)return;try{channel.unsubscribe();}catch{}try{void client.removeChannel(channel);}catch{}channel=null;};}
  function subscribeInvites(userId,onInvite,onError=()=>{}){const uid=String(userId||'');if(!uid)return()=>{};let channel=channelFor(`ashyk-inbox:${uid}`);channel.on('postgres_changes',{event:'*',schema:'public',table:'ashyk_invites',filter:`friend_user_id=eq.${uid}`},payload=>onInvite(single(payload.new||payload.old))).subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')onError(status);});return()=>{if(!channel)return;try{channel.unsubscribe();}catch{}try{void client.removeChannel(channel);}catch{}channel=null;};}
  function subscribePlayerUpdates(onUpdate,onError=()=>{}){let channel=channelFor('ashyk-players');const emit=()=>onUpdate?.();channel.on('postgres_changes',{event:'*',schema:'public',table:'ashyk_invites'},emit).on('postgres_changes',{event:'*',schema:'public',table:'ashyk_rooms'},emit).on('postgres_changes',{event:'*',schema:'public',table:'friendships'},emit).subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')onError(status);});return()=>{if(!channel)return;try{channel.unsubscribe();}catch{}try{void client.removeChannel(channel);}catch{}channel=null;};}
  function openVisualStream(roomId,onVisual,onStatus=()=>{},onError=()=>{}){
    if(!roomId)return{send:()=>false,close:()=>{},ready:Promise.resolve(false)};
    let channel=null,subscribed=false,closed=false,retry=null,attempt=0;
    const pendingEssential=[],pendingLatest=new Map();
    const receive=(event)=>(message)=>{if(!closed)onVisual?.(event,message?.payload||message||{});};
    const queue=(event,payload)=>{if(['shot-trajectory','question-submit','question-skip'].includes(event)){pendingEssential.push({event,payload});if(pendingEssential.length>24)pendingEssential.shift();}else pendingLatest.set(event,{event,payload});};
    const sendNow=(event,payload)=>{if(!channel||closed||!subscribed){queue(event,payload);return false;}Promise.resolve(channel.send({type:'broadcast',event,payload})).then(status=>{if(status==='error'||status==='timed out')throw new Error(status);}).catch((error)=>{if(closed)return;queue(event,payload);subscribed=false;onStatus('reconnecting');onError(error);reconnect();});return true;};
    const flushPending=()=>{if(!subscribed||closed)return;const rows=[...pendingEssential.splice(0),...pendingLatest.values()];pendingLatest.clear();for(const row of rows)sendNow(row.event,row.payload);};
    const reconnect=()=>{if(closed||retry!==null)return;retry=setTimer(async()=>{retry=null;const old=channel;channel=null;if(old)try{await client.removeChannel(old);}catch{}if(!closed)await connect();},Math.min(8000,500*2**Math.min(attempt++,4)));};
    const connect=async()=>{try{await client.realtime?.setAuth?.();if(closed)return false;const next=client.channel(`ashyk-shot:${roomId}`,{config:{private:true,broadcast:{self:false,ack:false}}});channel=next;for(const event of VISUAL_EVENTS)next.on('broadcast',{event},message=>{if(channel===next)receive(event)(message);});next.subscribe((status,error)=>{if(closed||channel!==next)return;if(status==='SUBSCRIBED'){subscribed=true;attempt=0;if(retry!==null){clearTimer(retry);retry=null;}onStatus('online');flushPending();return;}subscribed=false;if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){onStatus('reconnecting');onError(error||status);reconnect();}else onStatus('connecting');});return true;}catch(error){if(!closed){subscribed=false;onStatus('reconnecting');onError(error);reconnect();}return false;}};
    const ready=connect();
    return{
      send(event,payload){if(closed||!VISUAL_EVENTS.includes(event))return false;return sendNow(event,payload);},
      close(){closed=true;if(retry!==null)clearTimer(retry);subscribed=false;pendingEssential.length=0;pendingLatest.clear();if(!channel)return;try{channel.unsubscribe();}catch{}try{void client.removeChannel(channel);}catch{}channel=null;},
      ready
    };
  }
  const openShotStream=(roomId,onVisual,onError=()=>{})=>openVisualStream(roomId,onVisual,()=>{},onError);
  return{createFriendInvite,acceptInvite,declineInvite,cancelInvite,getRoom,getActiveRoom,getPlayersSnapshot,markReady,markNotReady,pingRoom,commitShot,submitAction,resolveTimeout,claimForfeit,leaveRoom,subscribeRoom,subscribeInvite,subscribeInvites,subscribePlayerUpdates,openVisualStream,openShotStream};
}
