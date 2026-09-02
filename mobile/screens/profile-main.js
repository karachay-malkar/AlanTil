import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { applyUserSettingsUpdate } from '../../packages/alantil-core/settings.js';
import { buildLearningRoute } from '../../packages/alantil-core/learning-route.js';
import { dictionaryPathProgress } from '../../packages/alantil-core/route-progress.js';
import { Button, Header, ProgressBar, Screen } from '../ui/components.js';
import { CompactSegmentedControl, EmptyState, MetricStrip, MonoLabel, ScreenSection, SurfaceCard } from '../ui/parity.js';
import { theme } from '../ui/theme.js';
import { bootstrapNativeAuth, subscribeNativeAuth } from '../platform/auth.js';
import { getNativeDictionaryDiagnostics, refreshNativeDictionary } from '../platform/dictionary.js';
import { loadNativeProfile } from '../platform/profile-api.js';
import { getNativeProgressSummary, loadNativeWordProgressMap } from '../platform/progress.js';

const C = theme.colors;
const T = theme.type;

function durationLabel(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  if (value < 60) return `${Math.round(value)} сек`;
  if (value < 3600) return `${Math.round(value / 60)} мин`;
  return `${(value / 3600).toFixed(value >= 36000 ? 0 : 1)} ч`;
}

const PROFILE_AVATAR_MALE = require('../../assets/images/profile/avatar_male.png');
const PROFILE_AVATAR_FEMALE = require('../../assets/images/profile/avatar_female.png');
function AvatarFigure({ gender }) {
  return <Image source={gender === 'female' ? PROFILE_AVATAR_FEMALE : PROFILE_AVATAR_MALE} resizeMode="contain" style={styles.avatarImage} />;
}

function ProfilePane({ route, profile, onAccount }) {
  const [progressMap, setProgressMap] = useState(() => new Map());
  useEffect(() => {
    let alive = true;
    loadNativeWordProgressMap().then((map) => { if (alive) setProgressMap(map); });
    return () => { alive = false; };
  }, []);
  const path = useMemo(() => dictionaryPathProgress(route, progressMap), [route, progressMap]);
  if (!profile) return <EmptyState>Профиль загружается…</EmptyState>;
  return <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
    <SurfaceCard inset style={styles.identity}><MonoLabel>PROFILE</MonoLabel><AvatarFigure gender={profile.avatar_gender} /><Text style={styles.nickname}>{profile.nickname}</Text><Button style={styles.accountButton} onPress={onAccount}>Аккаунт</Button></SurfaceCard>
    <ScreenSection title="Прогресс по историям"><SurfaceCard>{(route.storyOrder || []).map((type) => {
      const story = route.stories[type];
      const value = path.stories[type] || { percent: 0 };
      return <View key={type} style={styles.storyRow}><View style={styles.storyHead}><Text style={styles.storyName}>{story?.label || type}</Text><MonoLabel accent>{value.percent}%</MonoLabel></View><ProgressBar value={value.percent} /></View>;
    })}</SurfaceCard></ScreenSection>
    <ScreenSection title="Артефакты"><EmptyState>Заработанные вещи появятся здесь позже.</EmptyState></ScreenSection>
  </ScrollView>;
}

function StatisticsPane({ words, route }) {
  const [summary, setSummary] = useState(null);
  const [progressMap, setProgressMap] = useState(() => new Map());
  useEffect(() => {
    let alive = true;
    Promise.all([getNativeProgressSummary(words), loadNativeWordProgressMap()]).then(([next, map]) => { if (alive) { setSummary(next); setProgressMap(map); } });
    return () => { alive = false; };
  }, [words]);
  const path = useMemo(() => dictionaryPathProgress(route, progressMap), [route, progressMap]);
  const completed = Object.values(path.stories || {}).reduce((sum, value) => sum + Number(value.completedCatalogs || 0), 0);
  if (!summary) return <EmptyState>Загружаем статистику…</EmptyState>;
  return <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
    <ScreenSection title="Сводка эффективности"><SurfaceCard><MetricStrip items={[[String(summary.mastered || 0), 'освоено'], [String(completed), 'словарей'], [durationLabel(summary.activity?.activeSeconds || 0), 'активность']]} /><MetricStrip items={[[String(summary.activity?.sessions || 0), 'сессий'], [`${summary.activity?.accuracy || 0}%`, 'точность'], [String(summary.review || 0), 'к повторению']]} /></SurfaceCard></ScreenSection>
    <ScreenSection title="Проблемные слова">{summary.difficult?.length ? <SurfaceCard>{summary.difficult.slice(0, 7).map(({ word, unknownRate }) => <View key={word.id} style={styles.problemRow}><View style={styles.problemCopy}><Text numberOfLines={1} style={styles.problemWord}>{word.word}</Text><Text numberOfLines={1} style={styles.problemTrans}>{word.trans}</Text></View><MonoLabel style={styles.problemRate}>{unknownRate}%</MonoLabel></View>)}</SurfaceCard> : <EmptyState>Пока недостаточно данных.</EmptyState>}</ScreenSection>
  </ScrollView>;
}

