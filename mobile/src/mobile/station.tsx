import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { displayedAlanWord, displayedStructureName, displayedTranslation, loadAllWords, type MobileWord } from '@/src/mobile/dictionary';
import { loadSetProgress, loadWordProgress } from '@/src/mobile/progress/repository';
import { getStationProgress, type StationDescriptor } from '@/src/mobile/progress/station';
import { useSession } from '@/src/mobile/session';
import { useSettings } from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';

function splitKey(value: string): StationDescriptor | null {
  const [storyId, dictionaryId, sectionId, setId] = String(value || '').split('::');
  if (!storyId || !dictionaryId || !sectionId || !setId) return null;
  return { storyId, dictionaryId, sectionId, setId };
}

export default function StationScreen() {
  const params = useLocalSearchParams<{ key?: string }>();
  const auth = useSession();
  const { settings } = useSettings();
  const station = useMemo(() => splitKey(String(params.key ?? '')), [params.key]);
  const [words, setWords] = useState<MobileWord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'words' | 'stats'>('words');
  const [progress, setProgress] = useState<Map<string, Record<string, unknown>>>(new Map());
  const [setProgressRows, setSetProgressRows] = useState<Record<string, unknown>[]>([]);
  const [stationProgress, setStationProgress] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!station) throw new Error('Этап не найден.');
        const [all, wordRows, setRows, stationRow] = await Promise.all([
          loadAllWords(), loadWordProgress(auth.user?.id), loadSetProgress(auth.user?.id), getStationProgress(station, auth.user?.id),
        ]);
        const filtered = all.filter((word) => String(word.dictionary_id) === station.dictionaryId && String(word.section_id) === station.sectionId && String(word.set_id) === station.setId);
        if (!active) return;
        setWords(filtered);
        setSelected(new Set(filtered.map((word) => word.word_id)));
        setProgress(new Map(wordRows.map((row) => [row.word_id, row as unknown as Record<string, unknown>])));
        setSetProgressRows(setRows);
        setStationProgress(stationRow as unknown as Record<string, unknown>);
      } catch (reason) {
        if (active) setError(String((reason as { message?: string })?.message ?? reason));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [auth.user?.id, params.key, settings.interface_language_code, settings.translation_language_code, settings.alan_script_code, settings.alan_dialect_code]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.accentStrong} /></View>;
  if (error || !station || !words.length) return <View style={styles.center}><Text style={styles.error}>{error || 'Этап пуст.'}</Text></View>;

  const sample = words[0];
  const title = displayedStructureName(sample, 'set_name', settings) || String(sample.set_name_ru || station.setId);
  const subtitle = displayedStructureName(sample, 'section_name', settings) || displayedStructureName(sample, 'dictionary_name', settings);
  const mastered = words.filter((word) => ['mastered', 'review'].includes(String(progress.get(word.word_id)?.mastery_status || ''))).length;
  const review = words.filter((word) => String(progress.get(word.word_id)?.mastery_status || '') === 'review').length;
  const attempts = words.reduce((sum, word) => sum + Number(progress.get(word.word_id)?.test_correct_count || 0) + Number(progress.get(word.word_id)?.test_wrong_count || 0), 0);
  const percent = Math.round((mastered / words.length) * 100);

  const toggle = (id: string) => setSelected((previous) => {
    const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });

  const commonParams = { storyId: station.storyId, dictionaryId: station.dictionaryId, sectionId: station.sectionId, setId: station.setId, direction: 'alan_ru' };

  return <View style={styles.screen}>
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.back}>‹</Text></Pressable>
      <View style={styles.headerCopy}><Text numberOfLines={1} style={styles.title}>{title}</Text><Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text></View>
    </View>
    <View style={styles.tabs}>
      <Pressable onPress={() => setTab('words')}><Text style={[styles.tab, tab === 'words' && styles.tabOn]}>СЛОВА</Text></Pressable>
      <Pressable onPress={() => setTab('stats')}><Text style={[styles.tab, tab === 'stats' && styles.tabOn]}>СТАТИСТИКА</Text></Pressable>
    </View>
    {tab === 'words' ? <>
      <View style={styles.toolbar}><Text style={styles.toolbarText}>Выбрано {selected.size}/{words.length}</Text><Pressable onPress={() => setSelected(new Set(words.map((word) => word.word_id)))}><Text style={styles.all}>Все</Text></Pressable></View>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>{words.map((word) => {
        const on = selected.has(word.word_id);
        return <Pressable key={word.word_id} onPress={() => toggle(word.word_id)} style={styles.row}>
          <View style={[styles.check, on && styles.checkOn]}>{on ? <Text style={styles.checkText}>✓</Text> : null}</View>
          <View style={styles.wordCopy}><Text style={styles.word}>{displayedAlanWord(word, settings)}</Text><Text style={styles.trans}>{displayedTranslation(word, settings)}</Text></View>
        </Pressable>;
      })}</ScrollView>
      <View style={styles.launch}>
        <View style={styles.direction}><Text style={styles.directionLabel}>НАПРАВЛЕНИЕ</Text><Text style={styles.directionValue}>Алан → перевод</Text></View>
        <View style={styles.launchRow}>
          <Pressable disabled={!selected.size} onPress={() => router.push({ pathname: '/path/station-test', params: commonParams })} style={[styles.secondary, !selected.size && styles.disabled]}><Text style={styles.secondaryText}>ТЕСТ</Text></Pressable>
          <Pressable disabled={!selected.size} onPress={() => router.push({ pathname: '/path/learn', params: { ...commonParams, source: 'station' } })} style={[styles.primary, !selected.size && styles.disabled]}><Text style={styles.primaryText}>УЧИТЬ СЛОВА</Text></Pressable>
        </View>
      </View>
    </> : <ScrollView contentContainerStyle={styles.stats}>
      <View style={styles.statHero}><View><Text style={styles.statLabel}>ОСВОЕНО</Text><Text style={styles.statBig}>{percent}%</Text></View><Text style={styles.phase}>{String(stationProgress?.status || 'available')}</Text></View>
      <View style={styles.metrics}><View style={styles.metric}><Text style={styles.metricValue}>{mastered}</Text><Text style={styles.metricLabel}>освоено</Text></View><View style={styles.metric}><Text style={styles.metricValue}>{review}</Text><Text style={styles.metricLabel}>повторить</Text></View><View style={styles.metric}><Text style={styles.metricValue}>{attempts}</Text><Text style={styles.metricLabel}>ответов</Text></View></View>
      <View style={styles.statsLine}><Text style={styles.statsLineText}>Слова</Text><Text style={styles.statsLineValue}>{mastered}/{words.length}</Text></View>
      <View style={styles.statsLine}><Text style={styles.statsLineText}>Синхронизация</Text><Text style={styles.statsLineValue}>{auth.user?.id && setProgressRows.length ? 'облако' : 'локально'}</Text></View>
    </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background, padding: 24 }, error: { color: theme.colors.danger, textAlign: 'center' },
  header: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, backgroundColor: 'rgba(238,233,223,0.62)' }, backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: theme.colors.lineSoft }, back: { color: theme.colors.textMuted, fontSize: 29 }, headerCopy: { flex: 1, paddingRight: 36 }, title: { textAlign: 'center', color: theme.colors.text, fontSize: 17, fontWeight: '800' }, subtitle: { textAlign: 'center', color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  tabs: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 58, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft }, tab: { color: theme.colors.textSoft, fontSize: 11, fontWeight: '800' }, tabOn: { color: theme.colors.text }, toolbar: { height: 38, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }, toolbarText: { color: theme.colors.textMuted, fontSize: 10 }, all: { color: theme.colors.accentStrong, fontSize: 11, fontWeight: '800' },
  list: { flex: 1 }, listContent: { paddingHorizontal: 12, paddingBottom: 126 }, row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft }, check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.line, alignItems: 'center', justifyContent: 'center' }, checkOn: { borderColor: theme.colors.accentStrong, backgroundColor: 'rgba(139,107,59,0.10)' }, checkText: { color: theme.colors.accentStrong, fontSize: 13, fontWeight: '900' }, wordCopy: { flex: 1, paddingVertical: 7 }, word: { color: theme.colors.text, fontSize: 15, fontWeight: '800' }, trans: { marginTop: 2, color: theme.colors.textMuted, fontSize: 12 },
  launch: { position: 'absolute', left: 12, right: 12, bottom: 10, paddingTop: 7, gap: 7, backgroundColor: 'rgba(238,233,223,0.92)' }, direction: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, directionLabel: { color: theme.colors.textSoft, fontSize: 9, fontWeight: '800' }, directionValue: { color: theme.colors.text, fontSize: 10, fontWeight: '700', borderWidth: 1, borderColor: theme.colors.line, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 }, launchRow: { flexDirection: 'row', gap: 7 }, secondary: { flex: 0.8, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.line, borderRadius: 8 }, primary: { flex: 1.2, minHeight: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentStrong, borderRadius: 8 }, disabled: { opacity: 0.42 }, secondaryText: { color: theme.colors.text, fontSize: 10, fontWeight: '800' }, primaryText: { color: theme.colors.inverse, fontSize: 10, fontWeight: '800' },
  stats: { padding: 14, paddingBottom: 40 }, statHero: { minHeight: 92, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft }, statLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '800' }, statBig: { marginTop: 6, color: theme.colors.text, fontSize: 28, fontWeight: '800' }, phase: { color: theme.colors.accentStrong, fontSize: 11, fontWeight: '800' }, metrics: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft }, metric: { flex: 1, minHeight: 68, alignItems: 'center', justifyContent: 'center' }, metricValue: { color: theme.colors.text, fontSize: 18, fontWeight: '800' }, metricLabel: { color: theme.colors.textMuted, fontSize: 10, marginTop: 4 }, statsLine: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft }, statsLineText: { flex: 1, color: theme.colors.text, fontSize: 13 }, statsLineValue: { color: theme.colors.textMuted, fontSize: 12 },
});
