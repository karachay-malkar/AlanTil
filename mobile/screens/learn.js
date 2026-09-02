import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildLearnResultSummary, decideLearnCard, ensureLearnWordStats, exposeCurrentLearnCard, initializeLearnState, learnCompletionSummary, learnSessionWords, undoLearnDecision } from '../../packages/alantil-core/learning.js';
import { favoriteHas, toggleFavorite } from '../../packages/alantil-core/favorites.js';
import { Button, FavoriteButton, Header, ProgressBar, Screen, SectionLabel } from '../ui/components.js';
import { EmptyState, MetricStrip, MonoLabel, ScreenSection, SurfaceCard } from '../ui/parity.js';
import { theme } from '../ui/theme.js';
import { recordNativeLearnSession } from '../platform/progress.js';
import { clearNativeSessionSnapshot, loadNativeSessionSnapshot, saveNativeSessionSnapshot } from '../platform/session-store.js';

const C = theme.colors;
const T = theme.type;
function createState(words, mode, station) { const state = { currentDict: station?.dictionaryId || '', currentSection: station?.sectionId || '', currentSet: station?.setId || '', mainQueue: [], repeatQueue: [], round: 'main', totalPlanned: 0, currentStudyId: '', swipeHistory: [], analyticsActions: [], sessionFailMap: {}, studySession: { inProgress: false, completed: false, wordsPool: [], progressData: {}, wordStats: {}, metadata: {} } }; initializeLearnState(state, words, mode, { stationContext: station || null }); return state; }
function contextKey(words, mode, station) { return `${station?.key || 'practice'}|${mode}|${words.map((word) => String(word.id)).join(',')}`; }
function serializeState(state, key, startedAt) { return { contextKey: key, startedAt, state }; }

export function LearnScreen({ words, mode = 'kb', station, favorites, setFavorites, onBack }) {
  const key = useMemo(() => contextKey(words, mode, station), [words, mode, station]);
  const [state, setState] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [, redraw] = useState(0);
  const startedAt = useRef(new Date().toISOString());
  const recorded = useRef(false);
  const lastExposed = useRef('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = await loadNativeSessionSnapshot('learn');
      if (!alive) return;
      if (saved?.contextKey === key && saved?.state?.studySession?.inProgress) {
        startedAt.current = saved.startedAt || startedAt.current;
        setState(saved.state);
      } else {
        if (saved) await clearNativeSessionSnapshot('learn');
        setState(createState(words, mode, station));
      }
    })();
    return () => { alive = false; };
  }, [key, words, mode, station]);

  const persist = () => state ? saveNativeSessionSnapshot('learn', serializeState(state, key, startedAt.current)).catch(() => {}) : Promise.resolve();
  const back = () => { persist(); onBack(); };
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; }); return () => sub.remove(); }, [state, key, onBack]);
  const exposure = state ? exposeCurrentLearnCard(state, { countShow: false }) : { item: null, finished: false };
  const item = exposure.item;
  const finish = Boolean(state && (exposure.finished || (!item && state.totalPlanned > 0)));
  const summary = finish && state ? buildLearnResultSummary(state, words) : null;

  useEffect(() => {
    if (!state) return;
    const id = String(item?.id || '');
    if (!id || lastExposed.current === id) return;
    const stats = ensureLearnWordStats(state, item);
    if (stats) stats.show_count += 1;
    lastExposed.current = id;
    persist();
  }, [item?.id, state, key]);

  useEffect(() => {
    if (!state || !finish || recorded.current) return;
    recorded.current = true;
    state.studySession.completed = true;
    state.studySession.inProgress = false;
    recordNativeLearnSession({ sessionId: `learn-${startedAt.current}-${station?.key || 'practice'}`, words: learnSessionWords(state), startedAt: startedAt.current }).catch(() => {});
    clearNativeSessionSnapshot('learn').catch(() => {});
  }, [finish, state, station?.key]);

  if (!state) return <Screen><Header title="Учить слова" onBack={onBack} /><View style={styles.center}><EmptyState>Восстанавливаем обучение…</EmptyState></View></Screen>;
  if (finish) {
    const completed = learnCompletionSummary(state);
    return <Screen><Header title="Результат" onBack={onBack} /><ScrollView contentContainerStyle={styles.results} showsVerticalScrollIndicator={false}><SectionLabel>ОБУЧЕНИЕ ЗАВЕРШЕНО</SectionLabel><SurfaceCard><MetricStrip items={[[String(completed.items_total), 'изучено'], [String(completed.known_count), 'знаю'], [String(summary?.leftSwipesTotal || 0), 'не знаю']]} /></SurfaceCard><ScreenSection title="Проблемные слова">{summary?.problemWords?.length ? <SurfaceCard>{summary.problemWords.slice(0, 7).map((word) => <View key={word.id} style={styles.problemRow}><View style={styles.problemCopy}><Text style={styles.problemWord}>{word.word}</Text><Text style={styles.problemTrans}>{word.trans}</Text></View><MonoLabel style={styles.problemFails}>{word.fails}</MonoLabel></View>)}</SurfaceCard> : <EmptyState>Ошибок нет.</EmptyState>}</ScreenSection><View style={styles.resultFooter}><Button primary style={styles.resultButton} onPress={onBack}>К этапу</Button></View></ScrollView></Screen>;
  }
  if (!item) return <Screen><Header title="Учить слова" onBack={onBack} /><View style={styles.center}><EmptyState>Нет слов для обучения.</EmptyState></View></Screen>;

  const pending = new Set([...state.mainQueue, ...state.repeatQueue].map((word) => String(word.id))).size;
  const totalDone = Math.max(0, state.totalPlanned - pending);
  const progress = state.totalPlanned ? (totalDone / state.totalPlanned) * 100 : 0;
  const choose = (known) => { decideLearnCard(state, known); setFlipped(false); persist(); redraw((value) => value + 1); };
  const undo = () => { const action = undoLearnDecision(state); if (action) { lastExposed.current = ''; setFlipped(false); persist(); redraw((value) => value + 1); } };
  const frontText = mode === 'ru' ? item.trans : item.word;
  const backText = mode === 'ru' ? item.word : item.trans;
  const example = String(item.example || item.example_alan || item.example_ru || '').trim();

  return <Screen><Header title="Учить слова" onBack={back} sessionStatus={{ counter: `${Math.min(totalDone + 1, state.totalPlanned)}/${state.totalPlanned}`, mode: mode === 'ru' ? 'РУС → АЛАН' : 'АЛАН → РУС' }} /><View style={styles.session}><ProgressBar value={progress} /><Pressable accessibilityRole="button" accessibilityLabel="Перевернуть карточку" onPress={() => setFlipped((value) => !value)} style={styles.cardWrap}><SurfaceCard inset style={[styles.card, flipped && styles.cardBack]}>{!flipped ? <><MonoLabel>НАЖМИТЕ, ЧТОБЫ ПЕРЕВЕРНУТЬ</MonoLabel><Text style={styles.word}>{frontText}</Text></> : <ScrollView style={styles.backScroll} contentContainerStyle={styles.backContent} showsVerticalScrollIndicator={false}><MonoLabel>ПЕРЕВОД</MonoLabel><Text style={styles.translation}>{backText}</Text>{item.synonyms ? <><MonoLabel style={styles.backLabel}>СИНОНИМЫ</MonoLabel><Text style={styles.copyText}>{item.synonyms}</Text></> : null}{example ? <><MonoLabel style={styles.backLabel}>ПРИМЕР</MonoLabel><Text style={styles.copyText}>{example}</Text></> : null}</ScrollView>}<View style={styles.cardActions}><Pressable disabled={!state.swipeHistory.length} onPress={(event) => { event.stopPropagation?.(); undo(); }} style={({ pressed }) => [styles.cardAction, !state.swipeHistory.length && styles.cardActionDisabled, pressed && styles.pressed]}><Text style={styles.cardActionIcon}>↶</Text><MonoLabel>назад</MonoLabel></Pressable><FavoriteButton active={favoriteHas(favorites, item.id)} onPress={() => setFavorites(toggleFavorite(favorites, item.id).ids)} /></View></SurfaceCard></Pressable><View style={styles.decisions}><Decision kind="unknown" label="Не знаю" icon="×" onPress={() => choose(false)} /><Decision kind="known" label="Знаю" icon="✓" onPress={() => choose(true)} /></View></View></Screen>;
}