function SettingRow({ label, value, items, onChange, hidden = false }) {
  if (hidden) return null;
  return <View style={styles.settingRow}><Text style={styles.settingLabel}>{label}</Text><View style={styles.settingControl}><CompactSegmentedControl value={value} items={items} onChange={onChange} /></View></View>;
}

function SettingsLink({ title, value = '', onPress }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.settingsLink, pressed && styles.settingsPressed]}><Text style={styles.settingsLinkTitle}>{title}</Text><View style={styles.settingsLinkEnd}>{value ? <MonoLabel>{value}</MonoLabel> : null}<Text style={styles.settingsChevron}>›</Text></View></Pressable>;
}

function SettingsPane({ settings, onChange }) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [dictionary, setDictionary] = useState(() => getNativeDictionaryDiagnostics());
  const [dictionaryBusy, setDictionaryBusy] = useState(false);
  const [dictionaryError, setDictionaryError] = useState('');
  useEffect(() => { setDraft(settings); }, [settings]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const update = (key, value) => { setSaved(false); setDraft((current) => applyUserSettingsUpdate(current, { [key]: value })); };
  const save = async () => { if (!dirty) return; await onChange(draft); setSaved(true); };
  const refreshDictionary = async () => {
    if (dictionaryBusy) return;
    setDictionaryBusy(true); setDictionaryError('');
    try { await refreshNativeDictionary(); setDictionary(getNativeDictionaryDiagnostics()); }
    catch { setDictionaryError('Не удалось проверить актуальную версию словаря.'); }
    finally { setDictionaryBusy(false); }
  };
  return <ScrollView contentContainerStyle={styles.settingsScroll} showsVerticalScrollIndicator={false}>
    <View style={styles.settingsPageHead}><Text style={styles.settingsPageTitle}>Настройки</Text><Button compact primary={dirty} disabled={!dirty} onPress={save}>{saved ? 'Сохранено' : 'Сохранить'}</Button></View>

    <View style={styles.settingsSection}>
      <Text style={styles.settingsSectionTitle}>Языковые настройки</Text>
      <SettingRow label="Язык интерфейса" value={draft.interface_language_code} items={[["ru", "RU"], ["en", "EN"], ["tr", "TR"]]} onChange={(value) => update('interface_language_code', value)} />
      <SettingRow label="Алфавит аланских слов" value={draft.alan_script_code} items={[["cyrillic", "Кириллица"], ["turkic", "Latin"]]} onChange={(value) => update('alan_script_code', value)} />
      <SettingRow hidden={draft.alan_script_code === 'turkic'} label="Вариант кириллицы" value={draft.alan_dialect_code} items={[["canonical", "Җ"], ["karachay", "Дж"], ["balkar", "Ж"]]} onChange={(value) => update('alan_dialect_code', value)} />
      <SettingRow label="Размер текста" value={draft.text_size_code} items={[["small", "S"], ["medium", "M"], ["large", "L"]]} onChange={(value) => update('text_size_code', value)} />
      <View style={styles.settingsLearningPreview}><MonoLabel>ПРЕДПРОСМОТР</MonoLabel><Text style={[styles.previewWord, draft.text_size_code === 'small' && styles.previewSmall, draft.text_size_code === 'large' && styles.previewLarge]}>тау</Text><Text style={styles.previewTranslation}>гора</Text></View>
    </View>

    <View style={styles.settingsSection}>
      <View style={styles.settingsSectionHead}><Text style={styles.settingsSectionTitleBare}>Версия словаря</Text><Button compact disabled={dictionaryBusy} onPress={refreshDictionary}>{dictionaryBusy ? 'Проверяем…' : 'Обновить'}</Button></View>
      <View style={styles.versionFlatRow}><Text style={styles.versionLabel}>Текущая</Text><MonoLabel>{dictionary.installedVersion || dictionary.bundledVersion || '—'}</MonoLabel></View>
      <View style={styles.versionFlatRow}><Text style={styles.versionLabel}>Актуальная</Text><MonoLabel>{dictionary.installedVersion || dictionary.bundledVersion || '—'}</MonoLabel></View>
      {dictionaryError ? <Text style={styles.settingsError}>{dictionaryError}</Text> : null}
    </View>

    <View style={[styles.settingsSection, styles.settingsLinksSection]}>
      <SettingsLink title="Благодарности" onPress={() => {}} />
      <SettingsLink title="Версия приложения" value="16.6.0" onPress={() => {}} />
      <SettingsLink title="Политика конфиденциальности" onPress={() => {}} />
    </View>
  </ScrollView>;
}

