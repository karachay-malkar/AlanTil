import AsyncStorage from '@react-native-async-storage/async-storage';

const prefix='alantil:16.1:session:';

export async function loadNativeSessionSnapshot(type){
  try{const raw=await AsyncStorage.getItem(`${prefix}${type}`);return raw?JSON.parse(raw):null;}catch{return null;}
}

export async function saveNativeSessionSnapshot(type,snapshot){
  if(!snapshot)return clearNativeSessionSnapshot(type);
  await AsyncStorage.setItem(`${prefix}${type}`,JSON.stringify(snapshot));
  return snapshot;
}

export async function clearNativeSessionSnapshot(type){
  await AsyncStorage.removeItem(`${prefix}${type}`);
}
