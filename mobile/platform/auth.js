import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

const SUPABASE_URL='https://pybrzgedqjmosbmilcea.supabase.co';
const SUPABASE_KEY='sb_publishable_11TY-fBEAogA9JKnAku3vg_hjRxTa_a';
export const NATIVE_AUTH_REDIRECT_URL='alantil://auth/callback';
const SESSION_KEY='alantil:16.1:auth-session';
const listeners=new Set();
let currentSession=null,initialized=false,syncStartedForUser='',lastAuthError=null,bootstrapPromise=null;

function emit(){listeners.forEach((listener)=>{try{listener(currentSession,lastAuthError);}catch{}});}
function setAuthError(error){lastAuthError=error||null;emit();return lastAuthError;}
async function triggerAccountSync(){const userId=String(currentSession?.user?.id||'');if(!userId||syncStartedForUser===userId)return;syncStartedForUser=userId;try{const {synchronizeNativeAccount}=await import('./cloud-sync.js');await synchronizeNativeAccount();}catch{syncStartedForUser='';}}
function parseCallback(url){const value=String(url||'');if(!value.startsWith(NATIVE_AUTH_REDIRECT_URL))return null;const raw=(value.split('#')[1]||value.split('?')[1]||'').trim(),params=new URLSearchParams(raw);const oauthError=params.get('error_description')||params.get('error')||'';if(oauthError){const error=new Error(oauthError);error.code='OAUTH_CALLBACK_ERROR';throw error;}const accessToken=params.get('access_token')||'',refreshToken=params.get('refresh_token')||'',expiresIn=Number(params.get('expires_in')||3600);if(!accessToken)return null;return {access_token:accessToken,refresh_token:refreshToken,expires_at:Date.now()+Math.max(60,expiresIn)*1000,token_type:params.get('token_type')||'bearer',user:null};}
async function persist(session){currentSession=session||null;lastAuthError=null;if(currentSession)await AsyncStorage.setItem(SESSION_KEY,JSON.stringify(currentSession));else{await AsyncStorage.removeItem(SESSION_KEY);syncStartedForUser='';}emit();void triggerAccountSync();return currentSession;}
async function fetchUser(accessToken){if(!accessToken)return null;const response=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${accessToken}`}});if(!response.ok){const error=new Error(`Auth user request failed (${response.status})`);error.status=response.status;throw error;}return response.json();}
async function refreshSession(session){if(!session?.refresh_token)return null;const response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});if(!response.ok){const error=new Error(`Session refresh failed (${response.status})`);error.status=response.status;throw error;}const data=await response.json();return {access_token:data.access_token,refresh_token:data.refresh_token||session.refresh_token,expires_at:Date.now()+Math.max(60,Number(data.expires_in||3600))*1000,token_type:data.token_type||'bearer',user:data.user||null};}

export async function handleNativeAuthUrl(url){let parsed;try{parsed=parseCallback(url);}catch(error){setAuthError(error);throw error;}if(!parsed)return currentSession;try{parsed.user=await fetchUser(parsed.access_token);if(!parsed.user)throw new Error('Authenticated user was not returned');return await persist(parsed);}catch(error){setAuthError(error);throw error;}}

async function bootstrapImpl(){if(!initialized){initialized=true;Linking.addEventListener('url',({url})=>{handleNativeAuthUrl(url).catch(()=>{});});}
  try{const initialUrl=await Linking.getInitialURL();if(initialUrl?.startsWith(NATIVE_AUTH_REDIRECT_URL))await handleNativeAuthUrl(initialUrl);}catch(error){setAuthError(error);}
  if(!currentSession){try{const raw=await AsyncStorage.getItem(SESSION_KEY);currentSession=raw?JSON.parse(raw):null;}catch(error){currentSession=null;setAuthError(error);}}
  if(currentSession?.expires_at&&currentSession.expires_at<=Date.now()+60000){try{const refreshed=await refreshSession(currentSession);await persist(refreshed);}catch(error){await persist(null);setAuthError(error);}}
  if(currentSession?.access_token&&!currentSession.user){try{currentSession.user=await fetchUser(currentSession.access_token);await persist(currentSession);}catch(error){await persist(null);setAuthError(error);}}
  void triggerAccountSync();emit();return currentSession;
}

export async function bootstrapNativeAuth(){if(!bootstrapPromise)bootstrapPromise=bootstrapImpl().finally(()=>{bootstrapPromise=null;});return bootstrapPromise;}
export function subscribeNativeAuth(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export function getNativeAuthSession(){return currentSession;}
export function getNativeAuthError(){return lastAuthError;}
export function getNativeAuthProvider(session=currentSession){const user=session?.user;if(!user)return '';return String(user?.app_metadata?.provider||user?.identities?.[0]?.provider||user?.user_metadata?.provider||'').trim().toLowerCase();}
export async function signInWithGoogleNative(){lastAuthError=null;emit();const authorize=`${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(NATIVE_AUTH_REDIRECT_URL)}`;try{await Linking.openURL(authorize);}catch(error){setAuthError(error);throw error;}}
export async function signOutNative(){const token=currentSession?.access_token;if(token){try{await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`}});}catch{}}return persist(null);}
export async function nativeAuthFetch(path,options={}){const session=await bootstrapNativeAuth();const headers={apikey:SUPABASE_KEY,'Content-Type':'application/json',...(session?.access_token?{Authorization:`Bearer ${session.access_token}`} :{}),...(options.headers||{})};return fetch(`${SUPABASE_URL}${path}`,{...options,headers});}
bootstrapNativeAuth().catch(()=>{});
