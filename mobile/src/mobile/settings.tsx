import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/src/lib/supabase';
import { useSession } from '@/src/mobile/session';

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

  return {
    interface_language_code: language,
    translation_language_code: translationLanguage,
    alan_script_code: script,
    alan_dialect_code: dialect,
    text_size_code: textSize,
    learning_setup_completed_at: raw?.learning_setup_completed_at || null,
  };
}

function cloudPayload(settings: UserSettings, userId: string) {
  return {
    user_id: userId,
    interface_language_code: settings.interface_language_code,
    translation_language_code: settings.translation_language_code,
    alan_script_code: settings.alan_script_code,
    alan_dialect_code: settings.alan_dialect_code,
    learning_setup_completed_at: settings.learning_setup_completed_at,
    updated_at: new Date().toISOString(),
  };
}

export function SettingsProvider({ children }: PropsWithChildren) {
  const session = useSession();
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

  useEffect(() => {
    if (!ready || !session.ready || !session.user) return;
    let mounted = true;
    const userId = session.user.id;

    void (async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (!mounted || error) return;

      if (data) {
        const cloud = normalize({ ...data, text_size_code: settings.text_size_code });
        setSettings(cloud);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cloud));
        return;
      }

      await supabase.from('user_settings').upsert(cloudPayload(settings, userId), { onConflict: 'user_id' });
    })();

    return () => {
      mounted = false;
    };
  }, [ready, session.ready, session.user?.id]);

  const save = useCallback(async (updates: Partial<UserSettings>) => {
    const next = normalize({ ...settings, ...updates });
    setSettings(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));

    if (session.user) {
      const { error } = await supabase
        .from('user_settings')
        .upsert(cloudPayload(next, session.user.id), { onConflict: 'user_id' });
      if (error) throw error;
    }
  }, [settings, session.user]);

  const completeLearningSetup = useCallback(async (updates: Partial<UserSettings>) => {
    await save({ ...updates, learning_setup_completed_at: new Date().toISOString() });
  }, [save]);

  const value = useMemo(() => ({ ready, settings, save, completeLearningSetup }), [ready, settings, save, completeLearningSetup]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
