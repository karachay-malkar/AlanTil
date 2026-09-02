import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueProgressEntry, normalizeProgressQueue, removeProgressQueueEntry } from '../../packages/alantil-core/sync-policy.js';
import { mergeCloudWordProgressState, normalizeWordProgressState } from '../../packages/alantil-core/word-progress.js';
import { getNativeAuthSession, nativeAuthFetch } from './auth.js';
import { loadNativeFavorites, loadNativeSettings, loadNativeSongFavorites, saveNativeFavorites, saveNativeSettings, saveNativeSongFavorites } from './storage.js';
import { loadNativeWordProgressState, saveNativeWordProgressState } from './progress.js';

const QUEUE_KEY='alantil:16.1:cloud-queue';
let flushing=null;

async function readQueue(){try{return normalizeProgressQueue(JSON.parse((await AsyncStorage.getItem(QUEUE_KEY))||'[]'));}catch{return [];}}
async function writeQueue(queue){await AsyncStorage.setItem(QUEUE_KEY,JSON.stringify(normalizeProgressQueue(queue)));}
async function json(response,fallback=null){const text=await response.text();if(!text)return fallback;try{return JSON.parse(text);}catch{return fallback;}}

export async function queueNativeWordProgressSnapshot(state){
  const normalized=normalizeWordProgressState(state);
  const words=Object.values(normalized.rows||{});
  if(!words.length)return false;
  const now=new Date().toISOString();
  const payload={snapshot_id:`mobile:${now}`,words};
  const current=await readQueue();
  const {queue}=enqueueProgressEntry(current,'word_progress_snapshot',payload,{id:'word_progress_snapshot:current',replace:true,createdAt:now});
  await writeQueue(queue);
  void flushNativeCloudQueue();
  return true;
}

export async function queueNativePreferences(){
  const session=getNativeAuthSession();
  if(!session?.user?.id)return false;
  const userId=session.user.id,now=new Date().toISOString();
  const [wordFavorites,songFavorites,settings]=await Promise.all([loadNativeFavorites(),loadNativeSongFavorites(),loadNativeSettings()]);
  let queue=await readQueue();
  for(const wordId of wordFavorites){({queue}=enqueueProgressEntry(queue,'word_favorite',{user_id:userId,word_id:String(wordId),is_active:true,updated_at:now},{id:`word_favorite:${wordId}`,replace:true,createdAt:now}));}
  for(const songId of songFavorites){({queue}=enqueueProgressEntry(queue,'song_favorite',{user_id:userId,song_id:String(songId),is_active:true,updated_at:now},{id:`song_favorite:${songId}`,replace:true,createdAt:now}));}
  ({queue}=enqueueProgressEntry(queue,'user_settings',{user_id:userId,interface_language_code:settings.interface_language_code,translation_language_code:settings.translation_language_code,alan_script_code:settings.alan_script_code,alan_dialect_code:settings.alan_dialect_code,learning_setup_completed_at:settings.learning_setup_completed_at||null,updated_at:now},{id:'user_settings:current',replace:true,createdAt:now}));
  await writeQueue(queue);
  void flushNativeCloudQueue();
  return true;
}

async function execute(entry){
  if(entry.type==='word_progress_snapshot')return nativeAuthFetch('/rest/v1/rpc/merge_word_progress_snapshot',{method:'POST',body:JSON.stringify({payload:entry.payload})});
  if(entry.type==='word_favorite')return nativeAuthFetch('/rest/v1/user_word_favorites?on_conflict=user_id,word_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(entry.payload)});
  if(entry.type==='song_favorite')return nativeAuthFetch('/rest/v1/user_song_favorites?on_conflict=user_id,song_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(entry.payload)});
  if(entry.type==='user_settings')return nativeAuthFetch('/rest/v1/user_settings?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(entry.payload)});
  return {ok:true};
}

export async function flushNativeCloudQueue(){
  if(flushing)return flushing;
  const session=getNativeAuthSession();
  if(!session?.user?.id)return false;
  flushing=(async()=>{let queue=await readQueue();let ok=true;for(const entry of [...queue]){try{const response=await execute(entry);if(!response.ok){ok=false;continue;}queue=removeProgressQueueEntry(queue,entry.id).queue;await writeQueue(queue);}catch{ok=false;}}return ok;})().finally(()=>{flushing=null;});
  return flushing;
}

export async function pullNativeCloudState(){
  const session=getNativeAuthSession();
  if(!session?.user?.id)return false;
  try{
    const [progressResponse,wordFavResponse,songFavResponse,settingsResponse]=await Promise.all([
      nativeAuthFetch('/rest/v1/user_word_progress?select=word_id,sessions_total,learn_sessions_total,learn_unfinished_total,test_answers_total,match_sessions_total,match_success_total,match_errors_total,study_shown_count,known_count,unknown_count,test_correct_count,test_wrong_count,mastery_status,mastered_at,last_mode,last_result,last_seen_at,last_studied_at,last_tested_at'),
      nativeAuthFetch('/rest/v1/user_word_favorites?is_active=eq.true&select=word_id'),
      nativeAuthFetch('/rest/v1/user_song_favorites?is_active=eq.true&select=song_id'),
      nativeAuthFetch('/rest/v1/user_settings?select=*&limit=1'),
    ]);
    const local=await loadNativeWordProgressState();
    if(progressResponse.ok){mergeCloudWordProgressState(local,await json(progressResponse,[]));await saveNativeWordProgressState(local);}
    if(wordFavResponse.ok){const cloud=await json(wordFavResponse,[]),localFav=await loadNativeFavorites();cloud.forEach((row)=>{if(row?.word_id)localFav.add(String(row.word_id));});await saveNativeFavorites(localFav);}
    if(songFavResponse.ok){const cloud=await json(songFavResponse,[]),localFav=await loadNativeSongFavorites();cloud.forEach((row)=>{if(row?.song_id)localFav.add(String(row.song_id));});await saveNativeSongFavorites(localFav);}
    if(settingsResponse.ok){const rows=await json(settingsResponse,[]);if(rows?.[0]){const localSettings=await loadNativeSettings();await saveNativeSettings({...localSettings,...rows[0],text_size_code:localSettings.text_size_code});}}
    await queueNativeWordProgressSnapshot(local);
    await queueNativePreferences();
    return true;
  }catch{return false;}
}

export async function synchronizeNativeAccount(){
  const session=getNativeAuthSession();
  if(!session?.user?.id)return false;
  await pullNativeCloudState();
  return flushNativeCloudQueue();
}
