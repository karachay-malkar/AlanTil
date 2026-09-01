import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GuideCarousel } from '@/src/mobile/guide';
import { AlanIcon } from '@/src/mobile/icons';
import { messageForLanguage, type MobileMessageKey } from '@/src/mobile/i18n';
import { useSession } from '@/src/mobile/session';
import {
  type AlanDialect,
  type AlanScript,
  type InterfaceLanguage,
  type OnboardingStep,
  useSettings,
} from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';
import { testIds } from '@/src/mobile/test-ids';
import { AppText as Text } from '@/src/mobile/typography';

const PREVIEW = {
  ru: { translation: 'деятельный, активный, проворный', exampleTranslation: 'доблестный труд' },
  en: { translation: 'energetic, active, agile', exampleTranslation: 'valiant work' },
  tr: { translation: 'gayretli, aktif, çevik', exampleTranslation: 'yiğitçe emek' },
} as const;

const LANGUAGE_OPTIONS: { code: InterfaceLanguage; label: string }[] = [
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
];

function Flag({ language }: { language: InterfaceLanguage }) {
  if (language === 'ru') return <View style={styles.flag}><View style={styles.flagWhite} /><View style={styles.flagBlue} /><View style={styles.flagRed} /></View>;
  if (language === 'tr') return <View style={[styles.flag, styles.flagTurkey]}><View style={styles.flagMoonOuter} /><View style={styles.flagMoonInner} /><Text style={styles.flagStar}>★</Text></View>;
  return <View style={[styles.flag, styles.flagBritain]}>
    <View style={[styles.flagDiagonal, { transform: [{ rotate: '34deg' }] }]} />
    <View style={[styles.flagDiagonal, { transform: [{ rotate: '-34deg' }] }]} />
    <View style={styles.flagCrossHorizontal} />
    <View style={styles.flagCrossVertical} />
    <View style={styles.flagCrossRedHorizontal} />
    <View style={styles.flagCrossRedVertical} />
  </View>;
}

function Segment<T extends string>({ value, selected, label, onPress, children, testID }: {
  value: T;
  selected: boolean;
  label: string;
  onPress: (value: T) => void;
  children?: React.ReactNode;
  testID?: string;
}) {
  return <Pressable
    accessibilityRole="radio"
    accessibilityLabel={label}
    accessibilityState={{ checked: selected }}
    testID={testID}
    onPress={() => onPress(value)}
    style={({ pressed }) => [styles.segment, selected && styles.segmentSelected, pressed && styles.pressed]}
  >
    {children}
    <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
  </Pressable>;
}

