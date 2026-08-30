import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '@/src/mobile/chrome';
import { useSession } from '@/src/mobile/session';
import { useSettings } from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';

export function PracticeRoot() {
  const items = [
    ['Тест', 'Проверка слов из выбранных разделов'],
    ['Сопоставление', 'Соединение слов и переводов'],
    ['Избранное', 'Учить слова'],
    ['Песни', 'Язык в живом контексте'],
  ];
  return (
    <View style={styles.screen}>
      <ScreenHeader title="Практика" />
      <ScrollView contentContainerStyle={styles.rootContent} showsVerticalScrollIndicator={false}>
        <View style={styles.cardList}>
          {items.map(([title, subtitle]) => (
            <Pressable key={title} style={({ pressed }) => [styles.menuCard, pressed && styles.pressed]}>
              <View style={styles.menuCopy}>
                <Text style={styles.menuCardTitle}>{title}</Text>
                <Text style={styles.menuCardSubtitle}>{subtitle}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function ProfileRoot() {
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
    <View style={styles.screen}>
      <ScreenHeader title="Профиль" />
      <ScrollView contentContainerStyle={styles.rootContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{session.user ? 'А' : 'Г'}</Text></View>
          <View style={styles.profileCopy}>
            <Text numberOfLines={1} style={styles.profileName}>{session.user?.email ?? 'Гостевой режим'}</Text>
            <Text style={styles.muted}>{session.user ? 'Аккаунт подключён' : 'Прогресс хранится на устройстве'}</Text>
          </View>
        </View>

        {session.error ? <Text style={styles.error}>{session.error}</Text> : null}
        {session.authBusy ? <ActivityIndicator color={theme.colors.accentStrong} /> : null}
        {session.user ? (
          <Pressable disabled={session.authBusy} onPress={session.signOut} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>Выйти</Text>
          </Pressable>
        ) : (
          <Pressable disabled={session.authBusy} onPress={session.signInWithGoogle} style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}>
            <Text style={styles.googleMark}>G</Text>
            <Text style={styles.googleText}>Войти через Google</Text>
          </Pressable>
        )}

        <View style={styles.cardList}>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Язык интерфейса</Text><Text style={styles.infoValue}>{settings.interface_language_code.toUpperCase()}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Аланские слова</Text><Text style={styles.infoValue}>{dialect}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Версия</Text><Text style={styles.infoValue}>14.1.3</Text></View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  rootContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28, gap: 20 },
  muted: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18 },
  cardList: { borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  menuCard: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  menuCopy: { flex: 1, paddingVertical: 12 },
  menuCardTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  menuCardSubtitle: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 3 },
  chevron: { color: theme.colors.textSoft, fontSize: 27, lineHeight: 30 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(246,242,233,0.34)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(54,50,43,0.16)' },
  avatarText: { color: theme.colors.accentStrong, fontSize: 22, fontWeight: '700' },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { color: theme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  primaryButton: { minHeight: 42, borderRadius: theme.radius.sm, backgroundColor: theme.colors.accentStrong, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: theme.colors.inverse, fontSize: 14, fontWeight: '700' },
  googleButton: { minHeight: 46, borderRadius: theme.radius.sm, backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: theme.colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  googleMark: { color: '#4285f4', fontSize: 18, fontWeight: '800' },
  googleText: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  error: { color: theme.colors.danger, fontSize: 12 },
  infoRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft, gap: 12 },
  infoLabel: { flex: 1, color: theme.colors.text, fontSize: 13 },
  infoValue: { color: theme.colors.textMuted, fontSize: 12 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
