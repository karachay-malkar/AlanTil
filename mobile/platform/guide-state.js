import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateLegacyNativeValueToGuest, nativeScopedStorageKey } from './storage-scope.js';
const KEY='alantil_guided_help_v1';
async function key(){await migrateLegacyNativeValueToGuest(KEY);return nativeScopedStorageKey(KEY);}
export async function loadNativeGuideState(){try{const raw=await AsyncStorage.getItem(await key()),value=raw?JSON.parse(raw):{};return{learning_completed:Boolean(value?.learning_completed),repeat_hint_shown:Boolean(value?.repeat_hint_shown),station_pending:Boolean(value?.station_pending)};}catch{return{learning_completed:false,repeat_hint_shown:false,station_pending:false};}}
export async function saveNativeGuideState(updates={}){const current=await loadNativeGuideState(),next={...current,...updates};await AsyncStorage.setItem(await key(),JSON.stringify(next));return next;}
export async function resetNativeLearningGuide(){return saveNativeGuideState({learning_completed:false,repeat_hint_shown:false});}
