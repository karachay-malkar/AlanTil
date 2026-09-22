import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateLegacyNativeValueToGuest, nativeScopedStorageKey } from './storage-scope.js';

const SETTINGS_KEY='alantil_route_settings_v13_1';
const SCROLL_PREFIX='route_scroll_v3_';
const STORY_STELE_SEEN_KEY='alantil_story_intro_seen_v1';
const LEGACY_STORY_ID='oblivion';
const DEFAULT_NATIVE_STORY='understanding';
const activeStoryWrites=new Map();
async function scoped(base){await migrateLegacyNativeValueToGuest(base);return nativeScopedStorageKey(base);}
async function readJson(base,fallback){try{const raw=await AsyncStorage.getItem(await scoped(base));return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
async function writeJson(base,value){try{await AsyncStorage.setItem(await scoped(base),JSON.stringify(value));return true;}catch{return false;}}
export async function loadNativePathSettings(defaultStory=''){const saved=await readJson(SETTINGS_KEY,{}),raw=String(saved?.active_story||defaultStory||DEFAULT_NATIVE_STORY||''),active_story=raw===LEGACY_STORY_ID?DEFAULT_NATIVE_STORY:raw;if(raw!==active_story)await writeJson(SETTINGS_KEY,{...(saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{}),active_story,updated_at:saved?.updated_at||new Date().toISOString()});return{active_story,updated_at:saved?.updated_at||null};}
export function saveNativeActiveStory(storyType){const raw=String(storyType||''),value=raw===LEGACY_STORY_ID?DEFAULT_NATIVE_STORY:raw,key=nativeScopedStorageKey(SETTINGS_KEY),previous=activeStoryWrites.get(key)||Promise.resolve();const operation=previous.catch(()=>{}).then(async()=>{await migrateLegacyNativeValueToGuest(SETTINGS_KEY);let current={};try{const raw=await AsyncStorage.getItem(key);current=raw?JSON.parse(raw):{};}catch{}const next={...(current&&typeof current==='object'&&!Array.isArray(current)?current:{}),active_story:value,updated_at:new Date().toISOString()};await AsyncStorage.setItem(key,JSON.stringify(next));return next;});activeStoryWrites.set(key,operation);const cleanup=()=>{if(activeStoryWrites.get(key)===operation)activeStoryWrites.delete(key);};operation.then(cleanup,cleanup);return operation;}
export async function loadNativeStoryScroll(storyType){const story=String(storyType||''),key=`${SCROLL_PREFIX}${story}`;let value=await readJson(key,null);if(!value&&story===DEFAULT_NATIVE_STORY){value=await readJson(`${SCROLL_PREFIX}${LEGACY_STORY_ID}`,null);if(value)await writeJson(key,value);}const offset=Number(value?.offset);return Number.isFinite(offset)&&offset>=0?offset:null;}
export async function saveNativeStoryScroll(storyType,offset){const value=Math.max(0,Number(offset)||0);await writeJson(`${SCROLL_PREFIX}${String(storyType||'')}`,{offset:value,updated_at:new Date().toISOString()});return value;}
export async function hasSeenNativeStoryStele(storyType){const key=String(storyType||'').trim();if(!key)return false;const state=await readJson(STORY_STELE_SEEN_KEY,{});return Boolean(state&&typeof state==='object'&&!Array.isArray(state)&&state[key]);}
export async function markNativeStorySteleSeen(storyType){const key=String(storyType||'').trim();if(!key)return false;const state=await readJson(STORY_STELE_SEEN_KEY,{}),next={...(state&&typeof state==='object'&&!Array.isArray(state)?state:{}),[key]:true};return writeJson(STORY_STELE_SEEN_KEY,next);}
export { STORY_STELE_SEEN_KEY };
