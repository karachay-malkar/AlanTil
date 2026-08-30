import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://pybrzgedqjmosbmilcea.supabase.co';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_11TY-fBEAogA9JKnAku3vg_hjRxTa_a';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

let refreshLifecycleBound = false;

export function bindSupabaseAuthLifecycle() {
  if (refreshLifecycleBound || Platform.OS === 'web') return () => undefined;
  refreshLifecycleBound = true;

  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });

  supabase.auth.startAutoRefresh();

  return () => {
    subscription.remove();
    supabase.auth.stopAutoRefresh();
    refreshLifecycleBound = false;
  };
}
