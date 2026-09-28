import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GUEST_STORAGE_SCOPE,
  canonicalStorageBaseKey,
  legacyStorageBaseKeys,
  rawScopedStorageKey,
  scopedStorageKey,
  storageScopeForUser,
  storageScopeUserId,
} from '../../packages/alantil-core/storage-scope.js';

let activeScope = GUEST_STORAGE_SCOPE;
const migrated = new Set();

export function getNativeStorageScope(){ return activeScope; }
export function getNativeStorageScopeUserId(){ return storageScopeUserId(activeScope); }
export function setNativeStorageScope(userId){ activeScope = storageScopeForUser(userId); return activeScope; }
export function nativeScopedStorageKey(baseKey, scope = activeScope){ return scopedStorageKey(baseKey, scope); }

async function migrateScopeAliases(baseKey, scope){
  const canonical=canonicalStorageBaseKey(baseKey),target=rawScopedStorageKey(canonical,scope),marker=`${scope}:${canonical}`;
  if(migrated.has(marker))return false;
  migrated.add(marker);
  try{
    if(await AsyncStorage.getItem(target)!==null)return false;
    for(const legacyBase of legacyStorageBaseKeys(canonical)){
      const source=rawScopedStorageKey(legacyBase,scope);
      if(source===target)continue;
      const raw=await AsyncStorage.getItem(source);
      if(raw===null)continue;
      await AsyncStorage.setItem(target,raw);
      await AsyncStorage.removeItem(source);
      return true;
    }
  }catch{}
  return false;
}

export async function migrateLegacyNativeValueToGuest(baseKey){
  const capturedScope=activeScope,canonical=canonicalStorageBaseKey(baseKey),guestTarget=rawScopedStorageKey(canonical,GUEST_STORAGE_SCOPE);
  let changed=await migrateScopeAliases(baseKey,GUEST_STORAGE_SCOPE);
  const unscopedMarker=`unscoped:${canonical}`;
  if(!migrated.has(unscopedMarker)){
    migrated.add(unscopedMarker);
    try{
      if(await AsyncStorage.getItem(guestTarget)===null){
        for(const sourceBase of [baseKey,...legacyStorageBaseKeys(canonical),canonical]){
          const source=String(sourceBase||'');
          if(!source)continue;
          const raw=await AsyncStorage.getItem(source);
          if(raw===null)continue;
          await AsyncStorage.setItem(guestTarget,raw);
          await AsyncStorage.removeItem(source);
          changed=true;
          break;
        }
      }
    }catch{}
  }
  if(capturedScope!==GUEST_STORAGE_SCOPE){
    changed=(await migrateScopeAliases(baseKey,capturedScope))||changed;
  }
  return changed;
}
