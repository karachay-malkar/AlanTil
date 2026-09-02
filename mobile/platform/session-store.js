import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateLegacyNativeValueToGuest, nativeScopedStorageKey } from './storage-scope.js';

const prefix='alantil:16.1:session:';
async function key(type){const base=`${prefix}${type}`;await migrateLegacyNativeValueToGuest(base);return nativeScopedStorageKey(base);}
export async function loadNativeSessionSnapshot(type){try{const raw=await AsyncStorage.getItem(await key(type));return raw?JSON.parse(raw):null;}catch{return null;}}
export async function saveNativeSessionSnapshot(type,snapshot){if(!snapshot)return clearNativeSessionSnapshot(type);await AsyncStorage.setItem(await key(type),JSON.stringify(snapshot));return snapshot;}
export async function clearNativeSessionSnapshot(type){await AsyncStorage.removeItem(await key(type));}
