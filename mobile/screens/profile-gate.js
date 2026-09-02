import React, { useCallback, useEffect, useState } from 'react';
import { AccountScreen } from './profile.js';
import { ProfileMainArea } from './profile-main.js';
import { Screen, ScreenState } from '../ui/components.js';
import { bootstrapNativeAuth, subscribeNativeAuth } from '../platform/auth.js';
import { loadNativeProfile } from '../platform/profile-api.js';

export function ProfileGate({ words, settings, onSettingsChange, onAccount, onGuest }) {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(undefined);
  const [checking, setChecking] = useState(false);

  const resolveProfile = useCallback(async (nextSession) => {
    if (!nextSession?.user?.id) {
      setProfile(null);
      setChecking(false);
      return null;
    }
    setChecking(true);
    try {
      const next = await loadNativeProfile(nextSession.user.id);
      setProfile(next);
      return next;
    } catch {
      setProfile(undefined);
      return undefined;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const apply = (nextSession) => {
      if (!alive) return;
      const value = nextSession || null;
      setSession(value);
      setAuthReady(true);
      void resolveProfile(value);
    };
    bootstrapNativeAuth().then(apply).catch(() => apply(null));
    const unsubscribe = subscribeNativeAuth(apply);
    return () => { alive = false; unsubscribe(); };
  }, [resolveProfile]);

  if (!authReady || checking) return <Screen><ScreenState>Проверяем профиль…</ScreenState></Screen>;

  const setupIncomplete = Boolean(session?.user && (!profile?.nickname || !profile?.avatar_gender));
  if (setupIncomplete || (session?.user && profile === undefined)) {
    return <AccountScreen
      settings={settings}
      onGuest={onGuest}
      onBack={async () => {
        const next = await resolveProfile(session);
        if (next?.nickname && next?.avatar_gender) onAccount?.('close');
      }}
    />;
  }

  return <ProfileMainArea words={words} settings={settings} onSettingsChange={onSettingsChange} onAccount={() => onAccount?.('open')} />;
}
