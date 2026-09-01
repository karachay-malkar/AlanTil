import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlanIcon } from '@/src/mobile/icons';
import { useI18n, type MobileMessageKey } from '@/src/mobile/i18n';
import { OverflowMarquee } from '@/src/mobile/overflow-marquee';
import { PracticeHeader } from '@/src/mobile/practice/common';
import { adminAlanWord, adminTranslation, ADMIN_STORY_ORDER, boundedProgress } from '@/src/mobile/profile/admin-policy';
import {
  fetchAdminTest,
  fetchAdminUser,
  fetchAdminUserFavorites,
  fetchAdminUsers,
  fetchAdminUserTests,
  isActivityAccessDenied,
  type AdminTestDetail,
  type AdminTestRow,
  type AdminUserDetail,
  type AdminUserRow,
  type AdminWordRow,
} from '@/src/mobile/profile/admin-repository';
import { ProfileNavigation } from '@/src/mobile/profile/navigation';
import { useSettings } from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';
import { AppText as Text } from '@/src/mobile/typography';

type Translator = (key: MobileMessageKey, params?: Record<string, string | number>) => string;

function storyKey(type: string): MobileMessageKey {
  if (type === 'oblivion') return 'admin.story_oblivion';
  if (type === 'roots') return 'admin.story_roots';
  if (type === 'ascent') return 'admin.story_ascent';
  if (type === 'pathways') return 'admin.story_pathways';
  return 'admin.user';
}

function localeFor(language: string) {
  return language === 'en' ? 'en-US' : language === 'tr' ? 'tr-TR' : 'ru-RU';
}

function dayStamp(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatLastVisit(value: string | null | undefined, language: string, t: Translator) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) return t('admin.no_data');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayStamp(date) === dayStamp(today)) return t('admin.today');
  if (dayStamp(date) === dayStamp(yesterday)) return t('admin.yesterday');
  return new Intl.DateTimeFormat(localeFor(language), { day: '2-digit', month: '2-digit', year: '2-digit' }).format(date);
}

