import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stationTestDistractors, stationTestMasteryLevel, stationTestResult } from '../../../../packages/alantil-core/station-test.js';
import { loadAllWords } from '@/src/mobile/dictionary';
import { createActivitySession, completeActivitySession, interruptActivitySession, persistActivitySession, resumeActivitySession, type ActivityRuntime } from '@/src/mobile/activity-session';
import { AlanIcon } from '@/src/mobile/icons';
import { useI18n } from '@/src/mobile/i18n';
import { loadFavoriteIds, setFavorite } from '@/src/mobile/practice/repository';
import { shuffle, toPracticeWord, type PracticeWord } from '@/src/mobile/practice/selection';
import { recordLocalStationTest } from '@/src/mobile/progress/guest';
import { recordStationTest, REQUIRED_ACCURACY, stationTestPhase, type StationDescriptor } from '@/src/mobile/progress/station';
import { useSession } from '@/src/mobile/session';
import { useSettings } from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';
import { scopedTestId, testIds } from '@/src/mobile/test-ids';
import { AppText as Text } from '@/src/mobile/typography';
import { useSessionExitGuard } from '@/src/mobile/use-session-exit';

type Answer = { word_id: string; result: 'correct' | 'wrong'; wrong_word_id: string | null };
type State = { ids: string[]; index: number; answers: Answer[]; direction: 'alan_ru' | 'ru_alan'; phase: string };

function stationFrom(params: Record<string, string | string[] | undefined>): StationDescriptor | null {
  const v = (key: string) => String(params[key] ?? '').trim();
  const station = { storyId: v('storyId'), dictionaryId: v('dictionaryId'), sectionId: v('sectionId'), setId: v('setId') };
  return Object.values(station).every(Boolean) ? station : null;
}

function optionsFor(item: PracticeWord, all: PracticeWord[]) {
  return shuffle([item, ...stationTestDistractors(item, all, 3)]);
}

