import AsyncStorage from '@react-native-async-storage/async-storage';
import { GUEST_STORAGE_SCOPE, scopedStorageKey, storageScopeForUser, storageScopeUserId } from '../../packages/alantil-core/storage-scope.js';

let activeScope = GUEST_STORAGE_SCOPE;
const migrated = new Set();

export function getNativeStorageScope(){ return activeScope; }
export function getNativeStorageScopeUserId(){ return storageScopeUserId(activeScope); }
export function setNativeStorageScope(userId){ activeScope = storageScopeForUser(userId); return activeScope; }
export function nativeScopedStorageKey(baseKey, scope = activeScope){ return scopedStorageKey(baseKey, scope); }

export async function migrateLegacyNativeValueToGuest(baseKey){
  if(migrated.has(baseKey)) return false;
  migrated.add(baseKey);
  const guestKey = scopedStorageKey(baseKey, GUEST_STORAGE_SCOPE);
  try{
    const [legacy, guest] = await Promise.all([AsyncStorage.getItem(baseKey), AsyncStorage.getItem(guestKey)]);
    if(legacy === null) return false;
    if(guest === null) await AsyncStorage.setItem(guestKey, legacy);
    await AsyncStorage.removeItem(baseKey);
    return true;
  }catch{ return false; }
}
