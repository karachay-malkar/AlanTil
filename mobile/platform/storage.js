import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateStoredUserSettings, normalizeUserSettings } from '../../packages/alantil-core/settings.js';
import { migrateLegacyNativeValueToGuest, nativeScopedStorageKey } from './storage-scope.js';

const KEYS=Object.freeze({settings:'alantil:16.1:settings',favorites:'alantil:16.1:favorites',songFavorites:'alantil:16.1:song-favorites',legacyOnboarding:'alantil:16.1:onboarding-complete'});
async function scopedKey(base){await migrateLegacyNativeValueToGuest(base);return nativeScopedStorageKey(base);}
async function readJson(base,fallback){try{const raw=await AsyncStorage.getItem(await scopedKey(base));return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
async function writeJson(base,value){await AsyncStorage.setItem(await scopedKey(base),JSON.stringify(value));}
async function queuePreferences(){try{const {queueNativePreferences}=await import('./cloud-sync.js');await queueNativePreferences();}catch{}}
async function queueFavoriteDiff(kind,before,after){try{const {queueNativeFavoriteChange}=await import('./cloud-sync.js');const ids=new Set([...before,...after]);for(const id of ids){const was=before.has(id),is=after.has(id);if(was!==is)await queueNativeFavoriteChange(kind,id,is);}}catch{}}
export async function loadNativeSettings(){
  let raw=null,hasStoredSettings=false;
  try{const key=await scopedKey(KEYS.settings),stored=await AsyncStorage.getItem(key);hasStoredSettings=stored!==null;raw=stored?JSON.parse(stored):{};}catch{raw={};}
  const migrated=migrateStoredUserSettings(raw,hasStoredSettings),normalized=normalizeUserSettings(migrated||{});
  if(hasStoredSettings&&JSON.stringify(normalized)!==JSON.stringify(raw)){try{await writeJson(KEYS.settings,normalized);}catch{}}
  return normalized;
}
export async function saveNativeSettings(settings){const normalized=normalizeUserSettings(settings);await writeJson(KEYS.settings,normalized);void queuePreferences();return normalized;}
export async function loadNativeFavorites(){const value=await readJson(KEYS.favorites,[]);return new Set(Array.isArray(value)?value.map(String):[]);}
export async function saveNativeFavorites(ids){const before=await loadNativeFavorites(),values=Array.from(ids instanceof Set?ids:new Set(ids||[])).map(String),after=new Set(values);await writeJson(KEYS.favorites,values);void queueFavoriteDiff('word',before,after);return after;}
export async function loadNativeSongFavorites(){const value=await readJson(KEYS.songFavorites,[]);return new Set(Array.isArray(value)?value.map(String):[]);}
export async function saveNativeSongFavorites(ids){const before=await loadNativeSongFavorites(),values=Array.from(ids instanceof Set?ids:new Set(ids||[])).map(String),after=new Set(values);await writeJson(KEYS.songFavorites,values);void queueFavoriteDiff('song',before,after);return after;}
export async function hasCompletedNativeOnboarding(){return (await AsyncStorage.getItem(await scopedKey(KEYS.legacyOnboarding)))==='1';}
export async function markNativeOnboardingComplete(){await AsyncStorage.setItem(await scopedKey(KEYS.legacyOnboarding),'1');}
