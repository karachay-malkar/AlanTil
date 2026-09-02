import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { applyTestAnswer, buildTestOptions, initializeTestState, restoreTestStateSnapshot, testCompletionSummary, testStateSnapshot } from '../../packages/alantil-core/test.js';
import { initializeMatchState, markMatchSolved, matchCompletionSummary, matchSessionWords, matchStateSnapshot, recordMatchMismatch, restoreMatchStateSnapshot, takeNextMatchRound } from '../../packages/alantil-core/match.js';
import { toggleFavorite } from '../../packages/alantil-core/favorites.js';
import { masteryLevelForPercent } from '../../packages/alantil-core/mastery.js';
import { buildPracticeScope, practiceScopeKey, practiceSelectedPool, practiceWordScopeKey } from '../../packages/alantil-core/practice-scope.js';
import { toggleFavorite } from '../../packages/alantil-core/favorites.js';
import { masteryLevelForPercent } from '../../packages/alantil-core/mastery.js';
import { buildPracticeScope, practiceScopeKey, practiceSelectedPool, practiceWordScopeKey } from '../../packages/alantil-core/practice-scope.js';
import { shuffle } from '../../packages/alantil-core/word-selection.js';
import { Button, FavoriteButton, Header, Screen } from '../ui/components.js';
import { theme } from '../ui/theme.js';
import { clearNativeSessionSnapshot, loadNativeSessionSnapshot, saveNativeSessionSnapshot } from '../platform/session-store.js';
import { recordNativeMatchSession, recordNativeTestSession } from '../platform/progress.js';

const C = theme.colors;
const T = theme.type;

function BracketCheck({ checked, onPress }) {
  return <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }} style={styles.checkHit}><View style={styles.bracketCheck}><Text style={[styles.bracketGlyph, checked && styles.bracketGlyphOn]}>[</Text><Text style={[styles.bracketMark, checked && styles.bracketMarkOn]}>{checked ? '✓' : ' '}</Text><Text style={[styles.bracketGlyph, checked && styles.bracketGlyphOn]}>]</Text></View></Pressable>;
}

