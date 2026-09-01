import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  advanceMatchRound,
  applyMatchPair,
  createMatchSessionState,
  matchSessionPayload,
  matchSessionSummary,
  matchTranslationOptions,
  restoreMatchSessionState,
} from '../../../../packages/alantil-core/practice-session.js';
import { theme } from '@/src/mobile/theme';
import { useI18n } from '@/src/mobile/i18n';
import { OverflowMarquee } from '@/src/mobile/overflow-marquee';
import { useSession } from '@/src/mobile/session';
import { useSettings } from '@/src/mobile/settings';
import { PracticeHeader, PracticeScreen, PrimaryButton, ScopeSelector, Segment, commonStyles } from '@/src/mobile/practice/common';
import { buildScope, scopeKey, type PracticeWord } from '@/src/mobile/practice/selection';
import { createSessionRuntime, finalizeSession, loadFavoriteIds, loadPracticeWords, persistActiveSession, resumeSessionRuntime, setFavorite } from '@/src/mobile/practice/repository';
import { getMatchSession, setMatchSession, type MatchSessionState } from '@/src/mobile/practice/state';
import { scopedTestId, testIds } from '@/src/mobile/test-ids';
import { useSessionExitGuard } from '@/src/mobile/use-session-exit';
import { AppText as Text } from '@/src/mobile/typography';

const LIMITS = [20, 40, 80] as const;

async function restoreMatchSessionFromStorage(settings: ReturnType<typeof useSettings>['settings'], userId?: string | null) {
  const resumed = await resumeSessionRuntime('match', userId);
  const snapshot = resumed?.payload?.session_snapshot as Record<string, unknown> | undefined;
  if (!resumed || !snapshot) return null;
  const words = await loadPracticeWords(settings);
  const restored = restoreMatchSessionState(resumed.runtime, snapshot, words) as MatchSessionState | null;
  if (!restored) return null;
  setMatchSession(restored);
  return restored;
}

export function MatchMenuScreen() {
  const { settings } = useSettings();
  const { t } = useI18n();
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
      const runtime = await createSessionRuntime('match', settings, auth.user?.id);
      const state = createMatchSessionState({ pool, limit, runtime }) as MatchSessionState;
      if (!state.rounds.length) throw new Error(t('match.not_enough_words'));
      setMatchSession(state);
      await persistActiveSession(runtime, matchSessionPayload(state));
      router.push('/practice/match/session');
    } catch (reason) {
      setError(String((reason as { message?: string })?.message ?? reason));
    } finally {
      setStarting(false);
    }
  };

  return (
    <PracticeScreen
      testID={testIds.match.menu}
      header={<PracticeHeader title={t('practice.match.title')} />}
      footer={<PrimaryButton testID={testIds.match.start} title={t('match.start')} loading={starting} disabled={!pool.length} onPress={() => { void launch(); }} />}
    >
      {loading ? <ActivityIndicator color={theme.colors.accentStrong} style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading ? (
        <>
          <View style={commonStyles.lead}>
            <Text style={commonStyles.leadStrong}>{t('match.selection_summary', { selected: pool.length, count: Math.min(limit, pool.length) })}</Text>
            <Text style={commonStyles.leadMuted}>{t('match.selection_help')}</Text>
          </View>
          <ScopeSelector scope={scope} selected={selected} onToggle={toggle} />
          <Text style={commonStyles.sectionLabel}>{t('test.word_count')}</Text>
          <Segment testID="match.limit" values={[...LIMITS]} value={limit} onChange={setLimit} />
        </>
      ) : null}
    </PracticeScreen>
  );
}

type Pick = { side: 'word' | 'trans'; id: string } | null;

