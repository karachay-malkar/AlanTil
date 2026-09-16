import {normalizeInboxCounts,normalizeLeaderboard,normalizeSocialSnapshot,normalizeSocialUser} from '../../packages/alantil-core/social.js';
import {nativeAuthFetch} from './auth.js';

async function body(response){const text=await response.text();if(!text)return null;try{return JSON.parse(text);}catch{return null;}}
async function rpc(name,payload={}){const response=await nativeAuthFetch(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify(payload)});const data=await body(response);if(!response.ok){const error=new Error(data?.message||`${name} failed`);error.code=String(data?.code||'');error.status=response.status;throw error;}return data;}
export async function loadNativeFriendsSnapshot(){return normalizeSocialSnapshot(await rpc('social_friends_snapshot'));}
export async function loadNativeLeaderboard(limit=100,offset=0){return normalizeLeaderboard(await rpc('social_leaderboard',{p_limit:limit,p_offset:offset}));}
export async function searchNativeUsers(query,limit=30){const value=await rpc('social_search_users',{p_query:String(query||''),p_limit:limit});return(Array.isArray(value)?value:[]).map(normalizeSocialUser);}
export async function sendNativeFriendRequest(userId){return rpc('social_send_friend_request',{p_user_id:userId});}
export async function acceptNativeFriendRequest(friendshipId){return rpc('social_accept_friend_request',{p_friendship_id:friendshipId});}
export async function declineNativeFriendRequest(friendshipId){return rpc('social_decline_friend_request',{p_friendship_id:friendshipId});}
export async function removeNativeFriend(userId){return rpc('social_remove_friend',{p_user_id:userId});}
export async function blockNativeUser(userId){return rpc('social_block_user',{p_user_id:userId});}
export async function unblockNativeUser(userId){return rpc('social_unblock_user',{p_user_id:userId});}
export async function loadNativeSocialInboxCounts(){return normalizeInboxCounts(await rpc('social_inbox_counts'));}
