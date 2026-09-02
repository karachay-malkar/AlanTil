import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeFavoriteSyncRows, resolveFavoriteSyncRows } from '../../packages/alantil-core/favorites.js';
import { getNativeAuthSession, nativeAuthFetch } from './auth.js';
import { migrateLegacyNativeValueToGuest, nativeScopedStorageKey } from './storage-scope.js';

const KEY='alantil:16.1:hidden-words';
const SYNC_KEY='alantil:16.4.1:hidden-words-sync';
async function key(base){await migrateLegacyNativeValueToGuest(base);return nativeScopedStorageKey(base);}
async function readJson(base,fallback){try{const raw=await AsyncStorage.getItem(await key(base));return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
async function writeJson(base,value){await AsyncStorage.setItem(await key(base),JSON.stringify(value));}
async function read(){const values=await readJson(KEY,[]);return new Set(Array.isArray(values)?values.map(String):[]);}
async function readSyncRows(){const active=await read(),stored=normalizeFavoriteSyncRows(await readJson(SYNC_KEY,[])),map=new Map(stored.map((row)=>[row.id,row]));for(const id of active)if(!map.has(id))map.set(id,{id,is_active:true,updated_at:null});return Array.from(map.values());}
async function applySyncRows(rows){const normalized=normalizeFavoriteSyncRows(rows),active=new Set(normalized.filter((row)=>row.is_active).map((row)=>row.id));await Promise.all([writeJson(KEY,[...active]),writeJson(SYNC_KEY,normalized)]);return active;}
export async function loadNativeHiddenWords(){return read();}
export async function saveNativeHiddenWords(nextIds,changedIds=[]){const before=await read(),set=nextIds instanceof Set?new Set([...nextIds].map(String)):new Set((nextIds||[]).map(String)),now=new Date().toISOString(),rows=await readSyncRows(),map=new Map(rows.map((row)=>[row.id,row])),changed=new Set((changedIds||[]).map(String));for(const id of new Set([...before,...set]))if(before.has(id)!==set.has(id))changed.add(id);for(const id of changed)map.set(id,{id,is_active:set.has(id),updated_at:now});await Promise.all([writeJson(KEY,[...set]),writeJson(SYNC_KEY,Array.from(map.values()))]);const session=getNativeAuthSession();if(session?.user?.id){for(const id of changed){try{await nativeAuthFetch('/rest/v1/user_hidden_words?on_conflict=user_id,word_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:session.user.id,word_id:String(id),is_hidden:set.has(String(id)),updated_at:now})});}catch{}}}return set;}
export async function mergeNativeCloudHiddenWords(){const session=getNativeAuthSession();if(!session?.user?.id)return read();const localRows=await readSyncRows();try{const response=await nativeAuthFetch('/rest/v1/user_hidden_words?select=word_id,is_hidden,updated_at');if(response.ok){const rows=await response.json(),cloudRows=(Array.isArray(rows)?rows:[]).map((row)=>({id:String(row?.word_id||''),is_active:row?.is_hidden!==false,updated_at:row?.updated_at||null})).filter((row)=>row.id);return applySyncRows(resolveFavoriteSyncRows(localRows,cloudRows));}}catch{}return read();}