export function MatchSessionScreen() {
  const auth = useSession();
  const { settings } = useSettings();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Pick>(null);
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [completionPending, setCompletionPending] = useState(false);
  const session = getMatchSession();
  const round = session?.rounds[session.roundIndex] ?? [];
  const remaining = round.filter((word) => !session?.solved.has(word.id));
  const translations = useMemo(() => matchTranslationOptions(round), [session?.roundIndex]);

  const requestLeave = useSessionExitGuard(Boolean(session), useCallback(async (reason: string) => {
    const current = getMatchSession();
    if (!current) return;
    await finalizeSession(current.runtime, matchSessionPayload(current), 'interrupted', reason);
    setMatchSession(null);
  }, []));

  useEffect(() => {
    if (session) return;
    let active = true;
    void restoreMatchSessionFromStorage(settings, auth.user?.id).then((restored) => {
      if (!active) return;
      if (restored) setVersion((value) => value + 1); else router.replace('/practice/match');
    });
    return () => { active = false; };
  }, [session, auth.user?.id]);

  const finalizeCompletedMatch = async (current: MatchSessionState) => {
    setBusy(true);
    setSaveError('');
    try {
      await finalizeSession(current.runtime, matchSessionPayload(current), 'completed');
      router.replace('/practice/match/results');
    } catch {
      setCompletionPending(true);
      setSaveError(t('match.save_error'));
      setBusy(false);
    }
  };

  if (!session) return <View style={styles.fullLoader}><ActivityIndicator color={theme.colors.accentStrong} /></View>;
  if (completionPending) return <View style={styles.fullLoader}>
    {busy ? <ActivityIndicator color={theme.colors.accentStrong} /> : <>
      <Text accessibilityRole="alert" style={styles.errorCentered}>{saveError || t('match.save_error')}</Text>
      <Pressable accessibilityRole="button" onPress={() => { void finalizeCompletedMatch(session); }} style={styles.retryButton}><Text style={styles.retryText}>{t('common.retry').toUpperCase()}</Text></Pressable>
    </>}
  </View>;

  const persistRoundTransition = async (current: MatchSessionState) => {
    const transition = advanceMatchRound(current);
    if (!transition.advanced && !transition.completed) {
      setMatchSession(current);
      setSelected(null);
      setBusy(false);
      setVersion((value) => value + 1);
      return;
    }
    if (transition.completed) {
      setMatchSession(current);
      setCompletionPending(true);
      await finalizeCompletedMatch(current);
      return;
    }
    const next = transition.state as MatchSessionState;
    try {
      await persistActiveSession(next.runtime, matchSessionPayload(next));
    } catch {
      setMatchSession(current);
      setSaveError(t('match.save_error'));
      setBusy(false);
      setVersion((value) => value + 1);
      return;
    }
    setMatchSession(next);
    setSelected(null);
    setWrongIds(new Set());
    setBusy(false);
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
    setSaveError('');
    const transition = applyMatchPair(session, selected.id, pick.id);
    if (!transition) { setBusy(false); return; }
    const next = transition.state as MatchSessionState;
    try {
      await persistActiveSession(next.runtime, matchSessionPayload(next));
    } catch {
      setSaveError(t('match.save_error'));
      setBusy(false);
      return;
    }
    if (transition.correct) {
      await persistRoundTransition(next);
      return;
    }
    setMatchSession(next);
    setWrongIds(new Set(transition.wrongIds));
    setSelected(null);
    setBusy(false);
    setTimeout(() => setWrongIds(new Set()), 500);
  };

  const total = session.rounds.reduce((sum, value) => sum + value.length, 0);
  return (
    <View testID={testIds.match.session} style={[styles.sessionScreen, { paddingBottom: Math.max(insets.bottom, 4) }]}>
      <PracticeHeader title={t('practice.match.title')} subtitle={t('match.progress', { solved: session.solved.size, total, errors: session.errorsCount })} onBack={() => requestLeave('header_back')} />
      <View style={styles.roundLead}><Text style={styles.roundText}>{t('match.round', { current: session.roundIndex + 1, total: session.rounds.length })}</Text></View>
      <View style={styles.matchGrid}>
        <View style={styles.matchColumn}>
          {round.map((word) => {
            const solved = session.solved.has(word.id);
            const active = selected?.side === 'word' && selected.id === word.id;
            const wrong = wrongIds.has(word.id);
            return (
              <Pressable key={`w:${word.id}`} accessibilityRole="button" accessibilityState={{ selected: active, disabled: solved || busy }} testID={scopedTestId('match.word', word.id)} disabled={solved || busy} onPress={() => { void choose({ side: 'word', id: word.id }); }} style={({ pressed }) => [styles.matchCard, active && styles.matchCardActive, wrong && styles.matchCardWrong, solved && styles.matchCardSolved, pressed && styles.pressed]}>
                <OverflowMarquee style={[styles.matchCardText, active && styles.matchCardTextActive]}>{word.word}</OverflowMarquee>
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
              <Pressable key={`t:${option.id}`} accessibilityRole="button" accessibilityState={{ selected: active, disabled: solved || busy }} testID={scopedTestId('match.translation', option.id)} disabled={solved || busy} onPress={() => { void choose({ side: 'trans', id: option.id }); }} style={({ pressed }) => [styles.matchCard, active && styles.matchCardActive, wrong && styles.matchCardWrong, solved && styles.matchCardSolved, pressed && styles.pressed]}>
                <OverflowMarquee style={[styles.matchCardText, active && styles.matchCardTextActive]}>{option.text}</OverflowMarquee>
              </Pressable>
            );
          })}
        </View>
      </View>
      {saveError ? <View style={styles.sessionErrorBox}><Text accessibilityRole="alert" style={styles.sessionError}>{saveError}</Text>{!remaining.length ? <Pressable accessibilityRole="button" onPress={() => { setBusy(true); void persistRoundTransition(session); }} style={styles.inlineRetry}><Text style={styles.retryText}>{t('common.retry').toUpperCase()}</Text></Pressable> : null}</View> : null}
      {!remaining.length ? <ActivityIndicator color={theme.colors.accentStrong} style={styles.roundSpinner} /> : null}
    </View>
  );
}

