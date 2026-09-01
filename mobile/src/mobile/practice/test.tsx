import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/src/mobile/theme';
import { useI18n } from '@/src/mobile/i18n';
import { OverflowMarquee } from '@/src/mobile/overflow-marquee';
import { useSession } from '@/src/mobile/session';
import { useSettings } from '@/src/mobile/settings';
import { PracticeHeader, PracticeScreen, PrimaryButton, ScopeSelector, Segment, commonStyles } from '@/src/mobile/practice/common';
import { buildScope, buildSelectedSources, buildTestOptions, buildTestWords, scopeKey, shuffle, type PracticeWord } from '@/src/mobile/practice/selection';
import { createSessionRuntime, finalizeSession, loadFavoriteIds, loadPracticeWords, persistActiveSession, resumeSessionRuntime, setFavorite } from '@/src/mobile/practice/repository';
import { getTestSession, setTestSession, type TestMode, type TestResult, type TestSessionState } from '@/src/mobile/practice/state';
import { useSessionExitGuard } from '@/src/mobile/use-session-exit';
import { scopedTestId, testIds } from '@/src/mobile/test-ids';
import { AppText as Text } from '@/src/mobile/typography';

const LIMITS = [20, 40, 80] as const;

function optionsFor(item: PracticeWord, optionPool: PracticeWord[], mode: TestMode) {
  return buildTestOptions(item, optionPool, mode, 4);
}

function sessionPayload(session = getTestSession()) {
  if (!session) return {};
  return {
    selected_sources: session.selectedSources,
    direction: session.mode === 'kb' ? 'alan_to_translation' : 'translation_to_alan',
    questions_planned: session.items.length,
    questions_answered: session.results.length,
    correct_total: session.results.filter((result) => result.isCorrect).length,
    wrong_total: session.results.filter((result) => !result.isCorrect).length,
    words: session.results.map((result) => ({
      word_id: result.id,
      result: result.isCorrect ? 'correct' : 'wrong',
      wrong_word_id: result.isCorrect ? null : result.wrongWordId,
    })),
    session_snapshot: {
      mode: session.mode,
      limit: session.limit,
      item_ids: session.items.map((item) => item.id),
      option_pool_ids: session.optionPool.map((item) => item.id),
      index: session.index,
      correct: session.correct,
      results: session.results,
      selected_sources: session.selectedSources,
    },
  };
}

async function restoreTestSession(settings: ReturnType<typeof useSettings>['settings'], userId?: string | null) {
  const resumed = await resumeSessionRuntime('test', userId);
  const snapshot = resumed?.payload?.session_snapshot as Record<string, unknown> | undefined;
  if (!resumed || !snapshot) return null;
  const words = await loadPracticeWords(settings);
  const byId = new Map(words.map((word) => [word.id, word]));
  const items = (Array.isArray(snapshot.item_ids) ? snapshot.item_ids : []).map((wordId) => byId.get(String(wordId))).filter((word): word is PracticeWord => Boolean(word));
  const optionPool = (Array.isArray(snapshot.option_pool_ids) ? snapshot.option_pool_ids : []).map((wordId) => byId.get(String(wordId))).filter((word): word is PracticeWord => Boolean(word));
  if (!items.length || Number(snapshot.index || 0) >= items.length) return null;
  const restored = {
    runtime: resumed.runtime,
    mode: snapshot.mode === 'ru' ? 'ru' as const : 'kb' as const,
    limit: Number(snapshot.limit || items.length),
    items,
    optionPool: optionPool.length ? optionPool : words,
    index: Math.max(0, Number(snapshot.index || 0)),
    correct: Math.max(0, Number(snapshot.correct || 0)),
    results: Array.isArray(snapshot.results) ? snapshot.results as TestResult[] : [],
    selectedSources: Array.isArray(snapshot.selected_sources) ? snapshot.selected_sources as { dictionary_id: string; section_ids: string[] }[] : [],
  };
  setTestSession(restored);
  return restored;
}

