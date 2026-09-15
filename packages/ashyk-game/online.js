const cleanCode=(value)=>String(value||'').trim().toUpperCase();
const single=(value)=>Array.isArray(value)?(value[0]||null):(value||null);
export function createAshykOnlineAdapter(client){
  if(!client)throw new Error('Ashyk online client is required');
  async function rpc(name,args){const{data,error}=await client.rpc(name,args);if(error)throw error;return single(data);}
  async function createRoom(initialState){return rpc('ashyk_create_room',{p_initial_state:initialState});}
  async function joinRoom(code){return rpc('ashyk_join_room',{p_code:cleanCode(code)});}
  async function submitRoomState(room,state,nextActiveUserId,status='playing'){if(!room?.id)throw new Error('Missing Ashyk room');return rpc('ashyk_submit_state',{p_room_id:room.id,p_expected_revision:Number(room.revision||0),p_state:state,p_next_active_user_id:nextActiveUserId||null,p_status:status});}
  async function leaveRoom(roomId){if(!roomId)return null;return rpc('ashyk_leave_room',{p_room_id:roomId});}
  function subscribeRoom(roomId,onRoom,onError=()=>{}){let channel=client.channel(`ashyk-room:${roomId}:${Math.random().toString(36).slice(2)}`);channel.on('postgres_changes',{event:'UPDATE',schema:'public',table:'ashyk_rooms',filter:`id=eq.${roomId}`},payload=>{if(payload.new)onRoom(single(payload.new));}).subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')onError(status);});return()=>{if(!channel)return;try{channel.unsubscribe();}catch{}try{void client.removeChannel(channel);}catch{}channel=null;};}
  return{createRoom,joinRoom,submitRoomState,leaveRoom,subscribeRoom};
}
