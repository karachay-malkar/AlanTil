import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { displayedAlanWord, displayedStructureName, displayedTranslation, loadAllWords, type MobileWord } from '@/src/mobile/dictionary';
import { AlanIcon } from '@/src/mobile/icons';
import { useI18n } from '@/src/mobile/i18n';
import { OverflowMarquee } from '@/src/mobile/overflow-marquee';
import { loadFavoriteIds, setFavorite } from '@/src/mobile/practice/repository';
import { loadWordProgress } from '@/src/mobile/progress/repository';
import { getStationProgress, type StationDescriptor } from '@/src/mobile/progress/station';
import { useSession } from '@/src/mobile/session';
import { useSettings } from '@/src/mobile/settings';
import { masteryMark, stationProblemWords, stationTestSummaries, type ActivityHistoryRow } from '@/src/mobile/station-statistics';
import { loadStationDirection, loadStationSelection, saveStationDirection, saveStationSelection, type LearningDirection } from '@/src/mobile/station-preferences';
import { readScopedJson, STORAGE_KEYS, subscribeScopedValue } from '@/src/mobile/storage';
import { theme } from '@/src/mobile/theme';
import { scopedTestId, testIds } from '@/src/mobile/test-ids';
import { AppText as Text } from '@/src/mobile/typography';

function splitKey(value: string): StationDescriptor | null {
  const [storyId, dictionaryId, sectionId, setId] = String(value || '').split('::');
  if (!storyId || !dictionaryId || !sectionId || !setId) return null;
  return { storyId, dictionaryId, sectionId, setId };
}

function shortDate(value: string, language: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return '';
  const locale = language === 'en' ? 'en-US' : language === 'tr' ? 'tr-TR' : 'ru-RU';
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' }).format(parsed);
}