export function ProfileMainArea({ words, settings, onSettingsChange, onAccount }) {
  const [tab, setTab] = useState('profile');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const route = useMemo(() => buildLearningRoute(words), [words]);

  useEffect(() => {
    let alive = true;
    const apply = async (nextSession) => {
      if (!alive) return;
      setSession(nextSession || null);
      if (!nextSession?.user?.id) { setProfile(null); return; }
      try { const next = await loadNativeProfile(nextSession.user.id); if (alive) setProfile(next); } catch { if (alive) setProfile(null); }
    };
    bootstrapNativeAuth().then(apply).catch(() => apply(null));
    const unsubscribe = subscribeNativeAuth(apply);
    return () => { alive = false; unsubscribe(); };
  }, []);

  return <Screen bottomNav><Header title="Alan Til!" trailing={session?.user ? null : undefined} /><View style={styles.tabs}><CompactSegmentedControl value={tab} items={[["profile", "Профиль"], ["statistics", "Статистика"], ["settings", "Настройки"]]} onChange={setTab} /></View><View style={styles.body}>{tab === 'statistics' ? <StatisticsPane words={words} route={route} /> : tab === 'settings' ? <SettingsPane settings={settings} onChange={onSettingsChange} /> : <ProfilePane route={route} profile={profile} onAccount={onAccount} />}</View></Screen>;
}

const styles = StyleSheet.create({
  tabs: { position: 'absolute', zIndex: 24, top: theme.control.header + 4, left: 28, right: 28, height: 36 },
  body: { flex: 1, paddingTop: theme.control.header + 44, paddingBottom: theme.control.nav },
  scroll: { paddingHorizontal: 12, paddingBottom: 28, gap: 18 },
  identity: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18 },
  avatarImage: { width: 118, height: 146 },
  nickname: { fontSize: 22, fontWeight: '850', lineHeight: 26, color: C.text1 },
  accountButton: { width: 150, marginTop: 2 },
  storyRow: { minHeight: 60, paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.lineSoft, gap: 7 },
  storyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  storyName: { flex: 1, fontSize: 13, fontWeight: '750', color: C.text1 },
  problemRow: { minHeight: 54, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  problemCopy: { flex: 1, minWidth: 0 },
  problemWord: { fontSize: 14, fontWeight: '800', color: C.text1 },
  problemTrans: { marginTop: 2, fontSize: T.caption, color: C.text2 },
  problemRate: { color: C.dangerStrong },
  settingsScroll: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 30 },
  settingsPageHead: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  settingsPageTitle: { fontSize: 19, fontWeight: '860', color: C.text1 },
  settingsSection: { marginTop: 20 },
  settingsSectionTitle: { paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: C.lineSoft, fontSize: 15, fontWeight: '850', lineHeight: 18, color: C.text1 },
  settingsSectionHead: { minHeight: 36, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  settingsSectionTitleBare: { flex: 1, paddingBottom: 7, fontSize: 15, fontWeight: '850', lineHeight: 18, color: C.text1 },
  settingRow: { minHeight: 46, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  settingLabel: { flex: 1, minWidth: 120, fontSize: 12, lineHeight: 15, color: C.text2 },
  settingControl: { width: 178, maxWidth: '55%' },
  settingsLearningPreview: { width: '100%', height: 180, marginTop: 14, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: C.lineSoft, backgroundColor: C.paperSoft },
  previewWord: { fontSize: 29, fontWeight: '900', color: C.text1 },
  previewSmall: { fontSize: 24 },
  previewLarge: { fontSize: 34 },
  previewTranslation: { fontSize: 13, color: C.text2 },
  versionFlatRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  versionLabel: { fontSize: 12, color: C.text2 },
  settingsError: { marginTop: 7, fontSize: 11, lineHeight: 15, color: C.dangerStrong },
  settingsLinksSection: { borderTopWidth: 1, borderTopColor: C.lineSoft },
  settingsLink: { minHeight: 46, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  settingsLinkTitle: { fontSize: 13, color: C.text1 },
  settingsLinkEnd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingsChevron: { fontSize: 19, color: C.text3 },
  settingsPressed: { opacity: .64 },
});
