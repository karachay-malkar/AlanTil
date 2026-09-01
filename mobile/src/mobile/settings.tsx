import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useSession } from '@/src/mobile/session';
import { readScopedJson, STORAGE_KEYS, subscribeScopedValue, writeScopedJson } from '@/src/mobile/storage';
import { enqueueSync } from '@/src/mobile/sync';

export type InterfaceLanguage = 'ru' | 'en' | 'tr';
export type AlanScript = 'cyrillic' | 'turkic';
export type AlanDialect = 'canonical' | 'karachay' | 'balkar';
export type TextSize = 'small' | 'medium' | 'large';
export type OnboardingStep = 'setup' | 'access' | 'guide' | 'done';
export type OnboardingAccessMode = 'guest' | 'account' | null;

export type UserSettings = {
  interface_language_code: InterfaceLanguage;
  translation_language_code: InterfaceLanguage;
  alan_script_code: AlanScript;
  alan_dialect_code: AlanDialect;
  text_size_code: TextSize;
  onboarding_step: OnboardingStep;
  onboarding_access_mode: OnboardingAccessMode;
  learning_setup_completed_at: string | null;
  updated_at: string | null;
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  interface_language_code: 'ru',
  translation_language_code: 'ru',
  alan_script_code: 'cyrillic',
  alan_dialect_code: 'canonical',
  text_size_code: 'medium',
  onboarding_step: 'setup',
  onboarding_access_mode: null,
  learning_setup_completed_at: null,
  updated_at: null,
};

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
  const language: InterfaceLanguage = ['ru', 'en', 'tr'].includes(String(raw?.interface_language_code))
    ? (raw?.interface_language_code as InterfaceLanguage)
    : 'ru';
  const translationLanguage: InterfaceLanguage = ['ru', 'en', 'tr'].includes(String(raw?.translation_language_code))
    ? (raw?.translation_language_code as InterfaceLanguage)
    : language;
  const script: AlanScript = raw?.alan_script_code === 'turkic' ? 'turkic' : 'cyrillic';
  const dialect: AlanDialect = ['canonical', 'karachay', 'balkar'].includes(String(raw?.alan_dialect_code))
    ? (raw?.alan_dialect_code as AlanDialect)
    : 'canonical';
  const textSize: TextSize = ['small', 'medium', 'large'].includes(String(raw?.text_size_code))
    ? (raw?.text_size_code as TextSize)
    : 'medium';
  const onboardingStep: OnboardingStep = ['setup', 'access', 'guide', 'done'].includes(String(raw?.onboarding_step))
    ? (raw?.onboarding_step as OnboardingStep)
    : (raw?.learning_setup_completed_at ? 'done' : 'setup');
  const onboardingAccessMode: OnboardingAccessMode = ['guest', 'account'].includes(String(raw?.onboarding_access_mode))
    ? (raw?.onboarding_access_mode as Exclude<OnboardingAccessMode, null>)
    : null;
  const updatedAt = Date.parse(String(raw?.updated_at ?? ''));

  return {
    interface_language_code: language,
    translation_language_code: translationLanguage,
    alan_script_code: script,
    alan_dialect_code: dialect,
    text_size_code: textSize,
    onboarding_step: onboardingStep,
    onboarding_access_mode: onboardingAccessMode,
    learning_setup_completed_at: raw?.learning_setup_completed_at || null,
    updated_at: Number.isFinite(updatedAt) ? new Date(updatedAt).toISOString() : null,
  };
}

function cloudPayload(settings: UserSettings, userId: string) {
  return {
    user_id: userId,
    interface_language_code: settings.interface_language_code,
    translation_language_code: settings.translation_language_code,
    alan_script_code: settings.alan_script_code,
    alan_dialect_code: settings.alan_dialect_code,
    text_size_code: settings.text_size_code,
    learning_setup_completed_at: settings.learning_setup_completed_at,
    updated_at: settings.updated_at,
  };
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
    await enqueueSync('user_settings', cloudPayload(next, userId ?? ''), userId, { entryId: 'user_settings:current' });
  }, [settings, userId]);

  const completeLearningSetup = useCallback(async (updates: Partial<UserSettings>) => {
    await save({ ...updates, onboarding_step: 'done', learning_setup_completed_at: new Date().toISOString() });
  }, [save]);

  const value = useMemo(() => ({ ready, settings, save, completeLearningSetup }), [ready, settings, save, completeLearningSetup]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