export function OnboardingScreen() {
  const auth = useSession();
  const { settings, save, completeLearningSetup } = useSettings();
  const hasDraft = Boolean(settings.updated_at);
  const initialStage: OnboardingStep = hasDraft && settings.onboarding_step !== 'done' ? settings.onboarding_step : 'setup';
  const [stage, setStage] = useState<OnboardingStep>(initialStage);
  const [language, setLanguage] = useState<InterfaceLanguage | null>(hasDraft ? settings.interface_language_code : null);
  const [script, setScript] = useState<AlanScript | null>(hasDraft ? settings.alan_script_code : null);
  const [dialect, setDialect] = useState<AlanDialect | null>(hasDraft ? settings.alan_dialect_code : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const activeLanguage = language ?? 'ru';
  const t = (key: MobileMessageKey, params?: Record<string, string | number>) => messageForLanguage(activeLanguage, key, params);

  const preview = useMemo(() => {
    const selectedScript = script ?? 'cyrillic';
    const selectedDialect = dialect ?? 'canonical';
    const cyrillicWord = selectedDialect === 'karachay' ? 'джигер' : selectedDialect === 'balkar' ? 'жигер' : 'җигер';
    const cyrillicExample = selectedDialect === 'karachay' ? 'джигер урунуу' : selectedDialect === 'balkar' ? 'жигер урунуу' : 'җигер урунуу';
    return {
      word: selectedScript === 'turkic' ? 'ciger' : cyrillicWord,
      example: selectedScript === 'turkic' ? 'ciger urunuw' : cyrillicExample,
      ...PREVIEW[activeLanguage],
    };
  }, [activeLanguage, dialect, script]);

  const complete = Boolean(language && script && (script === 'turkic' || dialect));

  const saveConfiguration = async () => {
    if (!language || !script || !complete || saving) return;
    setSaving(true);
    setError('');
    try {
      await save({
        interface_language_code: language,
        translation_language_code: language,
        alan_script_code: script,
        alan_dialect_code: dialect ?? 'canonical',
        onboarding_step: 'access',
      });
      setStage('access');
    } catch {
      setError(t('onboarding.storage_error'));
    } finally {
      setSaving(false);
    }
  };

  const chooseAccess = async (mode: 'guest' | 'account') => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await save({ onboarding_access_mode: mode, onboarding_step: 'guide' });
      setStage('guide');
    } catch {
      setError(t('onboarding.storage_error'));
    } finally {
      setSaving(false);
    }
  };

  const startGoogleSignIn = async () => {
    if (saving || auth.authBusy) return;
    setSaving(true);
    setError('');
    try {
      await save({ onboarding_step: 'access' });
      await auth.signInWithGoogle();
    } catch {
      setError(t('onboarding.storage_error'));
    } finally {
      setSaving(false);
    }
  };

  const finishGuide = async () => {
    if (!language || !script || saving) return;
    setSaving(true);
    setError('');
    try {
      await completeLearningSetup({
        interface_language_code: language,
        translation_language_code: language,
        alan_script_code: script,
        alan_dialect_code: dialect ?? 'canonical',
        onboarding_access_mode: auth.user ? 'account' : (settings.onboarding_access_mode ?? 'guest'),
      });
    } catch {
      setError(t('onboarding.storage_error'));
      setSaving(false);
    }
  };

  if (stage === 'guide') {
    return <SafeAreaView style={styles.safe}>
      <View style={styles.guideContent}>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <GuideCarousel onDone={finishGuide} onSkip={finishGuide} />
      </View>
    </SafeAreaView>;
  }

  if (stage === 'access') {
    return <SafeAreaView testID={testIds.onboarding.access} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.accessContent} showsVerticalScrollIndicator={false}>
        <View style={styles.accountMark}><Text style={styles.accountMarkText}>A</Text></View>
        <Text style={styles.accessTitle}>{t('account.choice.title')}</Text>
        <Text style={styles.accessBody}>{t('account.choice.body')}</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {auth.error ? <Text accessibilityRole="alert" style={styles.error}>{auth.error}</Text> : null}

        {!auth.ready ? <ActivityIndicator color={theme.colors.accentStrong} /> : auth.user ? <>
          <Text style={styles.signedIn}>{t('account.signed_in', { email: auth.user.email ?? 'AlanTil' })}</Text>
          <Pressable
            accessibilityRole="button"
            testID={testIds.onboarding.account}
            accessibilityState={{ disabled: saving, busy: saving }}
            disabled={saving}
            onPress={() => { void chooseAccess('account'); }}
            style={({ pressed }) => [styles.primaryButton, saving && styles.disabled, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>{t('account.continue_account')}</Text>
          </Pressable>
        </> : <Pressable
          accessibilityRole="button"
          testID={testIds.onboarding.google}
          accessibilityState={{ disabled: saving || auth.authBusy, busy: saving || auth.authBusy }}
          disabled={saving || auth.authBusy}
          onPress={() => { void startGoogleSignIn(); }}
          style={({ pressed }) => [styles.googleButton, (saving || auth.authBusy) && styles.disabled, pressed && styles.pressed]}
        >
          {(saving || auth.authBusy) ? <ActivityIndicator color={theme.colors.text} size="small" /> : <Text style={styles.googleGlyph}>G</Text>}
          <Text style={styles.googleText}>{t('account.google')}</Text>
        </Pressable>}

        <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>•</Text><View style={styles.dividerLine} /></View>
        <Pressable
          accessibilityRole="button"
          testID={testIds.onboarding.guest}
          accessibilityState={{ disabled: saving, busy: saving }}
          disabled={saving}
          onPress={() => { void chooseAccess('guest'); }}
          style={({ pressed }) => [styles.secondaryButton, saving && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>{t('account.continue_guest')}</Text>
        </Pressable>
        <Text style={styles.privacyCopy}>{t('account.privacy')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => { setStage('setup'); void save({ onboarding_step: 'setup' }); }}
          style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
        >
          <AlanIcon color={theme.colors.textMuted} name="back" size={18} />
          <Text style={styles.backLinkText}>{t('common.back')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>;
  }

  return <SafeAreaView testID={testIds.onboarding.setup} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.block}>
        <Text accessibilityRole="header" style={styles.heading}>{t('onboarding.language')}</Text>
        <View accessibilityRole="radiogroup" style={styles.row}>
          {LANGUAGE_OPTIONS.map((option) => <Segment
            key={option.code}
            value={option.code}
            selected={language === option.code}
            label={option.label}
            onPress={setLanguage}
            testID={option.code === 'ru' ? testIds.onboarding.languageRu : option.code === 'en' ? testIds.onboarding.languageEn : testIds.onboarding.languageTr}
          ><Flag language={option.code} /></Segment>)}
        </View>
      </View>

      {language ? <View style={styles.block}>
        <Text style={styles.subheading}>{t('onboarding.script')}</Text>
        <View accessibilityRole="radiogroup" style={styles.row}>
          <Segment testID={testIds.onboarding.scriptCyrillic} value="cyrillic" selected={script === 'cyrillic'} label={t('onboarding.cyrillic')} onPress={setScript} />
          <Segment testID={testIds.onboarding.scriptTurkic} value="turkic" selected={script === 'turkic'} label="Latin" onPress={(value) => { setScript(value); setDialect((current) => current ?? 'canonical'); }} />
        </View>
      </View> : null}

      {script === 'cyrillic' ? <View style={styles.block}>
        <Text style={styles.subheading}>{t('onboarding.letter_form')}</Text>
        <View accessibilityRole="radiogroup" style={styles.row}>
          <Segment testID={testIds.onboarding.dialectCanonical} value="canonical" selected={dialect === 'canonical'} label="Җ" onPress={setDialect} />
          <Segment testID={testIds.onboarding.dialectKarachay} value="karachay" selected={dialect === 'karachay'} label="Дж" onPress={setDialect} />
          <Segment testID={testIds.onboarding.dialectBalkar} value="balkar" selected={dialect === 'balkar'} label="Ж" onPress={setDialect} />
        </View>
      </View> : null}

      <View accessibilityLabel={t('onboarding.preview')} style={styles.previewCard}>
        <Text style={styles.previewWord}>{preview.word.charAt(0).toUpperCase() + preview.word.slice(1)}</Text>
        <View style={styles.previewPill}>
          <Text style={styles.previewTranslation}>{preview.translation}</Text>
          <Text style={styles.previewExample}>{preview.example}  ✦  {preview.exampleTranslation}</Text>
        </View>
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        testID={testIds.onboarding.continue}
        accessibilityState={{ disabled: !complete || saving }}
        disabled={!complete || saving}
        onPress={() => { void saveConfiguration(); }}
        style={({ pressed }) => [styles.primaryButton, (!complete || saving) && styles.disabled, pressed && styles.pressed]}
      >
        {saving ? <ActivityIndicator color={theme.colors.inverse} size="small" /> : <Text style={styles.primaryText}>{t('common.continue')}</Text>}
      </Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 24, justifyContent: 'center', gap: 19 },
  guideContent: { flex: 1, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  accessContent: { flexGrow: 1, width: '100%', maxWidth: 500, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 32, paddingBottom: 24, justifyContent: 'center' },
  block: { gap: 10 },
  heading: { color: theme.colors.text, fontSize: 22, lineHeight: 29, fontWeight: '800', textAlign: 'center' },
  subheading: { color: theme.colors.text, fontSize: 15, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, minHeight: 48, flexDirection: 'row', gap: 7, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segmentSelected: { backgroundColor: theme.colors.accentStrong, borderColor: theme.colors.accentStrong },
  segmentText: { color: theme.colors.text, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  segmentTextSelected: { color: theme.colors.inverse },
  flag: { width: 20, height: 14, overflow: 'hidden', borderRadius: 2, borderWidth: 1, borderColor: 'rgba(40,38,33,0.18)' },
  flagWhite: { flex: 1, backgroundColor: '#fff' },
  flagBlue: { flex: 1, backgroundColor: '#1c57a7' },
  flagRed: { flex: 1, backgroundColor: '#d52b1e' },
  flagTurkey: { position: 'relative', backgroundColor: '#e30a17' },
  flagMoonOuter: { position: 'absolute', left: 5, top: 3, width: 9, height: 9, borderRadius: 5, backgroundColor: '#fff' },
  flagMoonInner: { position: 'absolute', left: 7, top: 3, width: 8, height: 9, borderRadius: 5, backgroundColor: '#e30a17' },
  flagStar: { position: 'absolute', right: 3, top: 2, color: '#fff', fontSize: 7 },
  flagBritain: { position: 'relative', backgroundColor: '#21468b' },
  flagDiagonal: { position: 'absolute', left: -4, top: 7, width: 32, height: 3, backgroundColor: '#fff' },
  flagCrossHorizontal: { position: 'absolute', left: 0, top: 4, width: 20, height: 6, backgroundColor: '#fff' },
  flagCrossVertical: { position: 'absolute', left: 7, top: 0, width: 6, height: 14, backgroundColor: '#fff' },
  flagCrossRedHorizontal: { position: 'absolute', left: 0, top: 6, width: 20, height: 2, backgroundColor: '#cf142b' },
  flagCrossRedVertical: { position: 'absolute', left: 9, top: 0, width: 2, height: 14, backgroundColor: '#cf142b' },
  previewCard: { borderRadius: theme.radius.lg, backgroundColor: '#f2ede3', borderWidth: 1, borderColor: theme.colors.lineSoft, padding: 18, gap: 14 },
  previewWord: { color: theme.colors.text, fontSize: 31, lineHeight: 39, fontWeight: '800', textAlign: 'center' },
  previewPill: { borderRadius: theme.radius.md, backgroundColor: 'rgba(255,255,255,0.34)', padding: 14, gap: 7 },
  previewTranslation: { color: theme.colors.text, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  previewExample: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  primaryButton: { width: '100%', minHeight: 50, borderRadius: theme.radius.sm, backgroundColor: theme.colors.accentStrong, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { color: theme.colors.inverse, fontSize: 13, fontWeight: '900', textAlign: 'center' },
  secondaryButton: { width: '100%', minHeight: 50, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryText: { color: theme.colors.text, fontSize: 13, fontWeight: '900', textAlign: 'center' },
  googleButton: { width: '100%', minHeight: 52, flexDirection: 'row', gap: 12, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  googleGlyph: { color: '#4285f4', fontSize: 20, lineHeight: 24, fontWeight: '900' },
  googleText: { color: theme.colors.text, fontSize: 13, fontWeight: '900' },
  accountMark: { width: 76, height: 76, alignSelf: 'center', borderRadius: 38, backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.line, alignItems: 'center', justifyContent: 'center' },
  accountMarkText: { color: theme.colors.accentStrong, fontSize: 36, lineHeight: 44, fontWeight: '900' },
  accessTitle: { marginTop: 22, color: theme.colors.text, fontSize: 25, lineHeight: 32, fontWeight: '900', textAlign: 'center' },
  accessBody: { marginTop: 10, marginBottom: 24, color: theme.colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  signedIn: { marginBottom: 14, color: theme.colors.success, fontSize: 12, lineHeight: 17, fontWeight: '700', textAlign: 'center' },
  divider: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.lineSoft },
  dividerText: { color: theme.colors.textSoft, fontSize: 12 },
  privacyCopy: { marginTop: 16, color: theme.colors.textSoft, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  backLink: { alignSelf: 'center', minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, paddingHorizontal: 14 },
  backLinkText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '800' },
  error: { color: theme.colors.danger, fontSize: 11, lineHeight: 16, textAlign: 'center', marginBottom: 10 },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.68, transform: [{ scale: 0.985 }] },
});
