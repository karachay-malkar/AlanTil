import { createClient } from '@supabase/supabase-js';

export const NATIVE_SUPABASE_URL='https://pybrzgedqjmosbmilcea.supabase.co';
export const NATIVE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_11TY-fBEAogA9JKnAku3vg_hjRxTa_a';
export const WEB_SUPABASE_AUTH_STORAGE_KEY='alantil:16.6.3:supabase-auth-web';

const browserStorage={
  getItem(key){try{return globalThis?.localStorage?.getItem(key)??null;}catch{return null;}},
  setItem(key,value){try{globalThis?.localStorage?.setItem(key,value);}catch{}},
  removeItem(key){try{globalThis?.localStorage?.removeItem(key);}catch{}},
};

export const nativeSupabase=createClient(NATIVE_SUPABASE_URL,NATIVE_SUPABASE_PUBLISHABLE_KEY,{
  auth:{
    storage:browserStorage,
    storageKey:WEB_SUPABASE_AUTH_STORAGE_KEY,
    autoRefreshToken:true,
    persistSession:true,
    detectSessionInUrl:false,
    flowType:'pkce',
    experimental:{appendPkceFlowIdToRedirects:true},
  },
});
