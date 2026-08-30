import type { Session, User } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { bindSupabaseAuthLifecycle, supabase } from '@/src/lib/supabase';

type SessionState = {
  ready: boolean;
  session: Session | null;
  user: User | null;
  error: string | null;
};

const SessionContext = createContext<SessionState>({
  ready: false,
  session: null,
  user: null,
  error: null,
});

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>({
    ready: false,
    session: null,
    user: null,
    error: null,
  });

  useEffect(() => {
    let mounted = true;
    const unbindLifecycle = bindSupabaseAuthLifecycle();

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      setState({
        ready: true,
        session: data.session ?? null,
        user: data.session?.user ?? null,
        error: error?.message ?? null,
      });
    }).catch((error: unknown) => {
      if (!mounted) return;
      setState({ ready: true, session: null, user: null, error: String(error) });
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState({ ready: true, session, user: session?.user ?? null, error: null });
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
      unbindLifecycle();
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
