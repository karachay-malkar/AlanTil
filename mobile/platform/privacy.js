import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateLegacyNativeValueToGuest, nativeScopedStorageKey } from './storage-scope.js';

const ANALYTICS_KEY='alantil:privacy:analytics-enabled';
async function key(){await migrateLegacyNativeValueToGuest(ANALYTICS_KEY);return nativeScopedStorageKey(ANALYTICS_KEY);}
export async function loadNativeAnalyticsPreference(){try{const raw=await AsyncStorage.getItem(await key());if(raw===null)return null;return raw==='1';}catch{return null;}}
export async function saveNativeAnalyticsPreference(enabled){const value=Boolean(enabled);await AsyncStorage.setItem(await key(),value?'1':'0');try{const {setNativeAnalyticsRuntimeEnabled}=await import('./analytics.js');await setNativeAnalyticsRuntimeEnabled(value);}catch{}return value;}
