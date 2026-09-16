import {getSupabaseClient} from '../auth/supabase-client.js?v=13.15.9';
import {normalizeInboxCounts,normalizeLeaderboard,normalizeSocialSnapshot,normalizeSocialUser} from '../../../packages/alantil-core/social.js';

async function rpc(name,parameters={}){const client=await getSupabaseClient();const{data,error}=await client.rpc(name,parameters);if(error)throw error;return data;}
export async function getSocialClient(){return getSupabaseClient();}
export async function getSocialSession(){const client=await getSupabaseClient();const{data}=await client.auth.getSession();return data?.session||null;}
export async function fetchFriendsSnapshot(){return normalizeSocialSnapshot(await rpc('social_friends_snapshot'));}
export async function fetchSocialLeaderboard(limit=100,offset=0){return normalizeLeaderboard(await rpc('social_leaderboard',{p_limit:limit,p_offset:offset}));}
export async function searchSocialUsers(query,limit=30){const rows=await rpc('social_search_users',{p_query:String(query||''),p_limit:limit});return(Array.isArray(rows)?rows:[]).map(normalizeSocialUser);}
export async function sendFriendRequest(userId){return rpc('social_send_friend_request',{p_user_id:userId});}
export async function acceptFriendRequest(friendshipId){return rpc('social_accept_friend_request',{p_friendship_id:friendshipId});}
export async function declineFriendRequest(friendshipId){return rpc('social_decline_friend_request',{p_friendship_id:friendshipId});}
export async function removeFriend(userId){return rpc('social_remove_friend',{p_user_id:userId});}
export async function blockUser(userId){return rpc('social_block_user',{p_user_id:userId});}
export async function unblockUser(userId){return rpc('social_unblock_user',{p_user_id:userId});}
export async function fetchSocialInboxCounts(){return normalizeInboxCounts(await rpc('social_inbox_counts'));}

export async function startSocialInboxController(onCounts){const client=await getSupabaseClient();let channel=null,disposed=false;const emit=async()=>{if(disposed)return;try{onCounts?.(await fetchSocialInboxCounts());}catch{onCounts?.({friend_requests:0,ashyk_invites:0,total:0});}};const stopChannel=()=>{if(!channel)return;try{channel.unsubscribe();}catch{}try{void client.removeChannel(channel);}catch{}channel=null;};const startChannel=()=>{stopChannel();channel=client.channel(`social-inbox:${Math.random().toString(36).slice(2)}`).on('postgres_changes',{event:'*',schema:'public',table:'friendships'},emit).on('postgres_changes',{event:'*',schema:'public',table:'ashyk_invites'},emit).subscribe();};const auth=client.auth.onAuthStateChange((_event,session)=>{if(disposed)return;if(session?.user){startChannel();void emit();}else{stopChannel();onCounts?.({friend_requests:0,ashyk_invites:0,total:0});}});const{data:{session}}=await client.auth.getSession();if(session?.user){startChannel();await emit();}else onCounts?.({friend_requests:0,ashyk_invites:0,total:0});return()=>{disposed=true;stopChannel();auth?.data?.subscription?.unsubscribe?.();};}
