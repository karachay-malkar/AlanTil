import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateLegacyNativeValueToGuest, nativeScopedStorageKey } from './storage-scope.js';

const KEY='alantil_guided_help_v1';
let generalRuntime={active:false,phase:'',storyIndex:0};

async function key(){await migrateLegacyNativeValueToGuest(KEY);return nativeScopedStorageKey(KEY);}
function persistentState(value={}){return{learning_completed:Boolean(value?.learning_completed),repeat_hint_shown:Boolean(value?.repeat_hint_shown)};}
export async function loadNativeGuideState(){try{const raw=await AsyncStorage.getItem(await key()),value=raw?JSON.parse(raw):{};return persistentState(value);}catch{return persistentState();}}
export async function saveNativeGuideState(updates={}){const current=await loadNativeGuideState(),next=persistentState({...current,...updates});await AsyncStorage.setItem(await key(),JSON.stringify(next));return next;}
export async function resetNativeLearningGuide(){return saveNativeGuideState({learning_completed:false,repeat_hint_shown:false});}
export function getNativeGeneralGuideRuntime(){return{...generalRuntime};}
export function setNativeGeneralGuideRuntime(updates={}){generalRuntime={...generalRuntime,...updates};return getNativeGeneralGuideRuntime();}
export function beginNativeGeneralGuide(){generalRuntime={active:true,phase:'intro',storyIndex:0};return getNativeGeneralGuideRuntime();}
export function resetNativeGeneralGuideRuntime(){generalRuntime={active:false,phase:'',storyIndex:0};return getNativeGeneralGuideRuntime();}