export function TestMenuScreen() {
  const { settings } = useSettings();
  const { t } = useI18n();
  const session = useSession();
  const [words, setWords] = useState<PracticeWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<TestMode>('kb');
  const [limit, setLimit] = useState<(typeof LIMITS)[number]>(40);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadPracticeWords(settings).then((rows) => {
      if (!active) return;
      setWords(rows);
      setSelected(new Set(rows.map((word) => scopeKey(word.dictionary_id, word.section_id))));
    }).catch((reason) => {
      if (active) setError(String((reason as { message?: string })?.message ?? reason));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [settings.interface_language_code, settings.translation_language_code, settings.alan_script_code, settings.alan_dialect_code]);

  const scope = useMemo(() => buildScope(words), [words]);
  const pool = useMemo(() => words.filter((word) => selected.has(scopeKey(word.dictionary_id, word.section_id))), [words, selected]);
  const effectiveCount = Math.min(limit, pool.length);

  const toggle = (key: string, active: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (active) next.add(key); else next.delete(key);
      return next;
    });
  };

  const launch = async () => {
    if (!pool.length || starting) return;
    setStarting(true);
    try {
      const built = buildTestWords(pool, limit);
      if (!built.items.length) throw new Error(t('test.not_enough_words'));
      const runtime = await createSessionRuntime('test', settings, session.user?.id);
      setTestSession({
        runtime,
        mode,
        limit,
        items: built.items,
        optionPool: words,
        index: 0,
        correct: 0,
        results: [],
        selectedSources: buildSelectedSources(pool),
      });
      await persistActiveSession(runtime, sessionPayload());
      router.push('/practice/test/session');
    } catch (reason) {
      setError(String((reason as { message?: string })?.message ?? reason));
    } finally {
      setStarting(false);
    }
  };

  return (
    <PracticeScreen
      testID={testIds.generalTest.menu}
      header={<PracticeHeader title={t('test.title')} />}
      footer={
        <View style={styles.footerStack}>
          <View style={styles.directionRow}>
            <Text style={styles.directionLabel}>{t('favorites.direction')}</Text>
            <Segment testID="general-test.direction" values={[t('favorites.alan_translation'), t('favorites.translation_alan')] as const} value={mode === 'kb' ? t('favorites.alan_translation') : t('favorites.translation_alan')} onChange={(value) => setMode(value === t('favorites.alan_translation') ? 'kb' : 'ru')} />
          </View>
          <PrimaryButton testID={testIds.generalTest.start} title={t('test.start')} loading={starting} disabled={!pool.length} onPress={() => { void launch(); }} />
        </View>
      }
    >
      {loading ? <ActivityIndicator color={theme.colors.accentStrong} style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading ? (
        <>
          <View style={commonStyles.lead}>
            <Text style={commonStyles.leadStrong}>{t('test.selection_summary', { selected: pool.length, count: effectiveCount })}</Text>
            <Text style={commonStyles.leadMuted}>{t('test.selection_help')}</Text>
          </View>
          <ScopeSelector scope={scope} selected={selected} onToggle={toggle} />
          <Text style={commonStyles.sectionLabel}>{t('test.word_count')}</Text>
          <Segment testID="general-test.limit" values={[...LIMITS]} value={limit} onChange={setLimit} />
        </>
      ) : null}
    </PracticeScreen>
  );
}

