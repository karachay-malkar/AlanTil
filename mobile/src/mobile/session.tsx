import type { Session, User } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { readAuthCallback } from '../../../packages/alantil-core/session.js';
import { bindSupabaseAuthLifecycle, supabase } from '@/src/lib/supabase';
import { initializeSyncLifecycle, migrateLegacyMobileStorage } from '@/src/mobile/sync';

WebBrowser.maybeCompleteAuthSession();

type SessionState = {
  ready: boolean;
  session: Session | null;
  user: User | null;
  error: string | null;
  authBusy: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState>({
  ready: false,
  session: null,
  user: null,
  error: null,
  authBusy: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

function authParamsFromUrl(url: string) {
  const parsed = Linking.parse(url);
  const callback = readAuthCallback(parsed.queryParams as Record<string, unknown>);
  return {
    code: callback.code || null,
    flowId: callback.flowId || null,
    error: callback.error || null,
  };
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<Omit<SessionState, 'signInWithGoogle' | 'signOut'>>({
    ready: false,
    session: null,
    user: null,
    error: null,
    authBusy: false,
  });
  const exchangedCodes = useRef(new Set<string>());

  const consumeAuthUrl = useCallback(async (url: string | null) => {
    if (!url) return false;
    const { code, flowId, error: callbackError } = authParamsFromUrl(url);
    if (callbackError) {
      setState((current) => ({ ...current, authBusy: false, error: callbackError }));
      return false;
    }
    if (!code) return false;
    if (exchangedCodes.current.has(code)) return true;

    exchangedCodes.current.add(code);
    setState((current) => ({ ...current, authBusy: true, error: null }));
    const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (error) exchangedCodes.current.delete(code);
    setState((current) => ({ ...current, authBusy: false, error: error?.message ?? null }));
    return !error;
  }, []);

  useEffect(() => {
    let mounted = true;
    const unbindLifecycle = bindSupabaseAuthLifecycle();

    void migrateLegacyMobileStorage();

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      setState((current) => ({
        ...current,
        ready: true,
        session: data.session ?? null,
        user: data.session?.user ?? null,
        error: error?.message ?? null,
      }));
    }).catch((error: unknown) => {
      if (!mounted) return;
      setState((current) => ({ ...current, ready: true, session: null, user: null, error: String(error) }));
    });

    void Linking.getInitialURL().then(consumeAuthUrl);
    const linkSubscription = Linking.addEventListener('url', ({ url }) => { void consumeAuthUrl(url); });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState((current) => ({ ...current, ready: true, session, user: session?.user ?? null, error: null, authBusy: false }));
    });

    return () => {
      mounted = false;
      linkSubscription.remove();
      data.subscription.unsubscribe();
      unbindLifecycle();
    };
  }, [consumeAuthUrl]);

  useEffect(() => {
    initializeSyncLifecycle(state.user?.id);
  }, [state.user?.id]);

  const signInWithGoogle = useCallback(async () => {
    setState((current) => ({ ...current, authBusy: true, error: null }));
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data.url) throw new Error('Supabase did not return an OAuth URL.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        await consumeAuthUrl(result.url);
      } else {
        setState((current) => ({ ...current, authBusy: false }));
      }
    } catch (error: unknown) {
      setState((current) => ({ ...current, authBusy: false, error: String((error as { message?: string })?.message ?? error) }));
    }
  }, [consumeAuthUrl]);

  const signOut = useCallback(async () => {
    setState((current) => ({ ...current, authBusy: true, error: null }));
    const { error } = await supabase.auth.signOut();
    setState((current) => ({ ...current, authBusy: false, error: error?.message ?? null }));
  }, []);

  const value = useMemo<SessionState>(() => ({ ...state, signInWithGoogle, signOut }), [state, signInWithGoogle, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
