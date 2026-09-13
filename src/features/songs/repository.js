import { getSupabaseClient } from "../../shared/auth/supabase-client.js?v=13.10.6";
import { readJson, writeJson } from "../../shared/state/storage.js?v=13.9.0";
import { BUNDLED_SONG_CATALOG, isSongsCacheFresh, normalizeSongsCache, normalizeSupabaseSongs } from "../../../packages/alantil-core/song-supabase.js";
import { normalizeSongCollection } from "../../../packages/alantil-core/song-catalog.js";

const SONGS_CACHE_KEY="fc_songs_cache_v3";
const LEGACY_CACHE_KEY="fc_songs_cache_v2";
let songs=null;
let fetchedAt=0;
let loadingPromise=null;
let requestCount=0;

function readPersistentCache(){
  for(const key of [SONGS_CACHE_KEY,LEGACY_CACHE_KEY]){
    const parsed=normalizeSongsCache(readJson(key,null));
    if(!parsed)continue;
    const normalized=normalizeSongCollection(parsed.songs);
    if(parsed.songs.length&&!normalized.length)continue;
    return {songs:normalized,fetchedAt:parsed.fetchedAt};
  }
  return null;
}

async function refreshSongs(){
  if(loadingPromise)return loadingPromise;
  loadingPromise=(async()=>{
    requestCount+=1;
    const supabase=await getSupabaseClient();
    const {data,error}=await supabase.from("v_songs_app").select("*").order("playlist_order",{ascending:true,nullsFirst:false}).order("sort_order",{ascending:true}).order("id",{ascending:true});
    if(error)throw error;
    const remote=normalizeSupabaseSongs(data);
    if(!remote.length)throw new Error("Supabase songs catalog is empty");
    songs=normalizeSongCollection(remote);
    fetchedAt=Date.now();
    writeJson(SONGS_CACHE_KEY,{songs,fetchedAt});
    return songs;
  })().catch((error)=>{
    console.warn("songs-repository: Supabase refresh failed",error);
    return songs||[];
  }).finally(()=>{loadingPromise=null;});
  return loadingPromise;
}

function ensureCachedSongs(){
  if(songs)return songs;
  const cached=readPersistentCache();
  if(cached){songs=cached.songs;fetchedAt=cached.fetchedAt;}
  else {songs=normalizeSongCollection(BUNDLED_SONG_CATALOG);fetchedAt=0;}
  return songs;
}

export async function getSongs(){
  const current=ensureCachedSongs();
  if(!isSongsCacheFresh(fetchedAt))void refreshSongs();
  return current;
}

export async function getSongById(songId){
  const id=String(songId||"");
  let collection=await getSongs();
  let song=collection.find((entry)=>entry.id===id)||null;
  if(song&&song.lyrics)return song;
  collection=await refreshSongs();
  return collection.find((entry)=>entry.id===id)||song;
}

export async function getSongsByPlaylist(playlistId){
  const collection=await getSongs();
  return collection.filter((song)=>song.playlistId===String(playlistId||""));
}

export async function getPlaylists(){
  const collection=await getSongs();
  const grouped=new Map();
  collection.forEach((song)=>{
    if(!grouped.has(song.playlistId))grouped.set(song.playlistId,{id:song.playlistId,title:song.playlistTitle,description:song.playlistDescription,order:song.playlistOrder,coverUrl:song.coverUrl,count:0});
    grouped.get(song.playlistId).count+=1;
  });
  return Array.from(grouped.values()).sort((left,right)=>left.order-right.order||left.title.localeCompare(right.title,"ru"));
}

export function clearSongsCache(){
  songs=null;fetchedAt=0;loadingPromise=null;
  try{localStorage.removeItem(SONGS_CACHE_KEY);localStorage.removeItem(LEGACY_CACHE_KEY);}catch{}
}

export function getSongsRepositoryDiagnostics(){return{requestCount,cached:Array.isArray(songs),size:songs?.length||0,fetchedAt,refreshing:Boolean(loadingPromise)};}