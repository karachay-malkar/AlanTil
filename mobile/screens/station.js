import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { favoriteHas, toggleFavorite } from '../../packages/alantil-core/favorites.js';
import { Button, FavoriteButton, Header, Screen } from '../ui/components.js';
import { theme } from '../ui/theme.js';
import { getNativeStationStatistics } from '../platform/progress.js';
import { loadNativeHiddenWords, saveNativeHiddenWords } from '../platform/hidden-words.js';

const C = theme.colors;
const T = theme.type;

function SegmentedProgress({ value = 0 }) {
  const filled = Math.round(Math.max(0, Math.min(100, value)) / 10);
  return <View style={styles.segmentedProgress}>{Array.from({ length: 10 }, (_, index) => <View key={index} style={[styles.segmentedCell, index < filled && styles.segmentedCellOn]} />)}</View>;
}

function StationTabs({ active, onChange }) {
  return <View style={styles.tabs}>{[['words', 'Меню'], ['statistics', 'Статистика']].map(([id, label]) => <Pressable key={id} onPress={() => onChange(id)} style={styles.tab}><Text style={[styles.tabText, active === id && styles.tabActive]}>{label}</Text></Pressable>)}</View>;
}

function DirectionToggle({ value, onChange }) {
  return <View style={styles.directionRow}><Text style={styles.directionLabel}>НАПРАВЛЕНИЕ</Text><View style={styles.directionToggle}><Pressable onPress={() => onChange('kb')} style={[styles.directionOption, value === 'kb' && styles.directionOptionActive]}><Text style={[styles.directionText, value === 'kb' && styles.directionTextActive]}>алан → рус</Text></Pressable><Pressable onPress={() => onChange('ru')} style={[styles.directionOption, value === 'ru' && styles.directionOptionActive]}><Text style={[styles.directionText, value === 'ru' && styles.directionTextActive]}>рус → алан</Text></Pressable></View></View>;
}

function BracketCheckbox({ selected }) {
  return <View style={styles.bracketCheckbox}><Text style={[styles.bracketGlyph, selected && styles.bracketGlyphOn]}>[</Text><Text style={[styles.bracketCheck, selected && styles.bracketCheckOn]}>{selected ? '✓' : ' '}</Text><Text style={[styles.bracketGlyph, selected && styles.bracketGlyphOn]}>]</Text></View>;
}

function WordRow({ word, selected, onToggle, favorite, onFavorite }) {
  return <View style={styles.wordRow}><Pressable onPress={onToggle} style={styles.toggleWrap} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel="Добавить слово в обучение"><BracketCheckbox selected={selected} /></Pressable><View style={styles.wordMain}><Text numberOfLines={1} style={styles.wordPrimary}>{word.word}</Text><Text numberOfLines={1} style={styles.wordSecondary}>{word.trans}</Text></View><FavoriteButton active={favorite} onPress={onFavorite} /></View>;
}

function masteryMark(percent) {
  if (percent >= 100) return ['⌃⌃⌃', 'III знак'];
  if (percent >= 90) return ['⌃⌃', 'II знак'];
  if (percent >= 80) return ['⌃', 'I знак'];
  return ['—', 'не сдан'];
}

