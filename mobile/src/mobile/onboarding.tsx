import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlanDialect, AlanScript, InterfaceLanguage, useSettings } from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';

const COPY = {
  ru: { script: 'Написание аланских слов', cyrillic: 'Кириллица', dialect: 'Выберите форму', continue: 'Продолжить' },
  en: { script: 'Alan word script', cyrillic: 'Cyrillic', dialect: 'Choose the letter form', continue: 'Continue' },
  tr: { script: 'Alanca kelimelerin yazımı', cyrillic: 'Kiril', dialect: 'Harf biçimini seçin', continue: 'Devam et' },
} as const;

const PREVIEW = {
  ru: { translation: 'деятельный, активный, проворный', exampleTranslation: 'доблестный труд' },
  en: { translation: 'energetic, active, agile', exampleTranslation: 'valiant work' },
  tr: { translation: 'gayretli, aktif, çevik', exampleTranslation: 'yiğitçe emek' },
} as const;

const LANGUAGE_OPTIONS: { code: InterfaceLanguage; label: string; flag: string }[] = [
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
];

function Segment<T extends string>({ value, selected, label, onPress }: { value: T; selected: boolean; label: string; onPress: (value: T) => void }) {
  return (
    <Pressable onPress={() => onPress(value)} style={[styles.segment, selected && styles.segmentSelected]}>
      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function OnboardingScreen() {
  const { completeLearningSetup } = useSettings();
  const [language, setLanguage] = useState<InterfaceLanguage | null>(null);
  const [script, setScript] = useState<AlanScript | null>(null);
  const [dialect, setDialect] = useState<AlanDialect | null>(null);
  const [saving, setSaving] = useState(false);
  const copy = COPY[language ?? 'ru'];

  const preview = useMemo(() => {
    const lang = language ?? 'ru';
    const selectedScript = script ?? 'cyrillic';
    const selectedDialect = dialect ?? 'canonical';
    const cyrillicWord = selectedDialect === 'karachay' ? 'джигер' : selectedDialect === 'balkar' ? 'жигер' : 'җигер';
    const cyrillicExample = selectedDialect === 'karachay' ? 'джигер урунуу' : selectedDialect === 'balkar' ? 'жигер урунуу' : 'җигер урунуу';
    return {
      word: selectedScript === 'turkic' ? 'ciger' : cyrillicWord,
      example: selectedScript === 'turkic' ? 'ciger urunuw' : cyrillicExample,
      ...PREVIEW[lang],
    };
  }, [language, script, dialect]);

  const complete = Boolean(language && script && (script === 'turkic' || dialect));

  async function finish() {
    if (!language || !script || !complete || saving) return;
    setSaving(true);
    try {
      await completeLearningSetup({
        interface_language_code: language,
        translation_language_code: language,
        alan_script_code: script,
        alan_dialect_code: script === 'turkic' ? (dialect ?? 'canonical') : (dialect ?? 'canonical'),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.block}>
          <Text style={styles.heading}>Язык · Language · Dil</Text>
          <View style={styles.row}>
            {LANGUAGE_OPTIONS.map((option) => (
              <Segment key={option.code} value={option.code} selected={language === option.code} label={`${option.flag} ${option.label}`} onPress={setLanguage} />
            ))}
          </View>
        </View>

        {language ? (
          <View style={styles.block}>
            <Text style={styles.subheading}>{copy.script}</Text>
            <View style={styles.row}>
              <Segment value="cyrillic" selected={script === 'cyrillic'} label={copy.cyrillic} onPress={(value) => { setScript(value); }} />
              <Segment value="turkic" selected={script === 'turkic'} label="Latin" onPress={(value) => { setScript(value); setDialect((current) => current ?? 'canonical'); }} />
            </View>
          </View>
        ) : null}

        {script === 'cyrillic' ? (
          <View style={styles.block}>
            <Text style={styles.subheading}>{copy.dialect}</Text>
            <View style={styles.row}>
              <Segment value="canonical" selected={dialect === 'canonical'} label="Җ" onPress={setDialect} />
              <Segment value="karachay" selected={dialect === 'karachay'} label="Дж" onPress={setDialect} />
              <Segment value="balkar" selected={dialect === 'balkar'} label="Ж" onPress={setDialect} />
            </View>
          </View>
        ) : null}

        <View style={styles.previewCard}>
          <Text style={styles.previewWord}>{preview.word.charAt(0).toUpperCase() + preview.word.slice(1)}</Text>
          <View style={styles.previewPill}>
            <Text style={styles.previewTranslation}>{preview.translation}</Text>
            <Text style={styles.previewExample}>{preview.example}  ✦  {preview.exampleTranslation}</Text>
          </View>
        </View>

        <Pressable disabled={!complete || saving} onPress={finish} style={[styles.continueButton, (!complete || saving) && styles.continueDisabled]}>
          <Text style={styles.continueText}>{saving ? '…' : copy.continue}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 28, justifyContent: 'center', gap: 24 },
  block: { gap: 12 },
  heading: { color: theme.colors.text, fontSize: 26, fontWeight: '700', textAlign: 'center' },
  subheading: { color: theme.colors.text, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, minHeight: 44, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segmentSelected: { backgroundColor: theme.colors.accentStrong, borderColor: theme.colors.accentStrong },
  segmentText: { color: theme.colors.text, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  segmentTextSelected: { color: theme.colors.inverse },
  previewCard: { borderRadius: theme.radius.lg, backgroundColor: '#f2ede3', borderWidth: 1, borderColor: theme.colors.lineSoft, padding: 22, gap: 18 },
  previewWord: { color: theme.colors.text, fontSize: 34, fontWeight: '700', textAlign: 'center' },
  previewPill: { borderRadius: theme.radius.md, backgroundColor: 'rgba(255,255,255,0.34)', padding: 16, gap: 8 },
  previewTranslation: { color: theme.colors.text, fontSize: 16, textAlign: 'center' },
  previewExample: { color: theme.colors.textMuted, fontSize: 13, textAlign: 'center' },
  continueButton: { minHeight: 48, borderRadius: theme.radius.sm, backgroundColor: theme.colors.accentStrong, alignItems: 'center', justifyContent: 'center' },
  continueDisabled: { opacity: 0.32 },
  continueText: { color: theme.colors.inverse, fontSize: 16, fontWeight: '700' },
});