export function TestSessionScreen() {
  const auth = useSession();
  const { settings } = useSettings();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [version, setVersion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [completionPending, setCompletionPending] = useState(false);
  const session = getTestSession();
  const item = session?.items[session.index];
  const options = useMemo(() => item && session ? optionsFor(item, session.optionPool, session.mode) : [], [session?.index, item?.id]);

  const requestLeave = useSessionExitGuard(Boolean(session), useCallback(async (reason: string) => {
    const current = getTestSession();
    if (!current) return;
    await finalizeSession(current.runtime, sessionPayload(current), 'interrupted', reason);
    setTestSession(null);
  }, []));

  useEffect(() => {
    if (session) return;
    let active = true;
    void restoreTestSession(settings, auth.user?.id).then((restored) => {
      if (!active) return;
      if (restored) setVersion((value) => value + 1); else router.replace('/practice/test');
    });
    return () => { active = false; };
  }, [session, auth.user?.id]);

  const finalizeCompletedTest = async (current: TestSessionState) => {
    setBusy(true);
    setSaveError('');
    try {
      await finalizeSession(current.runtime, sessionPayload(current), 'completed');
      router.replace('/practice/test/results');
    } catch {
      setCompletionPending(true);
      setSaveError(t('test.save_error'));
      setBusy(false);
    }
  };

  if (!session) return <View style={styles.fullLoader}><ActivityIndicator color={theme.colors.accentStrong} /></View>;
  if (completionPending || session.index >= session.items.length) return <View style={styles.fullLoader}>
    {busy ? <ActivityIndicator color={theme.colors.accentStrong} /> : <>
      <Text accessibilityRole="alert" style={styles.errorCentered}>{saveError || t('test.save_error')}</Text>
      <Pressable accessibilityRole="button" onPress={() => { void finalizeCompletedTest(session); }} style={styles.retryButton}><Text style={styles.retryText}>{t('common.retry').toUpperCase()}</Text></Pressable>
    </>}
  </View>;
  if (!item) return <View style={styles.fullLoader}><ActivityIndicator color={theme.colors.accentStrong} /></View>;
  const question = session.mode === 'kb' ? item.word : item.trans;

  const answer = async () => {
    if (!selectedAnswer || busy) return;
    setBusy(true);
    setSaveError('');
    const current = getTestSession();
    if (!current) { setBusy(false); return; }
    const currentItem = current.items[current.index];
    const correctAnswer = current.mode === 'kb' ? currentItem.trans : currentItem.word;
    const questionText = current.mode === 'kb' ? currentItem.word : currentItem.trans;
    const isCorrect = selectedAnswer.id === currentItem.id;
    const result: TestResult = {
      id: currentItem.id,
      questionText,
      word: currentItem.word,
      trans: currentItem.trans,
      correctAnswer,
      userAnswer: selectedAnswer.text,
      wrongWordId: isCorrect ? null : selectedAnswer.id,
      isCorrect,
    };
    const next: TestSessionState = {
      ...current,
      correct: current.correct + (isCorrect ? 1 : 0),
      results: [...current.results, result],
      index: current.index + 1,
    };
    try {
      await persistActiveSession(next.runtime, sessionPayload(next));
    } catch {
      setSaveError(t('test.save_error'));
      setBusy(false);
      return;
    }
    setTestSession(next);
    setSelectedAnswer(null);
    if (next.index >= next.items.length) {
      setCompletionPending(true);
      await finalizeCompletedTest(next);
      return;
    }
    setBusy(false);
    setVersion((value) => value + 1);
  };

  return (
    <View key={version} testID={testIds.generalTest.session} style={styles.sessionScreen}>
      <PracticeHeader title={t('test.title')} subtitle={`${session.index + 1}/${session.items.length}`} onBack={() => requestLeave('header_back')} />
      <View style={styles.questionArea}><OverflowMarquee style={styles.question}>{question}</OverflowMarquee></View>
      <View style={styles.options}>
        {options.map((option) => {
          const active = selectedAnswer?.id === option.id;
          return (
            <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: active, disabled: busy }} testID={scopedTestId('general-test.answer', option.id)} disabled={busy} onPress={() => setSelectedAnswer(option)} style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.pressed]}>
              <OverflowMarquee style={[styles.optionText, active && styles.optionTextActive]}>{option.text}</OverflowMarquee>
            </Pressable>
          );
        })}
      </View>
      {saveError ? <Text accessibilityRole="alert" style={styles.sessionError}>{saveError}</Text> : null}
      <View style={[styles.sessionFooter, { bottom: Math.max(insets.bottom, 8) }]}><PrimaryButton testID={testIds.generalTest.submit} title={t('station_test.submit')} loading={busy} disabled={!selectedAnswer} onPress={() => { void answer(); }} /></View>
    </View>
  );
}