function formatDateTime(value: string | null | undefined, language: string, t: Translator) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) return t('admin.no_data');
  return new Intl.DateTimeFormat(localeFor(language), { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function durationLabel(seconds: unknown) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function Loading() {
  return <View style={styles.state}><ActivityIndicator color={theme.colors.accentStrong} /></View>;
}

function Failure({ denied, retry }: { denied: boolean; retry: () => void }) {
  const { t } = useI18n();
  return <View accessibilityRole="alert" style={styles.state}>
    <Text style={styles.stateText}>{t(denied ? 'admin.activity_access_denied' : 'admin.data_unavailable')}</Text>
    {!denied ? <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}><Text style={styles.retryText}>{t('common.retry')}</Text></Pressable> : null}
  </View>;
}

function StoryProgressRow({ type, passed, total }: { type: string; passed: number; total: number }) {
  const { t } = useI18n();
  const progress = boundedProgress(passed, total);
  return <View style={styles.storyRow}>
    <View style={styles.storyHead}><Text numberOfLines={1} style={styles.storyName}>{t(storyKey(type))}</Text><Text style={styles.storyCount}>{progress.passed}/{progress.total}</Text></View>
    <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress.percent}%` }]} /></View>
  </View>;
}

export function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const { language, t } = useI18n();
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setDenied(false);
    setFailed(false);
    try {
      setRows(await fetchAdminUsers());
    } catch (error) {
      setDenied(isActivityAccessDenied(error));
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <View style={styles.screen}>
    <ProfileNavigation active="users" />
    {loading ? <Loading /> : failed ? <Failure denied={denied} retry={() => void load()} /> : <ScrollView contentContainerStyle={[styles.usersContent, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      {!rows.length ? <View style={styles.state}><Text style={styles.stateText}>{t('admin.no_users')}</Text></View> : rows.map((row, index) => {
        const rank = Math.max(1, Number(row.rank) || index + 1);
        return <Pressable accessibilityRole="button" key={row.user_id} onPress={() => router.push({ pathname: '/profile/users/[userId]', params: { userId: row.user_id } })} style={({ pressed }) => [styles.userCard, rank <= 3 && styles.topUserCard, pressed && styles.pressed]}>
          <View style={[styles.rank, rank <= 3 && styles.topRank]}><Text style={[styles.rankText, rank <= 3 && styles.topRankText]}>{rank}</Text></View>
          <View style={styles.userCardBody}>
            <View style={styles.userHead}><Text numberOfLines={1} style={styles.nickname}>{row.nickname}</Text><Text style={styles.lastVisit}>{formatLastVisit(row.last_seen_at, language, t)}</Text></View>
            <View style={styles.userMetrics}>
              <Text style={styles.userMetric}>{t('admin.days_short', { count: Math.max(0, Number(row.streak_days) || 0) })}</Text>
              <Text style={styles.userMetric}>{Math.max(0, Number(row.mastered_words) || 0)} · {t('admin.mastered_words')}</Text>
            </View>
            <View style={styles.storyMiniGrid}>{ADMIN_STORY_ORDER.map((type) => {
              const progress = boundedProgress(row.stories?.[type]?.passed, row.stories?.[type]?.total);
              return <View key={type} style={styles.storyMini}><Text numberOfLines={1} style={styles.storyMiniName}>{t(storyKey(type))}</Text><Text style={styles.storyMiniValue}>{progress.passed}/{progress.total}</Text></View>;
            })}</View>
          </View>
          <AlanIcon color={theme.colors.textSoft} name="chevron" size={16} />
        </Pressable>;
      })}
    </ScrollView>}
  </View>;
}

function SummaryMetric({ value, label }: { value: string | number; label: string }) {
  return <View style={styles.summaryMetric}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function TestRow({ row, onPress }: { row: AdminTestRow; onPress: () => void }) {
  const { language, t } = useI18n();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.testRow, pressed && styles.pressed]}>
    <Text style={styles.testDate}>{formatLastVisit(row.ended_at || row.started_at, language, t)}</Text>
    <View style={styles.testCopy}><Text numberOfLines={1} style={styles.testStory}>{t(storyKey(row.story_type))}</Text><Text style={styles.testStation}>{t('admin.station')} {row.story_number}.{String(row.station_number || 0).padStart(2, '0')}</Text></View>
    <Text style={styles.testAccuracy}>{Math.round(Number(row.accuracy) || 0)}%</Text>
    <AlanIcon color={theme.colors.textSoft} name="chevron" size={16} />
  </Pressable>;
}

function FavoriteWords({ rows }: { rows: AdminWordRow[] }) {
  const { settings } = useSettings();
  const { t } = useI18n();
  if (!rows.length) return <Text style={styles.emptyText}>{t('admin.no_favorites')}</Text>;
  return <View style={styles.wordTiles}>{rows.map((row) => <View key={row.word_id} style={styles.wordTile}><OverflowMarquee style={styles.wordTileText}>{adminAlanWord(row, settings)}</OverflowMarquee></View>)}</View>;
}

function ProblemWords({ rows }: { rows: AdminWordRow[] }) {
  const { settings } = useSettings();
  const { t } = useI18n();
  if (!rows.length) return <Text style={styles.emptyText}>{t('admin.no_problem_words')}</Text>;
  return <View style={styles.problemRows}>{rows.map((row) => <View key={row.word_id} style={styles.problemRow}>
    <View style={styles.problemCopy}><OverflowMarquee style={styles.problemWord}>{adminAlanWord(row, settings)}</OverflowMarquee><Text numberOfLines={1} style={styles.problemTranslation}>{adminTranslation(row, settings)}</Text></View>
    <Text style={styles.problemCounts}>{t('admin.test_errors_short', { count: Number(row.test_wrong_count) || 0 })}{'\n'}{t('admin.unknown_short', { count: Number(row.unknown_count) || 0 })}</Text>
  </View>)}</View>;
}

export function AdminUserScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = String(params.userId ?? '');
  const { language, t } = useI18n();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setFailed(false); setDenied(false);
    try { setDetail(await fetchAdminUser(userId)); }
    catch (error) { setDenied(isActivityAccessDenied(error)); setFailed(true); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { void load(); }, [load]);
  return <View style={styles.screen}>
    <PracticeHeader title={detail?.nickname || t('admin.user')} />
    {loading ? <Loading /> : failed ? <Failure denied={denied} retry={() => void load()} /> : !detail ? <View style={styles.state}><Text style={styles.stateText}>{t('admin.user_not_found')}</Text></View> : <ScrollView contentContainerStyle={[styles.detailContent, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      <View style={styles.summaryGrid}>
        <SummaryMetric value={formatLastVisit(detail.last_seen_at, language, t)} label={t('admin.last_visit')} />
        <SummaryMetric value={t('admin.days_short', { count: detail.streak_days })} label={t('admin.streak')} />
        <SummaryMetric value={detail.mastered_words} label={t('admin.mastered_words')} />
        <SummaryMetric value={detail.favorite_words} label={t('admin.favorite_count')} />
      </View>
      <View style={styles.detailSection}><Text style={styles.sectionTitle}>{t('admin.profile_progress')}</Text>{detail.stories.map((row) => <StoryProgressRow key={row.story_type} passed={row.passed} total={row.total} type={row.story_type} />)}</View>
      <View style={styles.detailSection}>
        <View style={styles.sectionHead}><Text style={styles.sectionTitle}>{t('admin.station_tests')}</Text>{detail.test_sessions ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/profile/users/history', params: { userId, nickname: detail.nickname } })} style={({ pressed }) => [styles.inlineActionButton, pressed && styles.pressed]}><Text style={styles.inlineAction}>{t('admin.all_history')}</Text></Pressable> : null}</View>
        {detail.tests.length ? detail.tests.slice(0, 10).map((row) => <TestRow key={row.session_id} onPress={() => router.push({ pathname: '/profile/users/test', params: { sessionId: row.session_id } })} row={row} />) : <Text style={styles.emptyText}>{t('admin.no_tests')}</Text>}
      </View>
      <View style={styles.detailSection}>
        <View style={styles.sectionHead}><Text style={styles.sectionTitle}>{t('admin.favorite_words')}</Text>{detail.favorite_words ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/profile/users/favorites', params: { userId, nickname: detail.nickname } })} style={({ pressed }) => [styles.inlineActionButton, pressed && styles.pressed]}><Text style={styles.inlineAction}>{t('admin.all_words')}</Text></Pressable> : null}</View>
        <FavoriteWords rows={detail.favorites} />
      </View>
      <View style={styles.detailSection}><Text style={styles.sectionTitle}>{t('admin.problem_words')}</Text><ProblemWords rows={detail.problem_words} /></View>
    </ScrollView>}
  </View>;
}

export function AdminHistoryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ userId?: string; nickname?: string }>();
  const userId = String(params.userId ?? '');
  const { t } = useI18n();
  const [rows, setRows] = useState<AdminTestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [denied, setDenied] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setFailed(false); setDenied(false);
    try { setRows(await fetchAdminUserTests(userId)); }
    catch (error) { setDenied(isActivityAccessDenied(error)); setFailed(true); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { void load(); }, [load]);
  return <View style={styles.screen}><PracticeHeader subtitle={String(params.nickname ?? '') || undefined} title={t('admin.station_tests')} />{loading ? <Loading /> : failed ? <Failure denied={denied} retry={() => void load()} /> : <ScrollView contentContainerStyle={[styles.listContent, { paddingBottom: 32 + insets.bottom }]}>{rows.length ? rows.map((row) => <TestRow key={row.session_id} onPress={() => router.push({ pathname: '/profile/users/test', params: { sessionId: row.session_id } })} row={row} />) : <Text style={styles.emptyText}>{t('admin.no_tests')}</Text>}</ScrollView>}</View>;
}

export function AdminFavoritesScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ userId?: string; nickname?: string }>();
  const userId = String(params.userId ?? '');
  const { t } = useI18n();
  const [rows, setRows] = useState<AdminWordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [denied, setDenied] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setFailed(false); setDenied(false);
    try { setRows(await fetchAdminUserFavorites(userId)); }
    catch (error) { setDenied(isActivityAccessDenied(error)); setFailed(true); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { void load(); }, [load]);
  return <View style={styles.screen}><PracticeHeader subtitle={String(params.nickname ?? '') || undefined} title={t('admin.favorite_words')} />{loading ? <Loading /> : failed ? <Failure denied={denied} retry={() => void load()} /> : <ScrollView contentContainerStyle={[styles.listContent, { paddingBottom: 32 + insets.bottom }]}><FavoriteWords rows={rows} /></ScrollView>}</View>;
}

function TestFact({ label, value }: { label: string; value: string | number }) {
  return <View style={styles.factRow}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>;
}

export function AdminTestScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = String(params.sessionId ?? '');
  const { language, t } = useI18n();
  const { settings } = useSettings();
  const [detail, setDetail] = useState<AdminTestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [denied, setDenied] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setFailed(false); setDenied(false);
    try { setDetail(await fetchAdminTest(sessionId)); }
    catch (error) { setDenied(isActivityAccessDenied(error)); setFailed(true); }
    finally { setLoading(false); }
  }, [sessionId]);
  useEffect(() => { void load(); }, [load]);
  return <View style={styles.screen}><PracticeHeader title={t('admin.test_result')} />{loading ? <Loading /> : failed ? <Failure denied={denied} retry={() => void load()} /> : !detail ? <View style={styles.state}><Text style={styles.stateText}>{t('admin.test_not_found')}</Text></View> : <ScrollView contentContainerStyle={[styles.detailContent, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
    <View style={styles.testTitle}><Text style={styles.testNickname}>{detail.nickname}</Text><Text style={styles.testTitleText}>{t(storyKey(detail.story_type))} · {detail.story_number}.{String(detail.station_number || 0).padStart(2, '0')}</Text></View>
    <View style={styles.facts}>
      <TestFact label={t('admin.date')} value={formatDateTime(detail.ended_at || detail.started_at, language, t)} />
      <TestFact label={t('admin.duration')} value={durationLabel(detail.active_duration_sec || detail.duration_sec)} />
      <TestFact label={t('admin.questions')} value={Number(detail.questions_total) || 0} />
      <TestFact label={t('admin.correct_answers')} value={Number(detail.correct_total) || 0} />
      <TestFact label={t('admin.wrong_answers')} value={Number(detail.wrong_total) || 0} />
      <TestFact label={t('admin.accuracy')} value={`${Math.round(Number(detail.accuracy) || 0)}%`} />
    </View>
    <View style={styles.detailSection}><Text style={styles.sectionTitle}>{t('admin.words')}</Text>{detail.words.map((row, index) => {
      const correct = String(row.result ?? '').toLowerCase() === 'correct';
      const selected = correct ? '' : adminAlanWord(row, settings, 'wrong_');
      const selectedTranslation = correct ? '' : adminTranslation(row, settings, 'wrong_');
      return <View key={`${row.word_id}:${index}`} style={[styles.resultWord, correct ? styles.correctWord : styles.wrongWord]}>
        <View style={styles.resultCopy}><OverflowMarquee style={styles.resultAlan}>{adminAlanWord(row, settings)}</OverflowMarquee><Text numberOfLines={2} style={styles.resultTranslation}>{adminTranslation(row, settings)}</Text></View>
        <View style={styles.resultStatus}><Text style={[styles.resultStatusTitle, correct ? styles.correctText : styles.wrongText]}>{t(correct ? 'admin.correct' : 'admin.wrong')}</Text>{selected ? <Text style={styles.selectedAnswer}>{t('admin.selected')}: {selected}{selectedTranslation ? ` — ${selectedTranslation}` : ''}</Text> : null}</View>
      </View>;
    })}</View>
  </ScrollView>}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  state: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  stateText: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  retry: { minWidth: 120, minHeight: 44, paddingHorizontal: 18, borderRadius: 11, backgroundColor: theme.colors.text, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: theme.colors.inverse, fontSize: 11, fontWeight: '900' },
  usersContent: { paddingHorizontal: 12, paddingTop: 10, gap: 9 },
  userCard: { minHeight: 142, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 15, borderWidth: 1, borderColor: theme.colors.lineSoft, backgroundColor: theme.colors.surface2, padding: 12 },
  topUserCard: { borderColor: theme.colors.accent, backgroundColor: 'rgba(246,242,233,0.8)' },
  rank: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface3 },
  topRank: { backgroundColor: theme.colors.accentStrong },
  rankText: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '900', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
  topRankText: { color: theme.colors.inverse },
  userCardBody: { flex: 1, minWidth: 0 },
  userHead: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 8 },
  nickname: { flex: 1, color: theme.colors.text, fontSize: 15, fontWeight: '900' },
  lastVisit: { color: theme.colors.textSoft, fontSize: 9, fontWeight: '700' },
  userMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 5 },
  userMetric: { color: theme.colors.textMuted, fontSize: 9, lineHeight: 13 },
  storyMiniGrid: { marginTop: 9, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  storyMini: { width: '48%', minHeight: 30, paddingHorizontal: 7, borderRadius: 7, backgroundColor: theme.colors.surface, justifyContent: 'center' },
  storyMiniName: { color: theme.colors.textSoft, fontSize: 7, lineHeight: 10 },
  storyMiniValue: { color: theme.colors.text, fontSize: 9, lineHeight: 12, fontWeight: '900', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
  chevron: { alignSelf: 'center', color: theme.colors.textSoft, fontSize: 25 },
  detailContent: { paddingHorizontal: 16, paddingTop: 14, gap: 22 },
  listContent: { paddingHorizontal: 16, paddingTop: 10 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryMetric: { width: '48%', minHeight: 82, borderRadius: 13, borderWidth: 1, borderColor: theme.colors.lineSoft, backgroundColor: theme.colors.surface2, padding: 12, justifyContent: 'center' },
  summaryValue: { color: theme.colors.text, fontSize: 18, lineHeight: 23, fontWeight: '900' },
  summaryLabel: { marginTop: 4, color: theme.colors.textMuted, fontSize: 9, lineHeight: 13 },
  detailSection: { gap: 9 },
  sectionHead: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { flex: 1, color: theme.colors.text, fontSize: 13, lineHeight: 18, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  inlineActionButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  inlineAction: { color: theme.colors.accentStrong, fontSize: 10, lineHeight: 15, fontWeight: '900', textDecorationLine: 'underline' },
  storyRow: { gap: 5, paddingVertical: 6 },
  storyHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  storyName: { flex: 1, color: theme.colors.text, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  storyCount: { color: theme.colors.textMuted, fontSize: 9, fontWeight: '900', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: theme.colors.surface3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.accentStrong },
  testRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  testDate: { width: 50, color: theme.colors.textSoft, fontSize: 9, fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
  testCopy: { flex: 1, minWidth: 0 },
  testStory: { color: theme.colors.text, fontSize: 12, lineHeight: 16, fontWeight: '800' },
  testStation: { marginTop: 2, color: theme.colors.textMuted, fontSize: 9, lineHeight: 12 },
  testAccuracy: { color: theme.colors.accentStrong, fontSize: 12, fontWeight: '900', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
  emptyText: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 17, paddingVertical: 20, textAlign: 'center' },
  wordTiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  wordTile: { width: '48%', minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.lineSoft, backgroundColor: theme.colors.surface2, paddingHorizontal: 10, justifyContent: 'center' },
  wordTileText: { color: theme.colors.text, fontSize: 12, fontWeight: '800' },
  problemRows: { borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  problemRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  problemCopy: { flex: 1, minWidth: 0, gap: 3 },
  problemWord: { color: theme.colors.text, fontSize: 13, fontWeight: '900' },
  problemTranslation: { color: theme.colors.textMuted, fontSize: 10 },
  problemCounts: { color: theme.colors.danger, fontSize: 8, lineHeight: 12, textAlign: 'right' },
  testTitle: { alignItems: 'center', gap: 5 },
  testNickname: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 16 },
  testTitleText: { color: theme.colors.text, fontSize: 20, lineHeight: 26, fontWeight: '900', textAlign: 'center' },
  facts: { borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  factRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  factLabel: { flex: 1, color: theme.colors.textMuted, fontSize: 11 },
  factValue: { color: theme.colors.text, fontSize: 11, fontWeight: '900', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
  resultWord: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft, borderLeftWidth: 3, paddingLeft: 9 },
  correctWord: { borderLeftColor: theme.colors.success },
  wrongWord: { borderLeftColor: theme.colors.danger },
  resultCopy: { flex: 1, minWidth: 0, gap: 4 },
  resultAlan: { color: theme.colors.text, fontSize: 13, fontWeight: '900' },
  resultTranslation: { color: theme.colors.textMuted, fontSize: 10, lineHeight: 14 },
  resultStatus: { width: '43%', alignItems: 'flex-end', gap: 3 },
  resultStatusTitle: { fontSize: 10, fontWeight: '900' },
  correctText: { color: theme.colors.success },
  wrongText: { color: theme.colors.danger },
  selectedAnswer: { color: theme.colors.textMuted, fontSize: 8, lineHeight: 12, textAlign: 'right' },
  pressed: { opacity: 0.68, transform: [{ scale: 0.995 }] },
});
