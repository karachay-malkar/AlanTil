import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { toggleFavorite } from '../../packages/alantil-core/favorites.js';
import { Button, FavoriteButton, Header, Screen } from '../ui/components.js';
import { CompactSegmentedControl, EmptyState, MonoLabel, SurfaceCard } from '../ui/parity.js';
import { loadNativeHiddenWords, saveNativeHiddenWords } from '../platform/hidden-words.js';
import { theme } from '../ui/theme.js';

const C = theme.colors;
const T = theme.type;

function BracketCheckbox({ selected, onPress }) {
  return <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel="Добавить слово в обучение" style={styles.checkboxHit}><Text style={[styles.checkboxText, selected && styles.checkboxOn]}>[{selected ? '✓' : ' '}]</Text></Pressable>;
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

  return <Screen><Header title="Избранное" subtitle={`${rows.length} слов`} onBack={onBack} />{rows.length ? <><View style={styles.toolbar}><View style={styles.tools}><Pressable disabled={!ready} onPress={showAll}><Text style={styles.tool}>Показать все</Text></Pressable><Text style={styles.divider}>·</Text><Pressable disabled={!ready} onPress={hideAll}><Text style={styles.tool}>Скрыть все</Text></Pressable></View><MonoLabel>{activeRows.length}/{rows.length}</MonoLabel></View><ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}><SurfaceCard>{rows.map((word) => { const selected = !hiddenIds.has(String(word.id)); return <View key={word.id} style={[styles.row, !selected && styles.rowHidden]}><BracketCheckbox selected={selected} onPress={() => toggleWord(word.id)} /><View style={styles.copy}><Text numberOfLines={1} style={styles.primary}>{word.word}</Text><Text numberOfLines={1} style={styles.secondary}>{word.trans}</Text></View><FavoriteButton active onPress={() => unfavorite(word.id)} /></View>; })}</SurfaceCard></ScrollView><View style={styles.footer}><View style={styles.direction}><CompactSegmentedControl value={direction} items={[["kb", "алан → рус"], ["ru", "рус → алан"]]} onChange={setDirection} /></View><Button primary style={styles.start} disabled={!activeRows.length} onPress={() => onLearn(activeRows, direction)}>Начать изучение</Button></View></> : <View style={styles.empty}><EmptyState>Отмечайте слова звездой, чтобы учить их отдельно.</EmptyState></View>}</Screen>;
}

const styles = StyleSheet.create({
  toolbar: { position: 'absolute', zIndex: 24, top: theme.control.header + 4, left: 18, right: 18, height: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tool: { fontFamily: theme.font.terminal, fontSize: 11, fontWeight: '700', color: C.text2 },
  divider: { fontFamily: theme.font.terminal, fontSize: 11, color: C.text3 },
  list: { paddingTop: theme.control.header + 44, paddingHorizontal: 12, paddingBottom: 116 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  rowHidden: { opacity: .48 },
  checkboxHit: { width: 38, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  checkboxText: { fontFamily: theme.font.terminal, fontSize: 14, lineHeight: 18, fontWeight: '800', color: C.text3 },
  checkboxOn: { color: C.accentStrong },
  copy: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
  primary: { fontSize: 15, fontWeight: '800', lineHeight: 21, color: C.text1 },
  secondary: { fontSize: T.caption, lineHeight: 18, color: C.text2 },
  footer: { position: 'absolute', zIndex: 30, left: 12, right: 12, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  direction: { flex: 1, maxWidth: 260 },
  start: { width: 156, maxWidth: '44%' },
  empty: { flex: 1, marginTop: theme.control.header + 24, marginHorizontal: 12, justifyContent: 'center' },
});
