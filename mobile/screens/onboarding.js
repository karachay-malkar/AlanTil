import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { completeLearningSetupSettings, emptyLearningSetupDraft, isLearningSetupDraftComplete } from '../../packages/alantil-core/settings.js';
import { LEARNING_SETUP_LANGUAGES, previewContent, setupText } from '../../packages/alantil-core/learning-setup.js';
import { msg } from '../i18n.js';
import { Button, InlineMessage, Screen } from '../ui/components.js';
import { CompactSegmentedControl, MonoLabel, SurfaceCard } from '../ui/parity.js';
import { Topography } from '../ui/topography.js';
import { theme } from '../ui/theme.js';

const C = theme.colors;

function capitalizeWord(value) {
  const text = String(value || '');
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : '';
}

export function OnboardingScreen({ initialSettings, onComplete }) {
  const [draft, setDraft] = useState(() => emptyLearningSetupDraft());
  const [error, setError] = useState('');
  const language = draft.interface_language_code || initialSettings?.interface_language_code || 'ru';
  const copy = setupText(language);
  const preview = useMemo(() => previewContent(draft), [draft]);
  const complete = isLearningSetupDraftComplete(draft);
  const localizedSettings = { ...initialSettings, interface_language_code: language };

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

  const languageOptions = LEARNING_SETUP_LANGUAGES.map((item) => [item.code, item.label]);
  const scriptOptions = [['cyrillic', copy.cyrillic], ['turkic', 'Latin']];
  const dialectOptions = [['canonical', 'Җ'], ['karachay', 'Дж'], ['balkar', 'Ж']];

  return <Screen><Topography opacity={0.22} /><ScrollView contentContainerStyle={styles.root} showsVerticalScrollIndicator={false}>
    <View style={styles.pane}>
      <View style={styles.heading}><MonoLabel>ALAN TIL</MonoLabel><Text style={styles.title}>{copy.title}</Text><Text style={styles.subtitle}>{copy.preview}</Text></View>
      {error ? <InlineMessage type="error">{error}</InlineMessage> : null}
      <View style={styles.step}><Text style={styles.stepTitle}>{msg(localizedSettings, 'mobile.onboarding.interface_language')}</Text><CompactSegmentedControl value={draft.interface_language_code} items={languageOptions} onChange={(value) => updateDraft({ interface_language_code: value, translation_language_code: value })} /></View>
      {draft.interface_language_code ? <View style={styles.step}><Text style={styles.stepTitle}>{copy.script}</Text><CompactSegmentedControl value={draft.alan_script_code} items={scriptOptions} onChange={(value) => updateDraft({ alan_script_code: value })} /></View> : null}
      {draft.alan_script_code === 'cyrillic' ? <View style={styles.step}><Text style={styles.stepTitle}>{copy.dialect}</Text><CompactSegmentedControl value={draft.alan_dialect_code} items={dialectOptions} onChange={(value) => updateDraft({ alan_dialect_code: value })} /></View> : null}
      <SurfaceCard inset style={styles.previewCard}><MonoLabel>{copy.preview}</MonoLabel><Text style={styles.previewWord}>{capitalizeWord(preview.word)}</Text><View style={styles.previewCopy}><Text style={styles.previewTranslation}>{preview.translation}</Text><Text style={styles.previewExample}>{preview.example}</Text><Text style={styles.previewExampleTranslation}>{preview.exampleTranslation}</Text></View></SurfaceCard>
      <Button primary style={styles.fullButton} disabled={!complete} onPress={continueSetup}>{copy.continue}</Button>
    </View>
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, minHeight: '100%', paddingTop: theme.control.header + theme.chrome.contentRestGap, paddingHorizontal: 14, paddingBottom: 24, justifyContent: 'center' },
  pane: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14 },
  heading: { alignItems: 'center', gap: 6, marginBottom: 2 },
  title: { fontSize: 20, fontWeight: '850', lineHeight: 24, color: C.text1, textAlign: 'center' },
  subtitle: { fontSize: 11, lineHeight: 15, color: C.text3, textAlign: 'center' },
  step: { gap: 7 },
  stepTitle: { fontSize: 13, fontWeight: '850', lineHeight: 16, color: C.text2 },
  previewCard: { minHeight: 220, maxHeight: 300, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24, gap: 12 },
  previewWord: { fontSize: 36, fontWeight: '900', lineHeight: 40, color: C.text1, textAlign: 'center' },
  previewCopy: { width: '92%', alignItems: 'center', gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.lineSoft },
  previewTranslation: { fontSize: 14, fontWeight: '800', color: C.text2, textAlign: 'center' },
  previewExample: { marginTop: 4, fontSize: 11, lineHeight: 16, color: C.text2, textAlign: 'center' },
  previewExampleTranslation: { fontSize: 10, lineHeight: 15, color: C.text3, textAlign: 'center' },
  fullButton: { width: '100%' },
});
