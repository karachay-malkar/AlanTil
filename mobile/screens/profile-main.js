import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { applyUserSettingsUpdate } from '../../packages/alantil-core/settings.js';
import { buildLearningRoute } from '../../packages/alantil-core/learning-route.js';
import { dictionaryPathProgress } from '../../packages/alantil-core/route-progress.js';
import { Button, Header, ProgressBar, Screen } from '../ui/components.js';
import { CompactSegmentedControl, EmptyState, MetricStrip, MonoLabel, ScreenSection, SurfaceCard } from '../ui/parity.js';
import { theme } from '../ui/theme.js';
import { bootstrapNativeAuth, subscribeNativeAuth } from '../platform/auth.js';
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

function AvatarFigure({ gender }) {
  const female = gender === 'female';
  return <View style={styles.avatarFigure}><View style={[styles.avatarHead, female && styles.avatarHeadFemale]} /><View style={[styles.avatarBody, female && styles.avatarBodyFemale]} /></View>;
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
    <ScreenSection title="Сводка эффективности"><SurfaceCard><MetricStrip items={[[String(summary.mastered || 0), 'освоено'], [String(completed), 'словарей'], [durationLabel(summary.activity?.activeSeconds || 0), 'активность']]} /><MetricStrip items={[[String(summary.activity?.learnSessions || 0), 'сессий'], [`${summary.activity?.accuracy || 0}%`, 'точность'], [String(summary.review || 0), 'к повторению']]} /></SurfaceCard></ScreenSection>
    <ScreenSection title="Проблемные слова">{summary.difficult?.length ? <SurfaceCard>{summary.difficult.slice(0, 7).map(({ word, unknownRate }) => <View key={word.id} style={styles.problemRow}><View style={styles.problemCopy}><Text numberOfLines={1} style={styles.problemWord}>{word.word}</Text><Text numberOfLines={1} style={styles.problemTrans}>{word.trans}</Text></View><MonoLabel style={styles.problemRate}>{unknownRate}%</MonoLabel></View>)}</SurfaceCard> : <EmptyState>Пока недостаточно данных.</EmptyState>}</ScreenSection>
  </ScrollView>;
}

function SettingRow({ label, value, items, onChange }) {
  return <View style={styles.settingRow}><Text style={styles.settingLabel}>{label}</Text><View style={styles.settingControl}><CompactSegmentedControl value={value} items={items} onChange={onChange} /></View></View>;
}

function SettingsPane({ settings, onChange }) {
  const update = (key, value) => onChange(applyUserSettingsUpdate(settings, { [key]: value }));
  return <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
    <ScreenSection title="Язык и отображение"><SurfaceCard>
      <SettingRow label="Язык интерфейса" value={settings.interface_language_code} items={[["ru", "RU"], ["en", "EN"], ["tr", "TR"]]} onChange={(value) => update('interface_language_code', value)} />
      <SettingRow label="Письменность" value={settings.alan_script_code} items={[["cyrillic", "Кир."], ["turkic", "Lat."]]} onChange={(value) => update('alan_script_code', value)} />
      {settings.alan_script_code === 'cyrillic' ? <SettingRow label="Форма Җ" value={settings.alan_dialect_code} items={[["canonical", "Җ"], ["karachay", "Дж"], ["balkar", "Ж"]]} onChange={(value) => update('alan_dialect_code', value)} /> : null}
      <SettingRow label="Размер текста" value={settings.text_size_code} items={[["small", "S"], ["medium", "M"], ["large", "L"]]} onChange={(value) => update('text_size_code', value)} />
    </SurfaceCard></ScreenSection>
    <SurfaceCard inset style={styles.preview}><MonoLabel>ПРЕДПРОСМОТР</MonoLabel><Text style={[styles.previewWord, settings.text_size_code === 'small' && styles.previewSmall, settings.text_size_code === 'large' && styles.previewLarge]}>тау</Text><Text style={styles.previewTranslation}>гора</Text></SurfaceCard>
    <ScreenSection title="Версия"><SurfaceCard><View style={styles.versionRow}><Text style={styles.versionLabel}>Приложение</Text><MonoLabel>16.3.0</MonoLabel></View><View style={styles.versionRow}><Text style={styles.versionLabel}>Источник</Text><MonoLabel>Web 13.15.12</MonoLabel></View></SurfaceCard></ScreenSection>
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

  const title = tab === 'statistics' ? 'Статистика' : tab === 'settings' ? 'Настройки' : 'Профиль';
  return <Screen bottomNav><Header title={title} trailing={session?.user ? null : undefined} /><View style={styles.tabs}><CompactSegmentedControl value={tab} items={[["profile", "Профиль"], ["statistics", "Статистика"], ["settings", "Настройки"]]} onChange={setTab} /></View><View style={styles.body}>{tab === 'statistics' ? <StatisticsPane words={words} route={route} /> : tab === 'settings' ? <SettingsPane settings={settings} onChange={onSettingsChange} /> : <ProfilePane route={route} profile={profile} onAccount={onAccount} />}</View></Screen>;
}

const styles = StyleSheet.create({
  tabs: { position: 'absolute', zIndex: 24, top: theme.control.header + 4, left: 28, right: 28, height: 36 },
  body: { flex: 1, paddingTop: theme.control.header + 44, paddingBottom: theme.control.nav },
  scroll: { paddingHorizontal: 12, paddingBottom: 28, gap: 18 },
  identity: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18 },
  avatarFigure: { width: 82, height: 98, alignItems: 'center', justifyContent: 'flex-start' },
  avatarHead: { width: 35, height: 37, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface1 },
  avatarHeadFemale: { borderRadius: 15 },
  avatarBody: { marginTop: 5, width: 66, height: 50, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface1 },
  avatarBodyFemale: { width: 60, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
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
  settingRow: { minHeight: 66, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.lineSoft, gap: 7 },
  settingLabel: { fontSize: 12, fontWeight: '750', color: C.text2 },
  settingControl: { width: '100%' },
  preview: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewWord: { fontSize: 29, fontWeight: '900', color: C.text1 },
  previewSmall: { fontSize: 24 },
  previewLarge: { fontSize: 34 },
  previewTranslation: { fontSize: 13, color: C.text2 },
  versionRow: { minHeight: 48, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  versionLabel: { fontSize: 13, color: C.text2 },
});
