import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'alantil_user_settings_v1';

export type InterfaceLanguage = 'ru' | 'en' | 'tr';
export type AlanScript = 'cyrillic' | 'turkic';
export type AlanDialect = 'canonical' | 'karachay' | 'balkar';
export type TextSize = 'small' | 'medium' | 'large';

export type UserSettings = {
  interface_language_code: InterfaceLanguage;
  translation_language_code: InterfaceLanguage;
  alan_script_code: AlanScript;
  alan_dialect_code: AlanDialect;
  text_size_code: TextSize;
  learning_setup_completed_at: string | null;
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  interface_language_code: 'ru',
  translation_language_code: 'ru',
  alan_script_code: 'cyrillic',
  alan_dialect_code: 'canonical',
  text_size_code: 'medium',
  learning_setup_completed_at: null,
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
  const script: AlanScript = raw?.alan_script_code === 'turkic' ? 'turkic' : 'cyrillic';
  const dialect: AlanDialect = ['canonical', 'karachay', 'balkar'].includes(String(raw?.alan_dialect_code))
    ? (raw?.alan_dialect_code as AlanDialect)
    : 'canonical';
  const textSize: TextSize = ['small', 'medium', 'large'].includes(String(raw?.text_size_code))
    ? (raw?.text_size_code as TextSize)
    : 'medium';

  return {
    interface_language_code: language,
    translation_language_code: language,
    alan_script_code: script,
    alan_dialect_code: dialect,
    text_size_code: textSize,
    learning_setup_completed_at: raw?.learning_setup_completed_at || null,
  };
}

export function SettingsProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!mounted) return;
        setSettings(normalize(value ? JSON.parse(value) : null));
      })
      .catch(() => {
        if (mounted) setSettings(DEFAULT_USER_SETTINGS);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const save = useCallback(async (updates: Partial<UserSettings>) => {
    let next: UserSettings | null = null;
    setSettings((current) => {
      next = normalize({ ...current, ...updates });
      return next;
    });
    if (!next) return;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const completeLearningSetup = useCallback(async (updates: Partial<UserSettings>) => {
    await save({ ...updates, learning_setup_completed_at: new Date().toISOString() });
  }, [save]);

  const value = useMemo(() => ({ ready, settings, save, completeLearningSetup }), [ready, settings, save, completeLearningSetup]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