export default function StationScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ key?: string }>();
  const auth = useSession();
  const { settings } = useSettings();
  const { t } = useI18n();
  const station = useMemo(() => splitKey(String(params.key ?? '')), [params.key]);
  const [words, setWords] = useState<MobileWord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'words' | 'stats'>('words');
  const [progress, setProgress] = useState<Map<string, Record<string, unknown>>>(new Map());
  const [stationProgress, setStationProgress] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [direction, setDirection] = useState<LearningDirection>('alan_ru');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [activityHistory, setActivityHistory] = useState<ActivityHistoryRow[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!station) throw new Error(t('stage.not_found'));
        const [all, wordRows, stationRow, savedDirection, favoriteIds, historyRows] = await Promise.all([
          loadAllWords(), loadWordProgress(auth.user?.id), getStationProgress(station, auth.user?.id),
          loadStationDirection(auth.user?.id),
          loadFavoriteIds(auth.user?.id),
          readScopedJson<ActivityHistoryRow[]>(STORAGE_KEYS.activityHistory, [], auth.user?.id),
        ]);
        const filtered = all.filter((word) => String(word.dictionary_id) === station.dictionaryId && String(word.section_id) === station.sectionId && String(word.set_id) === station.setId);
        const savedSelection = await loadStationSelection(filtered.map((word) => word.word_id), station.dictionaryId, station.sectionId, station.setId, auth.user?.id);
        if (!active) return;
        setWords(filtered);
        setSelected(savedSelection);
        setDirection(savedDirection);
        setProgress(new Map(wordRows.map((row) => [row.word_id, row as unknown as Record<string, unknown>])));
        setStationProgress(stationRow as unknown as Record<string, unknown>);
        setFavorites(favoriteIds);
        setActivityHistory(historyRows);
      } catch (reason) {
        if (active) setError(String((reason as { message?: string })?.message ?? reason));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [auth.user?.id, params.key, settings.interface_language_code, settings.translation_language_code, settings.alan_script_code, settings.alan_dialect_code, reloadKey, t]);

  useEffect(() => {
    const refreshFavorites = () => { void loadFavoriteIds(auth.user?.id).then(setFavorites); };
    const refreshHistory = () => { void readScopedJson<ActivityHistoryRow[]>(STORAGE_KEYS.activityHistory, [], auth.user?.id).then(setActivityHistory); };
    const stopFavorites = subscribeScopedValue(STORAGE_KEYS.wordFavorites, auth.user?.id, refreshFavorites);
    const stopHistory = subscribeScopedValue(STORAGE_KEYS.activityHistory, auth.user?.id, refreshHistory);
    return () => {
      stopFavorites();
      stopHistory();
    };
  }, [auth.user?.id]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.accentStrong} /></View>;
  if (error || !station || !words.length) return <View style={styles.center}><Text accessibilityRole="alert" style={styles.error}>{error || t('stage.empty')}</Text><Pressable accessibilityRole="button" onPress={() => { setError(''); setLoading(true); setReloadKey((value) => value + 1); }} style={styles.retry}><Text style={styles.retryText}>{t('common.retry').toUpperCase()}</Text></Pressable></View>;

  const sample = words[0];
  const title = displayedStructureName(sample, 'set_name', settings) || String(sample.set_name_ru || station.setId);
  const subtitle = displayedStructureName(sample, 'section_name', settings) || displayedStructureName(sample, 'dictionary_name', settings);
  const mastered = words.filter((word) => ['mastered', 'review'].includes(String(progress.get(word.word_id)?.mastery_status || ''))).length;
  const review = words.filter((word) => String(progress.get(word.word_id)?.mastery_status || '') === 'review').length;
  const percent = Math.round((mastered / words.length) * 100);
  const testSummaries = stationTestSummaries(activityHistory, words.map((word) => word.word_id));
  const best = Math.max(Number(stationProgress?.best_accuracy || 0), ...testSummaries.map((row) => row.percent));
  const attemptCount = Math.max(Number(stationProgress?.test_attempts_total || 0), testSummaries.length);
  const mark = masteryMark(best);
  const markLabel = mark.level === 3 ? t('stage.mark_iii') : mark.level === 2 ? t('stage.mark_ii') : mark.level === 1 ? t('stage.mark_i') : t('stage.not_passed');
  const problems = stationProblemWords(words, Array.from(progress.values()), 7);

  const commitSelection = (next: Set<string>) => {
    setSelected(next);
    void saveStationSelection(next, words.map((word) => word.word_id), station.dictionaryId, station.sectionId, station.setId, auth.user?.id);
  };

  const toggle = (id: string) => {
    const next = new Set(selected); if (next.has(id)) next.delete(id); else next.add(id); commitSelection(next);
  };

  const chooseDirection = (next: LearningDirection) => {
    if (next === direction) return;
    setDirection(next);
    void saveStationDirection(next, auth.user?.id);
  };

  const toggleFavorite = (wordId: string) => {
    const active = !favorites.has(wordId);
    setFavorites((current) => {
      const next = new Set(current);
      if (active) next.add(wordId); else next.delete(wordId);
      return next;
    });
    void setFavorite(auth.user?.id, wordId, active).catch(() => { void loadFavoriteIds(auth.user?.id).then(setFavorites); });
  };

  const commonParams = { storyId: station.storyId, dictionaryId: station.dictionaryId, sectionId: station.sectionId, setId: station.setId, direction };

  return <View testID={testIds.station.screen} style={styles.screen}>
    <View style={[styles.header, { paddingTop: insets.top, minHeight: 54 + insets.top }]}>
      <Pressable accessibilityLabel={t('common.back')} accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><AlanIcon color={theme.colors.textMuted} name="back" size={22} /></Pressable>
      <View style={styles.headerCopy}><Text numberOfLines={1} style={styles.title}>{title}</Text><Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text></View>
    </View>
    <View style={styles.tabs}>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'words' }} testID={testIds.station.menuTab} onPress={() => setTab('words')} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}><Text style={[styles.tab, tab === 'words' && styles.tabOn]}>{t('stage.menu').toUpperCase()}</Text></Pressable>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'stats' }} testID={testIds.station.statisticsTab} onPress={() => setTab('stats')} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}><Text style={[styles.tab, tab === 'stats' && styles.tabOn]}>{t('profile.statistics').toUpperCase()}</Text></Pressable>
    </View>
    {tab === 'words' ? <>
      <View style={styles.toolbar}>
        <View style={styles.toolbarActions}>
          <Pressable accessibilityRole="button" testID={testIds.station.showAll} onPress={() => commitSelection(new Set(words.map((word) => word.word_id)))} style={({ pressed }) => [styles.toolbarButton, pressed && styles.pressed]}><Text style={styles.all}>{t('favorites.show_all')}</Text></Pressable>
          <Text style={styles.toolbarDivider}>·</Text>
          <Pressable accessibilityRole="button" testID={testIds.station.hideAll} onPress={() => commitSelection(new Set())} style={({ pressed }) => [styles.toolbarButton, pressed && styles.pressed]}><Text style={styles.all}>{t('favorites.hide_all')}</Text></Pressable>
        </View>
        <Text style={styles.toolbarText}>{selected.size}/{words.length}</Text>
      </View>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>{words.map((word) => {
        const on = selected.has(word.word_id);
        const favorite = favorites.has(word.word_id);
        return <View key={word.word_id} style={styles.row}>
          <Pressable
            accessibilityLabel={t('favorites.include_word', { word: displayedAlanWord(word, settings) })}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            testID={scopedTestId('station.word', word.word_id)}
            onPress={() => toggle(word.word_id)}
            style={styles.rowSelection}
          >
            <View style={[styles.check, on && styles.checkOn]}>{on ? <Text style={styles.checkText}>✓</Text> : null}</View>
            <View style={styles.wordCopy}><Text numberOfLines={1} style={styles.word}>{displayedAlanWord(word, settings)}</Text><OverflowMarquee style={styles.trans}>{displayedTranslation(word, settings)}</OverflowMarquee></View>
          </Pressable>
          <Pressable accessibilityLabel={favorite ? t('learn.remove_favorite', { word: displayedAlanWord(word, settings) }) : t('learn.add_favorite', { word: displayedAlanWord(word, settings) })} accessibilityRole="button" accessibilityState={{ selected: favorite }} testID={scopedTestId('station.favorite', word.word_id)} onPress={() => toggleFavorite(word.word_id)} style={({ pressed }) => [styles.starButton, pressed && styles.pressed]}><Text style={[styles.star, favorite && styles.starOn]}>{favorite ? '★' : '☆'}</Text></Pressable>
        </View>;
      })}</ScrollView>
      <View style={[styles.launch, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={styles.direction}><Text style={styles.directionLabel}>{t('favorites.direction').toUpperCase()}</Text><View accessibilityRole="radiogroup" style={styles.directionSegments}>
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: direction === 'alan_ru' }} testID={testIds.station.alanToTranslation} onPress={() => chooseDirection('alan_ru')} style={({ pressed }) => [styles.directionOption, direction === 'alan_ru' && styles.directionOptionOn, pressed && styles.pressed]}><Text style={[styles.directionValue, direction === 'alan_ru' && styles.directionValueOn]}>{t('favorites.alan_translation')}</Text></Pressable>
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: direction === 'ru_alan' }} testID={testIds.station.translationToAlan} onPress={() => chooseDirection('ru_alan')} style={({ pressed }) => [styles.directionOption, direction === 'ru_alan' && styles.directionOptionOn, pressed && styles.pressed]}><Text style={[styles.directionValue, direction === 'ru_alan' && styles.directionValueOn]}>{t('favorites.translation_alan')}</Text></Pressable>
        </View></View>
        <View style={styles.launchRow}>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !selected.size }} testID={testIds.station.study} disabled={!selected.size} onPress={() => router.push({ pathname: '/path/learn', params: { ...commonParams, source: 'station', selectedIds: Array.from(selected).join(',') } })} style={({ pressed }) => [styles.secondary, !selected.size && styles.disabled, pressed && styles.pressed]}><Text style={styles.secondaryText}>{t('favorites.study').toUpperCase()}</Text></Pressable>
          <Pressable accessibilityRole="button" testID={testIds.station.test} onPress={() => router.push({ pathname: '/path/station-test', params: commonParams })} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}><Text style={styles.primaryText}>{t('stage.complete_test').toUpperCase()}</Text></Pressable>
        </View>
      </View>
    </> : <ScrollView contentContainerStyle={[styles.stats, { paddingBottom: 40 + insets.bottom }]}>
      <View style={styles.statHero}>
        <View style={styles.masteryCopy}><Text style={styles.statLabel}>{t('stage.mastered_words').toUpperCase()}</Text><Text style={styles.statBig}>{mastered}/{words.length}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View></View>
        <View accessibilityLabel={markLabel} style={styles.masteryBadge}><Text style={styles.masterySymbol}>{mark.symbol}</Text><Text style={styles.masteryLabel}>{markLabel}</Text></View>
      </View>
      <View style={styles.metrics}><View style={styles.metric}><Text style={styles.metricValue}>{attemptCount}</Text><Text style={styles.metricLabel}>{t('stage.attempts')}</Text></View><View style={styles.metric}><Text style={styles.metricValue}>{best}%</Text><Text style={styles.metricLabel}>{t('stage.best_result')}</Text></View><View style={styles.metric}><Text style={styles.metricValue}>{review}</Text><Text style={styles.metricLabel}>{t('stage.review')}</Text></View></View>
      <Text style={styles.statsHeading}>{t('stage.recent_results')}</Text>
      <View style={styles.attempts}>{testSummaries.slice(0, 3).length ? testSummaries.slice(0, 3).map((result) => { const resultMark = masteryMark(result.percent); const resultLabel = resultMark.level === 3 ? t('stage.mark_iii') : resultMark.level === 2 ? t('stage.mark_ii') : resultMark.level === 1 ? t('stage.mark_i') : t('stage.not_passed'); return <View key={result.id} style={[styles.attemptCard, result.percent < 80 && styles.attemptFailed]}><Text style={styles.attemptPercent}>{result.percent}%</Text><Text style={styles.attemptLabel}>{resultLabel}</Text><Text style={styles.attemptDate}>{shortDate(result.date, settings.interface_language_code)}</Text></View>; }) : <Text style={styles.emptyText}>{t('stage.no_tests')}</Text>}</View>
      <Text style={styles.statsHeading}>{t('statistics.problem_words')}</Text>
      {!problems.length ? <Text style={styles.emptyText}>{t('statistics.not_enough')}</Text> : <View style={styles.problemList}>
        <View style={styles.problemHead}><Text style={styles.problemWordHead}>{t('statistics.word')}</Text><Text style={styles.problemMetricHead}>{t('statistics.shows')}</Text><Text style={styles.problemMetricHead}>{t('statistics.errors')}</Text><Text style={styles.problemMetricHead}>%</Text><View style={styles.problemStarSpace} /></View>
        {problems.map(({ word, shows, errors, difficulty }) => { const favorite = favorites.has(word.word_id); const alanWord = displayedAlanWord(word, settings); return <View key={word.word_id} style={styles.problemRow}><Text numberOfLines={1} style={styles.problemWord}>{alanWord}</Text><Text style={styles.problemMetric}>{shows}</Text><Text style={styles.problemMetric}>{errors}</Text><Text style={styles.problemMetric}>{difficulty}%</Text><Pressable accessibilityLabel={favorite ? t('learn.remove_favorite', { word: alanWord }) : t('learn.add_favorite', { word: alanWord })} accessibilityRole="button" accessibilityState={{ selected: favorite }} onPress={() => toggleFavorite(word.word_id)} style={styles.problemStarButton}><Text style={[styles.problemStar, favorite && styles.starOn]}>{favorite ? '★' : '☆'}</Text></Pressable></View>; })}
      </View>}
    </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background, padding: 24 }, error: { color: theme.colors.danger, textAlign: 'center' },
  header: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, backgroundColor: 'rgba(238,233,223,0.62)' }, backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: theme.colors.lineSoft }, back: { color: theme.colors.textMuted, fontSize: 29 }, headerCopy: { flex: 1, paddingRight: 44 }, title: { textAlign: 'center', color: theme.colors.text, fontSize: 17, fontWeight: '800' }, subtitle: { textAlign: 'center', color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  tabs: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 42, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft }, tabButton: { minHeight: 44, minWidth: 84, alignItems: 'center', justifyContent: 'center' }, tab: { color: theme.colors.textSoft, fontSize: 11, fontWeight: '800' }, tabOn: { color: theme.colors.text },
  toolbar: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, toolbarActions: { flexDirection: 'row', alignItems: 'center' }, toolbarButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }, toolbarDivider: { color: theme.colors.textSoft, paddingHorizontal: 2 }, toolbarText: { color: theme.colors.textMuted, fontSize: 10 }, all: { color: theme.colors.accentStrong, fontSize: 11, fontWeight: '800' },
  list: { flex: 1 }, listContent: { paddingHorizontal: 12, paddingBottom: 146 }, row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft }, rowSelection: { flex: 1, minWidth: 0, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9 }, check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.line, alignItems: 'center', justifyContent: 'center' }, checkOn: { borderColor: theme.colors.accentStrong, backgroundColor: 'rgba(139,107,59,0.10)' }, checkText: { color: theme.colors.accentStrong, fontSize: 13, fontWeight: '900' }, wordCopy: { flex: 1, minWidth: 0, paddingVertical: 7 }, word: { color: theme.colors.text, fontSize: 15, fontWeight: '800' }, trans: { marginTop: 2, color: theme.colors.textMuted, fontSize: 12 }, starButton: { width: 44, height: 52, alignItems: 'center', justifyContent: 'center' }, star: { color: theme.colors.textSoft, fontSize: 22 }, starOn: { color: theme.colors.accentStrong },
  launch: { position: 'absolute', left: 12, right: 12, bottom: 0, paddingTop: 7, gap: 7, backgroundColor: 'rgba(238,233,223,0.94)' }, direction: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 8 }, directionLabel: { color: theme.colors.textSoft, fontSize: 9, fontWeight: '800' }, directionSegments: { flex: 1, minHeight: 50, flexDirection: 'row', padding: 2, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.lineSoft, backgroundColor: theme.colors.surface2 }, directionOption: { flex: 1, minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }, directionOptionOn: { backgroundColor: theme.colors.text }, directionValue: { color: theme.colors.textMuted, fontSize: 9, lineHeight: 11, fontWeight: '700', textAlign: 'center' }, directionValueOn: { color: theme.colors.inverse }, launchRow: { flexDirection: 'row', gap: 7 }, secondary: { flex: 0.9, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.line, borderRadius: 8 }, primary: { flex: 1.35, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentStrong, borderRadius: 8, paddingHorizontal: 6 }, disabled: { opacity: 0.42 }, pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] }, secondaryText: { color: theme.colors.text, fontSize: 10, fontWeight: '800' }, primaryText: { color: theme.colors.inverse, fontSize: 9, fontWeight: '800', textAlign: 'center' },
  retry: { marginTop: 16, minHeight: 44, paddingHorizontal: 20, borderRadius: 9, borderWidth: 1, borderColor: theme.colors.line, alignItems: 'center', justifyContent: 'center' }, retryText: { color: theme.colors.text, fontSize: 11, fontWeight: '800' },
  stats: { paddingHorizontal: 14, paddingTop: 0, paddingBottom: 40 }, statHero: { minHeight: 110, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft }, masteryCopy: { flex: 1 }, statLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '800' }, statBig: { marginTop: 5, color: theme.colors.text, fontSize: 25, fontWeight: '800', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] }, progressTrack: { height: 5, marginTop: 8, borderRadius: 3, backgroundColor: theme.colors.surface3, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.accentStrong }, masteryBadge: { width: 84, minHeight: 68, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.line, borderRadius: 8 }, masterySymbol: { color: theme.colors.accentStrong, fontSize: 17, fontWeight: '900' }, masteryLabel: { marginTop: 5, color: theme.colors.textMuted, fontSize: 9, fontWeight: '700' },
  metrics: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft }, metric: { flex: 1, minHeight: 76, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }, metricValue: { color: theme.colors.text, fontSize: 18, fontWeight: '800', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] }, metricLabel: { color: theme.colors.textMuted, fontSize: 9, lineHeight: 12, marginTop: 4, textAlign: 'center' }, statsHeading: { marginTop: 18, paddingBottom: 8, color: theme.colors.text, fontSize: 14, fontWeight: '800', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  attempts: { minHeight: 82, flexDirection: 'row', alignItems: 'stretch', gap: 7, paddingVertical: 10 }, attemptCard: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(85,122,92,0.45)', backgroundColor: 'rgba(85,122,92,0.06)', paddingVertical: 7 }, attemptFailed: { borderColor: 'rgba(153,74,62,0.35)', backgroundColor: 'rgba(153,74,62,0.05)' }, attemptPercent: { color: theme.colors.text, fontSize: 16, fontWeight: '900', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] }, attemptLabel: { marginTop: 3, color: theme.colors.textMuted, fontSize: 8, fontWeight: '700' }, attemptDate: { marginTop: 3, color: theme.colors.textSoft, fontSize: 8, fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] }, emptyText: { flex: 1, paddingVertical: 24, color: theme.colors.textMuted, fontSize: 11, textAlign: 'center' },
  problemList: { borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft }, problemHead: { minHeight: 34, flexDirection: 'row', alignItems: 'center' }, problemRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.colors.lineSoft }, problemWordHead: { flex: 1, color: theme.colors.textMuted, fontSize: 8, fontWeight: '800', textTransform: 'uppercase' }, problemMetricHead: { width: 48, color: theme.colors.textMuted, fontSize: 7, fontWeight: '800', textAlign: 'center', textTransform: 'uppercase' }, problemStarSpace: { width: 44 }, problemWord: { flex: 1, color: theme.colors.text, fontSize: 12, fontWeight: '800' }, problemMetric: { width: 48, color: theme.colors.textMuted, fontSize: 10, textAlign: 'center' }, problemStarButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, problemStar: { color: theme.colors.textSoft, fontSize: 20 },
});
