const single=(value)=>Array.isArray(value)?(value[0]||null):(value||null);
const ACTIVE_ROOM_STATUSES=new Set(['waiting','playing']);
const VISUAL_EVENTS=Object.freeze(['piece-selected','piece-deselected','shot-mode','aim-update','aim-clear','question-select','question-submit','question-skip','shot-trajectory']);
function inviteResult(value){const row=single(value)||{};return{invite:row.invite||null,room:row.room||null};}
export function isActiveAshykRoom(room){return Boolean(room?.id&&ACTIVE_ROOM_STATUSES.has(room.status));}
export function createAshykOnlineAdapter(client){
  if(!client)throw new Error('Ashyk online client is required');
  async function rpc(name,args){const{data,error}=await client.rpc(name,args);if(error)throw error;return single(data);}
  async function createFriendInvite(friendUserId,initialState){return inviteResult(await rpc('ashyk_invite_create',{p_friend_user_id:String(friendUserId||''),p_initial_state:initialState||{}}));}
  async function acceptInvite(inviteId){return inviteResult(await rpc('ashyk_invite_accept',{p_invite_id:inviteId}));}
  async function declineInvite(inviteId){if(!inviteId)return null;return rpc('ashyk_invite_decline',{p_invite_id:inviteId});}
  async function cancelInvite(inviteId){if(!inviteId)return null;return rpc('ashyk_invite_cancel',{p_invite_id:inviteId});}
  async function getRoom(roomId){if(!roomId)return null;return rpc('ashyk_room_get',{p_room_id:roomId});}
  async function getActiveRoom(){return rpc('ashyk_active_room',{});}
  async function getPlayersSnapshot(){const{data,error}=await client.rpc('ashyk_players_snapshot',{});if(error)throw error;return Array.isArray(data)?data:[];}
  async function markReady(roomId){if(!roomId)return null;return rpc('ashyk_room_ready',{p_room_id:roomId});}
  async function pingRoom(roomId){if(!roomId)return null;return rpc('ashyk_room_ping',{p_room_id:roomId});}
  async function commitShot(room,expectedPhaseSeq,shotId){if(!room?.id||!shotId)throw new Error('Missing Ashyk shot commit');return rpc('ashyk_shot_commit',{p_room_id:room.id,p_expected_revision:Number(room.revision||0),p_expected_phase_seq:Number(expectedPhaseSeq||0),p_shot_id:String(shotId)});}
  async function submitAction(room,expectedPhaseSeq,actionId,actionType,state,nextActiveUserId,status='playing'){if(!room?.id)throw new Error('Missing Ashyk room');return rpc('ashyk_submit_action',{p_room_id:room.id,p_expected_revision:Number(room.revision||0),p_expected_phase_seq:Number(expectedPhaseSeq||0),p_action_id:String(actionId||''),p_action_type:String(actionType||''),p_state:state||{},p_next_active_user_id:nextActiveUserId||null,p_status:status});}
  async function resolveTimeout(roomId){if(!roomId)return null;return rpc('ashyk_resolve_timeout',{p_room_id:roomId});}
  async function claimForfeit(roomId){if(!roomId)return null;return rpc('ashyk_claim_forfeit',{p_room_id:roomId});}
  async function leaveRoom(roomId){if(!roomId)return null;return rpc('ashyk_leave_room',{p_room_id:roomId});}
  function channelFor(key){return client.channel(`${key}:${Math.random().toString(36).slice(2)}`);}
  function subscribeRoom(roomId,onRoom,onError=()=>{}){let channel=channelFor(`ashyk-room:${roomId}`),disposed=false,refreshing=false,queued=false;const refresh=async()=>{if(disposed)return;if(refreshing){queued=true;return;}refreshing=true;try{const room=await getRoom(roomId);if(!disposed&&room)onRoom(room);}catch(error){if(!disposed)onError(error);}finally{refreshing=false;if(queued&&!disposed){queued=false;void refresh();}}};channel.on('postgres_changes',{event:'UPDATE',schema:'public',table:'ashyk_rooms',filter:`id=eq.${roomId}`},()=>void refresh()).subscribe(status=>{if(status==='SUBSCRIBED')void refresh();else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){onError(status);void refresh();}});return()=>{disposed=true;if(!channel)return;try{channel.unsubscribe();}catch{}try{void client.removeChannel(channel);}catch{}channel=null;};}
  function subscribeInvite(inviteId,onInvite,onError=()=>{}){let channel=channelFor(`ashyk-invite:${inviteId}`);channel.on('postgres_changes',{event:'UPDATE',schema:'public',table:'ashyk_invites',filter:`id=eq.${inviteId}`},payload=>{if(payload.new)onInvite(single(payload.new));}).subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')onError(status);});return()=>{if(!channel)return;try{channel.unsubscribe();}catch{}try{void client.removeChannel(channel);}catch{}channel=null;};}
  function subscribeInvites(userId,onInvite,onError=()=>{}){const uid=String(userId||'');if(!uid)return()=>{};let channel=channelFor(`ashyk-inbox:${uid}`);channel.on('postgres_changes',{event:'*',schema:'public',table:'ashyk_invites',filter:`friend_user_id=eq.${uid}`},payload=>onInvite(single(payload.new||payload.old))).subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')onError(status);});return()=>{if(!channel)return;try{channel.unsubscribe();}catch{}try{void client.removeChannel(channel);}catch{}channel=null;};}
  function subscribePlayerUpdates(onUpdate,onError=()=>{}){let channel=channelFor('ashyk-players');const emit=()=>onUpdate?.();channel.on('postgres_changes',{event:'*',schema:'public',table:'ashyk_invites'},emit).on('postgres_changes',{event:'*',schema:'public',table:'ashyk_rooms'},emit).on('postgres_changes',{event:'*',schema:'public',table:'friendships'},emit).subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')onError(status);});return()=>{if(!channel)return;try{channel.unsubscribe();}catch{}try{void client.removeChannel(channel);}catch{}channel=null;};}
  function openVisualStream(roomId,onVisual,onStatus=()=>{},onError=()=>{}){
    if(!roomId)return{send:()=>false,close:()=>{},ready:Promise.resolve(false)};
    let channel=null,subscribed=false,closed=false;
    const pendingEssential=[],pendingLatest=new Map();
    const receive=(event)=>(message)=>{if(!closed)onVisual?.(event,message?.payload||message||{});};
    const queue=(event,payload)=>{if(['shot-trajectory','question-submit','question-skip'].includes(event)){pendingEssential.push({event,payload});if(pendingEssential.length>24)pendingEssential.shift();}else pendingLatest.set(event,{event,payload});};
    const sendNow=(event,payload)=>{if(!channel||closed||!subscribed){queue(event,payload);return false;}Promise.resolve(channel.send({type:'broadcast',event,payload})).catch((error)=>{queue(event,payload);onError(error);});return true;};
    const flushPending=()=>{if(!subscribed||closed)return;const rows=[...pendingEssential.splice(0),...pendingLatest.values()];pendingLatest.clear();for(const row of rows)sendNow(row.event,row.payload);};
    const ready=(async()=>{try{await client.realtime?.setAuth?.();if(closed)return false;channel=client.channel(`ashyk-shot:${roomId}`,{config:{private:true,broadcast:{self:false,ack:false}}});for(const event of VISUAL_EVENTS)channel.on('broadcast',{event},receive(event));channel.subscribe((status,error)=>{if(closed)return;if(status==='SUBSCRIBED'){subscribed=true;onStatus('online');flushPending();return;}subscribed=false;if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){onStatus('reconnecting');onError(error||status);return;}if(status==='CLOSED')onStatus('offline');else onStatus('connecting');});return true;}catch(error){subscribed=false;onStatus('reconnecting');onError(error);return false;}})();
    return{
      send(event,payload){if(closed||!VISUAL_EVENTS.includes(event))return false;return sendNow(event,payload);},
      close(){closed=true;subscribed=false;pendingEssential.length=0;pendingLatest.clear();if(!channel)return;try{channel.unsubscribe();}catch{}try{void client.removeChannel(channel);}catch{}channel=null;},
      ready
    };
  }
  const openShotStream=(roomId,onVisual,onError=()=>{})=>openVisualStream(roomId,onVisual,()=>{},onError);
  return{createFriendInvite,acceptInvite,declineInvite,cancelInvite,getRoom,getActiveRoom,getPlayersSnapshot,markReady,pingRoom,commitShot,submitAction,resolveTimeout,claimForfeit,leaveRoom,subscribeRoom,subscribeInvite,subscribeInvites,subscribePlayerUpdates,openVisualStream,openShotStream};
}
