import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeFavoriteSyncRows } from '../../packages/alantil-core/favorites.js';
import { migrateStoredUserSettings, normalizeSyncTimestamp, normalizeUserSettings } from '../../packages/alantil-core/settings.js';
import { migrateLegacyNativeValueToGuest, nativeScopedStorageKey } from './storage-scope.js';

const KEYS=Object.freeze({settings:'alantil:16.1:settings',settingsSync:'alantil:16.4.1:settings-sync',favorites:'alantil:16.1:favorites',favoriteSync:'alantil:16.4.1:favorite-sync',songFavorites:'alantil:16.1:song-favorites',songFavoriteSync:'alantil:16.4.1:song-favorite-sync',legacyOnboarding:'alantil:16.1:onboarding-complete',authChoice:'alantil:16.6.3:auth-choice-complete'});
async function scopedKey(base){await migrateLegacyNativeValueToGuest(base);return nativeScopedStorageKey(base);}
async function readJson(base,fallback){try{const raw=await AsyncStorage.getItem(await scopedKey(base));return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
async function writeJson(base,value){await AsyncStorage.setItem(await scopedKey(base),JSON.stringify(value));}
async function queuePreferences(){try{const {queueNativePreferences}=await import('./cloud-sync.js');await queueNativePreferences();}catch{}}
async function queueFavoriteDiff(kind,before,after,updatedAt){try{const {queueNativeFavoriteChange}=await import('./cloud-sync.js');const ids=new Set([...before,...after]);for(const id of ids){const was=before.has(id),is=after.has(id);if(was!==is)await queueNativeFavoriteChange(kind,id,is,updatedAt);}}catch{}}
function config(kind){return kind==='song'?{values:KEYS.songFavorites,sync:KEYS.songFavoriteSync}:{values:KEYS.favorites,sync:KEYS.favoriteSync};}
async function loadFavoriteSet(kind){const value=await readJson(config(kind).values,[]);return new Set(Array.isArray(value)?value.map(String):[]);}
async function writeFavoriteSet(kind,set){await writeJson(config(kind).values,Array.from(set).map(String));}
export async function loadNativeFavoriteSyncRows(kind='word'){const set=await loadFavoriteSet(kind),stored=normalizeFavoriteSyncRows(await readJson(config(kind).sync,[])),map=new Map(stored.map((row)=>[row.id,row]));for(const id of set)if(!map.has(id))map.set(id,{id,is_active:true,updated_at:null});return Array.from(map.values());}
export async function applyNativeFavoriteSyncRows(kind='word',rows=[]){const normalized=normalizeFavoriteSyncRows(rows),active=new Set(normalized.filter((row)=>row.is_active).map((row)=>row.id));await Promise.all([writeFavoriteSet(kind,active),writeJson(config(kind).sync,normalized)]);return active;}
async function saveFavoriteSet(kind,ids){const before=await loadFavoriteSet(kind),after=new Set(Array.from(ids instanceof Set?ids:new Set(ids||[])).map(String)),now=new Date().toISOString(),rows=await loadNativeFavoriteSyncRows(kind),map=new Map(rows.map((row)=>[row.id,row]));let changed=false;for(const id of new Set([...before,...after])){const was=before.has(id),is=after.has(id);if(was!==is){map.set(id,{id,is_active:is,updated_at:now});changed=true;}}await Promise.all([writeFavoriteSet(kind,after),writeJson(config(kind).sync,Array.from(map.values()))]);if(changed)void queueFavoriteDiff(kind,before,after,now);return after;}
export async function loadNativeSettings(){let raw=null,hasStoredSettings=false;try{const key=await scopedKey(KEYS.settings),stored=await AsyncStorage.getItem(key);hasStoredSettings=stored!==null;raw=stored?JSON.parse(stored):{};}catch{raw={};}const migrated=migrateStoredUserSettings(raw,hasStoredSettings),normalized=normalizeUserSettings(migrated||{});if(hasStoredSettings&&JSON.stringify(normalized)!==JSON.stringify(raw)){try{await writeJson(KEYS.settings,normalized);}catch{}}return normalized;}
export async function loadNativeSettingsSyncTimestamp(){const raw=await readJson(KEYS.settingsSync,null);return normalizeSyncTimestamp(raw?.updated_at||raw);}
export async function saveNativeSettings(settings,{sync=true,updatedAt=''}={}){const normalized=normalizeUserSettings(settings),timestamp=normalizeSyncTimestamp(updatedAt)||new Date().toISOString();await Promise.all([writeJson(KEYS.settings,normalized),writeJson(KEYS.settingsSync,{updated_at:timestamp})]);if(sync)void queuePreferences();return normalized;}
export async function applyNativeSettingsFromSync(settings,updatedAt){return saveNativeSettings(settings,{sync:false,updatedAt});}
export async function loadNativeFavorites(){return loadFavoriteSet('word');}
export async function saveNativeFavorites(ids){return saveFavoriteSet('word',ids);}
export async function loadNativeSongFavorites(){return loadFavoriteSet('song');}
export async function saveNativeSongFavorites(ids){return saveFavoriteSet('song',ids);}
export async function hasCompletedNativeOnboarding(){return (await AsyncStorage.getItem(await scopedKey(KEYS.legacyOnboarding)))==='1';}
export async function markNativeOnboardingComplete(){await AsyncStorage.setItem(await scopedKey(KEYS.legacyOnboarding),'1');}
export async function hasCompletedNativeAuthChoice(){const direct=(await AsyncStorage.getItem(await scopedKey(KEYS.authChoice)))==='1';if(direct)return true;return hasCompletedNativeOnboarding();}
export async function markNativeAuthChoiceComplete(){await AsyncStorage.setItem(await scopedKey(KEYS.authChoice),'1');}
