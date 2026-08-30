import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { theme } from '@/src/mobile/theme';
import { useSession } from '@/src/mobile/session';
import { useSettings } from '@/src/mobile/settings';
import { PracticeHeader, PracticeScreen, PrimaryButton, ScopeSelector, Segment, commonStyles } from '@/src/mobile/practice/common';
import { buildScope, buildSelectedSources, buildWordsByPOSRounds, scopeKey, shuffle, type PracticeWord } from '@/src/mobile/practice/selection';
import { createSessionRuntime, finalizeSession, loadPracticeWords, persistActiveSession } from '@/src/mobile/practice/repository';
import { getMatchSession, setMatchSession } from '@/src/mobile/practice/state';

const LIMITS = [20, 40, 80] as const;

function matchPayload(session = getMatchSession()) {
  if (!session) return {};
  const shownIds = Array.from(session.shown);
  const words = shownIds.map((wordId) => ({
    word_id: wordId,
    matched: session.solved.has(wordId),
    error_count: Math.max(0, Number(session.failMap[wordId]) || 0),
  }));
  const errors = Object.values(session.errorPairs).filter((entry) => entry.error_count > 0);
  return {
    selected_sources: session.selectedSources,
    pairs_planned: session.rounds.reduce((sum, round) => sum + round.length, 0),
    pairs_completed: session.solved.size,
    errors_total: session.errorsCount,
    rounds_total: session.roundIndex + 1,
    words,
    errors,
  };
}

export function MatchMenuScreen() {
  const { settings } = useSettings();
  const auth = useSession();
  const [words, setWords] = useState<PracticeWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<(typeof LIMITS)[number]>(40);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let active = true;
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
      const rounds = built.rounds.filter((round) => round.length);
      if (!rounds.length) throw new Error('Для выбранных разделов недостаточно слов для сопоставления.');
      const runtime = await createSessionRuntime('match', settings, auth.user?.id);
      const state = {
        runtime,
        limit,
        items: built.items,
        rounds,
        roundIndex: 0,
        solved: new Set<string>(),
        shown: new Set<string>(),
        failMap: {},
        errorPairs: {},
        errorsCount: 0,
        selectedSources: buildSelectedSources(pool),
      };
      rounds[0].forEach((word) => state.shown.add(word.id));
      setMatchSession(state);
      await persistActiveSession(runtime, matchPayload(state));
      router.push('/practice/match/session');
    } catch (reason) {
      setError(String((reason as { message?: string })?.message ?? reason));
    } finally {
      setStarting(false);
    }
  };

  return (
    <PracticeScreen
      header={<PracticeHeader title="Сопоставление" />}
      footer={<PrimaryButton title={starting ? 'Запуск…' : 'Начать'} disabled={!pool.length || starting} onPress={() => { void launch(); }} />}
    >
      {loading ? <ActivityIndicator color={theme.colors.accentStrong} style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading ? (
        <>
          <View style={commonStyles.lead}>
            <Text style={commonStyles.leadStrong}>Выбрано {pool.length} · до {Math.min(limit, pool.length)} пар</Text>
            <Text style={commonStyles.leadMuted}>Слова формируются раундами по частям речи, как в текущей web-версии.</Text>
          </View>
          <ScopeSelector scope={scope} selected={selected} onToggle={toggle} />
          <Text style={commonStyles.sectionLabel}>Количество слов</Text>
          <Segment values={[...LIMITS]} value={limit} onChange={setLimit} />
        </>
      ) : null}
    </PracticeScreen>
  );
}

type Pick = { side: 'word' | 'trans'; id: string } | null;