function ScopePicker({ words, selectedKeys, setSelectedKeys }) {
  const scope = useMemo(() => buildPracticeScope(words), [words]);
  const toggleSection = (dictionaryId, sectionId) => setSelectedKeys((current) => {
    const next = new Set(current);
    const key = practiceScopeKey(dictionaryId, sectionId);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const toggleDictionary = (dictionary) => setSelectedKeys((current) => {
    const next = new Set(current);
    const keys = dictionary.sections.map((section) => practiceScopeKey(dictionary.id, section.id));
    const all = keys.every((key) => next.has(key));
    keys.forEach((key) => all ? next.delete(key) : next.add(key));
    return next;
  });
  return <View style={styles.scopeList}>{scope.map((dictionary) => {
    const keys = dictionary.sections.map((section) => practiceScopeKey(dictionary.id, section.id));
    const all = keys.length > 0 && keys.every((key) => selectedKeys.has(key));
    return <View key={dictionary.id} style={styles.scopeBlock}><View style={styles.scopeDictRow}><BracketCheck checked={all} onPress={() => toggleDictionary(dictionary)} /><View style={styles.scopeCopy}><Text numberOfLines={1} style={styles.scopeDict}>{dictionary.name}</Text><Text style={styles.scopeCount}>{dictionary.count}</Text></View></View>{dictionary.sections.map((section) => {
      const key = practiceScopeKey(dictionary.id, section.id);
      return <View key={key} style={styles.scopeSectionRow}><BracketCheck checked={selectedKeys.has(key)} onPress={() => toggleSection(dictionary.id, section.id)} /><View style={styles.scopeCopy}><Text numberOfLines={1} style={styles.scopeSection}>{section.name}</Text><Text style={styles.scopeCount}>{section.count}</Text></View></View>;
    })}</View>;
  })}</View>;
}

function LimitControl({ value, onChange }) {
  return <View style={styles.limitControl}>{[20, 40, 80].map((limit) => <Pressable key={limit} onPress={() => onChange(limit)} style={[styles.limitItem, value === limit && styles.limitActive]}><Text style={[styles.limitText, value === limit && styles.limitTextActive]}>{limit}</Text></Pressable>)}</View>;
}

function DirectionControl({ value, onChange }) {
  return <View style={styles.direction}><Text style={styles.directionLabel}>НАПРАВЛЕНИЕ</Text><View style={styles.directionControl}><Pressable onPress={() => onChange('kb')} style={[styles.directionItem, value === 'kb' && styles.directionActive]}><Text style={[styles.directionText, value === 'kb' && styles.directionTextActive]}>алан → рус</Text></Pressable><Pressable onPress={() => onChange('ru')} style={[styles.directionItem, value === 'ru' && styles.directionActive]}><Text style={[styles.directionText, value === 'ru' && styles.directionTextActive]}>рус → алан</Text></Pressable></View></View>;
}

function GameMenu({ type, words, onBack, onStart }) {
  const allKeys = useMemo(() => new Set(words.map(practiceWordScopeKey)), [words]);
  const [selectedKeys, setSelectedKeys] = useState(allKeys);
  const [limit, setLimit] = useState(40);
  const [mode, setMode] = useState('kb');
  const pool = useMemo(() => practiceSelectedPool(words, selectedKeys), [words, selectedKeys]);
  const selectedCount = Math.min(limit, pool.length);
  return <Screen><Header title={type === 'test' ? 'Проверь знания' : 'Сопоставление'} onBack={onBack} /><ScrollView contentContainerStyle={styles.menuScroll}><View style={styles.modeLead}><Text style={styles.modeLeadValue}>Выбрано: {pool.length}</Text><Text style={styles.modeLeadHint}>игра: {selectedCount}</Text></View><ScopePicker words={words} selectedKeys={selectedKeys} setSelectedKeys={setSelectedKeys} /><View style={styles.optionSection}><Text style={styles.optionLabel}>Количество слов</Text><LimitControl value={limit} onChange={setLimit} /></View></ScrollView><View style={styles.launchBar}>{type === 'test' ? <DirectionControl value={mode} onChange={setMode} /> : null}<View style={styles.launchButton}><Button primary disabled={!pool.length} onPress={() => onStart(pool, limit, mode)}>{type === 'test' ? 'Начать тест' : 'Начать игру'}</Button></View></View></Screen>;
}

function SessionProgress({ current, total }) {
  const percent = total ? Math.max(0, Math.min(100, ((current - 1) / total) * 100)) : 0;
  return <View style={styles.sessionProgress}><View style={[styles.sessionProgressFill, { width: `${percent}%` }]} /></View>;
}

export function GeneralTestFlow({ words, favorites, setFavorites, onBack }) {
  const [phase, setPhase] = useState('loading');
  const [state, setState] = useState(null);
  const [selected, setSelected] = useState(null);
  const recorded = useRef(false);

  useEffect(() => {
    let alive = true;
    loadNativeSessionSnapshot('test').then((snapshot) => {
      if (!alive) return;
      const restored = restoreTestStateSnapshot(snapshot, words, words);
      if (restored) {
        setState(restored);
        setPhase(restored.index >= restored.items.length ? 'results' : 'session');
      } else setPhase('menu');
    });
    return () => { alive = false; };
  }, [words]);

  const start = (pool, limit, mode) => {
    const now = new Date().toISOString();
    const next = { mode, limit, items: [], optionPool: [], index: 0, correct: 0, selectedAnswer: null, results: [], session: { id: `test-${Date.now()}`, startedAt: now } };
    initializeTestState(next, pool, mode, limit, {}, words);
    next.session.id = `test-${Date.now()}`;
    next.session.startedAt = now;
    recorded.current = false;
    setState(next);
    setSelected(null);
    setPhase('session');
    saveNativeSessionSnapshot('test', testStateSnapshot(next)).catch(() => {});
  };
  const leave = () => {
    if (phase === 'session' && state) saveNativeSessionSnapshot('test', testStateSnapshot(state)).catch(() => {});
    onBack();
  };
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { leave(); return true; }); return () => sub.remove(); }, [phase, state, onBack]);
  useEffect(() => {
    if (phase !== 'results' || !state || recorded.current) return;
    recorded.current = true;
    const result = testCompletionSummary(state);
    recordNativeTestSession({ sessionId: state.session.id || `test-${Date.now()}`, answers: state.results.map((row) => ({ word_id: row.id, result: row.isCorrect ? 'correct' : 'wrong' })), accuracy: result.accuracy_percent, updateMastery: false, startedAt: state.session.startedAt, type: 'test' }).catch(() => {});
    clearNativeSessionSnapshot('test').catch(() => {});
  }, [phase, state]);

  if (phase === 'loading') return <Screen><Header title="Проверь знания" onBack={leave} /><View style={styles.loading}><Text style={styles.modeLeadHint}>Восстанавливаем сессию…</Text></View></Screen>;
  if (phase === 'menu') return <GameMenu type="test" words={words} onBack={leave} onStart={start} />;
  if (phase === 'results') {
    const result = testCompletionSummary(state);
    const level = masteryLevelForPercent(result.accuracy_percent);
    return <Screen><Header title="Результаты теста" onBack={leave} /><View style={styles.resultsView}><View style={styles.resultSummary}><Text style={styles.resultMark}>{level ? '⌃'.repeat(level) : '—'}</Text><Text style={styles.resultScore}>{result.accuracy_percent}%</Text><Text style={styles.resultStatus}>{result.accuracy_percent >= 80 ? 'Тест сдан' : 'Тест не сдан'} · {result.correct_count}/{result.questions_total}</Text></View><ScrollView contentContainerStyle={styles.resultList}>{state.results.map((row) => <View key={`${row.id}-${row.questionText}`} style={styles.resultRow}><View style={[styles.resultStatusDot, row.isCorrect ? styles.okDot : styles.badDot]}><Text style={styles.resultStatusGlyph}>{row.isCorrect ? '✓' : '×'}</Text></View><View style={styles.resultCopy}><Text numberOfLines={1} style={styles.resultPrimary}>{row.questionText || row.word}</Text>{!row.isCorrect ? <View style={styles.answerLine}><Text style={styles.answerWrongLabel}>Ответ</Text><Text numberOfLines={1} style={styles.resultWrong}>{row.userAnswer || '—'}</Text></View> : null}<View style={styles.answerLine}><Text style={styles.answerCorrectLabel}>Правильно</Text><Text numberOfLines={1} style={styles.resultCorrect}>{row.correctAnswer}</Text></View></View><FavoriteButton active={favorites.has(String(row.id))} onPress={() => setFavorites(toggleFavorite(favorites, row.id).ids)} /></View>)}</ScrollView><View style={styles.retryBar}><View style={styles.retryButton}><Button primary onPress={() => start(state.session.wordsPool, state.limit, state.mode)}>Пройти ещё раз</Button></View></View></View></Screen>;
  }

  const item = state.items[state.index];
  if (!item) { setTimeout(() => setPhase('results'), 0); return <Screen />; }
  const options = buildTestOptions(state, item);
  const answer = () => {
    if (!selected) return;
    applyTestAnswer(state, selected);
    setSelected(null);
    setState({ ...state });
    if (state.index >= state.items.length) setPhase('results'); else saveNativeSessionSnapshot('test', testStateSnapshot(state)).catch(() => {});
  };
  return <Screen><Header title="Проверь знания" onBack={leave} sessionStatus={{ counter: `${state.index + 1}/${state.items.length}` }} /><View style={styles.session}><SessionProgress current={state.index + 1} total={state.items.length} /><View style={styles.question}><Text style={styles.questionText}>{state.mode === 'kb' ? item.word : item.trans}</Text></View><ScrollView contentContainerStyle={styles.options}>{options.map((option) => <Pressable key={`${item.id}-${option.id}`} onPress={() => setSelected(option)} style={({ pressed }) => [styles.choice, selected?.id === option.id && styles.choiceSelected, pressed && styles.choicePressed]}><Text style={[styles.choiceText, selected?.id === option.id && styles.choiceTextSelected]}>{option.text}</Text></Pressable>)}</ScrollView><View style={styles.answerBar}><View style={styles.answerButton}><Button primary disabled={!selected} onPress={answer}>Ответить</Button></View></View></View></Screen>;
}