export default function StationTestScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ source?: string; storyId?: string; dictionaryId?: string; sectionId?: string; setId?: string; direction?: string }>();
  const station = stationFrom(params);
  const auth = useSession();
  const { settings } = useSettings();
  const { t } = useI18n();
  const [runtime, setRuntime] = useState<ActivityRuntime | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [all, setAll] = useState<PracticeWord[]>([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ answers: Answer[]; accuracy: number; passed: boolean } | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        if (!station) throw new Error(t('stage.not_found'));
        const raw = await loadAllWords();
        const words = raw.map((word) => toPracticeWord(word, settings)).filter((word): word is PracticeWord => Boolean(word));
        const pool = words.filter((word) => word.dictionary_id === station.dictionaryId && word.section_id === station.sectionId && word.set_id === station.setId);
        if (!pool.length) throw new Error(t('station_test.no_words'));
        const phase = await stationTestPhase(station, auth.user?.id);
        const resumed = await resumeActivitySession<State>('station_test', auth.user?.id);
        const validIds = new Set(pool.map((word) => word.id));
        const canResume = Boolean(resumed?.payload?.ids?.length && resumed.payload.ids.every((id) => validIds.has(id)));
        const runtimeNext = canResume && resumed ? resumed.runtime : await createActivitySession('station_test', settings, auth.user?.id);
        const stateNext: State = canResume && resumed ? resumed.payload : {
          ids: shuffle(pool.map((word) => word.id)), index: 0, answers: [], direction: String(params.direction ?? 'alan_ru') === 'ru_alan' ? 'ru_alan' : 'alan_ru', phase,
        };
        if (!active) return;
        const favoriteIds = await loadFavoriteIds(auth.user?.id);
        if (!active) return;
        setFavorites(favoriteIds); setAll(words); setRuntime(runtimeNext); setState(stateNext); setBusy(false);
      } catch (reason) {
        if (active) { setError(String((reason as { message?: string })?.message ?? reason)); setBusy(false); }
      }
    }
    void boot();
    return () => { active = false; };
  }, [auth.user?.id, params.direction, settings.interface_language_code, settings.translation_language_code, settings.alan_script_code, settings.alan_dialect_code, t]);

  const map = useMemo(() => new Map(all.map((word) => [word.id, word])), [all]);
  const item = state ? map.get(state.ids[state.index]) : null;
  const options = useMemo(() => item ? optionsFor(item, all) : [], [item?.id, all]);

  const payloadFor = useCallback((value: State) => {
    if (!station) return {};
    const correctTotal = value.answers.filter((entry) => entry.result === 'correct').length;
    const testResult = stationTestResult(value.answers, REQUIRED_ACCURACY, value.answers.length);
    return {
      dictionary_id: station.dictionaryId, catalog_id: station.dictionaryId, group_id: station.sectionId, section_id: station.sectionId, set_id: station.setId,
      story_type: station.storyId, phase: value.phase, questions_total: value.answers.length, correct_total: correctTotal, wrong_total: value.answers.length - correctTotal,
      accuracy: testResult.accuracy, required_accuracy: REQUIRED_ACCURACY, words: value.answers, direction: value.direction === 'ru_alan' ? 'ru_to_alan' : 'alan_to_translation',
    };
  }, [station?.storyId, station?.dictionaryId, station?.sectionId, station?.setId]);

  const requestLeave = useSessionExitGuard(Boolean(runtime && state && !result), useCallback(async (reason: string) => {
    if (!runtime || !state) return;
    await interruptActivitySession(runtime, payloadFor(state), reason);
  }, [runtime, state, payloadFor]));

  async function submit() {
    if (!state || !runtime || !station || !item || !selected) return;
    const correct = selected === item.id;
    const answer: Answer = { word_id: item.id, result: correct ? 'correct' : 'wrong', wrong_word_id: correct ? null : selected };
    const next = { ...state, index: state.index + 1, answers: [...state.answers, answer] };
    setSelected(''); setState(next);
    await persistActivitySession(runtime, next);
    if (next.index < next.ids.length) return;
    setBusy(true);
    const payload = payloadFor(next);
    const finalResult = stationTestResult(next.answers, REQUIRED_ACCURACY, next.ids.length);
    const accuracy = finalResult.accuracy;
    const passed = finalResult.passed;
    let endedAt = new Date().toISOString();
    const warnings: string[] = [];
    try {
      const final = await completeActivitySession(runtime, payload);
      endedAt = String(final.ended_at || endedAt);
    } catch {
      warnings.push(t('station_test.session_save_error'));
    }
    try {
      await recordLocalStationTest(next.answers, passed, endedAt, auth.user?.id);
    } catch {
      warnings.push(t('station_test.progress_save_error'));
    }
    try {
      await recordStationTest(station, auth.user?.id, accuracy, passed, next.phase, endedAt);
    } catch {
      warnings.push(t('station_test.stage_save_error'));
    }
    setNotice(warnings.join(' '));
    setResult({ answers: next.answers, accuracy, passed });
    setBusy(false);
  }

  const toggleFavorite = (wordId: string) => {
    const active = !favorites.has(wordId);
    setFavorites((current) => {
      const next = new Set(current);
      if (active) next.add(wordId); else next.delete(wordId);
      return next;
    });
    void setFavorite(auth.user?.id, wordId, active).catch(() => {
      void loadFavoriteIds(auth.user?.id).then(setFavorites);
      setNotice(t('learn.favorite_error'));
    });
  };

  if (result && station) {
    const map = new Map(all.map((word) => [word.id, word]));
    const level = stationTestMasteryLevel(result.accuracy);
    const returnToStation = () => router.replace({ pathname: '/path/station', params: { key: [station.storyId, station.dictionaryId, station.sectionId, station.setId].join('::') } });
    const repeat = async () => {
      setResult(null); setBusy(true);
      const phase = await stationTestPhase(station, auth.user?.id);
      const nextRuntime = await createActivitySession('station_test', settings, auth.user?.id);
      setRuntime(nextRuntime); setState({ ids: shuffle(result.answers.map((answer) => answer.word_id)), index: 0, answers: [], direction: state?.direction ?? 'alan_ru', phase }); setBusy(false);
    };
    return <View testID={testIds.stationTest.result} style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 8) }]}>
      <Text style={styles.resultTitle}>{t('station_test.result_title')}</Text><Text style={styles.resultMark}>{level ? '⌃'.repeat(level) : '—'}</Text><Text style={styles.resultPercent}>{result.accuracy}%</Text><Text style={styles.resultSubtitle}>{result.passed ? t('station_test.passed') : t('station_test.threshold', { percent: REQUIRED_ACCURACY })}</Text>
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      <ScrollView style={styles.resultList}>{result.answers.map((answer) => { const word = map.get(answer.word_id); const wrong = answer.wrong_word_id ? map.get(answer.wrong_word_id) : null; if (!word) return null; const correct = state?.direction === 'ru_alan' ? word.word : word.trans; const chosen = wrong ? (state?.direction === 'ru_alan' ? wrong.word : wrong.trans) : correct; const favorite = favorites.has(word.id); return <View key={answer.word_id} style={styles.resultRow}><View style={styles.resultStatus}><Text style={[styles.resultStatusText, answer.result === 'wrong' && styles.resultWrong]}>{answer.result === 'correct' ? '✓' : '×'}</Text></View><View style={styles.resultCopy}><Text style={styles.resultQuestion}>{state?.direction === 'ru_alan' ? word.trans : word.word}</Text>{answer.result === 'wrong' ? <Text style={styles.resultWrong}>{t('station_test.answer')}: {chosen}</Text> : null}<Text style={styles.resultCorrect}>{t('station_test.correct')}: {correct}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={favorite ? t('learn.remove_favorite', { word: word.word }) : t('learn.add_favorite', { word: word.word })} accessibilityState={{ selected: favorite }} testID={scopedTestId('station-test.favorite', word.id)} onPress={() => toggleFavorite(word.id)} style={({ pressed }) => [styles.starButton, pressed && styles.pressed]}><Text style={[styles.star, favorite && styles.starOn]}>★</Text></Pressable></View>; })}</ScrollView>
      <View style={styles.resultActions}><Pressable accessibilityRole="button" testID={testIds.stationTest.backToStation} onPress={returnToStation} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><Text style={styles.secondaryText}>{t('learn.to_stage').toUpperCase()}</Text></Pressable>{!result.passed ? <Pressable accessibilityRole="button" testID={testIds.stationTest.retry} onPress={() => { void repeat(); }} style={({ pressed }) => [styles.submit, pressed && styles.pressed]}><Text style={styles.submitText}>{t('common.retry').toUpperCase()}</Text></Pressable> : null}</View>
    </View>;
  }
  if (busy) return <View style={styles.center}><ActivityIndicator color={theme.colors.accentStrong} /></View>;
  if (error || !state || !runtime || !item) return <View style={styles.center}><Text accessibilityRole="alert" style={styles.error}>{error || t('station_test.finished')}</Text></View>;
  const question = state.direction === 'ru_alan' ? item.trans : item.word;
  return <View testID={testIds.stationTest.screen} style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 8) }]}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => requestLeave('header_back')} style={styles.backButton}><AlanIcon color={theme.colors.textMuted} name="back" size={22} /></Pressable><Text style={styles.title}>{t('station_test.title')}</Text><Text style={styles.counter}>{state.index + 1}/{state.ids.length}</Text></View>
    <View style={styles.body}><Text style={styles.question}>{question}</Text><View style={styles.options}>{options.map((option) => {
      const label = state.direction === 'ru_alan' ? option.word : option.trans;
      return <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: selected === option.id }} testID={scopedTestId('station-test.answer', option.id)} onPress={() => setSelected(option.id)} style={({ pressed }) => [styles.option, selected === option.id && styles.optionOn, pressed && styles.pressed]}><Text style={styles.optionText}>{label}</Text></Pressable>;
    })}</View></View>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !selected }} testID={testIds.stationTest.submit} disabled={!selected} onPress={() => { void submit(); }} style={({ pressed }) => [styles.submit, !selected && styles.disabled, pressed && styles.pressed]}><Text style={styles.submitText}>{t('station_test.submit').toUpperCase()}</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 16 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background, padding: 24 }, error: { color: theme.colors.danger, textAlign: 'center' },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, back: { fontSize: 32, color: theme.colors.textMuted }, title: { fontSize: 16, fontWeight: '800', color: theme.colors.text }, counter: { width: 44, textAlign: 'right', fontSize: 11, color: theme.colors.textMuted, fontWeight: '700', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
  body: { flex: 1, justifyContent: 'center' }, question: { fontSize: 30, lineHeight: 38, fontWeight: '900', color: theme.colors.text, textAlign: 'center', marginBottom: 28 }, options: { gap: 10 }, option: { minHeight: 54, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 14, backgroundColor: theme.colors.surface }, optionOn: { borderColor: theme.colors.accentStrong, backgroundColor: 'rgba(139,107,59,0.10)' }, optionText: { color: theme.colors.text, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  submit: { minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentStrong }, disabled: { opacity: 0.4 }, pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] }, submitText: { color: theme.colors.inverse, fontSize: 11, fontWeight: '800' },
  resultTitle: { marginTop: 22, color: theme.colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' }, resultMark: { marginTop: 10, color: theme.colors.accentStrong, fontSize: 14, fontWeight: '900', textAlign: 'center' }, resultPercent: { color: theme.colors.text, fontSize: 36, fontWeight: '900', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'], textAlign: 'center' }, resultSubtitle: { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 8 }, notice: { color: theme.colors.danger, fontSize: 10, lineHeight: 15, textAlign: 'center', marginBottom: 8 }, resultList: { flex: 1, borderTopWidth: 1, borderTopColor: theme.colors.lineSoft }, resultRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft, paddingVertical: 8 }, resultStatus: { width: 30 }, resultStatusText: { color: theme.colors.success, fontSize: 18, fontWeight: '900' }, resultCopy: { flex: 1 }, resultQuestion: { color: theme.colors.text, fontSize: 14, fontWeight: '800' }, resultWrong: { color: theme.colors.danger, fontSize: 11, marginTop: 2 }, resultCorrect: { color: theme.colors.success, fontSize: 11, marginTop: 2 }, starButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, star: { color: theme.colors.textSoft, fontSize: 21 }, starOn: { color: theme.colors.accentStrong }, resultActions: { flexDirection: 'row', gap: 10, paddingTop: 10 }, secondary: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: theme.colors.text, fontSize: 11, fontWeight: '800' },
});