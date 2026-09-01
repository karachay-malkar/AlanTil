import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { useI18n } from '@/src/mobile/i18n';
import { OverflowMarquee } from '@/src/mobile/overflow-marquee';
import { PracticeHeader, PracticeScreen, PrimaryButton, commonStyles } from '@/src/mobile/practice/common';
import { favoriteWords, setFavorite } from '@/src/mobile/practice/repository';
import { type PracticeWord } from '@/src/mobile/practice/selection';
import { useSession } from '@/src/mobile/session';
import { useSettings } from '@/src/mobile/settings';
import { scopedTestId, testIds } from '@/src/mobile/test-ids';
import { AppText as Text } from '@/src/mobile/typography';
import {
  loadStationDirection,
  loadStationSelection,
  saveStationDirection,
  saveStationSelection,
  type LearningDirection,
} from '@/src/mobile/station-preferences';
import { theme } from '@/src/mobile/theme';

const FAVORITES_CONTEXT = { dictionaryId: 'favorites', sectionId: 'favorites', setId: 'favorites' } as const;

export function FavoritesScreen() {
  const auth = useSession();
  const { settings } = useSettings();
  const { t } = useI18n();
  const [words, setWords] = useState<PracticeWord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [direction, setDirection] = useState<LearningDirection>('alan_ru');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const userId = auth.user?.id;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void Promise.all([favoriteWords(settings, userId), loadStationDirection(userId)]).then(async ([rows, savedDirection]) => {
      const savedSelection = await loadStationSelection(
        rows.map((word) => word.id),
        FAVORITES_CONTEXT.dictionaryId,
        FAVORITES_CONTEXT.sectionId,
        FAVORITES_CONTEXT.setId,
        userId,
      );
      if (!active) return;
      setWords(rows);
      setSelected(savedSelection);
      setDirection(savedDirection);
    }).catch(() => {
      if (active) setError(t('favorites.load_error'));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [
    reloadKey,
    settings.alan_dialect_code,
    settings.alan_script_code,
    settings.interface_language_code,
    settings.translation_language_code,
    t,
    userId,
  ]);

  const commitSelection = (next: Set<string>) => {
    setSelected(next);
    void saveStationSelection(
      next,
      words.map((word) => word.id),
      FAVORITES_CONTEXT.dictionaryId,
      FAVORITES_CONTEXT.sectionId,
      FAVORITES_CONTEXT.setId,
      userId,
    ).catch(() => setError(t('favorites.selection_error')));
  };

  const toggleSelection = (wordId: string) => {
    const next = new Set(selected);
    if (next.has(wordId)) next.delete(wordId); else next.add(wordId);
    commitSelection(next);
  };

  const chooseDirection = (next: LearningDirection) => {
    if (next === direction) return;
    setDirection(next);
    void saveStationDirection(next, userId).catch(() => setError(t('favorites.direction_error')));
  };

  const remove = async (wordId: string) => {
    if (busyId) return;
    setBusyId(wordId);
    setError('');
    try {
      await setFavorite(userId, wordId, false);
      setWords((current) => current.filter((word) => word.id !== wordId));
      setSelected((current) => {
        const next = new Set(current);
        next.delete(wordId);
        return next;
      });
    } catch {
      setError(t('favorites.remove_error'));
    } finally {
      setBusyId('');
    }
  };

  const study = () => {
    if (!selected.size) return;
    router.push({
      pathname: '/path/learn',
      params: {
        source: 'favorites',
        direction,
        selectedIds: Array.from(selected).join(','),
      },
    });
  };

  const footer = words.length ? <View style={styles.footerStack}>
    <Text style={styles.directionLabel}>{t('favorites.direction')}</Text>
    <View accessibilityRole="radiogroup" style={styles.directionSegments}>
      <Pressable accessibilityRole="radio" accessibilityState={{ checked: direction === 'alan_ru' }} testID="favorites.direction.alan-translation" onPress={() => chooseDirection('alan_ru')} style={({ pressed }) => [styles.directionOption, direction === 'alan_ru' && styles.directionOptionActive, pressed && styles.pressed]}>
        <Text style={[styles.directionText, direction === 'alan_ru' && styles.directionTextActive]}>{t('favorites.alan_translation')}</Text>
      </Pressable>
      <Pressable accessibilityRole="radio" accessibilityState={{ checked: direction === 'ru_alan' }} testID="favorites.direction.translation-alan" onPress={() => chooseDirection('ru_alan')} style={({ pressed }) => [styles.directionOption, direction === 'ru_alan' && styles.directionOptionActive, pressed && styles.pressed]}>
        <Text style={[styles.directionText, direction === 'ru_alan' && styles.directionTextActive]}>{t('favorites.translation_alan')}</Text>
      </Pressable>
    </View>
    <PrimaryButton testID={testIds.favorites.study} title={t('favorites.study').toUpperCase()} disabled={!selected.size} onPress={study} />
  </View> : undefined;

  return <PracticeScreen testID={testIds.favorites.screen} header={<PracticeHeader title={t('practice.favorites.title')} />} footer={footer}>
    {loading ? <ActivityIndicator color={theme.colors.accentStrong} style={styles.loader} /> : null}
    {error ? <View style={styles.errorRow}>
      <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={() => setReloadKey((value) => value + 1)} style={styles.retry}><Text style={styles.retryText}>{t('common.retry')}</Text></Pressable>
    </View> : null}
    {!loading && !words.length ? <View style={commonStyles.empty}>
      <Text style={commonStyles.emptyTitle}>{t('favorites.empty')}</Text>
      <Text style={commonStyles.emptyText}>{t('favorites.empty_body')}</Text>
    </View> : null}
    {words.length ? <>
      <View style={styles.toolbar}>
        <View style={styles.toolbarActions}>
          <Pressable accessibilityRole="button" testID={testIds.favorites.showAll} onPress={() => commitSelection(new Set(words.map((word) => word.id)))} style={({ pressed }) => [styles.toolbarButton, pressed && styles.pressed]}><Text style={styles.toolbarAction}>{t('favorites.show_all')}</Text></Pressable>
          <Text style={styles.toolbarDivider}>·</Text>
          <Pressable accessibilityRole="button" testID={testIds.favorites.hideAll} onPress={() => commitSelection(new Set())} style={({ pressed }) => [styles.toolbarButton, pressed && styles.pressed]}><Text style={styles.toolbarAction}>{t('favorites.hide_all')}</Text></Pressable>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.count}>{selected.size}/{words.length}</Text>
      </View>
      <View style={styles.list}>
        {words.map((word) => {
          const checked = selected.has(word.id);
          return <View key={word.id} style={styles.row}>
            <Pressable
              accessibilityLabel={t('favorites.include_word', { word: word.word })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              testID={scopedTestId('favorites.word', word.id)}
              onPress={() => toggleSelection(word.id)}
              style={styles.rowSelection}
            >
              <View style={[styles.checkbox, checked && styles.checkboxActive]}>{checked ? <Text style={styles.check}>✓</Text> : null}</View>
              <View style={styles.copy}>
                <OverflowMarquee style={styles.word}>{word.word}</OverflowMarquee>
                <OverflowMarquee style={styles.translation}>{word.trans}</OverflowMarquee>
              </View>
            </Pressable>
            <Pressable
              accessibilityLabel={t('favorites.remove_word', { word: word.word })}
              accessibilityRole="button"
              accessibilityState={{ disabled: busyId === word.id, selected: true }}
              testID={scopedTestId('favorites.remove', word.id)}
              disabled={busyId === word.id}
              onPress={() => { void remove(word.id); }}
              style={({ pressed }) => [styles.starButton, busyId === word.id && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={styles.star}>★</Text>
            </Pressable>
          </View>;
        })}
      </View>
    </> : null}
  </PracticeScreen>;
}

const styles = StyleSheet.create({
  loader: { paddingVertical: 40 },
  errorRow: { paddingVertical: 8, alignItems: 'center' },
  error: { color: theme.colors.danger, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  retry: { minHeight: 44, marginTop: 3, paddingHorizontal: 12, justifyContent: 'center' },
  retryText: { color: theme.colors.accentStrong, fontSize: 10, fontWeight: '900' },
  toolbar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  toolbarActions: { flexDirection: 'row', alignItems: 'center' },
  toolbarButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 3 },
  toolbarAction: { color: theme.colors.accentStrong, fontSize: 10, lineHeight: 14, fontWeight: '900' },
  toolbarDivider: { color: theme.colors.textSoft, paddingHorizontal: 3 },
  count: { color: theme.colors.textMuted, fontSize: 10, lineHeight: 14, fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
  list: { borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  rowSelection: { flex: 1, minWidth: 0, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.line, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { borderColor: theme.colors.accentStrong, backgroundColor: 'rgba(139,107,59,0.10)' },
  check: { color: theme.colors.accentStrong, fontSize: 13, lineHeight: 16, fontWeight: '900' },
  copy: { flex: 1, minWidth: 0, paddingVertical: 8 },
  word: { color: theme.colors.text, fontSize: 14, lineHeight: 18, fontWeight: '900' },
  translation: { marginTop: 2, color: theme.colors.textMuted, fontSize: 11, lineHeight: 15 },
  starButton: { width: 44, height: 58, alignItems: 'center', justifyContent: 'center' },
  star: { color: theme.colors.accentStrong, fontSize: 22, lineHeight: 25 },
  footerStack: { gap: 6 },
  directionLabel: { color: theme.colors.textSoft, fontSize: 9, lineHeight: 12, fontWeight: '900' },
  directionSegments: { minHeight: 50, flexDirection: 'row', padding: 2, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.lineSoft, backgroundColor: theme.colors.surface2 },
  directionOption: { flex: 1, minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  directionOptionActive: { backgroundColor: theme.colors.text },
  directionText: { color: theme.colors.textMuted, fontSize: 9, lineHeight: 12, fontWeight: '800', textAlign: 'center' },
  directionTextActive: { color: theme.colors.inverse },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
