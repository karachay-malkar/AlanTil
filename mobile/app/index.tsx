import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadStarterWords, MobileWord } from '@/src/mobile/dictionary';
import { useSession } from '@/src/mobile/session';

export default function HomeScreen() {
  const session = useSession();
  const [words, setWords] = useState<MobileWord[]>([]);
  const [loadingWords, setLoadingWords] = useState(true);
  const [wordError, setWordError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadStarterWords(30)
      .then((data) => {
        if (!active) return;
        setWords(data);
        setWordError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setWordError(String((error as { message?: string })?.message ?? error));
      })
      .finally(() => {
        if (active) setLoadingWords(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.version}>14.1 mobile foundation</Text>
        <Text style={styles.title}>Путь</Text>
        <Text style={styles.subtitle}>
          {session.ready
            ? session.user
              ? `Сессия: ${session.user.email ?? session.user.id}`
              : 'Гостевой режим'
            : 'Проверка сессии…'}
        </Text>
        {session.error ? <Text style={styles.error}>{session.error}</Text> : null}
      </View>

      {loadingWords ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.muted}>Загрузка слов из Supabase…</Text>
        </View>
      ) : wordError ? (
        <View style={styles.center}>
          <Text style={styles.error}>Не удалось загрузить слова: {wordError}</Text>
        </View>
      ) : (
        <FlatList
          data={words}
          keyExtractor={(item) => item.word_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.order}>{item.global_order ?? '—'}</Text>
              <View style={styles.wordBody}>
                <Text style={styles.word}>{item.word_alan_cyrillic || '—'}</Text>
                <Text style={styles.translation}>{item.translation_ru || '—'}</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#081223' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
  version: { color: '#8291ab', fontSize: 12, marginBottom: 8 },
  title: { color: '#ffffff', fontSize: 34, fontWeight: '800' },
  subtitle: { color: '#b8c3d6', fontSize: 14, marginTop: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 30 },
  card: {
    minHeight: 68,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: '#101f38',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  order: { color: '#73829c', width: 44, fontSize: 13 },
  wordBody: { flex: 1 },
  word: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  translation: { color: '#aebbd0', fontSize: 15, marginTop: 3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  muted: { color: '#aebbd0', textAlign: 'center' },
  error: { color: '#ffb4ab', fontSize: 13, marginTop: 8 },
});