export function TestResultsScreen() {
  const sessionAuth = useSession();
  const { settings } = useSettings();
  const { t } = useI18n();
  const test = getTestSession();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    void loadFavoriteIds(sessionAuth.user?.id).then(setFavorites);
    if (!test) router.replace('/practice/test');
  }, [sessionAuth.user?.id]);

  if (!test) return <View style={styles.fullLoader}><ActivityIndicator color={theme.colors.accentStrong} /></View>;
  const percentage = Math.round((test.correct / Math.max(1, test.items.length)) * 100);
  const level = percentage >= 100 ? 3 : percentage >= 90 ? 2 : percentage >= 80 ? 1 : 0;

  const restart = async () => {
    if (restarting) return;
    setRestarting(true);
    setError('');
    try {
      const runtime = await createSessionRuntime('test', settings, sessionAuth.user?.id);
      const next = { ...test, runtime, items: shuffle(test.items.slice()), index: 0, correct: 0, results: [] };
      setTestSession(next);
      await persistActiveSession(runtime, sessionPayload(next));
      router.replace('/practice/test/session');
    } catch {
      setError(t('test.restart_error'));
      setRestarting(false);
    }
  };

  const toggleFavorite = async (wordId: string) => {
    if (busyId) return;
    setBusyId(wordId);
    const active = !favorites.has(wordId);
    try {
      await setFavorite(sessionAuth.user?.id, wordId, active);
      setFavorites((current) => {
        const next = new Set(current);
        if (active) next.add(wordId); else next.delete(wordId);
        return next;
      });
    } catch {
      setError(t('statistics.favorite_error'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <PracticeScreen
      testID={testIds.generalTest.result}
      header={<PracticeHeader title={t('test.results')} />}
      footer={
        <View style={styles.footerStack}>
          <PrimaryButton testID={testIds.generalTest.again} title={t('test.again')} loading={restarting} onPress={() => { void restart(); }} />
          <PrimaryButton testID={'general-test.to-practice'} title={t('tabs.practice')} onPress={() => { setTestSession(null); router.replace('/practice'); }} />
        </View>
      }
    >
      <View style={styles.resultHero}>
        <Text style={styles.resultPercentage}>{percentage}%</Text>
        <Text style={styles.resultCount}>{`${test.correct}/${test.items.length}`}</Text>
        {level > 0 ? <Text style={styles.resultLevel}>{'I'.repeat(level)}</Text> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.resultsList}>
        {test.results.map((result) => (
          <View key={`${result.id}-${result.questionText}`} style={styles.resultRow}>
            <View style={styles.resultCopy}>
              <OverflowMarquee style={styles.resultWord}>{result.word}</OverflowMarquee>
              <OverflowMarquee style={styles.resultTranslation}>{result.trans}</OverflowMarquee>
              {!result.isCorrect ? <OverflowMarquee style={styles.resultWrong}>{`${t('station_test.answer')}: ${result.userAnswer}`}</OverflowMarquee> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={favorites.has(result.id) ? t('statistics.remove_favorite') : t('statistics.add_favorite')} disabled={busyId === result.id} onPress={() => { void toggleFavorite(result.id); }} style={({ pressed }) => [styles.favoriteButton, pressed && styles.pressed]}>
              <Text style={[styles.favoriteGlyph, favorites.has(result.id) && styles.favoriteGlyphActive]}>{favorites.has(result.id) ? '★' : '☆'}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </PracticeScreen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 40 },
  error: { color: theme.colors.danger, textAlign: 'center', marginVertical: 12, fontSize: 13 },
  footerStack: { gap: 8 },
  directionRow: { gap: 8 },
  directionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase', color: theme.colors.textSoft },
  sessionScreen: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 14 },
  fullLoader: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorCentered: { color: theme.colors.danger, textAlign: 'center' },
  retryButton: { minHeight: 42, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  retryText: { fontSize: 11, fontWeight: '900', color: theme.colors.text },
  questionArea: { minHeight: 128, justifyContent: 'center', alignItems: 'center' },
  question: { fontSize: 28, fontWeight: '800', color: theme.colors.text, textAlign: 'center' },
  options: { gap: 10 },
  option: { minHeight: 56, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 13, backgroundColor: theme.colors.surface, justifyContent: 'center', paddingHorizontal: 14 },
  optionActive: { borderColor: theme.colors.accentStrong, backgroundColor: theme.colors.surface2 },
  optionText: { fontSize: 16, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  optionTextActive: { color: theme.colors.accentStrong },
  pressed: { opacity: 0.75 },
  sessionError: { color: theme.colors.danger, textAlign: 'center', marginTop: 10, fontSize: 12 },
  sessionFooter: { position: 'absolute', left: 14, right: 14 },
  resultHero: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 5 },
  resultPercentage: { fontSize: 42, fontWeight: '900', color: theme.colors.text },
  resultCount: { fontSize: 13, color: theme.colors.textSoft },
  resultLevel: { fontSize: 18, fontWeight: '900', letterSpacing: 4, color: theme.colors.accentStrong },
  resultsList: { borderTopWidth: 1, borderTopColor: theme.colors.line },
  resultRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft, paddingVertical: 8 },
  resultCopy: { flex: 1, minWidth: 0 },
  resultWord: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  resultTranslation: { marginTop: 3, fontSize: 13, color: theme.colors.textSoft },
  resultWrong: { marginTop: 4, fontSize: 11, color: theme.colors.danger },
  favoriteButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  favoriteGlyph: { fontSize: 25, color: theme.colors.textSoft },
  favoriteGlyphActive: { color: theme.colors.accentStrong },
});
