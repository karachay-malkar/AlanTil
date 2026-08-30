import type { Session, User } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Linking from 'expo-linking';

import { bindSupabaseAuthLifecycle, supabase } from '@/src/lib/supabase';
import { migrateGuestData } from '@/src/mobile/migration/guest-to-user';

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
  const code = parsed.queryParams?.code;
  const flowId = parsed.queryParams?.sb_flow_id;
  return {
    code: typeof code === 'string' ? code : null,
    flowId: typeof flowId === 'string' ? flowId : null,
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

  useEffect(() => {
    let mounted = true;
    const unbindLifecycle = bindSupabaseAuthLifecycle();

    async function consumeAuthUrl(url: string | null) {
      if (!url) return;
      const { code, flowId } = authParamsFromUrl(url);
      if (!code) return;
      setState((current) => ({ ...current, authBusy: true, error: null }));
      const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      if (!mounted) return;
      setState((current) => ({ ...current, authBusy: false, error: error?.message ?? null }));
    }

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
  }, []);

  useEffect(() => {
    if (!state.user?.id) return;
    void migrateGuestData(state.user.id).catch((error: unknown) => {
      setState((current) => ({ ...current, error: String((error as { message?: string })?.message ?? error) }));
    });
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
      await Linking.openURL(data.url);
    } catch (error: unknown) {
      setState((current) => ({ ...current, authBusy: false, error: String((error as { message?: string })?.message ?? error) }));
    }
  }, []);

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
