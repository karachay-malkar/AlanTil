import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNativeAuthSession, nativeAuthFetch } from './auth.js';

const KEY='alantil:16.1:hidden-words';
async function read(){try{const raw=await AsyncStorage.getItem(KEY);return new Set(raw?JSON.parse(raw).map(String):[]);}catch{return new Set();}}
async function write(set){await AsyncStorage.setItem(KEY,JSON.stringify([...set]));}
export async function loadNativeHiddenWords(){return read();}
export async function saveNativeHiddenWords(nextIds,changedIds=[]){const set=nextIds instanceof Set?new Set([...nextIds].map(String)):new Set((nextIds||[]).map(String));await write(set);const session=getNativeAuthSession();if(session?.user?.id){const now=new Date().toISOString();for(const id of changedIds){try{await nativeAuthFetch('/rest/v1/user_hidden_words?on_conflict=user_id,word_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:session.user.id,word_id:String(id),is_hidden:set.has(String(id)),updated_at:now})});}catch{}}}return set;}
export async function mergeNativeCloudHiddenWords(){const session=getNativeAuthSession();if(!session?.user?.id)return read();const local=await read();try{const response=await nativeAuthFetch('/rest/v1/user_hidden_words?is_hidden=eq.true&select=word_id');if(response.ok){const rows=await response.json();rows.forEach((row)=>{if(row?.word_id)local.add(String(row.word_id));});await write(local);}}catch{}return local;}
