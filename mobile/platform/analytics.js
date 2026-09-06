import AsyncStorage from '@react-native-async-storage/async-storage';
import { EVENTS, sanitizeAnalyticsParameters } from '../../packages/alantil-core/analytics.js';
import { nativeAuthFetch } from './auth.js';
import { loadNativeAnalyticsPreference } from './privacy.js';
import { getNativeStorageScope, nativeScopedStorageKey } from './storage-scope.js';

const APP_VERSION='16.6.6';
const VISITOR_KEY='alantil:analytics:visitor-id';
const QUEUE_BASE='alantil:16.6.3:analytics-events';
const MAX_QUEUE=240;
let enabledCache={scope:'',value:null},currentScreen=null,sessionId='';

function uuid(){const bytes=new Uint8Array(16),source=globalThis.crypto;if(source?.getRandomValues)source.getRandomValues(bytes);else for(let index=0;index<bytes.length;index+=1)bytes[index]=Math.floor(Math.random()*256);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
function queueKey(){return nativeScopedStorageKey(QUEUE_BASE);}
async function analyticsEnabled(){const scope=getNativeStorageScope();if(enabledCache.scope===scope&&enabledCache.value!==null)return enabledCache.value;const value=(await loadNativeAnalyticsPreference().catch(()=>null))===true;enabledCache={scope,value};return value;}
async function visitorId(){let value='';try{value=String(await AsyncStorage.getItem(VISITOR_KEY)||'');}catch{}if(value)return value;value=uuid();try{await AsyncStorage.setItem(VISITOR_KEY,value);}catch{}return value;}
function activeSessionId(){if(!sessionId)sessionId=uuid();return sessionId;}
async function appendLocalEvent(event){try{const key=queueKey(),raw=await AsyncStorage.getItem(key),rows=raw?JSON.parse(raw):[],next=Array.isArray(rows)?rows:[];next.push(event);await AsyncStorage.setItem(key,JSON.stringify(next.slice(-MAX_QUEUE)));}catch{}}
async function recordScreenVisit(screen){const safe=String(screen||'').toLowerCase().replace(/[^a-z0-9_/-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'home';try{const response=await nativeAuthFetch('/rest/v1/rpc/record_anonymous_visit',{method:'POST',body:JSON.stringify({p_visitor_id:await visitorId(),p_session_id:activeSessionId(),p_page_path:`/mobile/${safe}`,p_referrer_host:null,p_app_version:APP_VERSION})});return Boolean(response?.ok);}catch{return false;}}

export async function setNativeAnalyticsRuntimeEnabled(enabled){enabledCache={scope:getNativeStorageScope(),value:Boolean(enabled)};if(enabledCache.value)return true;currentScreen=null;sessionId='';try{await Promise.all([AsyncStorage.removeItem(queueKey()),AsyncStorage.removeItem(VISITOR_KEY)]);}catch{}return false;}
export async function trackNativeEvent(name,parameters={}){if(!await analyticsEnabled())return false;const eventName=String(name||'').trim();if(!eventName)return false;const safe=sanitizeAnalyticsParameters(parameters,{appVersion:APP_VERSION});await appendLocalEvent({event:eventName,parameters:safe,occurred_at:new Date().toISOString(),session_id:activeSessionId()});return true;}
export async function trackNativeScreen(screen,context={}){if(!await analyticsEnabled())return false;const now=Date.now(),name=String(screen||'home');if(currentScreen?.name&&currentScreen.startedAt){const seconds=Math.max(0,Math.round((now-currentScreen.startedAt)/1000));if(seconds)await trackNativeEvent(EVENTS.SCREEN_TIME,{screen:currentScreen.name,seconds,...currentScreen.context});}currentScreen={name,startedAt:now,context:sanitizeAnalyticsParameters(context,{appVersion:APP_VERSION})};await recordScreenVisit(name);return true;}
export async function flushNativeScreenTime(){if(!currentScreen)return false;const current=currentScreen;currentScreen=null;const seconds=Math.max(0,Math.round((Date.now()-current.startedAt)/1000));return seconds?trackNativeEvent(EVENTS.SCREEN_TIME,{screen:current.name,seconds,...current.context}):false;}
export async function getNativeAnalyticsQueue(){try{const raw=await AsyncStorage.getItem(queueKey());const rows=raw?JSON.parse(raw):[];return Array.isArray(rows)?rows:[];}catch{return [];}}
