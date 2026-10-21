import {getSupabaseClient} from '../../shared/auth/supabase-client.js?v=16.8.0.16';
import {getCurrentAuthState} from '../../shared/auth/auth-service.js?v=16.8.0.16';

/** The only persisted construction format is current approved V3 sections. */
export function towerUserId(){return getCurrentAuthState().user?.id||null;}
function normalize(data){
 if(data?.format!==3||!Array.isArray(data.elements)||!Number.isSafeInteger(Number(data.revision)))
  throw new Error('INVALID_TOWER_SNAPSHOT');
 return {format:3,revision:Number(data.revision),elements:data.elements,
  replayed:!!data.replayed,resetAt:data.resetAt||null};
}
async function rpc(name,args){
 const client=await getSupabaseClient();
 const result=await client.rpc(name,args);
 if(result.error)throw result.error;
 return normalize(result.data);
}
export function loadTowerV3(userId=null){
 return rpc('get_tower_v3_snapshot',{p_user_id:userId});
}
export function mutateTowerV3({revision,id,action,section=null,sectionId=null}){
 return rpc('mutate_tower_v3',{
  p_revision:revision,p_operation_id:id,p_action:action,p_section:section,p_section_id:sectionId
 });
}
export function clearTowerV3({revision,id}){
 return rpc('clear_tower_v3',{p_revision:revision,p_operation_id:id});
}
