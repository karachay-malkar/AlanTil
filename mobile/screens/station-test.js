import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { applyStationTestAnswer, buildStationTestSessionState, stationTestActiveSnapshot, stationTestPayload, stationTestResult } from '../../packages/alantil-core/station-test.js';
import { Button, Header, Screen, SectionLabel } from '../ui/components.js';
import { theme } from '../ui/theme.js';
import { recordNativeTestSession } from '../platform/progress.js';
import { clearNativeSessionSnapshot, loadNativeSessionSnapshot, saveNativeSessionSnapshot } from '../platform/session-store.js';

const C = theme.colors;
const T = theme.type;

function SegmentedProgress({ current, total }) {
  const percent = total ? Math.max(0, Math.min(100, ((current - 1) / total) * 100)) : 0;
  return <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View>;
}

export function StationTestScreen({ station, allWords, mode = 'kb', onBack }) {
  const [session, setSession] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [, redraw] = useState(0);
  const recorded = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const interrupted = await loadNativeSessionSnapshot('station-test');
      const next = buildStationTestSessionState({ station, optionWords: allWords, mode, interrupted, id: `station-${Date.now()}`, startedAt: new Date().toISOString() });
      if (alive) setSession(next);
    })();
    return () => { alive = false; };
  }, [station, allWords, mode]);

  const question = session?.questions?.[session.index];
  const done = Boolean(session && !question);
  const result = useMemo(() => done ? stationTestResult(session, stationTestPayload(session)) : null, [done, session]);

  useEffect(() => {
    setSelectedId('');
  }, [session?.index]);

  useEffect(() => {
    if (!done || !result || recorded.current) return;
    recorded.current = true;
    session.completed = true;
    const payload = stationTestPayload(session);
    recordNativeTestSession({ sessionId: session.id, answers: payload.words.map((row) => ({ word_id: row.word_id, result: row.result })), accuracy: payload.accuracy, requiredAccuracy: payload.required_accuracy, updateMastery: true, startedAt: session.startedAt, type: 'station_test', stationKey: station?.key || '' }).catch(() => {});
    clearNativeSessionSnapshot('station-test').catch(() => {});
  }, [done, result, session, station?.key]);

  const back = () => {
    if (session) saveNativeSessionSnapshot('station-test', stationTestActiveSnapshot(session)).catch(() => {});
    onBack();
  };
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; }); return () => sub.remove(); }, [session, onBack]);

  if (!session) return <Screen><Header title="Проверь знания" subtitle={station?.name || ''} onBack={onBack} /><View style={styles.loading}><Text style={styles.loadingText}>Восстанавливаем попытку…</Text></View></Screen>;

  if (done && result) {
    const levelSymbol = result.masteryLevel ? '⌃'.repeat(result.masteryLevel) : '—';
    const levelName = result.masteryLevel ? `${['', 'I', 'II', 'III'][result.masteryLevel]} знак` : 'не сдан';
    return <Screen><Header title="Результат этапа" subtitle={station?.name || ''} onBack={onBack} /><ScrollView contentContainerStyle={styles.resultScroll}><SectionLabel>{result.passed ? 'ЭТАП ПРОЙДЕН' : 'НУЖНО ПОВТОРИТЬ'}</SectionLabel><Text style={[styles.score, result.passed ? styles.scorePassed : styles.scoreFailed]}>{result.payload.accuracy}%</Text><Text style={styles.scoreCaption}>{result.payload.correct_total} из {result.payload.questions_total} · проходной {result.required}%</Text><View style={styles.masteryLine}><View><Text style={styles.masteryLabel}>УРОВЕНЬ</Text><Text style={styles.masteryName}>{levelName}</Text></View><View style={styles.masteryBadge}><Text style={styles.masteryValue}>{levelSymbol}</Text></View></View><View style={styles.resultMetrics}><Metric value={String(result.payload.correct_total)} label="верно" /><Metric value={String(result.payload.wrong_total)} label="ошибок" /><Metric value={String(result.payload.questions_total)} label="вопросов" /></View><View style={styles.resultList}><Text style={styles.resultListHeading}>Ответы</Text>{session.answers.map((answer, index) => { const source = session.questions[index]; const correct = answer.result === 'correct'; const selected = source?.options?.find((option) => String(option.id) === String(answer.wrongWordId || source?.item?.id)); return <View key={`${answer.wordId}-${index}`} style={styles.resultRow}><View style={[styles.resultDot, correct ? styles.resultDotCorrect : styles.resultDotWrong]}><Text style={styles.resultDotGlyph}>{correct ? '✓' : '×'}</Text></View><View style={styles.resultCopy}><Text numberOfLines={1} style={styles.resultPrimary}>{session.mode === 'ru' ? source?.item?.trans : source?.item?.word}</Text>{!correct ? <Text numberOfLines={1} style={styles.resultWrong}>Ответ: {selected?.text || '—'}</Text> : null}<Text numberOfLines={1} style={styles.resultCorrect}>Правильно: {session.mode === 'ru' ? source?.item?.word : source?.item?.trans}</Text></View></View>; })}</View><View style={styles.footer}><View style={styles.footerButton}><Button primary onPress={onBack}>К этапу</Button></View></View></ScrollView></Screen>;
  }

  const prompt = session.mode === 'ru' ? question.item.trans : question.item.word;
  const submit = () => {
    if (!selectedId) return;
    applyStationTestAnswer(session, selectedId);
    saveNativeSessionSnapshot('station-test', stationTestActiveSnapshot(session)).catch(() => {});
    setSelectedId('');
    setSession(session);
    redraw((value) => value + 1);
  };

  return <Screen><Header title="Проверь знания" subtitle={station?.name || ''} onBack={back} sessionStatus={{ counter: `${session.index + 1}/${session.questions.length}` }} /><View style={styles.testView}><SegmentedProgress current={session.index + 1} total={session.questions.length} /><ScrollView contentContainerStyle={styles.testScroll}><View style={styles.promptBlock}><Text style={styles.prompt}>{prompt}</Text></View><View style={styles.options}>{question.options.map((option) => { const selected = selectedId === String(option.id); return <Pressable key={`${question.item.id}-${option.id}`} onPress={() => setSelectedId(String(option.id))} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}><Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.text}</Text></Pressable>; })}</View></ScrollView><View style={styles.answerBar}><View style={styles.answerButton}><Button primary disabled={!selectedId} onPress={submit}>Ответить</Button></View></View></View></Screen>;
}

