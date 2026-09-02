import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Header, Screen, SectionLabel } from '../ui/components.js';
import { FavoriteIcon, ListChecksIcon, MusicIcon, PuzzleIcon } from '../ui/icons.js';
import { theme } from '../ui/theme.js';

const C = theme.colors;

function PracticeItem({ title, subtitle, icon, onPress, favorite = false }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}><View style={styles.icon}>{icon}</View><View style={styles.copy}><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View></Pressable>;
}

export function PracticeScreen({ openTest, openMatch, openFavorites, openSongs }) {
  return <Screen bottomNav><Header title="" /><ScrollView contentContainerStyle={styles.scroll}><SectionLabel>ПРАКТИКА</SectionLabel><View style={styles.menu}><PracticeItem title="Тест" subtitle="Проверка слов из выбранных разделов" icon={<ListChecksIcon size={23} color={C.text2} />} onPress={openTest} /><PracticeItem title="Сопоставление" subtitle="Соединение слов и переводов" icon={<PuzzleIcon size={23} color={C.text2} />} onPress={openMatch} /><PracticeItem title="Избранное" subtitle="Учить слова" icon={<FavoriteIcon size={23} color={C.favorite} filled />} onPress={openFavorites} /><PracticeItem title="Песни" subtitle="Язык в живом контексте" icon={<MusicIcon size={23} color={C.text2} />} onPress={openSongs} /></View></ScrollView></Screen>;
}

const styles = StyleSheet.create({
  scroll: { paddingTop: theme.control.header + 10, paddingHorizontal: 12, paddingBottom: theme.control.nav + 24 },
  menu: { width: '100%' },
  item: { width: '100%', minHeight: 68, paddingVertical: 10, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: C.lineSoft, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemPressed: { opacity: .68, transform: [{ translateY: 1 }] },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '800', lineHeight: 18, color: C.text1 },
  subtitle: { marginTop: 2, fontSize: 11, lineHeight: 14.3, color: C.text2 },
});
