import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { toggleFavorite } from '../../packages/alantil-core/favorites.js';
import { Button, FavoriteButton, Header, Screen } from '../ui/components.js';
import { loadNativeHiddenWords, saveNativeHiddenWords } from '../platform/hidden-words.js';
import { theme } from '../ui/theme.js';

const C = theme.colors;
const T = theme.type;

function BracketCheckbox({ selected, onPress }) {
  return <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel="Добавить слово в обучение" style={styles.checkboxHit}><View style={styles.checkbox}><Text style={[styles.bracket, selected && styles.bracketOn]}>[</Text><Text style={[styles.mark, selected && styles.markOn]}>{selected ? '✓' : ' '}</Text><Text style={[styles.bracket, selected && styles.bracketOn]}>]</Text></View></Pressable>;
}

function DirectionToggle({ value, onChange }) {
  return <View style={styles.direction}><Pressable onPress={() => onChange('kb')} style={[styles.directionOption, value === 'kb' && styles.directionActive]}><Text style={[styles.directionText, value === 'kb' && styles.directionTextActive]}>алан → рус</Text></Pressable><Pressable onPress={() => onChange('ru')} style={[styles.directionOption, value === 'ru' && styles.directionActive]}><Text style={[styles.directionText, value === 'ru' && styles.directionTextActive]}>рус → алан</Text></Pressable></View>;
}

export function FavoritesScreen({ words, favorites, setFavorites, onBack, onLearn }) {
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const [direction, setDirection] = useState('kb');
  const [ready, setReady] = useState(false);
  const rows = useMemo(() => words.filter((word) => favorites.has(String(word.id))), [words, favorites]);
  const activeRows = useMemo(() => rows.filter((word) => !hiddenIds.has(String(word.id))), [rows, hiddenIds]);

  useEffect(() => {
    let alive = true;
    loadNativeHiddenWords().then((set) => { if (alive) { setHiddenIds(set); setReady(true); } });
    return () => { alive = false; };
  }, []);

  const persist = (next, changed) => {
    setHiddenIds(next);
    saveNativeHiddenWords(next, changed).catch(() => {});
  };
  const toggleWord = (id) => {
    const key = String(id);
    const next = new Set(hiddenIds);
    if (next.has(key)) next.delete(key); else next.add(key);
    persist(next, [key]);
  };
  const showAll = () => {
    const next = new Set(hiddenIds);
    const changed = rows.map((word) => String(word.id));
    changed.forEach((id) => next.delete(id));
    persist(next, changed);
  };
  const hideAll = () => {
    const next = new Set(hiddenIds);
    const changed = rows.map((word) => String(word.id));
    changed.forEach((id) => next.add(id));
    persist(next, changed);
  };
  const unfavorite = (id) => setFavorites(toggleFavorite(favorites, id).ids);

  return <Screen><Header title="Избранное" subtitle={`${rows.length} слов`} onBack={onBack} />{rows.length ? <><View style={styles.toolbar}><View style={styles.tools}><Pressable disabled={!ready} onPress={showAll}><Text style={styles.tool}>Показать все</Text></Pressable><Text style={styles.divider}>·</Text><Pressable disabled={!ready} onPress={hideAll}><Text style={styles.tool}>Скрыть все</Text></Pressable></View><Text style={styles.count}>{activeRows.length}/{rows.length}</Text></View><ScrollView contentContainerStyle={styles.list}>{rows.map((word) => <View key={word.id} style={styles.row}><BracketCheckbox selected={!hiddenIds.has(String(word.id))} onPress={() => toggleWord(word.id)} /><View style={styles.copy}><Text numberOfLines={1} style={styles.primary}>{word.word}</Text><Text numberOfLines={1} style={styles.secondary}>{word.trans}</Text></View><FavoriteButton active onPress={() => unfavorite(word.id)} /></View>)}</ScrollView><View style={styles.footer}><DirectionToggle value={direction} onChange={setDirection} /><View style={styles.start}><Button primary disabled={!activeRows.length} onPress={() => onLearn(activeRows, direction)}>Начать изучение</Button></View></View></> : <View style={styles.empty}><Text style={styles.emptyTitle}>Пока пусто</Text><Text style={styles.emptyText}>Отмечайте слова звездой, чтобы учить их отдельно.</Text></View>}</Screen>;
}

const styles = StyleSheet.create({
  toolbar: { position: 'absolute', zIndex: 24, top: theme.control.header + 4, left: 18, right: 18, height: 34, flexDirection: 'row', alignItems: 'center' },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tool: { fontFamily: theme.font.terminal, fontSize: 11, fontWeight: '700', color: C.text2 },
  divider: { fontFamily: theme.font.terminal, fontSize: 11, color: C.text3 },
  count: { marginLeft: 'auto', fontFamily: theme.font.terminal, fontSize: 11, fontWeight: '700', color: C.text1 },
  list: { paddingTop: theme.control.header + 44, paddingHorizontal: 12, paddingBottom: 112 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 2 },
  checkboxHit: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  checkbox: { minWidth: 30, height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  bracket: { fontFamily: theme.font.terminal, fontSize: 16, lineHeight: 18, fontWeight: '700', color: C.text3 },
  bracketOn: { color: C.accentStrong },
  mark: { width: 10, fontFamily: theme.font.terminal, fontSize: 10, lineHeight: 14, fontWeight: '900', textAlign: 'center', color: 'transparent' },
  markOn: { color: C.accentStrong },
  copy: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(54,50,43,.0864)' },
  primary: { fontSize: 15, fontWeight: '800', lineHeight: 21, color: C.text1 },
  secondary: { fontSize: T.caption, lineHeight: 18, color: C.text2 },
  footer: { position: 'absolute', zIndex: 30, left: 12, right: 12, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' },
  direction: { flex: 1, maxWidth: 250, flexDirection: 'row', padding: 2, borderWidth: 1, borderColor: C.line, borderRadius: 999 },
  directionOption: { flex: 1, minHeight: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  directionActive: { backgroundColor: 'rgba(246,242,233,.86)' },
  directionText: { fontFamily: theme.font.terminal, fontSize: 10, fontWeight: '700', color: C.text3 },
  directionTextActive: { color: C.text1 },
  start: { width: 150, maxWidth: '43%' },
  empty: { flex: 1, marginTop: theme.control.header + 24, marginHorizontal: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.text1 },
  emptyText: { maxWidth: 300, marginTop: 6, fontSize: T.caption, lineHeight: 18, color: C.text2, textAlign: 'center' },
});
