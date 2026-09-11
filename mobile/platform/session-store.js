import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateLegacyNativeValueToGuest, nativeScopedStorageKey } from './storage-scope.js';

const prefix='alantil:16.1:session:';
const namespaces=new Map(),pending=new Map();
function clean(value){return String(value||'').trim().replace(/[^a-z0-9:_-]+/gi,'-');}
export function setNativeSessionNamespace(type,namespace=''){const key=clean(type);if(!key)return;if(namespace)namespaces.set(key,clean(namespace));else namespaces.delete(key);}
export function getNativeSessionNamespace(type){return namespaces.get(clean(type))||'';}
function location(type){const normalizedType=clean(type),namespace=getNativeSessionNamespace(normalizedType),base=`${prefix}${normalizedType}${namespace?`:${namespace}`:''}`;return {base,key:nativeScopedStorageKey(base)};}
function enqueue(type,operation){
  // Capture user/namespace synchronously, before migration or another async write.
  const target=location(type),previous=pending.get(target.key)||Promise.resolve();
  const next=previous.catch(()=>{}).then(async()=>{await migrateLegacyNativeValueToGuest(target.base);return operation(target.key);});
  pending.set(target.key,next);
  const cleanup=()=>{if(pending.get(target.key)===next)pending.delete(target.key);};
  next.then(cleanup,cleanup);return next;
}
export async function loadNativeSessionSnapshot(type){try{return await enqueue(type,async key=>{const raw=await AsyncStorage.getItem(key);return raw?JSON.parse(raw):null;});}catch{return null;}}
export function saveNativeSessionSnapshot(type,snapshot){if(!snapshot)return clearNativeSessionSnapshot(type);const serialized=JSON.stringify(snapshot);return enqueue(type,async key=>{await AsyncStorage.setItem(key,serialized);return snapshot;});}
export function clearNativeSessionSnapshot(type){return enqueue(type,key=>AsyncStorage.removeItem(key));}
