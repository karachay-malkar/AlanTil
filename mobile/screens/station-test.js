import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { applyStationTestAnswer, buildStationTestSessionState, stationTestActiveSnapshot, stationTestPayload, stationTestResult } from '../../packages/alantil-core/station-test.js';
import { toggleFavorite } from '../../packages/alantil-core/favorites.js';
import { Button, FavoriteButton, Header, ProgressBar, Screen, SectionLabel } from '../ui/components.js';
import { EmptyState, MetricStrip, MonoLabel, ScreenSection, SurfaceCard } from '../ui/parity.js';
import { theme } from '../ui/theme.js';
import { recordNativeTestSession } from '../platform/progress.js';
import { clearNativeSessionSnapshot, loadNativeSessionSnapshot, saveNativeSessionSnapshot } from '../platform/session-store.js';

const C = theme.colors;
const T = theme.type;

export function StationTestScreen({ station, allWords, mode = 'kb', favorites = new Set(), setFavorites = () => {}, onBack }) {
  const [session, setSession] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [, redraw] = useState(0);
  const recorded = useRef(false);

  const createSession = (interrupted = null) => buildStationTestSessionState({
    station,
    optionWords: allWords,
    mode,
    interrupted,
    id: `station-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: new Date().toISOString(),
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const interrupted = await loadNativeSessionSnapshot('station-test');
      const next = createSession(interrupted);
      if (alive) setSession(next);
    })();
    return () => { alive = false; };
  }, [station, allWords, mode]);

  const question = session?.questions?.[session.index];
  const done = Boolean(session && !question);
  const result = useMemo(() => done ? stationTestResult(session, stationTestPayload(session)) : null, [done, session]);
  useEffect(() => { setSelectedId(''); }, [session?.index]);

  useEffect(() => {
    if (!done || !result || recorded.current) return;
    recorded.current = true;
    session.completed = true;
    const payload = stationTestPayload(session);
    recordNativeTestSession({ sessionId: session.id, answers: payload.words.map((row) => ({ word_id: row.word_id, result: row.result })), accuracy: payload.accuracy, requiredAccuracy: payload.required_accuracy, updateMastery: true, startedAt: session.startedAt, type: 'station_test', stationKey: station?.key || '', phase: payload.phase || session.phase || '' }).catch(() => {});
    clearNativeSessionSnapshot('station-test').catch(() => {});
  }, [done, result, session, station?.key]);

  const back = () => {
    if (session && !session.completed) saveNativeSessionSnapshot('station-test', stationTestActiveSnapshot(session)).catch(() => {});
    onBack();
  };
  const retry = async () => {
    await clearNativeSessionSnapshot('station-test').catch(() => {});
    recorded.current = false;
    setSelectedId('');
    const next = createSession(null);
    setSession(next);
    redraw((value) => value + 1);
    saveNativeSessionSnapshot('station-test', stationTestActiveSnapshot(next)).catch(() => {});
  };
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; }); return () => sub.remove(); }, [session, onBack]);

  if (!session) return <Screen><Header title="Проверь знания" subtitle={station?.name || ''} onBack={onBack} /><View style={styles.center}><EmptyState>Восстанавливаем попытку…</EmptyState></View></Screen>;

  if (done && result) {
    const levelSymbol = result.masteryLevel ? '⌃'.repeat(result.masteryLevel) : '—';
    const levelName = result.masteryLevel ? `${['', 'I', 'II', 'III'][result.masteryLevel]} знак` : 'не сдан';
    return <Screen><Header title="Результат этапа" subtitle={station?.name || ''} onBack={onBack} /><ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}><SectionLabel>{result.passed ? 'ЭТАП ПРОЙДЕН' : 'НУЖНО ПОВТОРИТЬ'}</SectionLabel><SurfaceCard style={styles.scoreCard}><Text style={[styles.score, result.passed ? styles.scorePassed : styles.scoreFailed]}>{result.payload.accuracy}%</Text><Text style={styles.scoreCaption}>{result.payload.correct_total} из {result.payload.questions_total} · проходной {result.required}%</Text><View style={styles.masteryLine}><View><MonoLabel>УРОВЕНЬ</MonoLabel><Text style={styles.masteryName}>{levelName}</Text></View><View style={styles.masteryBadge}><Text style={styles.masteryValue}>{levelSymbol}</Text></View></View><MetricStrip items={[[String(result.payload.correct_total), 'верно'], [String(result.payload.wrong_total), 'ошибок'], [String(result.payload.questions_total), 'вопросов']]} /></SurfaceCard><ScreenSection title="Ответы"><SurfaceCard>{session.answers.map((answer, index) => { const source = session.questions[index]; const correct = answer.result === 'correct'; const selected = source?.options?.find((option) => String(option.id) === String(answer.wrongWordId || source?.item?.id)); const wordId=String(answer.wordId||source?.item?.id||''); return <View key={`${wordId}-${index}`} style={styles.resultRow}><View style={[styles.resultDot, correct ? styles.resultDotCorrect : styles.resultDotWrong]}><Text style={styles.resultDotGlyph}>{correct ? '✓' : '×'}</Text></View><View style={styles.resultCopy}><Text numberOfLines={1} style={styles.resultPrimary}>{session.mode === 'ru' ? source?.item?.trans : source?.item?.word}</Text>{!correct ? <Text numberOfLines={1} style={styles.resultWrong}>Ответ: {selected?.text || '—'}</Text> : null}<Text numberOfLines={1} style={styles.resultCorrect}>Правильно: {session.mode === 'ru' ? source?.item?.word : source?.item?.trans}</Text></View><FavoriteButton active={favorites.has(wordId)} onPress={()=>setFavorites(toggleFavorite(favorites,wordId).ids)}/></View>; })}</SurfaceCard></ScreenSection><View style={styles.footer}><Button text style={styles.footerButton} onPress={onBack}>К этапу</Button>{!result.passed?<Button primary style={styles.footerButton} onPress={retry}>Повторить</Button>:null}</View></ScrollView></Screen>;
  }

  const prompt = session.mode === 'ru' ? question.item.trans : question.item.word;
  const progress = session.questions.length ? (session.index / session.questions.length) * 100 : 0;
  const submit = () => {
    if (!selectedId) return;
    applyStationTestAnswer(session, selectedId);
    saveNativeSessionSnapshot('station-test', stationTestActiveSnapshot(session)).catch(() => {});
    setSelectedId('');
    setSession(session);
    redraw((value) => value + 1);
  };

  return <Screen><Header title="Проверь знания" subtitle={station?.name || ''} onBack={back} sessionStatus={{ counter: `${session.index + 1}/${session.questions.length}`, mode: mode === 'ru' ? 'РУС → АЛАН' : 'АЛАН → РУС' }} /><View style={styles.testView}><ProgressBar value={progress} /><ScrollView contentContainerStyle={styles.testScroll} showsVerticalScrollIndicator={false}><SurfaceCard inset style={styles.promptBlock}><MonoLabel>ВЫБЕРИТЕ ПРАВИЛЬНЫЙ ОТВЕТ</MonoLabel><Text style={styles.prompt}>{prompt}</Text></SurfaceCard><View style={styles.options}>{question.options.map((option) => { const selected = selectedId === String(option.id); return <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={`${question.item.id}-${option.id}`} onPress={() => setSelectedId(String(option.id))} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}><Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.text}</Text></Pressable>; })}</View></ScrollView><View style={styles.answerBar}><Button primary style={styles.answerButton} disabled={!selectedId} onPress={submit}>Ответить</Button></View></View></Screen>;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  testView: { flex: 1, paddingTop: theme.control.header + 8, paddingHorizontal: 12, gap: 8 },
  testScroll: { flexGrow: 1, paddingTop: 4, paddingBottom: 92, gap: 12 },
  promptBlock: { minHeight: 210, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, gap: 16 },
  prompt: { fontSize: 34, fontWeight: '900', lineHeight: 39, color: C.text1, textAlign: 'center' },
  options: { gap: 9 },
  option: { minHeight: 52, borderWidth: 1, borderColor: C.line, borderRadius: theme.radius.sm, backgroundColor: C.surface0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  optionSelected: { borderColor: C.accentStrong, backgroundColor: C.accentSoft },
  optionPressed: { transform: [{ translateY: 1 }], opacity: .8 },
  optionText: { fontSize: 15, fontWeight: '700', lineHeight: 19, color: C.text1, textAlign: 'center' },
  optionTextSelected: { color: C.accentStrong },
  answerBar: { position: 'absolute', zIndex: 20, left: 12, right: 12, bottom: 10, alignItems: 'flex-end' },
  answerButton: { width: 176, maxWidth: '52%' },
  resultScroll: { paddingTop: theme.control.header + 22, paddingHorizontal: 12, paddingBottom: 26, gap: 14 },
  scoreCard: { overflow: 'hidden' },
  score: { fontFamily: theme.font.terminal, fontSize: 58, fontWeight: '800', lineHeight: 66, textAlign: 'center', marginTop: 18 },
  scorePassed: { color: C.successStrong },
  scoreFailed: { color: C.dangerStrong },
  scoreCaption: { fontSize: T.caption, lineHeight: 17, color: C.text2, textAlign: 'center', marginTop: 4 },
  masteryLine: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 12, borderTopWidth: 1, borderColor: C.lineSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  masteryName: { marginTop: 4, fontSize: T.micro, color: C.text3 },
  masteryBadge: { width: 64, height: 52, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  masteryValue: { fontFamily: theme.font.terminal, fontSize: 20, fontWeight: '900', color: C.accentStrong },
  resultRow: { minHeight: 62, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  resultDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  resultDotCorrect: { borderColor: C.success, backgroundColor: C.successSoft },
  resultDotWrong: { borderColor: C.danger, backgroundColor: C.dangerSoft },
  resultDotGlyph: { fontSize: 13, fontWeight: '900', color: C.text1 },
  resultCopy: { flex: 1, minWidth: 0, paddingVertical: 8 },
  resultPrimary: { fontSize: 14, fontWeight: '800', color: C.text1 },
  resultWrong: { marginTop: 3, fontSize: T.micro, color: C.dangerStrong },
  resultCorrect: { marginTop: 3, fontSize: T.micro, color: C.successStrong },
  footer: { flexDirection:'row', justifyContent:'flex-end', gap:8, paddingTop: 2 },
  footerButton: { width: 176, maxWidth: '48%' },
});