export function MatchSessionScreen() {
  const [selected, setSelected] = useState<Pick>(null);
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const session = getMatchSession();
  const round = session?.rounds[session.roundIndex] ?? [];
  const remaining = round.filter((word) => !session?.solved.has(word.id));
  const translations = useMemo(() => shuffle(round.map((word) => ({ id: word.id, text: word.trans }))), [session?.roundIndex]);

  useEffect(() => {
    if (!session) router.replace('/practice/match');
  }, [session]);

  if (!session) return <View style={styles.fullLoader}><ActivityIndicator color={theme.colors.accentStrong} /></View>;

  const completeRoundIfNeeded = async () => {
    const current = getMatchSession();
    if (!current) return;
    const currentRound = current.rounds[current.roundIndex];
    const done = currentRound.every((word) => current.solved.has(word.id));
    if (!done) return;
    if (current.roundIndex >= current.rounds.length - 1) {
      try {
        await finalizeSession(current.runtime, matchPayload(current), 'completed');
      } finally {
        router.replace('/practice/match/results');
      }
      return;
    }
    current.roundIndex += 1;
    current.rounds[current.roundIndex].forEach((word) => current.shown.add(word.id));
    await persistActiveSession(current.runtime, matchPayload(current));
    setSelected(null);
    setWrongIds(new Set());
    setVersion((value) => value + 1);
  };

  const choose = async (pick: NonNullable<Pick>) => {
    if (busy || session.solved.has(pick.id)) return;
    if (!selected) {
      setSelected(pick);
      return;
    }
    if (selected.side === pick.side) {
      setSelected(pick);
      return;
    }
    setBusy(true);
    const first = selected;
    const correct = first.id === pick.id;
    if (correct) {
      session.solved.add(pick.id);
      await persistActiveSession(session.runtime, matchPayload(session));
      setSelected(null);
      setBusy(false);
      setVersion((value) => value + 1);
      await completeRoundIfNeeded();
      return;
    }
    session.errorsCount += 1;
    session.failMap[first.id] = (session.failMap[first.id] || 0) + 1;
    session.failMap[pick.id] = (session.failMap[pick.id] || 0) + 1;
    const pair = [first.id, pick.id].sort();
    const key = `${pair[0]}||${pair[1]}`;
    const entry = session.errorPairs[key] ?? { word_id_a: pair[0], word_id_b: pair[1], error_count: 0 };
    entry.error_count += 1;
    session.errorPairs[key] = entry;
    await persistActiveSession(session.runtime, matchPayload(session));
    setWrongIds(new Set([first.id, pick.id]));
    setSelected(null);
    setBusy(false);
    setTimeout(() => setWrongIds(new Set()), 500);
  };

  const total = session.rounds.reduce((sum, value) => sum + value.length, 0);
  return (
    <View style={styles.sessionScreen}>
      <PracticeHeader title="Сопоставление" subtitle={`${session.solved.size}/${total} · ошибок ${session.errorsCount}`} />
      <View style={styles.roundLead}><Text style={styles.roundText}>Раунд {session.roundIndex + 1}/{session.rounds.length}</Text></View>
      <View style={styles.matchGrid}>
        <View style={styles.matchColumn}>
          {round.map((word) => {
            const solved = session.solved.has(word.id);
            const active = selected?.side === 'word' && selected.id === word.id;
            const wrong = wrongIds.has(word.id);
            return (
              <Pressable key={`w:${word.id}`} disabled={solved || busy} onPress={() => { void choose({ side: 'word', id: word.id }); }} style={[styles.matchCard, active && styles.matchCardActive, wrong && styles.matchCardWrong, solved && styles.matchCardSolved]}>
                <Text numberOfLines={3} adjustsFontSizeToFit style={[styles.matchCardText, active && styles.matchCardTextActive]}>{word.word}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.matchColumn}>
          {translations.map((option) => {
            const solved = session.solved.has(option.id);
            const active = selected?.side === 'trans' && selected.id === option.id;
            const wrong = wrongIds.has(option.id);
            return (
              <Pressable key={`t:${option.id}`} disabled={solved || busy} onPress={() => { void choose({ side: 'trans', id: option.id }); }} style={[styles.matchCard, active && styles.matchCardActive, wrong && styles.matchCardWrong, solved && styles.matchCardSolved]}>
                <Text numberOfLines={3} adjustsFontSizeToFit style={[styles.matchCardText, active && styles.matchCardTextActive]}>{option.text}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {!remaining.length ? <ActivityIndicator color={theme.colors.accentStrong} style={styles.roundSpinner} /> : null}
    </View>
  );
}

export function MatchResultsScreen() {
  const match = getMatchSession();
  useEffect(() => {
    if (!match) router.replace('/practice/match');
  }, [match]);
  if (!match) return <View style={styles.fullLoader}><ActivityIndicator color={theme.colors.accentStrong} /></View>;
  const total = match.rounds.reduce((sum, round) => sum + round.length, 0);
  const clean = Math.max(0, total - Object.keys(match.failMap).length);
  return (
    <PracticeScreen header={<PracticeHeader title="Результаты" />} footer={<PrimaryButton title="Пройти ещё раз" onPress={() => router.replace('/practice/match')} />}>
      <View style={commonStyles.resultSummary}>
        <Text style={commonStyles.resultPercent}>{total}/{total}</Text>
        <Text style={commonStyles.resultText}>Сопоставлено · ошибок {match.errorsCount}</Text>
        <Text style={styles.cleanText}>Без ошибок: {clean}</Text>
      </View>
      <View style={styles.resultList}>
        {match.items.map((word) => {
          const errors = match.failMap[word.id] || 0;
          return (
            <View key={word.id} style={styles.matchResultRow}>
              <View style={styles.matchResultCopy}>
                <Text style={styles.matchResultWord}>{word.word}</Text>
                <Text style={styles.matchResultTrans}>{word.trans}</Text>
              </View>
              <Text style={[styles.matchResultErrors, errors > 0 && styles.matchResultErrorsBad]}>{errors ? `${errors} ош.` : '✓'}</Text>
            </View>
          );
        })}
      </View>
    </PracticeScreen>
  );
}

const styles = StyleSheet.create({
  loader: { paddingVertical: 40 },
  error: { color: theme.colors.danger, fontSize: 12, lineHeight: 17, paddingVertical: 8 },
  fullLoader: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  sessionScreen: { flex: 1, backgroundColor: theme.colors.background },
  roundLead: { height: 38, alignItems: 'center', justifyContent: 'center' },
  roundText: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700' },
  matchGrid: { flex: 1, flexDirection: 'row', gap: 9, paddingHorizontal: 12, paddingBottom: 14 },
  matchColumn: { flex: 1, gap: 9, justifyContent: 'center' },
  matchCard: { minHeight: 66, flex: 1, maxHeight: 94, borderRadius: 13, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: 'rgba(246,242,233,0.54)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9, paddingVertical: 7 },
  matchCardActive: { backgroundColor: theme.colors.text, borderColor: theme.colors.text },
  matchCardWrong: { backgroundColor: 'rgba(152,86,76,0.17)', borderColor: theme.colors.danger },
  matchCardSolved: { opacity: 0.08 },
  matchCardText: { color: theme.colors.text, fontSize: 14, lineHeight: 18, fontWeight: '700', textAlign: 'center' },
  matchCardTextActive: { color: theme.colors.inverse },
  roundSpinner: { position: 'absolute', bottom: 18, alignSelf: 'center' },
  cleanText: { color: theme.colors.success, fontSize: 11, fontWeight: '700' },
  resultList: { borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  matchResultRow: { minHeight: 62, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  matchResultCopy: { flex: 1, minWidth: 0 },
  matchResultWord: { color: theme.colors.text, fontSize: 14, fontWeight: '800' },
  matchResultTrans: { marginTop: 2, color: theme.colors.textMuted, fontSize: 11, lineHeight: 15 },
  matchResultErrors: { color: theme.colors.success, fontSize: 11, fontWeight: '800' },
  matchResultErrorsBad: { color: theme.colors.danger },
});