function Metric({ value, label }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function StatisticsPane({ station, favorites, setFavorites }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let alive = true;
    getNativeStationStatistics(station).then((value) => { if (alive) setStats(value); });
    return () => { alive = false; };
  }, [station]);
  if (!stats) return <View style={styles.statsLoading}><Text style={styles.emptyStats}>Загружаем статистику…</Text></View>;
  const mark = masteryMark(stats.best);
  return <ScrollView contentContainerStyle={styles.statsScroll}><View style={styles.statsSummary}><View style={styles.masteryBlock}><Text style={styles.statLabel}>ОСВОЕНО СЛОВ</Text><Text style={styles.masteryValue}>{stats.summary.mastered}/{stats.summary.total}</Text><SegmentedProgress value={stats.summary.percent} /></View><View style={styles.masteryBadge}><Text style={styles.masteryBadgeValue}>{mark[0]}</Text><Text style={styles.masteryBadgeSmall}>{mark[1]}</Text></View></View><View style={styles.metricGrid}><Metric value={String(stats.attempts.length)} label="попыток" /><Metric value={`${stats.best}%`} label="лучший результат" /><Metric value={String(stats.summary.review)} label="требуют повторения" /></View><View style={styles.statsSection}><Text style={styles.statsHeading}>Последние результаты</Text>{stats.recent.length ? <View style={styles.attempts}>{stats.recent.map((row, index) => <View key={`${row.sessionId}-${index}`} style={[styles.attempt, row.percent >= 80 ? styles.attemptPassed : styles.attemptFailed]}><Text style={styles.attemptScore}>{row.percent}%</Text><Text style={styles.attemptLabel}>{masteryMark(row.percent)[1]}</Text><Text style={styles.attemptDate}>{row.date ? new Date(row.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : ''}</Text></View>)}</View> : <Text style={styles.emptyStats}>Тесты ещё не проходились.</Text>}</View><View style={styles.statsSection}><Text style={styles.statsHeading}>Проблемные слова</Text>{stats.problems.length ? <><View style={styles.problemHead}><Text style={styles.problemHeadWord}>Слово</Text><Text style={styles.problemHeadMetric}>Показы</Text><Text style={styles.problemHeadMetric}>Не знаю</Text><Text style={styles.problemHeadRate}>Затруднение</Text><View style={styles.problemFavoriteSpace} /></View>{stats.problems.map(({ word, progress, evaluated, unknownRate }) => <View key={word.id} style={styles.problemRow}><View style={styles.problemCopy}><Text numberOfLines={1} style={styles.problemWord}>{word.word}</Text><Text numberOfLines={1} style={styles.problemTrans}>{word.trans}</Text></View><Text style={styles.problemMetric}>{evaluated}</Text><Text style={styles.problemMetric}>{progress.unknown_count}</Text><Text style={styles.problemRate}>{unknownRate}%</Text><FavoriteButton active={favoriteHas(favorites, word.id)} onPress={() => setFavorites(toggleFavorite(favorites, word.id).ids)} /></View>)}</> : <Text style={styles.emptyStats}>Пока недостаточно данных.</Text>}</View></ScrollView>;
}

export function StationScreen({ station, favorites, setFavorites, onBack, onLearn, onTest }) {
  const [pane, setPane] = useState('words');
  const [direction, setDirection] = useState('kb');
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const [hiddenReady, setHiddenReady] = useState(false);
  const words = Array.isArray(station?.words) ? station.words : [];

  useEffect(() => {
    let alive = true;
    loadNativeHiddenWords().then((set) => { if (alive) { setHiddenIds(set); setHiddenReady(true); } });
    return () => { alive = false; };
  }, [station?.key]);

  const activeWords = useMemo(() => words.filter((word) => !hiddenIds.has(String(word.id))), [words, hiddenIds]);
  const updateHidden = (next, changed) => {
    setHiddenIds(next);
    saveNativeHiddenWords(next, changed).catch(() => {});
  };
  const toggleWord = (id) => {
    const next = new Set(hiddenIds);
    const key = String(id);
    if (next.has(key)) next.delete(key); else next.add(key);
    updateHidden(next, [key]);
  };
  const showAll = () => {
    const next = new Set(hiddenIds);
    const changed = words.map((word) => String(word.id));
    changed.forEach((id) => next.delete(id));
    updateHidden(next, changed);
  };
  const hideAll = () => {
    const next = new Set(hiddenIds);
    const changed = words.map((word) => String(word.id));
    changed.forEach((id) => next.add(id));
    updateHidden(next, changed);
  };

  return <Screen><Header title={station?.name || 'Этап'} subtitle={station?.sectionName || station?.catalogName || ''} onBack={onBack} /><StationTabs active={pane} onChange={setPane} />{pane === 'statistics' ? <StatisticsPane station={station} favorites={favorites} setFavorites={setFavorites} /> : <><View style={styles.toolbar}><View style={styles.toolbarActions}><Pressable onPress={showAll} disabled={!hiddenReady}><Text style={styles.toolbarAction}>Показать все</Text></Pressable><Text style={styles.toolbarDivider}>·</Text><Pressable onPress={hideAll} disabled={!hiddenReady}><Text style={styles.toolbarAction}>Скрыть все</Text></Pressable></View><Text style={styles.selectionCount}>{activeWords.length}/{words.length}</Text></View><ScrollView contentContainerStyle={styles.wordList}>{words.map((word) => <WordRow key={word.id} word={word} selected={!hiddenIds.has(String(word.id))} onToggle={() => toggleWord(word.id)} favorite={favoriteHas(favorites, word.id)} onFavorite={() => setFavorites(toggleFavorite(favorites, word.id).ids)} />)}</ScrollView><View style={styles.launchPanel}><DirectionToggle value={direction} onChange={setDirection} /><View style={styles.launchActions}><View style={styles.studyAction}><Button disabled={!activeWords.length} onPress={() => onLearn(activeWords, direction)}>Учить слова</Button></View><View style={styles.testAction}><Button primary disabled={!words.length} onPress={() => onTest(station, direction)}>Завершить этап: тест</Button></View></View></View></>}</Screen>;
}

