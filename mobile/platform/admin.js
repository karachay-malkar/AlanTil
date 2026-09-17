import {getNativeAuthSession,nativeAuthFetch} from './auth.js';

async function body(response){const text=await response.text();if(!text)return null;try{return JSON.parse(text);}catch{return null;}}
async function rpc(name,payload={}){const response=await nativeAuthFetch(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify(payload)});const data=await body(response);if(!response.ok){const error=new Error(data?.message||`${name} failed`);error.code=String(data?.code||'');error.status=response.status;throw error;}return data;}

export async function fetchNativeActivityAccess(){
  const userId=getNativeAuthSession()?.user?.id;
  if(!userId)return false;
  try{
    const response=await nativeAuthFetch(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}&select=activity_access&limit=1`,{headers:{Accept:'application/json'}});
    const data=await body(response);
    return Boolean(response.ok && Array.isArray(data) && data[0]?.activity_access===true);
  }catch{return false;}
}
export async function fetchNativeUserActivityList(){const rows=await rpc('admin_user_activity_list');return Array.isArray(rows)?rows:[];}
export async function fetchNativeUserActivityDetail(userId){const id=String(userId||'').trim();if(!id)return null;return rpc('admin_user_activity_detail',{p_user_id:id});}
export async function fetchNativeUserTestHistory(userId){const id=String(userId||'').trim();if(!id)return[];const rows=await rpc('admin_user_test_history',{p_user_id:id});return Array.isArray(rows)?rows:[];}
export async function fetchNativeUserFavorites(userId){const id=String(userId||'').trim();if(!id)return[];const rows=await rpc('admin_user_favorites',{p_user_id:id});return Array.isArray(rows)?rows:[];}
export async function fetchNativeStationTestDetail(sessionId){const id=String(sessionId||'').trim();if(!id)return null;return rpc('admin_station_test_detail',{p_session_id:id});}
export async function blockNativeUserAccount(userId){const id=String(userId||'').trim();if(!id)return false;return Boolean(await rpc('admin_block_account',{p_user_id:id}));}
export async function unblockNativeUserAccount(userId){const id=String(userId||'').trim();if(!id)return false;return Boolean(await rpc('admin_unblock_account',{p_user_id:id}));}
