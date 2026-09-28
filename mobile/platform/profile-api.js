import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeProfileGender, validateNicknameRule } from '../../packages/alantil-core/profile.js';
import { nativeAuthFetch } from './auth.js';

const PROFILE_CACHE_PREFIX='alantil:profile-cache:';
const LEGACY_PROFILE_CACHE_PREFIX='alantil:16.6.8:profile:';
const PROFILE_SELECT='user_id,nickname,avatar_gender,created_at,updated_at';
const profileMemory=new Map();
function cacheKey(userId,prefix=PROFILE_CACHE_PREFIX){return `${prefix}${String(userId||'')}`;}
async function writeProfileCache(userId,profile){const id=String(userId||'');if(!id)return;if(profile){profileMemory.set(id,profile);try{await AsyncStorage.setItem(cacheKey(id),JSON.stringify(profile));await AsyncStorage.removeItem(cacheKey(id,LEGACY_PROFILE_CACHE_PREFIX));}catch{}}else{profileMemory.delete(id);try{await Promise.all([AsyncStorage.removeItem(cacheKey(id)),AsyncStorage.removeItem(cacheKey(id,LEGACY_PROFILE_CACHE_PREFIX))]);}catch{}}}
export async function loadCachedNativeProfile(userId){const id=String(userId||'');if(!id)return null;if(profileMemory.has(id))return profileMemory.get(id);try{let raw=await AsyncStorage.getItem(cacheKey(id));if(!raw){raw=await AsyncStorage.getItem(cacheKey(id,LEGACY_PROFILE_CACHE_PREFIX));if(raw){await AsyncStorage.setItem(cacheKey(id),raw);await AsyncStorage.removeItem(cacheKey(id,LEGACY_PROFILE_CACHE_PREFIX));}}if(!raw)return null;const value=JSON.parse(raw);if(value?.user_id){profileMemory.set(id,value);return value;}}catch{}return null;}

export class NativeProfileApiError extends Error {
  constructor(message, { operation = 'profile', status = 0, unavailable = false, code = '' } = {}) {
    super(message || 'Profile API error');
    this.name = 'NativeProfileApiError';
    this.operation = operation;
    this.status = status;
    this.unavailable = Boolean(unavailable);
    this.code = code || '';
  }
}
async function jsonOrNull(response){const body=await response.text();if(!body)return null;try{return JSON.parse(body);}catch{return null;}}
function firstRow(value){return Array.isArray(value)?(value[0]||null):value;}
function apiError(response,data,operation){const status=Number(response?.status||0),unavailable=status===0||status===408||status===429||status>=500;return new NativeProfileApiError(data?.message||data?.error_description||`${operation} failed`,{operation,status,unavailable,code:String(data?.code||'')});}
export function isNativeProfileApiUnavailable(error){return Boolean(error?.unavailable||error?.name==='TypeError'||error?.code==='ALANTIL_TIMEOUT');}

export async function loadNativeProfile(userId){
  if(!userId)return null;let response;
  try{response=await nativeAuthFetch(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}&select=${PROFILE_SELECT}&limit=1`,{headers:{Accept:'application/json'}});}catch(error){throw new NativeProfileApiError(error?.message||'Profile load failed',{operation:'get_profile',unavailable:true});}
  const data=await jsonOrNull(response);if(!response.ok)throw apiError(response,data,'get_profile');const profile=firstRow(data);await writeProfileCache(userId,profile);return profile;
}
export async function checkNativeNickname(value){const validation=validateNicknameRule(value);if(!validation.valid)return{...validation,available:false};let response;try{response=await nativeAuthFetch('/rest/v1/rpc/is_nickname_available',{method:'POST',body:JSON.stringify({candidate:validation.nickname})});}catch(error){throw new NativeProfileApiError(error?.message||'Nickname check failed',{operation:'nickname_check',unavailable:true});}const data=await jsonOrNull(response);if(!response.ok)throw apiError(response,data,'nickname_check');return{...validation,available:Boolean(data)};}
export async function createNativeProfile(userId,value,avatarGender){
  const validation=validateNicknameRule(value),gender=normalizeProfileGender(avatarGender);if(!validation.valid||!gender||!userId)throw new NativeProfileApiError('Invalid profile input',{operation:'create_profile',code:validation.reason||(!gender?'gender_required':'unauthorized')});
  let response;try{response=await nativeAuthFetch(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}&select=${PROFILE_SELECT}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({nickname:validation.nickname,avatar_gender:gender})});}catch(error){throw new NativeProfileApiError(error?.message||'Profile save failed',{operation:'create_profile',unavailable:true});}
  let data=await jsonOrNull(response);if(!response.ok)throw apiError(response,data,'create_profile');let profile=firstRow(data);
  if(!profile){try{response=await nativeAuthFetch(`/rest/v1/profiles?select=${PROFILE_SELECT}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:userId,nickname:validation.nickname,avatar_gender:gender})});}catch(error){throw new NativeProfileApiError(error?.message||'Profile create failed',{operation:'create_profile',unavailable:true});}data=await jsonOrNull(response);if(!response.ok)throw apiError(response,data,'create_profile');profile=firstRow(data);}
  await writeProfileCache(userId,profile);return profile;
}
export async function updateNativeNickname(userId,value){const validation=validateNicknameRule(value);if(!validation.valid||!userId)throw new NativeProfileApiError('Invalid profile input',{operation:'update_profile',code:validation.reason||'unauthorized'});let response;try{response=await nativeAuthFetch(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}&select=${PROFILE_SELECT}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({nickname:validation.nickname})});}catch(error){throw new NativeProfileApiError(error?.message||'Profile update failed',{operation:'update_profile',unavailable:true});}const data=await jsonOrNull(response);if(!response.ok)throw apiError(response,data,'update_profile');const profile=firstRow(data);await writeProfileCache(userId,profile);return profile;}
