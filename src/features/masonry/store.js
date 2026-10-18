/** Server-backed drafts; no edits to tower_game gameplay tables. */
import {getSupabaseClient} from '../../shared/auth/supabase-client.js?v=16.7.1';
import {getCurrentAuthState} from '../../shared/auth/auth-service.js?v=16.7.1';
import {validateRecipe} from './library.js';

const TABLE='masonry_editor_sections';
const userId=()=>{
 const u=getCurrentAuthState()?.user?.id;
 if(!u)throw new Error('Требуется авторизация');
 return u;
};
const localKey=()=> 'alantil_common100_editor_autosave_v1:'+userId();
const fileName=s=>String(s||'section').replace(/[^a-z0-9а-яё_-]+/gi,'-').slice(0,70);
export function saveLocalScratch(draft){
 try{localStorage.setItem(localKey(),JSON.stringify({savedAt:new Date().toISOString(),draft}));return true;}
 catch{return false;}
}
export function readLocalScratch(){
 try{const entry=JSON.parse(localStorage.getItem(localKey())||'null');return entry?.draft||null;}
 catch{return null;}
}
export function clearLocalScratch(){try{localStorage.removeItem(localKey());}catch{}}
export async function listSections(){
 const client=await getSupabaseClient();
 const {data,error}=await client.from(TABLE).select('id,title,status,cells,updated_at').eq('user_id',userId()).order('updated_at',{ascending:false}).limit(100);
 if(error)throw error;return data||[];
}
export async function loadSection(id){
 const client=await getSupabaseClient();
 const {data,error}=await client.from(TABLE).select('id,title,status,cells,recipe,updated_at').eq('user_id',userId()).eq('id',id).single();
 if(error)throw error;return data;
}
export async function saveSection({id,title,status,cells,recipe},manifest){
 validateRecipe(recipe,manifest);
 if(!['draft','ready'].includes(status))throw new Error('Редактировать можно только черновики');
 const client=await getSupabaseClient();
 const payload={user_id:userId(),title:String(title||'Секция').trim().slice(0,120),status,cells,recipe};
 if(!payload.title)throw new Error('Укажите название секции');
 const query=id?client.from(TABLE).update(payload).eq('id',id).eq('user_id',userId()):client.from(TABLE).insert(payload);
 const {data,error}=await query.select('id,title,status,cells,updated_at').single();
 if(error)throw error;return data;
}
export function downloadRecipe({title,recipe}){
 const data=JSON.stringify({title,recipe},null,2);
 const blob=new Blob([data],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=fileName(title)+'.json';document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
}
