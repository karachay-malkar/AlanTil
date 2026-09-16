const single=(value)=>Array.isArray(value)?(value[0]||null):(value||null);
function inviteResult(value){const row=single(value)||{};return{invite:row.invite||null,room:row.room||null};}
export function createAshykOnlineAdapter(client){
  if(!client)throw new Error('Ashyk online client is required');
  async function rpc(name,args){const{data,error}=await client.rpc(name,args);if(error)throw error;return single(data);}
  async function createFriendInvite(friendUserId,initialState){const data=await rpc('ashyk_invite_create',{p_friend_user_id:String(friendUserId||''),p_initial_state:initialState||{}});return inviteResult(data);}
  async function acceptInvite(inviteId){const data=await rpc('ashyk_invite_accept',{p_invite_id:inviteId});return inviteResult(data);}
  async function declineInvite(inviteId){if(!inviteId)return null;return rpc('ashyk_invite_decline',{p_invite_id:inviteId});}
  async function cancelInvite(inviteId){if(!inviteId)return null;return rpc('ashyk_invite_cancel',{p_invite_id:inviteId});}
  async function submitRoomState(room,state,nextActiveUserId,status='playing'){if(!room?.id)throw new Error('Missing Ashyk room');return rpc('ashyk_submit_state',{p_room_id:room.id,p_expected_revision:Number(room.revision||0),p_state:state,p_next_active_user_id:nextActiveUserId||null,p_status:status});}
  async function leaveRoom(roomId){if(!roomId)return null;return rpc('ashyk_leave_room',{p_room_id:roomId});}
  function channelFor(key){return client.channel(`${key}:${Math.random().toString(36).slice(2)}`);}
  function subscribeRoom(roomId,onRoom,onError=()=>{}){let channel=channelFor(`ashyk-room:${roomId}`);channel.on('postgres_changes',{event:'UPDATE',schema:'public',table:'ashyk_rooms',filter:`id=eq.${roomId}`},payload=>{if(payload.new)onRoom(single(payload.new));}).subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')onError(status);});return()=>{if(!channel)return;try{channel.unsubscribe();}catch{}try{void client.removeChannel(channel);}catch{}channel=null;};}
  function subscribeInvite(inviteId,onInvite,onError=()=>{}){let channel=channelFor(`ashyk-invite:${inviteId}`);channel.on('postgres_changes',{event:'UPDATE',schema:'public',table:'ashyk_invites',filter:`id=eq.${inviteId}`},payload=>{if(payload.new)onInvite(single(payload.new));}).subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')onError(status);});return()=>{if(!channel)return;try{channel.unsubscribe();}catch{}try{void client.removeChannel(channel);}catch{}channel=null;};}
  function subscribeInvites(userId,onInvite,onError=()=>{}){const uid=String(userId||'');if(!uid)return()=>{};let channel=channelFor(`ashyk-inbox:${uid}`);channel.on('postgres_changes',{event:'*',schema:'public',table:'ashyk_invites',filter:`friend_user_id=eq.${uid}`},payload=>onInvite(single(payload.new||payload.old))).subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')onError(status);});return()=>{if(!channel)return;try{channel.unsubscribe();}catch{}try{void client.removeChannel(channel);}catch{}channel=null;};}
  return{createFriendInvite,acceptInvite,declineInvite,cancelInvite,submitRoomState,leaveRoom,subscribeRoom,subscribeInvite,subscribeInvites};
}
