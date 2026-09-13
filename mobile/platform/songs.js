import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeSongCollection } from '../../packages/alantil-core/song-catalog.js';
import { BUNDLED_SONG_CATALOG, isSongsCacheFresh, normalizeSongsCache, normalizeSupabaseSongs } from '../../packages/alantil-core/song-supabase.js';
import { nativeSupabase } from './supabase.js';

const CACHE_KEY='alantil:16.6.7:songs-cache-v3';
const LEGACY_CACHE_KEY='alantil:16.1:songs-cache-v2';
const TIMEOUT_MS=8000;
let memorySongs=normalizeSongCollection(BUNDLED_SONG_CATALOG);
let memoryFetchedAt=0;
let refreshPromise=null;

async function readPersistentCache(){
  for(const key of [CACHE_KEY,LEGACY_CACHE_KEY]){
    try{
      const raw=await AsyncStorage.getItem(key);
      if(!raw)continue;
      const parsed=normalizeSongsCache(JSON.parse(raw));
      if(!parsed)continue;
      const normalized=normalizeSongCollection(parsed.songs);
      if(parsed.songs.length&&!normalized.length)continue;
      return {songs:normalized,fetchedAt:parsed.fetchedAt,key};
    }catch{}
  }
  return null;
}

async function writePersistentCache(songs,fetchedAt){
  await AsyncStorage.setItem(CACHE_KEY,JSON.stringify({songs,fetchedAt})).catch(()=>{});
}

async function refreshSongs(){
  if(refreshPromise)return refreshPromise;
  refreshPromise=(async()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
    try{
      let query=nativeSupabase.from('v_songs_app').select('*').order('playlist_order',{ascending:true,nullsFirst:false}).order('sort_order',{ascending:true}).order('id',{ascending:true});
      if(typeof query.abortSignal==='function')query=query.abortSignal(controller.signal);
      const {data,error}=await query;
      if(error)throw error;
      const songs=normalizeSupabaseSongs(data);
      if(!songs.length)throw new Error('Supabase songs catalog is empty');
      memorySongs=normalizeSongCollection(songs);
      memoryFetchedAt=Date.now();
      await writePersistentCache(memorySongs,memoryFetchedAt);
      return memorySongs;
    }finally{clearTimeout(timer);}
  })().finally(()=>{refreshPromise=null;});
  return refreshPromise;
}

export async function loadNativeSongs({force=false,onCached,onWarning}={}){
  if(memorySongs.length)onCached?.(memorySongs);
  if(!force&&isSongsCacheFresh(memoryFetchedAt))return memorySongs;

  const cached=await readPersistentCache();
  if(cached){
    memorySongs=cached.songs;
    memoryFetchedAt=cached.fetchedAt;
    onCached?.(memorySongs);
    if(!force&&isSongsCacheFresh(memoryFetchedAt))return memorySongs;
  }

  try{return await refreshSongs();}
  catch(error){
    if(memorySongs.length){onWarning?.(error);return memorySongs;}
    throw error;
  }
}

export function getNativeSongsMemoryCache(){return memorySongs;}
export function clearNativeSongsMemoryCache(){memorySongs=normalizeSongCollection(BUNDLED_SONG_CATALOG);memoryFetchedAt=0;}