export function GeneralMatchFlow({ words, favorites, setFavorites, onBack }) {
  const [phase, setPhase] = useState('loading');
  const [state, setState] = useState(null);
  const [round, setRound] = useState([]);
  const [rightOrder, setRightOrder] = useState([]);
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const [wrongPair, setWrongPair] = useState(null);
  const lockRef = useRef(false);
  const recorded = useRef(false);

  const installRound = (nextRound) => {
    setRound(nextRound);
    setRightOrder(shuffle(nextRound.slice()));
    setLeft(null);
    setRight(null);
  };

  useEffect(() => {
    let alive = true;
    loadNativeSessionSnapshot('match').then((snapshot) => {
      if (!alive) return;
      const restored = restoreMatchStateSnapshot(snapshot, words);
      if (restored) {
        setState(restored);
        const current = restored.rounds[Math.max(0, restored.roundIndex - 1)] || takeNextMatchRound(restored);
        installRound(current);
        setPhase(restored.solvedCount >= restored.total ? 'results' : 'game');
      } else setPhase('menu');
    });
    return () => { alive = false; };
  }, [words]);

  const start = (pool, limit) => {
    const now = new Date().toISOString();
    const next = { session: { id: `match-${Date.now()}`, startedAt: now } };
    initializeMatchState(next, pool, limit, {});
    next.session.id = `match-${Date.now()}`;
    next.session.startedAt = now;
    const first = takeNextMatchRound(next);
    recorded.current = false;
    setState(next);
    installRound(first);
    setWrongPair(null);
    setPhase('game');
    saveNativeSessionSnapshot('match', matchStateSnapshot(next)).catch(() => {});
  };
  const leave = () => {
    if (phase === 'game' && state) saveNativeSessionSnapshot('match', matchStateSnapshot(state)).catch(() => {});
    onBack();
  };
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { leave(); return true; }); return () => sub.remove(); }, [phase, state, onBack]);
  useEffect(() => {
    if (phase !== 'results' || !state || recorded.current) return;
    recorded.current = true;
    recordNativeMatchSession({ sessionId: state.session.id || `match-${Date.now()}`, words: matchSessionWords(state), startedAt: state.session.startedAt }).catch(() => {});
    clearNativeSessionSnapshot('match').catch(() => {});
  }, [phase, state]);

  if (phase === 'loading') return <Screen><Header title="Сопоставление" onBack={leave} /><View style={styles.loading}><Text style={styles.modeLeadHint}>Восстанавливаем сессию…</Text></View></Screen>;
  if (phase === 'menu') return <GameMenu type="match" words={words} onBack={leave} onStart={start} />;
  if (phase === 'results') {
    const summary = matchCompletionSummary(state);
    const problems = Object.entries(state.failMap).filter(([, count]) => count > 0).map(([id, count]) => ({ ...words.find((word) => String(word.id) === String(id)), fails: count })).filter((word) => word.id).sort((a, b) => b.fails - a.fails);
    return <Screen><Header title="Сопоставление" onBack={leave} /><ScrollView contentContainerStyle={styles.resultScroll}><View style={styles.resultSummary}><Text style={styles.resultMark}>{summary.errors_count ? '—' : '⌃⌃⌃'}</Text><Text style={styles.matchResultScore}>{summary.pairs_completed}/{summary.pairs_total}</Text><Text style={styles.resultStatus}>Ошибок: {summary.errors_count}</Text></View>{problems.length ? <View style={styles.resultList}>{problems.map((word) => <View key={word.id} style={styles.resultRow}><View style={[styles.resultStatusDot, styles.badDot]}><Text style={styles.resultStatusGlyph}>{word.fails}</Text></View><View style={styles.resultCopy}><Text style={styles.resultPrimary}>{word.word}</Text><Text style={styles.resultCorrect}>{word.trans}</Text></View><FavoriteButton active={favorites.has(String(word.id))} onPress={() => setFavorites(toggleFavoriteSet(favorites, word.id))} /></View>)}</View> : <View style={styles.perfect}><Text style={styles.perfectTitle}>Аперим!</Text><Text style={styles.resultCorrect}>Все пары собраны с первого раза.</Text></View>}<View style={styles.retryInline}><View style={styles.retryButton}><Button primary onPress={() => start(state.session.wordsPool || state.items, state.limit)}>Пройти ещё раз</Button></View></View></ScrollView></Screen>;
  }

  const active = round.filter((word) => !state.solved.has(String(word.id)));
  if (!active.length) {
    if (state.solvedCount >= state.total) setTimeout(() => setPhase('results'), 0);
    else {
      const next = takeNextMatchRound(state);
      saveNativeSessionSnapshot('match', matchStateSnapshot(state)).catch(() => {});
      setTimeout(() => installRound(next), 0);
    }
    return <Screen />;
  }

  const choose = (side, word) => {
    if (lockRef.current) return;
    if (side === 'left') setLeft(word); else setRight(word);
    const first = side === 'left' ? word : left;
    const second = side === 'right' ? word : right;
    if (!first || !second) return;
    if (String(first.id) === String(second.id)) {
      markMatchSolved(state, first.id);
      setLeft(null);
      setRight(null);
      setState({ ...state });
      saveNativeSessionSnapshot('match', matchStateSnapshot(state)).catch(() => {});
      return;
    }
    lockRef.current = true;
    const pair = { leftId: String(first.id), rightId: String(second.id) };
    setWrongPair(pair);
    setTimeout(() => {
      recordMatchMismatch(state, first.id, second.id);
      setWrongPair(null);
      setLeft(null);
      setRight(null);
      setState({ ...state });
      saveNativeSessionSnapshot('match', matchStateSnapshot(state)).catch(() => {});
      lockRef.current = false;
    }, 240);
  };

  const rightCards = rightOrder.filter((word) => !state.solved.has(String(word.id)));
  return <Screen><Header title="Сопоставление" onBack={leave} sessionStatus={{ counter: `${state.solvedCount}/${state.total}` }} /><View style={styles.matchGame}><View style={styles.matchColumn}>{active.map((word) => {
    const selected = left?.id === word.id;
    const wrong = wrongPair?.leftId === String(word.id);
    return <Pressable key={`l-${word.id}`} onPress={() => choose('left', word)} style={({ pressed }) => [styles.matchCard, selected && styles.matchCardSelected, wrong && styles.matchCardWrong, pressed && styles.matchCardPressed]}><Text style={[styles.matchCardText, wrong && styles.matchCardWrongText]}>{word.word}</Text></Pressable>;
  })}</View><View style={styles.matchColumn}>{rightCards.map((word) => {
    const selected = right?.id === word.id;
    const wrong = wrongPair?.rightId === String(word.id);
    return <Pressable key={`r-${word.id}`} onPress={() => choose('right', word)} style={({ pressed }) => [styles.matchCard, selected && styles.matchCardSelected, wrong && styles.matchCardWrong, pressed && styles.matchCardPressed]}><Text style={[styles.matchCardText, wrong && styles.matchCardWrongText]}>{word.trans}</Text></Pressable>;
  })}</View></View></Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  menuScroll: { paddingTop: theme.control.header + 4, paddingHorizontal: 12, paddingBottom: 150 },
  modeLead: { minHeight: 34, paddingHorizontal: 2, paddingTop: 3, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.lineSoft, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  modeLeadValue: { fontFamily: theme.font.terminal, fontSize: T.caption, fontWeight: '800', color: C.text1 },
  modeLeadHint: { fontFamily: theme.font.terminal, fontSize: 9, fontWeight: '700', color: C.text3 },
  scopeList: { gap: 0 },
  scopeBlock: { borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  scopeDictRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2, paddingVertical: 7 },
  scopeSectionRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 24, paddingRight: 2, paddingVertical: 6 },
  scopeCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  scopeDict: { flex: 1, fontSize: 13, fontWeight: '800', color: C.text1 },
  scopeSection: { flex: 1, fontSize: 12, color: C.text2 },
  scopeCount: { fontFamily: theme.font.terminal, fontSize: 9, fontWeight: '700', color: C.text3 },
  checkHit: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  bracketCheck: { minWidth: 29, height: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  bracketGlyph: { fontFamily: theme.font.terminal, fontSize: 15, fontWeight: '700', color: C.text3 },
  bracketGlyphOn: { color: C.accentStrong },
  bracketMark: { width: 10, fontFamily: theme.font.terminal, fontSize: 10, fontWeight: '900', color: 'transparent', textAlign: 'center' },
  bracketMarkOn: { color: C.accentStrong },
  optionSection: { marginTop: 15 },
  optionLabel: { fontFamily: theme.font.terminal, fontSize: T.caption, fontWeight: '800', color: C.text1, marginBottom: 7 },
  limitControl: { flexDirection: 'row', gap: 0, padding: 2, borderWidth: 1, borderColor: C.line, borderRadius: 999 },
  limitItem: { flex: 1, minHeight: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  limitActive: { backgroundColor: 'rgba(246,242,233,.86)' },
  limitText: { fontFamily: theme.font.terminal, fontSize: T.caption, fontWeight: '800', color: C.text3 },
  limitTextActive: { color: C.text1 },
  launchBar: { position: 'absolute', left: 12, right: 12, bottom: 10, zIndex: 30, gap: 7, paddingTop: 4, backgroundColor: 'transparent' },
  launchButton: { width: 190, maxWidth: '54%', alignSelf: 'flex-end' },
  direction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  directionLabel: { fontFamily: theme.font.terminal, fontSize: 9, fontWeight: '700', letterSpacing: .45, color: C.text3 },
  directionControl: { width: '72%', maxWidth: 250, flexDirection: 'row', padding: 2, borderWidth: 1, borderColor: C.line, borderRadius: 999 },
  directionItem: { flex: 1, minHeight: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  directionActive: { backgroundColor: 'rgba(246,242,233,.86)' },
  directionText: { fontFamily: theme.font.terminal, fontSize: 10, fontWeight: '700', color: C.text3 },
  directionTextActive: { color: C.text1 },
  session: { flex: 1, paddingTop: theme.control.header + 8, paddingHorizontal: 12, paddingBottom: 10, gap: 9 },
  sessionProgress: { height: 2, backgroundColor: 'rgba(41,39,34,.10)', overflow: 'hidden' },
  sessionProgressFill: { height: 2, backgroundColor: C.text1 },
  question: { flex: 1, minHeight: 150, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 4, paddingBottom: 8 },
  questionText: { fontSize: 34, fontWeight: '900', lineHeight: 37, color: C.text1, textAlign: 'center' },
  options: { flexGrow: 1, justifyContent: 'center', gap: 8, paddingBottom: 62 },
  choice: { width: '100%', minHeight: theme.control.normal, borderWidth: 1, borderColor: C.line, borderRadius: 2, backgroundColor: 'rgba(246,242,233,.46)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 9 },
  choiceSelected: { borderColor: C.accentStrong, backgroundColor: C.accentSoft },
  choicePressed: { transform: [{ translateY: 1 }] },
  choiceText: { fontSize: 14, fontWeight: '700', color: C.text1, textAlign: 'center' },
  choiceTextSelected: { color: C.accentStrong },
  answerBar: { position: 'absolute', left: 12, right: 12, bottom: 10, alignItems: 'flex-end' },
  answerButton: { width: 190, maxWidth: '54%' },
  resultsView: { flex: 1, paddingTop: theme.control.header },
  resultScroll: { paddingTop: theme.control.header + 8, paddingHorizontal: 12, paddingBottom: 28 },
  resultSummary: { minHeight: 118, padding: 8, borderBottomWidth: 1, borderBottomColor: C.lineSoft, alignItems: 'center', justifyContent: 'center' },
  resultMark: { fontFamily: theme.font.terminal, fontSize: 18, fontWeight: '900', color: C.accentStrong, textAlign: 'center' },
  resultScore: { fontFamily: theme.font.terminal, fontSize: 42, fontWeight: '900', lineHeight: 44, color: C.text1, textAlign: 'center', marginTop: 3 },
  matchResultScore: { fontFamily: theme.font.terminal, fontSize: 42, fontWeight: '900', lineHeight: 44, color: C.text1, textAlign: 'center', marginTop: 3 },
  resultStatus: { fontSize: T.caption, color: C.text2, textAlign: 'center', marginTop: 6 },
  resultList: { paddingHorizontal: 12 },
  resultRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.lineSoft, paddingVertical: 7 },
  resultStatusDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  okDot: { backgroundColor: C.successSoft },
  badDot: { backgroundColor: C.dangerSoft },
  resultStatusGlyph: { fontFamily: theme.font.terminal, fontSize: 11, fontWeight: '900', color: C.text1 },
  resultCopy: { flex: 1, minWidth: 0 },
  resultPrimary: { fontSize: 14, fontWeight: '800', color: C.text1 },
  answerLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  answerWrongLabel: { fontFamily: theme.font.terminal, fontSize: 10, fontWeight: '800', color: C.danger },
  answerCorrectLabel: { fontFamily: theme.font.terminal, fontSize: 10, fontWeight: '800', color: C.successStrong },
  resultWrong: { flex: 1, fontSize: 13, lineHeight: 17, color: C.text2 },
  resultCorrect: { flex: 1, fontSize: 13, lineHeight: 17, color: C.text2 },
  retryBar: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, alignItems: 'flex-end' },
  retryInline: { paddingTop: 14, alignItems: 'flex-end' },
  retryButton: { width: 190, maxWidth: '54%' },
  perfect: { alignItems: 'center', paddingVertical: 28 },
  perfectTitle: { fontSize: 22, fontWeight: '900', color: C.text1, marginBottom: 6 },
  matchGame: { flex: 1, paddingTop: theme.control.header + 12, paddingHorizontal: 9, paddingBottom: 14, flexDirection: 'row', gap: 8 },
  matchColumn: { flex: 1, gap: 7, minWidth: 0 },
  matchCard: { flex: 1, minHeight: theme.control.normal, maxHeight: 78, borderWidth: 1, borderColor: C.line, borderRadius: 2, backgroundColor: 'rgba(246,242,233,.46)', alignItems: 'center', justifyContent: 'center', padding: 8 },
  matchCardSelected: { borderColor: C.accent, backgroundColor: C.accentSoft },
  matchCardWrong: { borderColor: C.danger, backgroundColor: C.dangerSoft, transform: [{ translateX: -2 }] },
  matchCardPressed: { opacity: .82 },
  matchCardText: { fontSize: 13, fontWeight: '700', lineHeight: 16, color: C.text1, textAlign: 'center' },
  matchCardWrongText: { color: C.dangerStrong },
});
