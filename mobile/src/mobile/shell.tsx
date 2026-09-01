import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/src/mobile/chrome';
import { AlanIcon, type AlanIconName } from '@/src/mobile/icons';
import { useI18n } from '@/src/mobile/i18n';
import { theme } from '@/src/mobile/theme';
import { testIds } from '@/src/mobile/test-ids';
import { AppText as Text } from '@/src/mobile/typography';

export function PracticeRoot() {
  const { t } = useI18n();
  const items: readonly [AlanIconName, string, string, '/practice/test' | '/practice/match' | '/practice/favorites' | '/practice/songs'][] = [
    ['test', t('practice.test.title'), t('practice.test.subtitle'), '/practice/test'],
    ['match', t('practice.match.title'), t('practice.match.subtitle'), '/practice/match'],
    ['favorite', t('practice.favorites.title'), t('practice.favorites.subtitle'), '/practice/favorites'],
    ['songs', t('practice.songs.title'), t('practice.songs.subtitle'), '/practice/songs'],
  ] as const;
  return (
    <View testID={testIds.practice.screen} style={styles.screen}>
      <ScreenHeader title={t('tabs.practice')} />
      <ScrollView contentContainerStyle={styles.rootContent} showsVerticalScrollIndicator={false}>
        <View style={styles.cardList}>
          {items.map(([icon, title, subtitle, href]) => (
            <Pressable
              key={title}
              accessibilityRole="button"
              accessibilityLabel={title}
              testID={icon === 'test' ? testIds.practice.test : icon === 'match' ? testIds.practice.match : icon === 'favorite' ? testIds.practice.favorites : testIds.practice.songs}
              onPress={() => router.push(href)}
              style={({ pressed }) => [styles.menuCard, pressed && styles.pressed]}
            >
              <View style={styles.menuIcon}><AlanIcon color={theme.colors.accentStrong} name={icon} size={22} /></View>
              <View style={styles.menuCopy}>
                <Text style={styles.menuCardTitle}>{title}</Text>
                <Text style={styles.menuCardSubtitle}>{subtitle}</Text>
              </View>
              <AlanIcon color={theme.colors.textSoft} name="chevron" size={18} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  rootContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28 },
  cardList: { borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  menuCard: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  menuIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139,107,59,0.09)', borderWidth: 1, borderColor: 'rgba(101,73,31,0.12)' },
  menuCopy: { flex: 1, paddingVertical: 12 },
  menuCardTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  menuCardSubtitle: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 3 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
