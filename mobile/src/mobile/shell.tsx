import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/src/mobile/session';
import { useSettings } from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';

type RootTab = 'path' | 'practice' | 'profile';

const TAB_LABELS: Record<RootTab, string> = {
  path: 'Путь',
  practice: 'Практика',
  profile: 'Профиль',
};

function PathRoot() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.pathContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pathHeader}>
        <Text style={styles.brand}>Алан тил</Text>
        <Text style={styles.pathTitle}>Путь</Text>
        <Text style={styles.muted}>Истории и станции будут перенесены в 14.1.2 без изменения логики сайта.</Text>
      </View>
      <View style={styles.routeLine} />
      {['Восхождение', 'На вершине', 'Тропы', 'Возвращение к истокам', 'На пороге забвения'].map((story, index) => (
        <View key={story} style={styles.storyRow}>
          <View style={[styles.stationStone, index > 0 && styles.stationLocked]}>
            <Text style={styles.stationNumber}>{index + 1}</Text>
          </View>
          <View style={styles.storyCopy}>
            <Text style={styles.storyTitle}>{story}</Text>
            <Text style={styles.storyMeta}>{index === 0 ? 'Доступно' : 'Следующая история'}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function PracticeRoot() {
  const items = ['Учить слова', 'Проверить знания', 'Сопоставить слова', 'Избранные слова', 'Песни'];
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.rootContent}>
      <Text style={styles.rootTitle}>Практика</Text>
      <View style={styles.cardList}>
        {items.map((item) => (
          <Pressable key={item} style={styles.menuCard}>
            <Text style={styles.menuCardTitle}>{item}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.stageNote}>Экраны и игровая логика подключаются в 14.1.3.</Text>
    </ScrollView>
  );
}

function ProfileRoot() {
  const session = useSession();
  const { settings } = useSettings();
  const dialect = settings.alan_script_code === 'turkic'
    ? 'Latin'
    : settings.alan_dialect_code === 'karachay'
      ? 'Кириллица · Дж'
      : settings.alan_dialect_code === 'balkar'
        ? 'Кириллица · Ж'
        : 'Кириллица · Җ';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.rootContent}>
      <Text style={styles.rootTitle}>Профиль</Text>
      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{session.user ? 'А' : 'Г'}</Text></View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{session.user?.email ?? 'Гостевой режим'}</Text>
          <Text style={styles.muted}>{session.user ? 'Аккаунт подключён' : 'Прогресс хранится на устройстве'}</Text>
        </View>
      </View>

      {session.error ? <Text style={styles.error}>{session.error}</Text> : null}
      {session.authBusy ? <ActivityIndicator color={theme.colors.accentStrong} /> : null}
      {session.user ? (
        <Pressable disabled={session.authBusy} onPress={session.signOut} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Выйти</Text>
        </Pressable>
      ) : (
        <Pressable disabled={session.authBusy} onPress={session.signInWithGoogle} style={styles.googleButton}>
          <Text style={styles.googleMark}>G</Text>
          <Text style={styles.googleText}>Войти через Google</Text>
        </Pressable>
      )}

      <View style={styles.cardList}>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Язык интерфейса</Text><Text style={styles.infoValue}>{settings.interface_language_code.toUpperCase()}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Аланские слова</Text><Text style={styles.infoValue}>{dialect}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Версия</Text><Text style={styles.infoValue}>14.1.1</Text></View>
      </View>
      <Text style={styles.stageNote}>Полный профиль, статистика и настройки подключаются в 14.1.4.</Text>
    </ScrollView>
  );
}

export function AppShell() {
  const [tab, setTab] = useState<RootTab>('path');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        {tab === 'path' ? <PathRoot /> : null}
        {tab === 'practice' ? <PracticeRoot /> : null}
        {tab === 'profile' ? <ProfileRoot /> : null}
      </View>
      <View style={styles.nav}>
        {(Object.keys(TAB_LABELS) as RootTab[]).map((key) => {
          const active = tab === key;
          return (
            <Pressable key={key} onPress={() => setTab(key)} style={styles.navItem}>
              <View style={[styles.navDot, active && styles.navDotActive]} />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{TAB_LABELS[key]}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  body: { flex: 1 },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  rootContent: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 32, gap: 20 },
  pathContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 50, minHeight: 760 },
  pathHeader: { marginBottom: 30 },
  brand: { color: theme.colors.textSoft, fontSize: 13, fontWeight: '600', letterSpacing: 0.4, marginBottom: 6 },
  pathTitle: { color: theme.colors.text, fontSize: 36, fontWeight: '700', marginBottom: 8 },
  muted: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  routeLine: { position: 'absolute', left: 49, top: 180, bottom: 62, width: 2, backgroundColor: 'rgba(54,50,43,0.10)' },
  storyRow: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 22 },
  stationStone: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#d8d0c2', borderWidth: 1, borderColor: 'rgba(75,70,61,0.42)', alignItems: 'center', justifyContent: 'center' },
  stationLocked: { opacity: 0.58, backgroundColor: '#e3ded5' },
  stationNumber: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  storyCopy: { flex: 1 },
  storyTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
  storyMeta: { color: theme.colors.textSoft, fontSize: 12, marginTop: 4 },
  rootTitle: { color: theme.colors.text, fontSize: 32, fontWeight: '700' },
  cardList: { borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  menuCard: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  menuCardTitle: { flex: 1, color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  chevron: { color: theme.colors.textSoft, fontSize: 28 },
  stageNote: { color: theme.colors.textSoft, fontSize: 12, lineHeight: 18 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: theme.colors.surface3, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.line },
  avatarText: { color: theme.colors.accentStrong, fontSize: 22, fontWeight: '700' },
  profileCopy: { flex: 1 },
  profileName: { color: theme.colors.text, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  primaryButton: { minHeight: 46, borderRadius: theme.radius.sm, backgroundColor: theme.colors.accentStrong, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: theme.colors.inverse, fontSize: 15, fontWeight: '700' },
  googleButton: { minHeight: 48, borderRadius: theme.radius.sm, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  googleMark: { color: '#4285f4', fontSize: 18, fontWeight: '800' },
  googleText: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  error: { color: theme.colors.danger, fontSize: 13 },
  infoRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft, gap: 12 },
  infoLabel: { flex: 1, color: theme.colors.text, fontSize: 14 },
  infoValue: { color: theme.colors.textMuted, fontSize: 13 },
  nav: { height: 60, borderTopWidth: 1, borderTopColor: theme.colors.lineSoft, backgroundColor: 'rgba(238,233,223,0.98)', flexDirection: 'row' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(70,66,59,0.22)' },
  navDotActive: { width: 8, backgroundColor: theme.colors.accentStrong },
  navLabel: { color: theme.colors.textSoft, fontSize: 11, fontWeight: '600' },
  navLabelActive: { color: theme.colors.accentStrong },
});
