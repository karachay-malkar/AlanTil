import {
  GUEST_STORAGE_SCOPE,
  canonicalStorageBaseKey,
  isGuestStorageScope,
  legacyStorageBaseKeys,
  rawScopedStorageKey,
  scopedStorageKey as buildScopedStorageKey,
  storageScopeForUser,
  storageScopeUserId,
} from '../../../packages/alantil-core/storage-scope.js?v=16.8.0.6';

const listeners=new Set();let activeScope=GUEST_STORAGE_SCOPE;
function safeParse(raw,fallback){if(raw===null||raw===undefined)return fallback;try{return JSON.parse(raw);}catch{return fallback;}}
function notifyScopeChanged(){listeners.forEach((listener)=>{try{listener(activeScope);}catch(error){console.error('Storage scope subscriber failed',error);}});}
function isInactiveGuestScope(scope){return String(scope||'')===GUEST_STORAGE_SCOPE&&activeScope!==GUEST_STORAGE_SCOPE;}
function migrateScopedValue(baseKey,scope){
  const canonical=canonicalStorageBaseKey(baseKey),target=rawScopedStorageKey(canonical,scope);
  let migrated=false;
  try{
    if(localStorage.getItem(target)!==null)return{target,migrated};
    const legacyBases=legacyStorageBaseKeys(canonical);
    for(const legacyBase of legacyBases){
      const source=rawScopedStorageKey(legacyBase,scope);
      if(source===target)continue;
      const raw=localStorage.getItem(source);
      if(raw===null)continue;
      localStorage.setItem(target,raw);
      localStorage.removeItem(source);
      migrated=true;
      return{target,migrated};
    }
    if(String(scope||'')===GUEST_STORAGE_SCOPE){
      for(const sourceBase of [baseKey,...legacyBases,canonical]){
        const source=String(sourceBase||'');
        if(!source)continue;
        const raw=localStorage.getItem(source);
        if(raw===null)continue;
        localStorage.setItem(target,raw);
        localStorage.removeItem(source);
        migrated=true;
        break;
      }
    }
  }catch{}
  return{target,migrated};
}
export { storageScopeForUser };
export function getStorageScope(){return activeScope;}
export function getStorageScopeUserId(scope=activeScope){return storageScopeUserId(scope);}
export function isGuestStorageScopeActive(scope=activeScope){return isGuestStorageScope(scope);}
export { isGuestStorageScopeActive as isGuestStorageScope };
export function setStorageScope(userId){const nextScope=storageScopeForUser(userId);if(nextScope===activeScope)return activeScope;activeScope=nextScope;notifyScopeChanged();return activeScope;}
export function scopedStorageKey(baseKey,scope=activeScope){return buildScopedStorageKey(baseKey,scope);}
export function readScopedJson(baseKey,fallback,scope=activeScope){if(isInactiveGuestScope(scope))return fallback;try{const{target}=migrateScopedValue(baseKey,scope);return safeParse(localStorage.getItem(target),fallback);}catch{return fallback;}}
export function writeScopedJson(baseKey,value,scope=activeScope){if(isInactiveGuestScope(scope))return false;try{const{target}=migrateScopedValue(baseKey,scope);localStorage.setItem(target,JSON.stringify(value));return true;}catch{return false;}}
export function removeScopedValue(baseKey,scope=activeScope){if(isInactiveGuestScope(scope))return false;try{const{target}=migrateScopedValue(baseKey,scope);localStorage.removeItem(target);return true;}catch{return false;}}
export function hasScopedValue(baseKey,scope=activeScope){if(isInactiveGuestScope(scope))return false;try{const{target}=migrateScopedValue(baseKey,scope);return localStorage.getItem(target)!==null;}catch{return false;}}
export function migrateLegacyValueToGuest(baseKey){return migrateScopedValue(baseKey,GUEST_STORAGE_SCOPE).migrated;}
export function subscribeStorageScope(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export const STORAGE_SCOPES=Object.freeze({GUEST:GUEST_STORAGE_SCOPE});
