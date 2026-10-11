import {getSupabaseClient} from '../../shared/auth/supabase-client.js?v=16.8.0.16';
import {getCurrentAuthState} from '../../shared/auth/auth-service.js?v=16.8.0.16';
import {decodeTower} from '../../../packages/tower-game/core.mjs';
export function towerUserId(){return getCurrentAuthState().user?.id||null;}
function normalize(data){return{...data,elements:decodeTower(data.elements||[]),silver:Number(data.silver)||0,gold:Number(data.gold)||0,revision:Number(data.revision)||0};}
async function rpc(name,args){const client=await getSupabaseClient();const r=await client.rpc(name,args);if(r.error)throw r.error;return normalize(r.data);}
export async function loadTower(userId=null){return rpc('get_tower_snapshot',{p_user_id:userId});}
export async function mutateTower(operation){return rpc('mutate_tower',{p_revision:operation.revision,p_operation_id:operation.id,p_action:operation.action,p_element:operation.element||null,p_element_id:operation.elementId||null,p_currency:operation.currency||'silver'});}
