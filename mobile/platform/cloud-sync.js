import {createDurableQueue} from '../../packages/alantil-core/durable-queue.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveFavoriteSyncRows } from '../../packages/alantil-core/favorites.js';
import { resolveTimestampedUserSettings } from '../../packages/alantil-core/settings.js';
import { GUEST_STORAGE_SCOPE, scopedStorageKey } from '../../packages/alantil-core/storage-scope.js';
import { enqueueProgressEntry, normalizeProgressQueue } from '../../packages/alantil-core/sync-policy.js';
import { MAX_PROCESSED_WORD_SESSIONS, mergeCloudWordProgressState, normalizeWordProgressState } from '../../packages/alantil-core/word-progress.js';
import { getNativeAuthSession, nativeAuthFetch } from './auth.js';
import { migrateLegacyNativeValueToGuest, nativeScopedStorageKey } from './storage-scope.js';
import { applyNativeFavoriteSyncRows, applyNativeSettingsFromSync, loadNativeFavoriteSyncRows, loadNativeSettings, loadNativeSettingsSyncTimestamp, saveNativeFavorites, saveNativeSettings, saveNativeSongFavorites } from './storage.js';
import { loadNativeWordProgressState, saveNativeWordProgressState } from './progress.js';

const QUEUE_BASE='alantil:16.1:cloud-queue';
const PROGRESS_BASE='alantil:16.1:word-progress',FAVORITES_BASE='alantil:16.1:favorites',SONG_FAVORITES_BASE='alantil:16.1:song-favorites',SETTINGS_BASE='alantil:16.1:settings',SETTINGS_SYNC_BASE='alantil:16.4.1:settings-sync';
const flushing=new Map(),synchronizing=new Map(),flushRequested=new Set();
function queueContext(){return {key:nativeScopedStorageKey(QUEUE_BASE),userId:String(getNativeAuthSession()?.user?.id||'')};}
function sameUser(context){return context.userId===String(getNativeAuthSession()?.user?.id||'');}
const durableQueue=createDurableQueue({
 read:async key=>{await migrateLegacyNativeValueToGuest(QUEUE_BASE);const raw=await AsyncStorage.getItem(key);return normalizeProgressQueue(raw?JSON.parse(raw):[]);},
 write:async(key,queue)=>{await AsyncStorage.setItem(key,JSON.stringify(normalizeProgressQueue(queue)));}
});
function enqueue(context,type,payload,options){return durableQueue.mutate(context.key,current=>enqueueProgressEntry(current,type,payload,options).queue);}
function requestFlush(){const context=queueContext();if(flushing.has(context.key)){flushRequested.add(context.key);return;}void flushNativeCloudQueue().catch(()=>{});}
async function json(response,fallback=null){const text=await response.text();if(!text)return fallback;try{return JSON.parse(text);}catch{return fallback;}}
async function readScoped(base,scope,fallback){try{const raw=await AsyncStorage.getItem(scopedStorageKey(base,scope));return raw?JSON.parse(raw):fallback;}catch{return fallback;}}

export async function claimNativeGuestStateToAccount(){
  const session=getNativeAuthSession(),userId=String(session?.user?.id||'');if(!userId)return false;
  await Promise.all([PROGRESS_BASE,FAVORITES_BASE,SONG_FAVORITES_BASE,SETTINGS_BASE].map((base)=>migrateLegacyNativeValueToGuest(base)));
  const marker=nativeScopedStorageKey(`alantil:16.4.1:guest-claim:${userId}`);if(await AsyncStorage.getItem(marker))return false;
  const guestProgress=normalizeWordProgressState(await readScoped(PROGRESS_BASE,GUEST_STORAGE_SCOPE,{})),accountProgress=await loadNativeWordProgressState();mergeCloudWordProgressState(accountProgress,Object.values(guestProgress.rows||{}));accountProgress.processed_session_ids=Array.from(new Set([...(accountProgress.processed_session_ids||[]),...(guestProgress.processed_session_ids||[])])).slice(-MAX_PROCESSED_WORD_SESSIONS);await saveNativeWordProgressState(accountProgress);
  const guestFav=new Set((await readScoped(FAVORITES_BASE,GUEST_STORAGE_SCOPE,[])).map(String)),accountFav=new Set((await loadNativeFavoriteSyncRows('word')).filter((row)=>row.is_active).map((row)=>row.id));guestFav.forEach((id)=>accountFav.add(id));await saveNativeFavorites(accountFav);
  const guestSongFav=new Set((await readScoped(SONG_FAVORITES_BASE,GUEST_STORAGE_SCOPE,[])).map(String)),accountSongFav=new Set((await loadNativeFavoriteSyncRows('song')).filter((row)=>row.is_active).map((row)=>row.id));guestSongFav.forEach((id)=>accountSongFav.add(id));await saveNativeSongFavorites(accountSongFav);
  const accountSettingsKey=nativeScopedStorageKey(SETTINGS_BASE),guestSettings=await readScoped(SETTINGS_BASE,GUEST_STORAGE_SCOPE,null),guestSettingsMeta=await readScoped(SETTINGS_SYNC_BASE,GUEST_STORAGE_SCOPE,null);if(guestSettings&&await AsyncStorage.getItem(accountSettingsKey)===null)await saveNativeSettings(guestSettings,{updatedAt:guestSettingsMeta?.updated_at||new Date().toISOString()});
  await AsyncStorage.setItem(marker,new Date().toISOString());await queueNativeWordProgressSnapshot(accountProgress);await queueNativePreferences();return true;
}