function Decision({ kind, label, icon, onPress }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.decision, pressed && styles.pressed]}><View style={[styles.decisionIcon, kind === 'unknown' ? styles.unknownIcon : styles.knownIcon]}><Text style={[styles.decisionGlyph, kind === 'unknown' ? styles.unknownGlyph : styles.knownGlyph]}>{icon}</Text></View><MonoLabel>{label}</MonoLabel></Pressable>; }

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  session: { flex: 1, paddingTop: theme.control.header + 8, paddingHorizontal: 12, paddingBottom: 10, gap: 12 },
  cardWrap: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', maxWidth: 560, height: '100%', maxHeight: 620, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 26, gap: 18 },
  cardBack: { alignItems: 'stretch', justifyContent: 'flex-start', paddingTop: 30, paddingHorizontal: 20, paddingBottom: 58 },
  word: { maxWidth: '100%', fontSize: 42, fontWeight: '900', lineHeight: 46, color: C.text1, textAlign: 'center' },
  backScroll: { width: '100%', flex: 1 },
  backContent: { width: '100%', paddingTop: 4, paddingBottom: 50, gap: 7 },
  backLabel: { marginTop: 12 },
  translation: { fontSize: 19, fontWeight: '800', lineHeight: 27, color: C.text1 },
  copyText: { fontSize: T.body, lineHeight: 21, color: C.text2 },
  cardActions: { position: 'absolute', zIndex: 5, left: 12, right: 12, bottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardAction: { minWidth: 44, minHeight: 42, padding: 7, alignItems: 'center', justifyContent: 'center', gap: 3 },
  cardActionDisabled: { opacity: .28 },
  cardActionIcon: { fontSize: 20, lineHeight: 20, color: C.text2 },
  decisions: { width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 58, paddingTop: 2 },
  decision: { width: 68, minHeight: 66, alignItems: 'center', gap: 5 },
  decisionIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  unknownIcon: { borderColor: C.danger, backgroundColor: 'rgba(152,86,76,.045)' },
  knownIcon: { borderColor: C.success, backgroundColor: 'rgba(93,118,84,.045)' },
  unknownGlyph: { color: C.dangerStrong },
  knownGlyph: { color: C.successStrong },
  decisionGlyph: { fontSize: 22, fontWeight: '800' },
  results: { paddingTop: theme.control.header + 18, paddingHorizontal: 12, paddingBottom: 24, gap: 14 },
  problemRow: { minHeight: 52, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  problemCopy: { flex: 1, minWidth: 0 },
  problemWord: { fontSize: 15, fontWeight: '700', color: C.text1 },
  problemTrans: { marginTop: 2, fontSize: T.caption, color: C.text2 },
  problemFails: { color: C.dangerStrong },
  resultFooter: { alignItems: 'flex-end', paddingTop: 2 },
  resultButton: { width: 176, maxWidth: '52%' },
  pressed: { opacity: .7, transform: [{ translateY: 1 }] },
});
