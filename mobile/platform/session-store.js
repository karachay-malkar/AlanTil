import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateLegacyNativeValueToGuest, nativeScopedStorageKey } from './storage-scope.js';

const prefix='alantil:16.1:session:';
const namespaces=new Map();
function clean(value){return String(value||'').trim().replace(/[^a-z0-9:_-]+/gi,'-');}
export function setNativeSessionNamespace(type,namespace=''){const key=clean(type);if(!key)return;if(namespace)namespaces.set(key,clean(namespace));else namespaces.delete(key);}
export function getNativeSessionNamespace(type){return namespaces.get(clean(type))||'';}
async function key(type){const normalizedType=clean(type),namespace=getNativeSessionNamespace(normalizedType),base=`${prefix}${normalizedType}${namespace?`:${namespace}`:''}`;await migrateLegacyNativeValueToGuest(base);return nativeScopedStorageKey(base);}
export async function loadNativeSessionSnapshot(type){try{const raw=await AsyncStorage.getItem(await key(type));return raw?JSON.parse(raw):null;}catch{return null;}}
export async function saveNativeSessionSnapshot(type,snapshot){if(!snapshot)return clearNativeSessionSnapshot(type);await AsyncStorage.setItem(await key(type),JSON.stringify(snapshot));return snapshot;}
export async function clearNativeSessionSnapshot(type){await AsyncStorage.removeItem(await key(type));}