function Metric({ value, label }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: T.caption, color: C.text3 },
  testView: { flex: 1, paddingTop: theme.control.header + 8 },
  progressTrack: { height: 2, marginHorizontal: 12, backgroundColor: 'rgba(41,39,34,.10)', overflow: 'hidden' },
  progressFill: { height: 2, backgroundColor: C.text1 },
  testScroll: { flexGrow: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 92 },
  promptBlock: { minHeight: 208, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  prompt: { fontSize: 34, fontWeight: '900', lineHeight: 39, color: C.text1, textAlign: 'center' },
  options: { gap: 9, marginTop: 4 },
  option: { minHeight: 52, borderWidth: 1, borderColor: C.line, borderRadius: theme.radius.sm, backgroundColor: 'rgba(246,242,233,.46)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  optionSelected: { borderColor: C.accentStrong, backgroundColor: C.accentSoft },
  optionPressed: { transform: [{ translateY: 1 }] },
  optionText: { fontSize: 15, fontWeight: '700', lineHeight: 19, color: C.text1, textAlign: 'center' },
  optionTextSelected: { color: C.accentStrong },
  answerBar: { position: 'absolute', zIndex: 20, left: 12, right: 12, bottom: 10, alignItems: 'flex-end' },
  answerButton: { width: 170, maxWidth: '48%' },
  resultScroll: { paddingTop: theme.control.header + 22, paddingHorizontal: 12, paddingBottom: 26 },
  score: { fontFamily: theme.font.terminal, fontSize: 58, fontWeight: '800', lineHeight: 66, textAlign: 'center', marginTop: 18 },
  scorePassed: { color: C.successStrong },
  scoreFailed: { color: C.dangerStrong },
  scoreCaption: { fontSize: T.caption, lineHeight: 17, color: C.text2, textAlign: 'center', marginTop: 4 },
  masteryLine: { marginTop: 28, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.lineSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  masteryLabel: { fontFamily: theme.font.terminal, fontSize: T.micro, fontWeight: '700', letterSpacing: .7, color: C.text2 },
  masteryName: { marginTop: 4, fontSize: T.micro, color: C.text3 },
  masteryBadge: { width: 64, height: 52, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  masteryValue: { fontFamily: theme.font.terminal, fontSize: 20, fontWeight: '900', color: C.accentStrong },
  resultMetrics: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  metric: { flex: 1, minHeight: 66, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: C.lineSoft },
  metricValue: { fontFamily: theme.font.terminal, fontSize: 18, fontWeight: '800', color: C.text1 },
  metricLabel: { fontSize: T.micro, color: C.text2, marginTop: 5 },
  resultList: { marginTop: 18 },
  resultListHeading: { fontSize: 15, fontWeight: '800', color: C.text1, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  resultRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  resultDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  resultDotCorrect: { borderColor: 'rgba(93,118,84,.48)', backgroundColor: C.successSoft },
  resultDotWrong: { borderColor: 'rgba(152,86,76,.48)', backgroundColor: C.dangerSoft },
  resultDotGlyph: { fontSize: 13, fontWeight: '900', color: C.text1 },
  resultCopy: { flex: 1, minWidth: 0, paddingVertical: 8 },
  resultPrimary: { fontSize: 14, fontWeight: '800', color: C.text1 },
  resultWrong: { marginTop: 3, fontSize: T.micro, color: C.dangerStrong },
  resultCorrect: { marginTop: 3, fontSize: T.micro, color: C.successStrong },
  footer: { alignItems: 'flex-end', paddingTop: 18 },
  footerButton: { width: 170, maxWidth: '48%' },
});
