import {
  GUEST_STORAGE_SCOPE,
  canonicalStorageBaseKey,
  isGuestStorageScope,
  isKnownStorageBaseKey,
  legacyStorageBaseKeys,
  parseScopedStorageKey,
  rawScopedStorageKey,
  scopedStorageKey as buildScopedStorageKey,
  storageScopeForUser,
  storageScopeUserId,
} from '../../../packages/alantil-core/storage-scope.js?v=16.8.0.7';

const listeners=new Set();let activeScope=GUEST_STORAGE_SCOPE;
function safeParse(raw,fallback){if(raw===null||raw===undefined)return fallback;try{return JSON.parse(raw);}catch{return fallback;}}
function notifyScopeChanged(){listeners.forEach((listener)=>{try{listener(activeScope);}catch(error){console.error('Storage scope subscriber failed',error);}});}
function isInactiveGuestScope(scope){return String(scope||'')===GUEST_STORAGE_SCOPE&&activeScope!==GUEST_STORAGE_SCOPE;}
function moveStorageValue(source,target){
  if(!source||!target||source===target)return false;
  try{
    const raw=localStorage.getItem(source);
    if(raw===null)return false;
    if(localStorage.getItem(target)===null){
      localStorage.setItem(target,raw);
      if(localStorage.getItem(target)!==raw)return false;
    }
    localStorage.removeItem(source);
    return true;
  }catch{return false;}
}
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
export function removeScopedValueForMigration(baseKey,scope=activeScope){try{const{target}=migrateScopedValue(baseKey,scope);localStorage.removeItem(target);return localStorage.getItem(target)===null;}catch{return false;}}
export function hasScopedValue(baseKey,scope=activeScope){if(isInactiveGuestScope(scope))return false;try{const{target}=migrateScopedValue(baseKey,scope);return localStorage.getItem(target)!==null;}catch{return false;}}
export function migrateLegacyValueToGuest(baseKey){return migrateScopedValue(baseKey,GUEST_STORAGE_SCOPE).migrated;}
export function migrateAllStorageKeys(){
  let migrated=0;
  let keys=[];
  try{keys=Array.from({length:localStorage.length},(_,index)=>localStorage.key(index)).filter(Boolean);}catch{return migrated;}
  for(const key of keys){
    const parsed=parseScopedStorageKey(key);
    if(parsed){
      if(!isKnownStorageBaseKey(parsed.baseKey))continue;
      const canonical=canonicalStorageBaseKey(parsed.baseKey);
      if(canonical===parsed.baseKey)continue;
      if(moveStorageValue(key,rawScopedStorageKey(canonical,parsed.scope)))migrated+=1;
      continue;
    }
    if(!isKnownStorageBaseKey(key))continue;
    const canonical=canonicalStorageBaseKey(key);
    if(moveStorageValue(key,rawScopedStorageKey(canonical,GUEST_STORAGE_SCOPE)))migrated+=1;
  }
  return migrated;
}
export function subscribeStorageScope(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export const STORAGE_SCOPES=Object.freeze({GUEST:GUEST_STORAGE_SCOPE});
