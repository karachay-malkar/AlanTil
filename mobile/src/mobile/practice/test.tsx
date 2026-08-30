import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { theme } from '@/src/mobile/theme';
import { useSession } from '@/src/mobile/session';
import { useSettings } from '@/src/mobile/settings';
import { PracticeHeader, PracticeScreen, PrimaryButton, ScopeSelector, Segment, commonStyles } from '@/src/mobile/practice/common';
import { buildScope, buildSelectedSources, buildWordsByPOSRounds, hasWordConflict, normalizePos, scopeKey, shuffle, type PracticeWord } from '@/src/mobile/practice/selection';
import { createSessionRuntime, finalizeSession, loadFavoriteIds, loadPracticeWords, persistActiveSession, setFavorite } from '@/src/mobile/practice/repository';
import { getTestSession, setTestSession, type TestMode } from '@/src/mobile/practice/state';

const LIMITS = [20, 40, 80] as const;

function optionsFor(item: PracticeWord, optionPool: PracticeWord[], mode: TestMode) {
  const correctText = mode === 'kb' ? item.trans : item.word;
  const targetPOS = normalizePos(item.pos);
  const pool = shuffle(optionPool.filter((candidate) => candidate.id !== item.id && normalizePos(candidate.pos) === targetPOS).slice());
  const options = [{ id: item.id, text: correctText }];
  const selectedWords: PracticeWord[] = [];
  const usedTexts = new Set([correctText]);
  for (const candidate of pool) {
    if (options.length >= 4) break;
    if (hasWordConflict(candidate, [item, ...selectedWords])) continue;
    const text = mode === 'kb' ? candidate.trans : candidate.word;
    if (!text || usedTexts.has(text)) continue;
    usedTexts.add(text);
    selectedWords.push(candidate);
    options.push({ id: candidate.id, text });
  }
  return shuffle(options);
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
  };
}

export function TestMenuScreen() {
  const { settings } = useSettings();
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
      const built = buildWordsByPOSRounds(pool, limit);
      if (!built.items.length) throw new Error('Для выбранных разделов недостаточно слов для теста.');
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
      header={<PracticeHeader title="Проверь знания" />}
      footer={
        <View style={styles.footerStack}>
          <View style={styles.directionRow}>
            <Text style={styles.directionLabel}>Направление</Text>
            <Segment values={['Алан → перевод', 'Перевод → алан'] as const} value={mode === 'kb' ? 'Алан → перевод' : 'Перевод → алан'} onChange={(value) => setMode(value === 'Алан → перевод' ? 'kb' : 'ru')} />
          </View>
          <PrimaryButton title={starting ? 'Запуск…' : 'Начать тест'} disabled={!pool.length || starting} onPress={() => { void launch(); }} />
        </View>
      }
    >
      {loading ? <ActivityIndicator color={theme.colors.accentStrong} style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading ? (
        <>
          <View style={commonStyles.lead}>
            <Text style={commonStyles.leadStrong}>Выбрано {pool.length} · в тесте до {effectiveCount}</Text>
            <Text style={commonStyles.leadMuted}>Выберите словари и разделы. Варианты ответа подбираются по той же части речи и с проверкой конфликтующих переводов/синонимов.</Text>
          </View>
          <ScopeSelector scope={scope} selected={selected} onToggle={toggle} />
          <Text style={commonStyles.sectionLabel}>Количество слов</Text>
          <Segment values={[...LIMITS]} value={limit} onChange={setLimit} />
        </>
      ) : null}
    </PracticeScreen>
  );
}

