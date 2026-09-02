import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { favoriteHas, toggleFavorite } from '../../packages/alantil-core/favorites.js';
import { stationHiddenSelectionContext } from '../../packages/alantil-core/hidden-selection.js';
import { masteryMarkForPercent } from '../../packages/alantil-core/mastery.js';
import { Button, FavoriteButton, Header, ProgressBar, Screen } from '../ui/components.js';
import { CompactSegmentedControl, EmptyState, MetricStrip, MonoLabel, ScreenSection, SurfaceCard } from '../ui/parity.js';
import { theme } from '../ui/theme.js';
import { getNativeStationStatistics } from '../platform/progress.js';
import { loadNativeHiddenWords, saveNativeHiddenWords } from '../platform/hidden-words.js';

const C = theme.colors;
const T = theme.type;

function BracketCheckbox({ selected }) {
  return <View style={styles.checkbox}><Text style={[styles.checkboxText, selected && styles.checkboxActive]}>[{selected ? '✓' : ' '}]</Text></View>;
}

function WordRow({ word, selected, onToggle, favorite, onFavorite }) {
  return <View style={[styles.wordRow, !selected && styles.wordRowHidden]}><Pressable onPress={onToggle} style={styles.toggleWrap} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel="Добавить слово в обучение"><BracketCheckbox selected={selected} /></Pressable><View style={styles.wordMain}><Text numberOfLines={1} style={styles.wordPrimary}>{word.word}</Text><Text numberOfLines={1} style={styles.wordSecondary}>{word.trans}</Text></View><FavoriteButton active={favorite} onPress={onFavorite} /></View>;
}

function StatisticsPane({ station, favorites, setFavorites }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let alive = true;
    getNativeStationStatistics(station).then((value) => { if (alive) setStats(value); });
    return () => { alive = false; };
  }, [station]);
  if (!stats) return <EmptyState>Загружаем статистику…</EmptyState>;
  const mark = masteryMarkForPercent(stats.best);
  return <ScrollView contentContainerStyle={styles.statsScroll} showsVerticalScrollIndicator={false}>
    <SurfaceCard style={styles.summaryCard}><View style={styles.summaryHead}><View style={styles.masteryCopy}><MonoLabel>ОСВОЕНО СЛОВ</MonoLabel><Text style={styles.masteryValue}>{stats.summary.mastered}/{stats.summary.total}</Text><ProgressBar value={stats.summary.percent} /></View><View style={styles.masteryBadge}><Text style={styles.masteryBadgeValue}>{mark.mark}</Text><Text style={styles.masteryBadgeSmall}>{mark.label}</Text></View></View><MetricStrip items={[[String(stats.attempts.length), 'попыток'], [`${stats.best}%`, 'лучший результат'], [String(stats.summary.review), 'к повторению']]} /></SurfaceCard>
    <ScreenSection title="Последние результаты">{stats.recent.length ? <SurfaceCard>{stats.recent.slice(0, 3).map((row, index) => <View key={`${row.sessionId}-${index}`} style={styles.attempt}><Text style={styles.attemptScore}>{row.percent}%</Text><Text style={styles.attemptLabel}>{masteryMarkForPercent(row.percent).label}</Text><Text style={styles.attemptDate}>{row.date ? new Date(row.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : ''}</Text></View>)}</SurfaceCard> : <EmptyState>Тесты ещё не проходились.</EmptyState>}</ScreenSection>
    <ScreenSection title="Проблемные слова">{stats.problems.length ? <SurfaceCard><View style={styles.problemHead}><Text style={styles.problemHeadWord}>Слово</Text><Text style={styles.problemMetric}>Показы</Text><Text style={styles.problemMetric}>Ошибки</Text><Text style={styles.problemRate}>%</Text><View style={styles.favoriteSpace} /></View>{stats.problems.slice(0, 7).map(({ word, progress, evaluated, unknownRate }) => <View key={word.id} style={styles.problemRow}><View style={styles.problemCopy}><Text numberOfLines={1} style={styles.problemWord}>{word.word}</Text><Text numberOfLines={1} style={styles.problemTrans}>{word.trans}</Text></View><Text style={styles.problemMetric}>{evaluated}</Text><Text style={styles.problemMetric}>{progress.unknown_count}</Text><Text style={styles.problemRate}>{unknownRate}%</Text><FavoriteButton active={favoriteHas(favorites, word.id)} onPress={() => setFavorites(toggleFavorite(favorites, word.id).ids)} /></View>)}</SurfaceCard> : <EmptyState>Пока недостаточно данных.</EmptyState>}</ScreenSection>
  </ScrollView>;
}

