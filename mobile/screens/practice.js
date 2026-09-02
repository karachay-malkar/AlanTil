import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Header, Screen, SectionLabel } from '../ui/components.js';
import { FavoriteIcon, ListChecksIcon, MusicIcon, PuzzleIcon } from '../ui/icons.js';
import { ListRow, SurfaceCard } from '../ui/parity.js';
import { theme } from '../ui/theme.js';

const C = theme.colors;

export function PracticeScreen({ openTest, openMatch, openFavorites, openSongs }) {
  return <Screen bottomNav><Header title="" /><ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}><SectionLabel>ПРАКТИКА</SectionLabel><SurfaceCard flat style={styles.menu}>
    <ListRow title="Тест" subtitle="Проверка слов из выбранных разделов" leading={<ListChecksIcon size={23} color={C.text2} />} onPress={openTest} />
    <ListRow title="Сопоставление" subtitle="Соединение слов и переводов" leading={<PuzzleIcon size={23} color={C.text2} />} onPress={openMatch} />
    <ListRow title="Избранное" subtitle="Учить отмеченные слова" leading={<FavoriteIcon size={23} color={C.favorite} filled />} onPress={openFavorites} />
    <ListRow title="Песни" subtitle="Язык в живом контексте" leading={<MusicIcon size={23} color={C.text2} />} onPress={openSongs} />
  </SurfaceCard></ScrollView></Screen>;
}

const styles = StyleSheet.create({
  scroll: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingTop: theme.control.header + 10, paddingHorizontal: 16, paddingBottom: theme.control.nav + 28, gap: 8 },
  menu: { overflow: 'hidden', borderTopWidth: 1, borderTopColor: C.lineSoft },
});
