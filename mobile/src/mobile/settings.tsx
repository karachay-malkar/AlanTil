import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_USER_SETTINGS as CORE_DEFAULT_USER_SETTINGS,
  completeLearningSetupSettings,
  normalizeUserSettings,
  settingsCloudPayload,
} from '../../../packages/alantil-core/settings.js';
import type {
  AlanDialect,
  AlanScript,
  InterfaceLanguage,
  OnboardingAccessMode,
  OnboardingStep,
  TextSize,
  UserSettings,
} from '../../../packages/alantil-core/settings.js';
import { useSession } from '@/src/mobile/session';
import { readScopedJson, STORAGE_KEYS, subscribeScopedValue, writeScopedJson } from '@/src/mobile/storage';
import { enqueueSync } from '@/src/mobile/sync';

export type {
  AlanDialect,
  AlanScript,
  InterfaceLanguage,
  OnboardingAccessMode,
  OnboardingStep,
  TextSize,
  UserSettings,
} from '../../../packages/alantil-core/settings.js';

export const DEFAULT_USER_SETTINGS: UserSettings = { ...CORE_DEFAULT_USER_SETTINGS };

type SettingsContextValue = {
  ready: boolean;
  settings: UserSettings;
  save: (updates: Partial<UserSettings>) => Promise<void>;
  completeLearningSetup: (updates: Partial<UserSettings>) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue>({
  ready: false,
  settings: DEFAULT_USER_SETTINGS,
  save: async () => {},
  completeLearningSetup: async () => {},
});

function normalize(raw: Partial<UserSettings> | null | undefined): UserSettings {
  return normalizeUserSettings(raw);
}

export function SettingsProvider({ children }: PropsWithChildren) {
  const session = useSession();
  const userId = session.user?.id;
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);

  useEffect(() => {
    let mounted = true;
    const activeUserId = userId ?? null;
    setReady(false);
    const reload = async () => {
      const local = normalize(await readScopedJson<Partial<UserSettings> | null>(STORAGE_KEYS.userSettings, null, activeUserId));
      if (!mounted) return;
      setSettings(local);
      setReady(true);
    };
    const unsubscribe = subscribeScopedValue(STORAGE_KEYS.userSettings, activeUserId, () => { void reload(); });
    void reload();
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [session.ready, userId]);

  const save = useCallback(async (updates: Partial<UserSettings>) => {
    const next = normalize({ ...settings, ...updates, updated_at: new Date().toISOString() });
    setSettings(next);
    await writeScopedJson(STORAGE_KEYS.userSettings, next, userId);
    await enqueueSync('user_settings', settingsCloudPayload(next, userId ?? ''), userId, { entryId: 'user_settings:current' });
  }, [settings, userId]);

  const completeLearningSetup = useCallback(async (updates: Partial<UserSettings>) => {
    const completedAt = new Date().toISOString();
    const completed = completeLearningSetupSettings({ ...settings, ...updates }, completedAt);
    await save(completed);
  }, [save, settings]);

  const value = useMemo(() => ({ ready, settings, save, completeLearningSetup }), [ready, settings, save, completeLearningSetup]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
