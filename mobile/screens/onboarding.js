import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { completeLearningSetupSettings, emptyLearningSetupDraft, isLearningSetupDraftComplete } from '../../packages/alantil-core/settings.js';
import { LEARNING_SETUP_LANGUAGES, previewContent, setupText } from '../../packages/alantil-core/learning-setup.js';
import { Button } from '../ui/components.js';
import { theme } from '../ui/theme.js';

const C = theme.colors;

function Flag({ language }) {
  if (language === 'ru') return <View style={styles.flag}><View style={styles.flagStripeWhite}/><View style={styles.flagStripeBlue}/><View style={styles.flagStripeRed}/></View>;
  if (language === 'tr') return <View style={[styles.flag, styles.flagTurkey]}><Text style={styles.flagTurkeyMark}>☾</Text></View>;
  return <View style={[styles.flag, styles.flagEnglish]}><Text style={styles.flagEnglishMark}>✚</Text></View>;
}

function Segment({ value, options, onChange }) {
  return <View style={styles.segment}>{options.map(({ id, label, flag }) => <Pressable key={id} onPress={() => onChange(id)} style={[styles.segmentItem, value === id && styles.segmentActive]}>{flag ? <Flag language={id}/> : null}<Text style={[styles.segmentText, value === id && styles.segmentTextActive]}>{label}</Text></Pressable>)}</View>;
}

function capitalizeWord(value) {
  const text = String(value || '');
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : '';
}

export function OnboardingScreen({ initialSettings, onComplete }) {
  const [draft, setDraft] = useState(() => emptyLearningSetupDraft());
  const [error, setError] = useState('');
  const copy = setupText(draft.interface_language_code || 'ru');
  const preview = useMemo(() => previewContent(draft), [draft]);
  const complete = isLearningSetupDraftComplete(draft);

  const updateDraft = (updates) => {
    setDraft((current) => ({ ...current, ...updates }));
    setError('');
  };

  const continueSetup = async () => {
    if (!complete) return;
    const next = completeLearningSetupSettings(initialSettings, {
      ...draft,
      translation_language_code: draft.interface_language_code,
      alan_dialect_code: draft.alan_script_code === 'turkic'
        ? (draft.alan_dialect_code || 'canonical')
        : draft.alan_dialect_code,
    });
    try {
      await onComplete?.(next);
    } catch {
      setError(copy.storageError);
    }
  };

  const languageOptions = LEARNING_SETUP_LANGUAGES.map((item) => ({ id: item.code, label: item.label, flag: true }));
  const scriptOptions = [
    { id: 'cyrillic', label: copy.cyrillic },
    { id: 'turkic', label: 'Latin' },
  ];
  const dialectOptions = [
    { id: 'canonical', label: 'Җ' },
    { id: 'karachay', label: 'Дж' },
    { id: 'balkar', label: 'Ж' },
  ];

  return <ScrollView contentContainerStyle={styles.root} showsVerticalScrollIndicator={false}>
    <View style={styles.pane}>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.step}>
        <Text style={styles.title}>Язык · Language · Dil</Text>
        <Segment value={draft.interface_language_code} options={languageOptions} onChange={(value) => updateDraft({ interface_language_code: value, translation_language_code: value })}/>
      </View>
      {draft.interface_language_code ? <View style={styles.step}>
        <Text style={styles.stepTitle}>{copy.script}</Text>
        <Segment value={draft.alan_script_code} options={scriptOptions} onChange={(value) => updateDraft({ alan_script_code: value })}/>
      </View> : null}
      {draft.alan_script_code === 'cyrillic' ? <View style={styles.step}>
        <Text style={styles.stepTitle}>{copy.dialect}</Text>
        <Segment value={draft.alan_dialect_code} options={dialectOptions} onChange={(value) => updateDraft({ alan_dialect_code: value })}/>
      </View> : null}
      <View accessible accessibilityLabel={copy.preview} style={styles.previewCard}>
        <View style={styles.previewInset}/>
        <Text style={styles.previewWord}>{capitalizeWord(preview.word)}</Text>
        <View style={styles.previewPill}>
          <Text style={styles.previewTranslation}>{preview.translation}</Text>
          <Text style={styles.previewExample}>{preview.example} ✦ {preview.exampleTranslation}</Text>
        </View>
      </View>
      <Button primary style={styles.fullButton} disabled={!complete} onPress={continueSetup}>{copy.continue}</Button>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, minHeight: '100%', backgroundColor: C.appBg, paddingHorizontal: 14, paddingVertical: 24, justifyContent: 'center' },
  pane: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14 },
  step: { gap: 7 },
  title: { fontSize: 20, fontWeight: '850', lineHeight: 24, color: C.text1, textAlign: 'center' },
  stepTitle: { fontSize: 13, fontWeight: '800', lineHeight: 16, color: C.text2 },
  segment: { width: '100%', minHeight: 38, padding: 2, borderWidth: 1, borderColor: C.line, borderRadius: 999, flexDirection: 'row' },
  segmentItem: { flex: 1, minHeight: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, flexDirection: 'row', gap: 6 },
  segmentActive: { backgroundColor: 'rgba(246,242,233,.84)' },
  segmentText: { fontSize: 10, fontWeight: '700', color: C.text3 },
  segmentTextActive: { color: C.text1 },
  flag: { width: 18, height: 12, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(0,0,0,.12)' },
  flagStripeWhite: { flex: 1, backgroundColor: '#fff' },
  flagStripeBlue: { flex: 1, backgroundColor: '#1c57a7' },
  flagStripeRed: { flex: 1, backgroundColor: '#d52b1e' },
  flagTurkey: { backgroundColor: '#e30a17', alignItems: 'center', justifyContent: 'center' },
  flagTurkeyMark: { color: '#fff', fontSize: 10, lineHeight: 10 },
  flagEnglish: { backgroundColor: '#21468b', alignItems: 'center', justifyContent: 'center' },
  flagEnglishMark: { color: '#fff', fontSize: 9, lineHeight: 9 },
  previewCard: { width: '100%', minHeight: 240, borderWidth: 1, borderColor: C.line, borderRadius: theme.radius.lg, backgroundColor: C.surface0, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', paddingHorizontal: 22 },
  previewInset: { position: 'absolute', top: 10, left: 10, right: 10, bottom: 10, borderWidth: 1, borderColor: C.lineSoft, borderRadius: theme.radius.lg - 7 },
  previewWord: { fontSize: 36, fontWeight: '900', color: C.text1, textAlign: 'center' },
  previewPill: { marginTop: 16, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: C.lineSoft, borderRadius: 999, backgroundColor: 'rgba(246,242,233,.55)', maxWidth: '92%' },
  previewTranslation: { fontSize: 13, fontWeight: '700', color: C.text2, textAlign: 'center' },
  previewExample: { fontSize: 10, lineHeight: 15, color: C.text3, textAlign: 'center', marginTop: 5 },
  fullButton: { width: '100%' },
  error: { fontSize: 12, lineHeight: 17, color: C.danger, textAlign: 'center' },
});
