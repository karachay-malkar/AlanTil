import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { theme } from '@/src/mobile/theme';
import { useSession } from '@/src/mobile/session';
import { useSettings } from '@/src/mobile/settings';
import { PracticeHeader, PracticeScreen, PrimaryButton, commonStyles } from '@/src/mobile/practice/common';
import { favoriteWords, setFavorite } from '@/src/mobile/practice/repository';
import { shuffle, type PracticeWord } from '@/src/mobile/practice/selection';

let studyPool: PracticeWord[] = [];

export function FavoritesScreen() {
  const auth = useSession();
  const { settings } = useSettings();
  const [words, setWords] = useState<PracticeWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState('');

  const reload = () => {
    setLoading(true);
    favoriteWords(settings, auth.user?.id).then(setWords).catch((reason) => {
      setError(String((reason as { message?: string })?.message ?? reason));
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [auth.user?.id, settings.interface_language_code, settings.translation_language_code, settings.alan_script_code, settings.alan_dialect_code]);

  const remove = async (wordId: string) => {
    if (busyId) return;
    setBusyId(wordId);
    try {
      await setFavorite(auth.user?.id, wordId, false);
      setWords((current) => current.filter((word) => word.id !== wordId));
    } catch (reason) {
      setError(String((reason as { message?: string })?.message ?? reason));
    } finally {
      setBusyId('');
    }
  };

  const study = () => {
    studyPool = shuffle(words.slice());
    router.push('/practice/favorites/study');
  };

  return (
    <PracticeScreen header={<PracticeHeader title="Избранное" />} footer={words.length ? <PrimaryButton title="Учить слова" onPress={study} /> : undefined}>
      {loading ? <ActivityIndicator color={theme.colors.accentStrong} style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !words.length ? (
        <View style={commonStyles.empty}>
          <Text style={commonStyles.emptyTitle}>В избранном пока нет слов</Text>
          <Text style={commonStyles.emptyText}>Добавляйте слова звёздочкой в результатах тестов. Они появятся здесь и синхронизируются с аккаунтом.</Text>
        </View>
      ) : null}
      <View style={styles.list}>
        {words.map((word) => (
          <View key={word.id} style={styles.row}>
            <View style={styles.order}><Text style={styles.orderText}>{word.source.global_order ?? ''}</Text></View>
            <View style={styles.copy}>
              <Text numberOfLines={1} style={styles.word}>{word.word}</Text>
              <Text numberOfLines={2} style={styles.trans}>{word.trans}</Text>
            </View>
            <Pressable disabled={busyId === word.id} onPress={() => { void remove(word.id); }} style={styles.starButton}>
              <Text style={styles.star}>★</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </PracticeScreen>
  );
}

export function FavoritesStudyScreen() {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const words = useMemo(() => studyPool.slice(), []);
  const current = words[index];

  useEffect(() => {
    if (!words.length) router.replace('/practice/favorites');
  }, [words.length]);

  if (!current) return <View style={styles.fullLoader}><ActivityIndicator color={theme.colors.accentStrong} /></View>;

  const next = () => {
    if (index >= words.length - 1) {
      router.replace('/practice/favorites');
      return;
    }
    setIndex((value) => value + 1);
    setRevealed(false);
  };

  return (
    <View style={styles.studyScreen}>
      <PracticeHeader title="Избранное" subtitle={`${index + 1}/${words.length}`} />
      <View style={styles.studyBody}>
        <Text style={styles.studyWord}>{current.word}</Text>
        {revealed ? <Text style={styles.studyTranslation}>{current.trans}</Text> : <Text style={styles.studyHint}>Нажмите, чтобы показать перевод</Text>}
        <Pressable onPress={() => setRevealed(true)} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.studyFooter}>
        {revealed ? <PrimaryButton title={index >= words.length - 1 ? 'Завершить' : 'Следующее слово'} onPress={next} /> : <PrimaryButton title="Показать перевод" onPress={() => setRevealed(true)} />}
      </View>
    </View>
  );
}

export function SongsBridgeScreen() {
  return (
    <PracticeScreen header={<PracticeHeader title="Песни" />}>
      <View style={commonStyles.empty}>
        <Text style={commonStyles.emptyTitle}>Песни</Text>
        <Text style={commonStyles.emptyText}>Плейлисты, тексты, проигрыватель и избранное песен переносятся отдельным модулем, чтобы не смешивать их с тестами и прогрессом слов.</Text>
      </View>
    </PracticeScreen>
  );
}

const styles = StyleSheet.create({
  loader: { paddingVertical: 40 },
  error: { color: theme.colors.danger, fontSize: 12, lineHeight: 17, paddingVertical: 8 },
  list: { borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft, paddingVertical: 8 },
  order: { width: 38 },
  orderText: { color: theme.colors.textSoft, fontSize: 9, fontWeight: '700' },
  copy: { flex: 1, minWidth: 0 },
  word: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  trans: { marginTop: 2, color: theme.colors.textMuted, fontSize: 11, lineHeight: 15 },
  starButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  star: { color: theme.colors.accentStrong, fontSize: 21 },
  fullLoader: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  studyScreen: { flex: 1, backgroundColor: theme.colors.background },
  studyBody: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  studyWord: { color: theme.colors.text, fontSize: 34, lineHeight: 42, fontWeight: '900', textAlign: 'center' },
  studyTranslation: { marginTop: 24, color: theme.colors.textMuted, fontSize: 20, lineHeight: 27, fontWeight: '600', textAlign: 'center' },
  studyHint: { marginTop: 24, color: theme.colors.textSoft, fontSize: 11, fontWeight: '600' },
  studyFooter: { paddingHorizontal: 16, paddingBottom: 14 },
});
