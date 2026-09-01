import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDictionaryStatus, refreshDictionary, type DictionaryStatus } from '@/src/mobile/dictionary';
import { AlanIcon } from '@/src/mobile/icons';
import { useI18n } from '@/src/mobile/i18n';
import { navigateProfileSection, ProfileNavigation, type ProfileSection } from '@/src/mobile/profile/navigation';
import {
  type AlanDialect,
  type AlanScript,
  type InterfaceLanguage,
  type TextSize,
  type UserSettings,
  useSettings,
} from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';
import { scopedTestId, testIds } from '@/src/mobile/test-ids';
import { AppText as Text } from '@/src/mobile/typography';
import { APP_VERSION } from '@/src/mobile/version';

type SettingsDraft = Pick<UserSettings,
  'interface_language_code' | 'translation_language_code' | 'alan_script_code' | 'alan_dialect_code' | 'text_size_code'
>;

function draftFrom(settings: UserSettings): SettingsDraft {
  return {
    interface_language_code: settings.interface_language_code,
    translation_language_code: settings.interface_language_code,
    alan_script_code: settings.alan_script_code,
    alan_dialect_code: settings.alan_dialect_code,
    text_size_code: settings.text_size_code,
  };
}

function sameDraft(left: SettingsDraft, right: SettingsDraft) {
  return left.interface_language_code === right.interface_language_code
    && left.translation_language_code === right.translation_language_code
    && left.alan_script_code === right.alan_script_code
    && left.alan_dialect_code === right.alan_dialect_code
    && left.text_size_code === right.text_size_code;
}

function SettingSegments<T extends string>({ value, options, onChange, testID }: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  testID?: string;
}) {
  return <View accessibilityRole="radiogroup" testID={testID} style={styles.segments}>
    {options.map((option) => {
      const selected = option.value === value;
      return <Pressable
        key={option.value}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        testID={testID ? scopedTestId(testID, option.value) : undefined}
        onPress={() => onChange(option.value)}
        style={({ pressed }) => [styles.segment, selected && styles.segmentActive, pressed && styles.pressed]}
      >
        <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{option.label}</Text>
      </Pressable>;
    })}
  </View>;
}

function SettingsBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.block}>
    <Text style={styles.blockTitle}>{title}</Text>
    {children}
  </View>;
}