export function TestSessionScreen() {
  const [version, setVersion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const session = getTestSession();
  const item = session?.items[session.index];
  const options = useMemo(() => item && session ? optionsFor(item, session.optionPool, session.mode) : [], [session?.index, item?.id]);

  useEffect(() => {
    if (!session) router.replace('/practice/test');
  }, [session]);

  if (!session || !item) return <View style={styles.fullLoader}><ActivityIndicator color={theme.colors.accentStrong} /></View>;
  const question = session.mode === 'kb' ? item.word : item.trans;

  const answer = async () => {
    if (!selectedAnswer || busy) return;
    setBusy(true);
    const current = getTestSession();
    if (!current) return;
    const currentItem = current.items[current.index];
    const correctAnswer = current.mode === 'kb' ? currentItem.trans : currentItem.word;
    const questionText = current.mode === 'kb' ? currentItem.word : currentItem.trans;
    const isCorrect = selectedAnswer.id === currentItem.id;
    if (isCorrect) current.correct += 1;
    current.results.push({
      id: currentItem.id,
      questionText,
      word: currentItem.word,
      trans: currentItem.trans,
      correctAnswer,
      userAnswer: selectedAnswer.text,
      wrongWordId: isCorrect ? null : selectedAnswer.id,
      isCorrect,
    });
    current.index += 1;
    await persistActiveSession(current.runtime, sessionPayload(current));
    setSelectedAnswer(null);
    if (current.index >= current.items.length) {
      try {
        await finalizeSession(current.runtime, sessionPayload(current), 'completed');
      } finally {
        router.replace('/practice/test/results');
      }
      return;
    }
    setBusy(false);
    setVersion((value) => value + 1);
  };

  return (
    <View key={version} style={styles.sessionScreen}>
      <PracticeHeader title="Проверь знания" subtitle={`${session.index + 1}/${session.items.length}`} />
      <View style={styles.questionArea}><Text adjustsFontSizeToFit numberOfLines={4} style={styles.question}>{question}</Text></View>
      <View style={styles.options}>
        {options.map((option) => {
          const active = selectedAnswer?.id === option.id;
          return (
            <Pressable key={option.id} disabled={busy} onPress={() => setSelectedAnswer(option)} style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.pressed]}>
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.text}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.sessionFooter}><PrimaryButton title={busy ? 'Сохраняю…' : 'Ответить'} disabled={!selectedAnswer || busy} onPress={() => { void answer(); }} /></View>
    </View>
  );
}

export function TestResultsScreen() {
  const sessionAuth = useSession();
  const test = getTestSession();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    void loadFavoriteIds(sessionAuth.user?.id).then(setFavorites);
    if (!test) router.replace('/practice/test');
  }, [sessionAuth.user?.id]);

  if (!test) return <View style={styles.fullLoader}><ActivityIndicator color={theme.colors.accentStrong} /></View>;
  const percentage = Math.round((test.correct / Math.max(1, test.items.length)) * 100);
  const level = percentage >= 100 ? 3 : percentage >= 90 ? 2 : percentage >= 80 ? 1 : 0;

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
    } finally {
      setBusyId('');
    }
  };


  return (
    <PracticeScreen header={<PracticeHeader title="Результаты теста" />} footer={<PrimaryButton title="Пройти ещё раз" onPress={() => router.replace('/practice/test')} />}>
      <View style={commonStyles.resultSummary}>
        <Text style={styles.resultMark}>{level ? '⌃'.repeat(level) : '—'}</Text>
        <Text style={commonStyles.resultPercent}>{percentage}%</Text>
        <Text style={commonStyles.resultText}>{percentage >= 80 ? 'Тест сдан' : 'Тест не сдан'} · {test.correct}/{test.items.length}</Text>
      </View>
      <View style={styles.resultList}>
        {test.results.map((result) => (
          <View key={`${result.id}:${result.questionText}`} style={styles.resultRow}>
            <View style={[styles.resultStatus, result.isCorrect ? styles.resultStatusOk : styles.resultStatusBad]}><Text style={styles.resultStatusText}>{result.isCorrect ? '✓' : '×'}</Text></View>
            <View style={styles.resultCopy}>
              <Text style={styles.resultPrimary}>{result.questionText}</Text>
              {!result.isCorrect ? <Text style={styles.resultWrong}>Ответ: {result.userAnswer || '—'}</Text> : null}
              <Text style={styles.resultCorrect}>Правильно: {result.correctAnswer}</Text>
            </View>
            <Pressable disabled={busyId === result.id} onPress={() => { void toggleFavorite(result.id); }} style={styles.starButton}>
              <Text style={[styles.star, favorites.has(result.id) && styles.starOn]}>★</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </PracticeScreen>
  );
}

const styles = StyleSheet.create({
  loader: { paddingVertical: 40 },
  error: { color: theme.colors.danger, fontSize: 12, lineHeight: 17, paddingVertical: 8 },
  footerStack: { gap: 9 },
  directionRow: { gap: 6 },
  directionLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700' },
  sessionScreen: { flex: 1, backgroundColor: theme.colors.background },
  fullLoader: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  questionArea: { flex: 0.42, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  question: { color: theme.colors.text, fontSize: 30, lineHeight: 37, fontWeight: '800', textAlign: 'center' },
  options: { flex: 0.58, paddingHorizontal: 16, gap: 10, justifyContent: 'center', paddingBottom: 84 },
  option: { minHeight: 58, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: 'rgba(246,242,233,0.55)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  optionActive: { borderColor: theme.colors.text, backgroundColor: theme.colors.text },
  optionText: { color: theme.colors.text, fontSize: 16, lineHeight: 21, fontWeight: '700', textAlign: 'center' },
  optionTextActive: { color: theme.colors.inverse },
  sessionFooter: { position: 'absolute', left: 16, right: 16, bottom: 12 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  resultMark: { color: theme.colors.accentStrong, fontSize: 14, fontWeight: '900', letterSpacing: -1 },
  resultList: { borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  resultRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft, paddingVertical: 10 },
  resultStatus: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  resultStatusOk: { backgroundColor: 'rgba(93,118,84,0.16)' },
  resultStatusBad: { backgroundColor: 'rgba(152,86,76,0.16)' },
  resultStatusText: { color: theme.colors.text, fontSize: 16, fontWeight: '900' },
  resultCopy: { flex: 1, minWidth: 0 },
  resultPrimary: { color: theme.colors.text, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  resultWrong: { color: theme.colors.danger, fontSize: 11, lineHeight: 15 },
  resultCorrect: { color: theme.colors.success, fontSize: 11, lineHeight: 15 },
  starButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  star: { color: theme.colors.textSoft, fontSize: 20 },
  starOn: { color: theme.colors.accentStrong },
});
