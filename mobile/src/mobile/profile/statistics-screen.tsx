import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { displayedAlanWord, displayedTranslation, loadAllWords, type MobileWord } from '@/src/mobile/dictionary';
import { useI18n } from '@/src/mobile/i18n';
import { OverflowMarquee } from '@/src/mobile/overflow-marquee';
import { loadFavoriteIds, setFavorite } from '@/src/mobile/practice/repository';
import { ProfileNavigation } from '@/src/mobile/profile/navigation';
import { buildProfileStatistics, type ProfileStatistics } from '@/src/mobile/profile/statistics-policy';
import { loadWordProgress } from '@/src/mobile/progress/repository';
import { useSession } from '@/src/mobile/session';
import { useSettings } from '@/src/mobile/settings';
import { readScopedJson, STORAGE_KEYS } from '@/src/mobile/storage';
import { theme } from '@/src/mobile/theme';
import { AppText as Text } from '@/src/mobile/typography';

const EMPTY: ProfileStatistics<MobileWord> = {
  masteredWords: 0,
  completedDictionaries: 0,
  activeSeconds: 0,
  learnSessions: 0,
  accuracy: 0,
  reviewWords: 0,
  problemWords: [],
};

function durationLabel(seconds: number, t: ReturnType<typeof useI18n>['t']) {
  const minutes = Math.round(Math.max(0, seconds) / 60);
  if (minutes < 60) return t('statistics.minutes', { minutes });
  return t('statistics.hours_minutes', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return <View style={styles.metric}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>;
}

export function StatisticsScreen() {
  const insets = useSafeAreaInsets();
  const auth = useSession();
  const { settings } = useSettings();
  const { t } = useI18n();
  const [statistics, setStatistics] = useState<ProfileStatistics<MobileWord>>(EMPTY);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const userId = auth.user?.id;

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    void Promise.all([
      loadAllWords(),
      loadWordProgress(userId),
      readScopedJson<Record<string, unknown>[]>(STORAGE_KEYS.activityHistory, [], userId),
      loadFavoriteIds(userId),
    ]).then(([words, progress, history, favoriteIds]) => {
      if (!active) return;
      setStatistics(buildProfileStatistics(words, progress, history));
      setFavorites(favoriteIds);
    }).catch(() => {
      if (active) setError(t('statistics.unavailable_body'));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [retryToken, t, userId]));

  const toggleFavorite = async (wordId: string) => {
    const next = !favorites.has(wordId);
    setFavorites((current) => {
      const value = new Set(current);
      if (next) value.add(wordId); else value.delete(wordId);
      return value;
    });
    try {
      await setFavorite(userId, wordId, next);
    } catch {
      setFavorites((current) => {
        const value = new Set(current);
        if (!next) value.add(wordId); else value.delete(wordId);
        return value;
      });
      setError(t('statistics.favorite_error'));
    }
  };

  return <View style={styles.screen}>
    <ProfileNavigation active="statistics" />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      {loading ? <View style={styles.loading}><ActivityIndicator color={theme.colors.accentStrong} /></View> : error && statistics === EMPTY ? <View style={styles.unavailable}>
        <Text accessibilityRole="alert" style={styles.unavailableTitle}>{t('statistics.unavailable')}</Text>
        <Text style={styles.unavailableBody}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={() => setRetryToken((value) => value + 1)} style={styles.retryButton}><Text style={styles.retryText}>{t('common.retry')}</Text></Pressable>
      </View> : <>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('statistics.summary')}</Text>
          <View style={styles.metrics}>
            <Metric value={statistics.masteredWords} label={t('statistics.mastered_words')} />
            <Metric value={statistics.completedDictionaries} label={t('statistics.completed_dictionaries')} />
            <Metric value={durationLabel(statistics.activeSeconds, t)} label={t('statistics.active_time')} />
            <Metric value={statistics.learnSessions} label={t('statistics.learn_sessions')} />
            <Metric value={`${statistics.accuracy}%`} label={t('statistics.test_accuracy')} />
            <Metric value={statistics.reviewWords} label={t('statistics.review_words')} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('statistics.problem_words')}</Text>
          {statistics.problemWords.length ? <View style={styles.problemTable}>
            <View style={styles.problemHeader}>
              <Text style={[styles.headerText, styles.wordColumn]}>{t('statistics.word')}</Text>
              <Text style={styles.numberColumn}>{t('statistics.shows')}</Text>
              <Text style={styles.numberColumn}>{t('statistics.errors')}</Text>
              <Text style={styles.percentColumn}>{t('statistics.difficulty')}</Text>
              <View style={styles.starColumn} />
            </View>
            {statistics.problemWords.map(({ word, shows, errors, difficulty }) => {
              const favorite = favorites.has(word.word_id);
              return <View key={word.word_id} style={styles.problemRow}>
                <View style={styles.wordColumn}>
                  <OverflowMarquee style={styles.problemWord}>{displayedAlanWord(word, settings)}</OverflowMarquee>
                  <OverflowMarquee style={styles.problemTranslation}>{displayedTranslation(word, settings)}</OverflowMarquee>
                </View>
                <Text style={styles.numberColumn}>{shows}</Text>
                <Text style={styles.numberColumn}>{errors}</Text>
                <Text style={styles.percentColumn}>{difficulty}%</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={favorite ? t('statistics.remove_favorite') : t('statistics.add_favorite')}
                  accessibilityState={{ selected: favorite }}
                  onPress={() => { void toggleFavorite(word.word_id); }}
                  style={styles.starColumn}
                >
                  <Text style={[styles.star, favorite && styles.starActive]}>{favorite ? '★' : '☆'}</Text>
                </Pressable>
              </View>;
            })}
          </View> : <Text style={styles.empty}>{t('statistics.not_enough')}</Text>}
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.inlineError}>{error}</Text> : null}
      </>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 14, gap: 24 },
  loading: { flex: 1, minHeight: 360, alignItems: 'center', justifyContent: 'center' },
  unavailable: { flex: 1, minHeight: 420, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  unavailableTitle: { color: theme.colors.text, fontSize: 19, lineHeight: 25, fontWeight: '900', textAlign: 'center' },
  unavailableBody: { marginTop: 8, color: theme.colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retryButton: { minWidth: 150, minHeight: 46, marginTop: 18, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.line, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: theme.colors.text, fontSize: 11, fontWeight: '900' },
  section: { gap: 9 },
  sectionTitle: { color: theme.colors.text, fontSize: 13, lineHeight: 18, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  metric: { width: '50%', minHeight: 78, paddingVertical: 12, paddingRight: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  metricValue: { color: theme.colors.text, fontSize: 21, lineHeight: 25, fontWeight: '900', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
  metricLabel: { marginTop: 5, color: theme.colors.textMuted, fontSize: 10, lineHeight: 14 },
  problemTable: { borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  problemHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  problemRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  headerText: { color: theme.colors.textSoft, fontSize: 8, lineHeight: 11, fontWeight: '900', textTransform: 'uppercase' },
  wordColumn: { flex: 1, minWidth: 0, paddingRight: 7 },
  numberColumn: { width: 38, color: theme.colors.textMuted, fontSize: 9, lineHeight: 13, fontWeight: '800', fontFamily: theme.fonts.mono, textAlign: 'center', fontVariant: ['tabular-nums'] },
  percentColumn: { width: 46, color: theme.colors.danger, fontSize: 9, lineHeight: 13, fontWeight: '900', fontFamily: theme.fonts.mono, textAlign: 'center', fontVariant: ['tabular-nums'] },
  starColumn: { width: 38, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  problemWord: { color: theme.colors.text, fontSize: 12, lineHeight: 16, fontWeight: '900' },
  problemTranslation: { marginTop: 2, color: theme.colors.textMuted, fontSize: 9, lineHeight: 13 },
  star: { color: theme.colors.textSoft, fontSize: 21, lineHeight: 24 },
  starActive: { color: theme.colors.accentStrong },
  empty: { minHeight: 72, paddingVertical: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.lineSoft, color: theme.colors.textMuted, fontSize: 11, lineHeight: 16 },
  inlineError: { color: theme.colors.danger, fontSize: 10, lineHeight: 15, textAlign: 'center' },
});
