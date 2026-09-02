import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

const SUPABASE_URL='https://pybrzgedqjmosbmilcea.supabase.co';
const SUPABASE_KEY='sb_publishable_11TY-fBEAogA9JKnAku3vg_hjRxTa_a';
const REDIRECT_URL='alantil://auth/callback';
const SESSION_KEY='alantil:16.1:auth-session';
const listeners=new Set();
let currentSession=null,initialized=false,syncStartedForUser='';
function emit(){listeners.forEach((listener)=>{try{listener(currentSession);}catch{}});}
async function triggerAccountSync(){const userId=String(currentSession?.user?.id||'');if(!userId||syncStartedForUser===userId)return;syncStartedForUser=userId;try{const {synchronizeNativeAccount}=await import('./cloud-sync.js');await synchronizeNativeAccount();}catch{syncStartedForUser='';}}
function parseCallback(url){const value=String(url||'');if(!value.startsWith(REDIRECT_URL))return null;const params=new URLSearchParams((value.split('#')[1]||value.split('?')[1]||'').trim()),accessToken=params.get('access_token')||'',refreshToken=params.get('refresh_token')||'',expiresIn=Number(params.get('expires_in')||3600);if(!accessToken)return null;return {access_token:accessToken,refresh_token:refreshToken,expires_at:Date.now()+Math.max(60,expiresIn)*1000,token_type:params.get('token_type')||'bearer',user:null};}
async function persist(session){currentSession=session||null;if(currentSession)await AsyncStorage.setItem(SESSION_KEY,JSON.stringify(currentSession));else{await AsyncStorage.removeItem(SESSION_KEY);syncStartedForUser='';}emit();void triggerAccountSync();return currentSession;}
async function fetchUser(accessToken){if(!accessToken)return null;const response=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${accessToken}`}});if(!response.ok)return null;return response.json();}
async function refreshSession(session){if(!session?.refresh_token)return null;const response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});if(!response.ok)return null;const data=await response.json();return {access_token:data.access_token,refresh_token:data.refresh_token||session.refresh_token,expires_at:Date.now()+Math.max(60,Number(data.expires_in||3600))*1000,token_type:data.token_type||'bearer',user:data.user||null};}
export async function handleNativeAuthUrl(url){const parsed=parseCallback(url);if(!parsed)return currentSession;parsed.user=await fetchUser(parsed.access_token);return persist(parsed);}
export async function bootstrapNativeAuth(){if(!initialized){initialized=true;Linking.addEventListener('url',({url})=>{handleNativeAuthUrl(url).catch(()=>{});});}try{const initialUrl=await Linking.getInitialURL();if(initialUrl?.startsWith(REDIRECT_URL))await handleNativeAuthUrl(initialUrl);}catch{}if(!currentSession){try{const raw=await AsyncStorage.getItem(SESSION_KEY);currentSession=raw?JSON.parse(raw):null;}catch{currentSession=null;}}if(currentSession?.expires_at&&currentSession.expires_at<=Date.now()+60000){currentSession=await refreshSession(currentSession);await persist(currentSession);}if(currentSession?.access_token&&!currentSession.user){currentSession.user=await fetchUser(currentSession.access_token);await persist(currentSession);}void triggerAccountSync();return currentSession;}
export function subscribeNativeAuth(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export function getNativeAuthSession(){return currentSession;}
export async function signInWithGoogleNative(){const authorize=`${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(REDIRECT_URL)}`;await Linking.openURL(authorize);}
export async function signOutNative(){const token=currentSession?.access_token;if(token){try{await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`}});}catch{}}return persist(null);}
export async function nativeAuthFetch(path,options={}){const session=await bootstrapNativeAuth();const headers={apikey:SUPABASE_KEY,'Content-Type':'application/json',...(session?.access_token?{Authorization:`Bearer ${session.access_token}`} :{}),...(options.headers||{})};return fetch(`${SUPABASE_URL}${path}`,{...options,headers});}
bootstrapNativeAuth().catch(()=>{});