export function StationScreen({ station, favorites, setFavorites, onBack, onLearn, onTest }) {
  const [pane, setPane] = useState('words');
  const [direction, setDirection] = useState('kb');
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const [hiddenReady, setHiddenReady] = useState(false);
  const words = Array.isArray(station?.words) ? station.words : [];
  const hiddenContext = useMemo(() => stationHiddenSelectionContext(station), [station?.key, station?.dictionaryId, station?.catalogId, station?.sectionId, station?.groupId, station?.sourceSetId, station?.setId]);

  useEffect(() => {
    let alive = true;
    setHiddenReady(false);
    loadNativeHiddenWords(hiddenContext).then((set) => { if (alive) { setHiddenIds(set); setHiddenReady(true); } });
    return () => { alive = false; };
  }, [station?.key]);

  const activeWords = useMemo(() => words.filter((word) => !hiddenIds.has(String(word.id))), [words, hiddenIds]);
  const updateHidden = (next, changed) => {
    setHiddenIds(next);
    saveNativeHiddenWords(hiddenContext, next, changed).catch(() => {});
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

  return <Screen><Header title={station?.name || 'Этап'} subtitle={station?.sectionName || station?.catalogName || ''} onBack={onBack} /><View style={styles.tabs}><CompactSegmentedControl value={pane} items={[["words", "Меню"], ["statistics", "Статистика"]]} onChange={setPane} /></View>{pane === 'statistics' ? <StatisticsPane station={station} favorites={favorites} setFavorites={setFavorites} /> : <><View style={styles.toolbar}><View style={styles.toolbarActions}><Pressable onPress={showAll} disabled={!hiddenReady}><Text style={styles.toolbarAction}>Показать все</Text></Pressable><Text style={styles.toolbarDivider}>·</Text><Pressable onPress={hideAll} disabled={!hiddenReady}><Text style={styles.toolbarAction}>Скрыть все</Text></Pressable></View><MonoLabel>{activeWords.length}/{words.length}</MonoLabel></View><ScrollView contentContainerStyle={styles.wordList} showsVerticalScrollIndicator={false}>{words.map((word) => <WordRow key={word.id} word={word} selected={!hiddenIds.has(String(word.id))} onToggle={() => toggleWord(word.id)} favorite={favoriteHas(favorites, word.id)} onFavorite={() => setFavorites(toggleFavorite(favorites, word.id).ids)} />)}</ScrollView><View style={styles.launchPanel}><View style={styles.directionRow}><MonoLabel>НАПРАВЛЕНИЕ</MonoLabel><View style={styles.directionControl}><CompactSegmentedControl value={direction} items={[["kb", "алан → рус"], ["ru", "рус → алан"]]} onChange={setDirection} /></View></View><View style={styles.launchActions}><View style={styles.studyAction}><Button disabled={!activeWords.length} onPress={() => onLearn(activeWords, direction)}>Учить слова</Button></View><View style={styles.testAction}><Button primary disabled={!words.length} onPress={() => onTest(station, direction)}>Завершить этап: тест</Button></View></View></View></>}</Screen>;
}

const styles = StyleSheet.create({
  tabs: { position: 'absolute', zIndex: 30, top: theme.control.header + 4, left: 56, right: 56, height: 36 },
  toolbar: { position: 'absolute', zIndex: 30, top: theme.control.header + 46, left: 18, right: 18, height: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  toolbarAction: { fontFamily: theme.font.terminal, fontSize: 11, fontWeight: '700', color: C.text2 },
  toolbarDivider: { fontFamily: theme.font.terminal, fontSize: 11, color: C.text3 },
  wordList: { paddingTop: theme.control.header + 82, paddingHorizontal: 12, paddingBottom: 142 },
  wordRow: { minHeight: 52, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', gap: 7, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  wordRowHidden: { opacity: .48 },
  toggleWrap: { width: 36, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  checkbox: { minWidth: 30, alignItems: 'center', justifyContent: 'center' },
  checkboxText: { fontFamily: theme.font.terminal, fontSize: 14, fontWeight: '800', color: C.text3 },
  checkboxActive: { color: C.accentStrong },
  wordMain: { flex: 1, minWidth: 0, minHeight: 48, justifyContent: 'center' },
  wordPrimary: { fontSize: 15, fontWeight: '800', lineHeight: 21, color: C.text1 },
  wordSecondary: { fontSize: T.caption, lineHeight: 17, color: C.text2 },
  launchPanel: { position: 'absolute', zIndex: 30, left: 12, right: 12, bottom: 5, gap: 7 },
  directionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  directionControl: { width: '72%', maxWidth: 260 },
  launchActions: { flexDirection: 'row', gap: 7 },
  studyAction: { flex: .78 },
  testAction: { flex: 1.22 },
  statsScroll: { paddingTop: theme.control.header + 50, paddingHorizontal: 12, paddingBottom: 28, gap: 18 },
  summaryCard: { overflow: 'hidden' },
  summaryHead: { minHeight: 88, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  masteryCopy: { flex: 1, gap: 6 },
  masteryValue: { fontFamily: theme.font.terminal, fontSize: 26, fontWeight: '850', lineHeight: 28, color: C.text1 },
  masteryBadge: { width: 78, height: 62, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  masteryBadgeValue: { fontFamily: theme.font.terminal, fontSize: 18, fontWeight: '900', color: C.accentStrong },
  masteryBadgeSmall: { fontSize: 9, color: C.text2, marginTop: 4 },
  attempt: { minHeight: 46, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  attemptScore: { width: 58, fontFamily: theme.font.terminal, fontSize: 14, fontWeight: '850', color: C.text1 },
  attemptLabel: { flex: 1, fontSize: T.caption, color: C.text2 },
  attemptDate: { width: 44, fontFamily: theme.font.terminal, fontSize: 10, color: C.text3, textAlign: 'right' },
  problemHead: { minHeight: 34, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  problemHeadWord: { flex: 1, fontFamily: theme.font.terminal, fontSize: 9, fontWeight: '800', color: C.text3 },
  problemRow: { minHeight: 54, paddingLeft: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  problemCopy: { flex: 1, minWidth: 0 },
  problemWord: { fontSize: 14, fontWeight: '750', color: C.text1 },
  problemTrans: { marginTop: 2, fontSize: 10, color: C.text2 },
  problemMetric: { width: 48, fontFamily: theme.font.terminal, fontSize: 10, fontWeight: '700', color: C.text2, textAlign: 'center' },
  problemRate: { width: 42, fontFamily: theme.font.terminal, fontSize: 10, fontWeight: '800', color: C.dangerStrong, textAlign: 'center' },
  favoriteSpace: { width: 44 },
});
