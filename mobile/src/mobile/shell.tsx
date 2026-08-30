import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '@/src/mobile/chrome';
import { theme } from '@/src/mobile/theme';

export function PracticeRoot() {
  const items = [
    ['Тест', 'Проверка слов из выбранных разделов', '/practice/test'],
    ['Сопоставление', 'Соединение слов и переводов', '/practice/match'],
    ['Избранное', 'Учить слова', '/practice/favorites'],
    ['Песни', 'Язык в живом контексте', '/practice/songs'],
  ] as const;
  return (
    <View style={styles.screen}>
      <ScreenHeader title="Практика" />
      <ScrollView contentContainerStyle={styles.rootContent} showsVerticalScrollIndicator={false}>
        <View style={styles.cardList}>
          {items.map(([title, subtitle, href]) => (
            <Pressable key={title} onPress={() => router.push(href)} style={({ pressed }) => [styles.menuCard, pressed && styles.pressed]}>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  rootContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28 },
  cardList: { borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  menuCard: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  menuCopy: { flex: 1, paddingVertical: 12 },
  menuCardTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  menuCardSubtitle: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 3 },
  chevron: { color: theme.colors.textSoft, fontSize: 27, lineHeight: 30 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