export function MatchResultsScreen() {
  const auth = useSession();
  const { t } = useI18n();
  const match = getMatchSession();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  useEffect(() => {
    if (!match) router.replace('/practice/match');
    void loadFavoriteIds(auth.user?.id).then(setFavorites);
  }, [match, auth.user?.id]);
  if (!match) return <View style={styles.fullLoader}><ActivityIndicator color={theme.colors.accentStrong} /></View>;
  const summary = matchSessionSummary(match);
  const toggleFavorite = async (word: PracticeWord) => {
    const active = !favorites.has(word.id);
    setFavorites((current) => {
      const next = new Set(current);
      if (active) next.add(word.id); else next.delete(word.id);
      return next;
    });
    try {
      await setFavorite(auth.user?.id, word.id, active);
    } catch {
      void loadFavoriteIds(auth.user?.id).then(setFavorites);
      setError(t('learn.favorite_error'));
    }
  };
  return (
    <PracticeScreen testID={testIds.match.result} header={<PracticeHeader title={t('match.results')} />}>
      <View style={commonStyles.resultSummary}>
        <Text style={commonStyles.resultPercent}>{summary.total}/{summary.total}</Text>
        <Text style={commonStyles.resultText}>{t('match.matched_errors', { errors: summary.errors })}</Text>
        <Text style={styles.cleanText}>{summary.problemWords.length ? t('match.without_errors', { count: summary.clean }) : t('match.perfect')}</Text>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.resultList}>
        {summary.problemWords.map((word) => {
          const errors = match.failMap[word.id] || 0;
          return (
            <View key={word.id} style={styles.matchResultRow}>
              <View style={styles.matchResultCopy}>
                <OverflowMarquee style={styles.matchResultWord}>{word.word}</OverflowMarquee>
                <OverflowMarquee style={styles.matchResultTrans}>{word.trans}</OverflowMarquee>
              </View>
              <Text style={[styles.matchResultErrors, styles.matchResultErrorsBad]}>{t('match.error_count', { count: errors })}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={favorites.has(word.id) ? t('learn.remove_favorite', { word: word.word }) : t('learn.add_favorite', { word: word.word })} accessibilityState={{ selected: favorites.has(word.id) }} testID={scopedTestId('match.favorite', word.id)} onPress={() => { void toggleFavorite(word); }} style={({ pressed }) => [styles.starButton, pressed && styles.pressed]}><Text style={[styles.star, favorites.has(word.id) && styles.starOn]}>★</Text></Pressable>
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
  errorCentered: { maxWidth: 320, color: theme.colors.danger, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retryButton: { minWidth: 150, minHeight: 46, marginTop: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.line, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: theme.colors.text, fontSize: 11, fontWeight: '900' },
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
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  matchCardText: { color: theme.colors.text, fontSize: 14, lineHeight: 18, fontWeight: '700', textAlign: 'center' },
  matchCardTextActive: { color: theme.colors.inverse },
  roundSpinner: { position: 'absolute', bottom: 18, alignSelf: 'center' },
  sessionErrorBox: { position: 'absolute', left: 16, right: 16, bottom: 12, minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(152,86,76,0.35)', backgroundColor: 'rgba(238,233,223,0.97)', flexDirection: 'row', alignItems: 'center', paddingLeft: 12 },
  sessionError: { flex: 1, color: theme.colors.danger, fontSize: 10, lineHeight: 14 },
  inlineRetry: { minWidth: 86, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  cleanText: { color: theme.colors.success, fontSize: 11, fontWeight: '700' },
  resultList: { borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  matchResultRow: { minHeight: 62, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  matchResultCopy: { flex: 1, minWidth: 0 },
  matchResultWord: { color: theme.colors.text, fontSize: 14, fontWeight: '800' },
  matchResultTrans: { marginTop: 2, color: theme.colors.textMuted, fontSize: 11, lineHeight: 15 },
  matchResultErrors: { color: theme.colors.success, fontSize: 11, fontWeight: '800' },
  matchResultErrorsBad: { color: theme.colors.danger },
  starButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, star: { color: theme.colors.textSoft, fontSize: 21 }, starOn: { color: theme.colors.accentStrong },
});