const styles = StyleSheet.create({
  tabs: { position: 'absolute', zIndex: 30, top: theme.control.header + 4, left: 12, right: 12, height: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 46 },
  tab: { minHeight: 30, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: theme.font.terminal, fontSize: T.caption, fontWeight: '800', letterSpacing: .3, color: C.text3 },
  tabActive: { color: C.text1 },
  toolbar: { position: 'absolute', zIndex: 30, top: theme.control.header + 42, left: 18, right: 18, height: 32, flexDirection: 'row', alignItems: 'center' },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  toolbarAction: { fontFamily: theme.font.terminal, fontSize: 11, fontWeight: '700', color: C.text2 },
  toolbarDivider: { fontFamily: theme.font.terminal, fontSize: 11, color: C.text3 },
  selectionCount: { marginLeft: 'auto', fontFamily: theme.font.terminal, fontSize: 11, fontWeight: '700', color: C.text1 },
  wordList: { paddingTop: theme.control.header + 82, paddingHorizontal: 12, paddingBottom: 138 },
  wordRow: { position: 'relative', height: 52, minHeight: 52, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', gap: 7 },
  toggleWrap: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  bracketCheckbox: { height: 22, minWidth: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  bracketGlyph: { fontFamily: theme.font.terminal, fontSize: 16, lineHeight: 18, fontWeight: '700', color: C.text3 },
  bracketGlyphOn: { color: C.accentStrong },
  bracketCheck: { width: 10, fontFamily: theme.font.terminal, fontSize: 10, lineHeight: 14, fontWeight: '900', textAlign: 'center', color: 'transparent' },
  bracketCheckOn: { color: C.accentStrong },
  wordMain: { flex: 1, minWidth: 0, height: 44, paddingVertical: 1, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(54,50,43,.0864)' },
  wordPrimary: { fontSize: 15, fontWeight: '800', lineHeight: 21, color: C.text1 },
  wordSecondary: { fontSize: T.caption, lineHeight: 18, color: C.text2 },
  launchPanel: { position: 'absolute', zIndex: 30, left: 12, right: 12, bottom: 4, gap: 6, paddingTop: 4, backgroundColor: 'transparent' },
  directionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  directionLabel: { fontFamily: theme.font.terminal, fontSize: 9, fontWeight: '700', letterSpacing: .45, color: C.text3 },
  directionToggle: { width: '72%', maxWidth: 250, padding: 2, borderWidth: 1, borderColor: C.line, borderRadius: 999, flexDirection: 'row' },
  directionOption: { flex: 1, minHeight: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  directionOptionActive: { backgroundColor: 'rgba(246,242,233,.72)', shadowColor: '#292721', shadowOpacity: .05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  directionText: { fontFamily: theme.font.terminal, fontSize: 10, fontWeight: '700', color: C.text3 },
  directionTextActive: { color: C.text1 },
  launchActions: { flexDirection: 'row', gap: 7 },
  studyAction: { flex: .78 },
  testAction: { flex: 1.22 },
  statsLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsScroll: { paddingTop: theme.control.header + 48, paddingHorizontal: 12, paddingBottom: 24 },
  statsSummary: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  masteryBlock: { flex: 1, gap: 5 },
  statLabel: { fontFamily: theme.font.terminal, fontSize: T.micro, fontWeight: '700', letterSpacing: .6, color: C.text2 },
  masteryValue: { fontFamily: theme.font.terminal, fontSize: 26, fontWeight: '800', lineHeight: 27, color: C.text1 },
  segmentedProgress: { width: '100%', height: 5, flexDirection: 'row', gap: 2 },
  segmentedCell: { flex: 1, height: 5, borderRadius: 1, backgroundColor: 'rgba(54,50,43,.12)' },
  segmentedCellOn: { backgroundColor: C.accentStrong },
  masteryBadge: { width: 78, height: 64, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  masteryBadgeValue: { fontFamily: theme.font.terminal, fontSize: 18, fontWeight: '900', color: C.accentStrong },
  masteryBadgeSmall: { fontSize: 9, color: C.text2, marginTop: 5 },
  metricGrid: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  metric: { flex: 1, minHeight: 66, paddingVertical: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: C.lineSoft },
  metricValue: { fontFamily: theme.font.terminal, fontSize: 18, fontWeight: '800', color: C.text1 },
  metricLabel: { fontSize: T.micro, lineHeight: 12, color: C.text2, textAlign: 'center', marginTop: 5 },
  statsSection: { marginTop: 17 },
  statsHeading: { fontSize: 15, fontWeight: '800', color: C.text1, paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  emptyStats: { fontSize: T.caption, lineHeight: 18, color: C.text3, paddingVertical: 13 },
  attempts: { flexDirection: 'row', gap: 7, paddingVertical: 10 },
  attempt: { flex: 1, minHeight: 78, paddingVertical: 9, paddingHorizontal: 5, borderWidth: 1, borderColor: C.lineSoft, backgroundColor: C.paperSoft, alignItems: 'center', justifyContent: 'center' },
  attemptPassed: { borderColor: 'rgba(93,118,84,.32)' },
  attemptFailed: { borderColor: 'rgba(152,86,76,.35)' },
  attemptScore: { fontFamily: theme.font.terminal, fontSize: 19, fontWeight: '800', color: C.text1 },
  attemptLabel: { fontSize: T.micro, color: C.text2, marginTop: 5 },
  attemptDate: { fontSize: 9, color: C.text3, marginTop: 4 },
  problemHead: { minHeight: 30, flexDirection: 'row', alignItems: 'center' },
  problemHeadWord: { flex: 1, fontFamily: theme.font.terminal, fontSize: T.micro, color: C.text3 },
  problemHeadMetric: { width: 48, fontFamily: theme.font.terminal, fontSize: T.micro, color: C.text3, textAlign: 'center' },
  problemHeadRate: { width: 66, fontFamily: theme.font.terminal, fontSize: T.micro, color: C.text3, textAlign: 'center' },
  problemFavoriteSpace: { width: 36 },
  problemRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  problemCopy: { flex: 1, minWidth: 0 },
  problemWord: { fontSize: 14, fontWeight: '700', color: C.text1 },
  problemTrans: { fontSize: T.micro, color: C.text2, marginTop: 2 },
  problemMetric: { width: 48, fontFamily: theme.font.terminal, fontSize: T.micro, color: C.text2, textAlign: 'center' },
  problemRate: { width: 66, fontFamily: theme.font.terminal, fontSize: T.micro, fontWeight: '800', color: C.danger, textAlign: 'center' },
});
