import {getSupabaseClient} from '../../shared/auth/supabase-client.js?v=16.8.0.16';
import {getCurrentAuthState} from '../../shared/auth/auth-service.js?v=16.8.0.16';
import {decodeTower} from '../../../packages/tower-game/core.mjs';
export function towerUserId(){return getCurrentAuthState().user?.id||null;}
function normalize(data){return{...data,elements:decodeTower(data.elements||[]),silver:Number(data.silver)||0,gold:Number(data.gold)||0,revision:Number(data.revision)||0};}
async function rpc(name,args){const client=await getSupabaseClient();const r=await client.rpc(name,args);if(r.error)throw r.error;return normalize(r.data);}
export async function loadTower(userId=null){return rpc('get_tower_snapshot',{p_user_id:userId});}
export async function mutateTower(operation){return rpc('mutate_tower',{p_revision:operation.revision,p_operation_id:operation.id,p_action:operation.action,p_element:operation.element||null,p_element_id:operation.elementId||null,p_currency:operation.currency||'silver'});}

// V2 towers have a separate element collection and share the existing wallet
// and monotonic revision. Never pass V2 coordinates through decodeTower().
function normalizeV2(data){
 if(data?.format!==2||!Array.isArray(data.elements))throw new Error('INVALID_V2_SNAPSHOT');
 return {...data,elements:data.elements,silver:Number(data.silver)||0,gold:Number(data.gold)||0,revision:Number(data.revision)||0};
}
async function rpcV2(name,args){
 const client=await getSupabaseClient();const r=await client.rpc(name,args);
 if(r.error)throw r.error;return normalizeV2(r.data);
}
export async function loadTowerV2(userId=null){return rpcV2('get_tower_v2_snapshot',{p_user_id:userId});}
export async function mutateTowerV2(operation){return rpcV2('mutate_tower_v2',{
 p_revision:operation.revision,p_operation_id:operation.id,p_action:operation.action,
 p_element:operation.element||null,p_element_id:operation.elementId||null,
 p_currency:operation.currency||'silver'
});}

// V3 is the only writable format for prefabricated sections. It does not touch wallets.
function normalizeV3(data){
 if(data?.format!==3||!Array.isArray(data.elements)||!Number.isInteger(Number(data.revision)))
  throw new Error('INVALID_V3_SNAPSHOT');
 return {format:3,revision:Number(data.revision),elements:data.elements,replayed:!!data.replayed,resetAt:data.resetAt||null};
}
export async function loadTowerV3(userId=null){
 const client=await getSupabaseClient();
 const r=await client.rpc('get_tower_v3_snapshot',{p_user_id:userId});
 if(r.error)throw r.error;
 return normalizeV3(r.data);
}
export async function mutateTowerV3({revision,id,action,section=null,sectionId=null}){
 const client=await getSupabaseClient();
 const r=await client.rpc('mutate_tower_v3',{
  p_revision:revision,p_operation_id:id,p_action:action,p_section:section,p_section_id:sectionId
 });
 if(r.error)throw r.error;
 return normalizeV3(r.data);
}

/** Atomically clear V1/V2/V3 geometry without modifying either legacy balance. */
export async function clearTowerAll({revision,legacyRevision,id}){
 const client=await getSupabaseClient();
 const r=await client.rpc('clear_tower_all',{
  p_legacy_revision:legacyRevision,p_v3_revision:revision,p_operation_id:id
 });
 if(r.error)throw r.error;
 const snapshot=normalizeV3(r.data);
 const legacy=Number(r.data?.legacyRevision);
 if(!Number.isSafeInteger(legacy)||legacy<0||!snapshot.resetAt)throw new Error('INVALID_CLEAR_SNAPSHOT');
 return {...snapshot,legacyRevision:legacy};
}