function SettingsLink({ title, value, onPress }: { title: string; value?: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
    <Text style={styles.linkTitle}>{title}</Text>
    {value ? <Text style={styles.linkValue}>{value}</Text> : null}
    <AlanIcon color={theme.colors.textSoft} name="chevron" size={16} />
  </Pressable>;
}

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, save } = useSettings();
  const { t } = useI18n();
  const [draft, setDraft] = useState<SettingsDraft>(() => draftFrom(settings));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dictionary, setDictionary] = useState<DictionaryStatus | null>(null);
  const [dictionaryBusy, setDictionaryBusy] = useState(false);
  const storedDraft = useMemo(() => draftFrom(settings), [settings]);
  const dirty = !sameDraft(draft, storedDraft);

  useEffect(() => {
    let active = true;
    void getDictionaryStatus({ checkRemote: false }).then((status) => { if (active) setDictionary(status); });
    void getDictionaryStatus().then((status) => { if (active) setDictionary(status); });
    return () => { active = false; };
  }, []);

  const requestLeave = useCallback((action: () => void) => {
    if (saving) return;
    if (!dirty) {
      action();
      return;
    }
    Alert.alert(t('settings.unsaved_title'), t('settings.unsaved_body'), [
      { text: t('settings.stay'), style: 'cancel' },
      { text: t('settings.discard'), style: 'destructive', onPress: action },
    ]);
  }, [dirty, saving, t]);

  const requestBack = useCallback(() => {
    requestLeave(() => router.back());
  }, [requestLeave]);

  const selectProfileSection = useCallback((section: ProfileSection) => {
    requestLeave(() => navigateProfileSection(section));
  }, [requestLeave]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      requestBack();
      return true;
    });
    return () => subscription.remove();
  }, [requestBack]));

  const updateLanguage = (value: InterfaceLanguage) => {
    setDraft((current) => ({ ...current, interface_language_code: value, translation_language_code: value }));
    setMessage('');
  };

  const saveDraft = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await save(draft);
      setMessage(t('settings.saved'));
    } catch {
      setError(t('settings.save_error'));
    } finally {
      setSaving(false);
    }
  };

  const checkDictionary = async (update: boolean) => {
    if (dictionaryBusy) return;
    setDictionaryBusy(true);
    setError('');
    setMessage('');
    try {
      if (update) {
        const refreshed = await refreshDictionary({ force: true });
        setDictionary({ installedVersion: refreshed.version, latestVersion: refreshed.version, updateAvailable: false, remoteAvailable: true });
        setMessage(t('settings.updated'));
      } else {
        setDictionary(await getDictionaryStatus());
      }
    } catch {
      setError(t('settings.dictionary_error'));
      setDictionary(await getDictionaryStatus({ checkRemote: false }));
    } finally {
      setDictionaryBusy(false);
    }
  };

  const languageOptions: readonly { value: InterfaceLanguage; label: string }[] = [
    { value: 'ru', label: 'Русский' },
    { value: 'en', label: 'English' },
    { value: 'tr', label: 'Türkçe' },
  ];
  const scriptOptions: readonly { value: AlanScript; label: string }[] = [
    { value: 'cyrillic', label: t('onboarding.cyrillic') },
    { value: 'turkic', label: 'Latin' },
  ];
  const dialectOptions: readonly { value: AlanDialect; label: string }[] = [
    { value: 'canonical', label: 'Җ' },
    { value: 'karachay', label: 'Дж' },
    { value: 'balkar', label: 'Ж' },
  ];
  const textSizeOptions: readonly { value: TextSize; label: string }[] = [
    { value: 'small', label: t('settings.text_small') },
    { value: 'medium', label: t('settings.text_medium') },
    { value: 'large', label: t('settings.text_large') },
  ];
  const previewScale = draft.text_size_code === 'small' ? 0.88 : draft.text_size_code === 'large' ? 1.14 : 1;
  const previewWord = draft.alan_script_code === 'turkic'
    ? 'Ciger'
    : draft.alan_dialect_code === 'karachay' ? 'Джигер' : draft.alan_dialect_code === 'balkar' ? 'Жигер' : t('settings.preview_word');

  return <View testID={testIds.settings.screen} style={styles.screen}>
    <ProfileNavigation active="settings" onSelect={selectProfileSection} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 112 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      <SettingsBlock title={t('settings.interface_language')}>
        <SettingSegments testID="settings.language" value={draft.interface_language_code} options={languageOptions} onChange={updateLanguage} />
      </SettingsBlock>

      <SettingsBlock title={t('settings.script')}>
        <SettingSegments testID="settings.script" value={draft.alan_script_code} options={scriptOptions} onChange={(value) => setDraft((current) => ({ ...current, alan_script_code: value }))} />
      </SettingsBlock>

      {draft.alan_script_code === 'cyrillic' ? <SettingsBlock title={t('settings.letter_form')}>
        <SettingSegments testID="settings.dialect" value={draft.alan_dialect_code} options={dialectOptions} onChange={(value) => setDraft((current) => ({ ...current, alan_dialect_code: value }))} />
      </SettingsBlock> : null}

      <SettingsBlock title={t('settings.text_size')}>
        <SettingSegments testID="settings.text-size" value={draft.text_size_code} options={textSizeOptions} onChange={(value) => setDraft((current) => ({ ...current, text_size_code: value }))} />
      </SettingsBlock>

      <SettingsBlock title={t('settings.preview')}>
        <View style={styles.previewCard}>
          <Text unscaled style={[styles.previewWord, { fontSize: 28 * previewScale, lineHeight: 36 * previewScale }]}>{previewWord}</Text>
          <Text unscaled style={[styles.previewTranslation, { fontSize: 13 * previewScale, lineHeight: 19 * previewScale }]}>{t('settings.preview_translation')}</Text>
        </View>
      </SettingsBlock>

      <SettingsBlock title={t('settings.dictionary')}>
        <View style={styles.dictionaryCard}>
          {dictionary ? <>
            <Text style={styles.dictionaryLine}>{t('settings.installed_version', { version: dictionary.installedVersion })}</Text>
            <Text style={styles.dictionaryLine}>{dictionary.latestVersion
              ? t('settings.latest_version', { version: dictionary.latestVersion })
              : t('settings.latest_unknown')}</Text>
            <Text style={[styles.dictionaryStatus, dictionary.updateAvailable && styles.dictionaryUpdate]}>{dictionary.updateAvailable ? t('settings.update_available') : t('settings.up_to_date')}</Text>
          </> : <ActivityIndicator color={theme.colors.accentStrong} />}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: dictionaryBusy, disabled: dictionaryBusy }}
            testID="settings.dictionary.action"
            disabled={dictionaryBusy}
            onPress={() => { void checkDictionary(Boolean(dictionary?.updateAvailable)); }}
            style={({ pressed }) => [styles.dictionaryButton, dictionaryBusy && styles.disabled, pressed && styles.pressed]}
          >
            {dictionaryBusy ? <ActivityIndicator color={theme.colors.text} size="small" /> : <Text style={styles.dictionaryButtonText}>{dictionary?.updateAvailable ? t('settings.update_dictionary') : t('settings.check_update')}</Text>}
          </Pressable>
        </View>
      </SettingsBlock>

      <SettingsBlock title={t('settings.about')}>
        <View style={styles.links}>
          <SettingsLink title={t('settings.thanks')} onPress={() => requestLeave(() => router.push('/profile/thanks'))} />
          <SettingsLink title={t('settings.app_version')} value={APP_VERSION} onPress={() => requestLeave(() => router.push('/profile/version'))} />
          <SettingsLink title={t('settings.privacy_policy')} onPress={() => requestLeave(() => router.push('/profile/privacy'))} />
        </View>
      </SettingsBlock>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
    </ScrollView>

    <View style={[styles.footer, { paddingBottom: 10 + insets.bottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !dirty || saving }}
        testID={testIds.settings.save}
        disabled={!dirty || saving}
        onPress={() => { void saveDraft(); }}
        style={({ pressed }) => [styles.saveButton, (!dirty || saving) && styles.disabled, pressed && styles.pressed]}
      >
        {saving ? <ActivityIndicator color={theme.colors.inverse} size="small" /> : <Text style={styles.saveText}>{t('settings.save').toUpperCase()}</Text>}
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 20 },
  block: { gap: 9 },
  blockTitle: { color: theme.colors.text, fontSize: 11, lineHeight: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  segments: { minHeight: 50, flexDirection: 'row', gap: 3, padding: 3, borderRadius: 13, backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.lineSoft },
  segment: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segmentActive: { backgroundColor: theme.colors.text },
  segmentText: { color: theme.colors.textMuted, fontSize: 10, lineHeight: 14, fontWeight: '800', textAlign: 'center' },
  segmentTextActive: { color: theme.colors.inverse },
  previewCard: { minHeight: 160, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.lineSoft, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', padding: 20 },
  previewWord: { color: theme.colors.text, fontWeight: '900', textAlign: 'center' },
  previewTranslation: { marginTop: 14, color: theme.colors.textMuted, fontWeight: '600', textAlign: 'center' },
  dictionaryCard: { borderRadius: 14, borderWidth: 1, borderColor: theme.colors.lineSoft, backgroundColor: theme.colors.surface2, padding: 14, gap: 7 },
  dictionaryLine: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 16 },
  dictionaryStatus: { marginTop: 3, color: theme.colors.success, fontSize: 11, lineHeight: 16, fontWeight: '800' },
  dictionaryUpdate: { color: theme.colors.accentStrong },
  dictionaryButton: { minHeight: 44, marginTop: 7, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  dictionaryButtonText: { color: theme.colors.text, fontSize: 11, fontWeight: '900', textAlign: 'center' },
  links: { borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  linkRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  linkTitle: { flex: 1, color: theme.colors.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  linkValue: { color: theme.colors.textSoft, fontSize: 10, fontWeight: '800', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
  linkChevron: { color: theme.colors.textSoft, fontSize: 25, lineHeight: 28 },
  error: { color: theme.colors.danger, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  success: { color: theme.colors.success, fontSize: 11, lineHeight: 16, fontWeight: '700', textAlign: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: 'rgba(238,233,223,0.96)' },
  saveButton: { minHeight: 48, borderRadius: 10, backgroundColor: theme.colors.accentStrong, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: theme.colors.inverse, fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
});