export async function queueNativeWordProgressSnapshot(state){const context=queueContext(),normalized=normalizeWordProgressState(state),words=Object.values(normalized.rows||{});if(!words.length)return false;const now=new Date().toISOString(),payload={snapshot_id:`mobile:${now}`,words};await enqueue(context,'word_progress_snapshot',payload,{id:'word_progress_snapshot:current',replace:true,createdAt:now});if(sameUser(context))requestFlush();return true;}
export async function queueNativeFavoriteChange(kind,id,isActive,updatedAt=''){const session=getNativeAuthSession();if(!session?.user?.id||!id)return false;const context=queueContext(),userId=session.user.id,now=updatedAt||new Date().toISOString(),type=kind==='song'?'song_favorite':'word_favorite',payload=kind==='song'?{user_id:userId,song_id:String(id),is_active:Boolean(isActive),updated_at:now}:{user_id:userId,word_id:String(id),is_active:Boolean(isActive),updated_at:now};await enqueue(context,type,payload,{id:`${type}:${id}`,replace:true,createdAt:now});if(sameUser(context))requestFlush();return true;}
export async function queueNativePreferences(){const session=getNativeAuthSession();if(!session?.user?.id)return false;const context=queueContext(),userId=session.user.id,now=new Date().toISOString(),[wordRows,songRows,settings,settingsUpdatedAt]=await Promise.all([loadNativeFavoriteSyncRows('word'),loadNativeFavoriteSyncRows('song'),loadNativeSettings(),loadNativeSettingsSyncTimestamp()]);if(!sameUser(context))return false;await durableQueue.mutate(context.key,queue=>{for(const row of wordRows)({queue}=enqueueProgressEntry(queue,'word_favorite',{user_id:userId,word_id:row.id,is_active:row.is_active,updated_at:row.updated_at||now},{id:`word_favorite:${row.id}`,replace:true,createdAt:row.updated_at||now}));for(const row of songRows)({queue}=enqueueProgressEntry(queue,'song_favorite',{user_id:userId,song_id:row.id,is_active:row.is_active,updated_at:row.updated_at||now},{id:`song_favorite:${row.id}`,replace:true,createdAt:row.updated_at||now}));const settingsTimestamp=settingsUpdatedAt||now;({queue}=enqueueProgressEntry(queue,'user_settings',{user_id:userId,interface_language_code:settings.interface_language_code,translation_language_code:settings.translation_language_code,alan_script_code:settings.alan_script_code,alan_dialect_code:settings.alan_dialect_code,learning_setup_completed_at:settings.learning_setup_completed_at||null,updated_at:settingsTimestamp},{id:'user_settings:current',replace:true,createdAt:settingsTimestamp}));return queue;});if(sameUser(context))requestFlush();return true;}
async function execute(entry,context){const send=(path,options)=>nativeAuthFetch(path,options,context.userId);if(entry.type==='word_progress_snapshot')return send('/rest/v1/rpc/merge_word_progress_snapshot',{method:'POST',body:JSON.stringify({payload:entry.payload})});if(entry.type==='word_favorite')return send('/rest/v1/user_word_favorites?on_conflict=user_id,word_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(entry.payload)});if(entry.type==='song_favorite')return send('/rest/v1/user_song_favorites?on_conflict=user_id,song_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(entry.payload)});if(entry.type==='user_settings')return send('/rest/v1/user_settings?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(entry.payload)});return {ok:true};}
export async function flushNativeCloudQueue(){
 const context=queueContext();if(!context.userId)return false;
 if(flushing.has(context.key))return flushing.get(context.key);
 const run=(async()=>{
  while(sameUser(context)){
   const queue=await durableQueue.read(context.key);if(!queue.length)return true;
   for(const entry of queue){
    if(!sameUser(context))return false;
    if(entry.payload?.user_id&&String(entry.payload.user_id)!==context.userId)return false;
    let response;try{response=await execute(entry,context);}catch{return false;}
    if(!response.ok)return false;
    await durableQueue.acknowledge(context.key,entry);
   }
  }
  return false;
 })().finally(()=>{flushing.delete(context.key);if(flushRequested.delete(context.key)&&sameUser(context))requestFlush();});flushing.set(context.key,run);return run;
}
function cloudFavoriteRows(rows,idField){return (Array.isArray(rows)?rows:[]).map((row)=>({id:String(row?.[idField]||''),is_active:row?.is_active!==false,updated_at:row?.updated_at||null})).filter((row)=>row.id);}
export async function pullNativeCloudState(){const context=queueContext(),session=getNativeAuthSession();if(!session?.user?.id)return false;try{const [progressResponse,wordFavResponse,songFavResponse,settingsResponse]=await Promise.all([nativeAuthFetch('/rest/v1/user_word_progress?select=word_id,sessions_total,learn_sessions_total,learn_unfinished_total,test_answers_total,match_sessions_total,match_success_total,match_errors_total,study_shown_count,known_count,unknown_count,test_correct_count,test_wrong_count,mastery_status,mastered_at,last_mode,last_result,last_seen_at,last_studied_at,last_tested_at'),nativeAuthFetch('/rest/v1/user_word_favorites?select=word_id,is_active,updated_at'),nativeAuthFetch('/rest/v1/user_song_favorites?select=song_id,is_active,updated_at'),nativeAuthFetch('/rest/v1/user_settings?select=*&limit=1')]);if(!sameUser(context))return false;const local=await loadNativeWordProgressState();if(progressResponse.ok){mergeCloudWordProgressState(local,await json(progressResponse,[]));await saveNativeWordProgressState(local);}if(wordFavResponse.ok){const resolved=resolveFavoriteSyncRows(await loadNativeFavoriteSyncRows('word'),cloudFavoriteRows(await json(wordFavResponse,[]),'word_id'));await applyNativeFavoriteSyncRows('word',resolved);}if(songFavResponse.ok){const resolved=resolveFavoriteSyncRows(await loadNativeFavoriteSyncRows('song'),cloudFavoriteRows(await json(songFavResponse,[]),'song_id'));await applyNativeFavoriteSyncRows('song',resolved);}if(settingsResponse.ok){const rows=await json(settingsResponse,[]),cloud=rows?.[0];if(cloud){const localSettings=await loadNativeSettings(),localUpdatedAt=await loadNativeSettingsSyncTimestamp(),resolved=resolveTimestampedUserSettings({localSettings,localUpdatedAt,cloudSettings:cloud,cloudUpdatedAt:cloud.updated_at});await applyNativeSettingsFromSync(resolved.settings,resolved.updated_at||localUpdatedAt||new Date().toISOString());}}await queueNativeWordProgressSnapshot(local);await queueNativePreferences();return sameUser(context)&&[progressResponse,wordFavResponse,songFavResponse,settingsResponse].every(response=>response.ok);}catch{return false;}}
export async function synchronizeNativeAccount(){
 const context=queueContext();if(!context.userId)return false;
 if(synchronizing.has(context.key))return synchronizing.get(context.key);
 const run=(async()=>{await claimNativeGuestStateToAccount();if(!sameUser(context))return false;const pulled=await pullNativeCloudState();if(!sameUser(context))return false;const sent=await flushNativeCloudQueue();return pulled&&sent;})().finally(()=>{synchronizing.delete(context.key);});
 synchronizing.set(context.key,run);return run;
}
