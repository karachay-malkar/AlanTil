import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const NATIVE_SUPABASE_URL='https://pybrzgedqjmosbmilcea.supabase.co';
export const NATIVE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_11TY-fBEAogA9JKnAku3vg_hjRxTa_a';
export const NATIVE_SUPABASE_AUTH_STORAGE_KEY='alantil:16.6.3:supabase-auth';

export const nativeSupabase=createClient(NATIVE_SUPABASE_URL,NATIVE_SUPABASE_PUBLISHABLE_KEY,{
  auth:{
    storage:AsyncStorage,
    storageKey:NATIVE_SUPABASE_AUTH_STORAGE_KEY,
    autoRefreshToken:true,
    persistSession:true,
    detectSessionInUrl:false,
    flowType:'pkce',
    experimental:{appendPkceFlowIdToRedirects:true},
  },
});
