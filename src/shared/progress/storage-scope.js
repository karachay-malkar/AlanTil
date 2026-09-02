import { GUEST_STORAGE_SCOPE, isGuestStorageScope, scopedStorageKey as buildScopedStorageKey, storageScopeForUser, storageScopeUserId } from '../../../packages/alantil-core/storage-scope.js';

const listeners=new Set();let activeScope=GUEST_STORAGE_SCOPE;
function safeParse(raw,fallback){if(raw===null||raw===undefined)return fallback;try{return JSON.parse(raw);}catch{return fallback;}}
function notifyScopeChanged(){listeners.forEach((listener)=>{try{listener(activeScope);}catch(error){console.error('Storage scope subscriber failed',error);}});}
function isInactiveGuestScope(scope){return String(scope||'')===GUEST_STORAGE_SCOPE&&activeScope!==GUEST_STORAGE_SCOPE;}
export { storageScopeForUser };
export function getStorageScope(){return activeScope;}
export function getStorageScopeUserId(scope=activeScope){return storageScopeUserId(scope);}
export function isGuestStorageScopeActive(scope=activeScope){return isGuestStorageScope(scope);}
export { isGuestStorageScopeActive as isGuestStorageScope };
export function setStorageScope(userId){const nextScope=storageScopeForUser(userId);if(nextScope===activeScope)return activeScope;activeScope=nextScope;notifyScopeChanged();return activeScope;}
export function scopedStorageKey(baseKey,scope=activeScope){return buildScopedStorageKey(baseKey,scope);}
export function readScopedJson(baseKey,fallback,scope=activeScope){if(isInactiveGuestScope(scope))return fallback;try{return safeParse(localStorage.getItem(scopedStorageKey(baseKey,scope)),fallback);}catch{return fallback;}}
export function writeScopedJson(baseKey,value,scope=activeScope){if(isInactiveGuestScope(scope))return false;try{localStorage.setItem(scopedStorageKey(baseKey,scope),JSON.stringify(value));return true;}catch{return false;}}
export function removeScopedValue(baseKey,scope=activeScope){if(isInactiveGuestScope(scope))return false;try{localStorage.removeItem(scopedStorageKey(baseKey,scope));return true;}catch{return false;}}
export function hasScopedValue(baseKey,scope=activeScope){if(isInactiveGuestScope(scope))return false;try{return localStorage.getItem(scopedStorageKey(baseKey,scope))!==null;}catch{return false;}}
export function migrateLegacyValueToGuest(baseKey){try{const guestKey=scopedStorageKey(baseKey,GUEST_STORAGE_SCOPE),legacy=localStorage.getItem(baseKey);if(legacy===null)return false;if(localStorage.getItem(guestKey)===null)localStorage.setItem(guestKey,legacy);localStorage.removeItem(baseKey);return true;}catch{return false;}}
export function subscribeStorageScope(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export const STORAGE_SCOPES=Object.freeze({GUEST:GUEST_STORAGE_SCOPE});
