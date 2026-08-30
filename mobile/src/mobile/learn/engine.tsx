import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { displayedAlanWord, displayedTranslation, loadAllWords, type MobileWord } from '@/src/mobile/dictionary';
import { createActivitySession, completeActivitySession, persistActivitySession, resumeActivitySession, type ActivityRuntime } from '@/src/mobile/activity-session';
import { favoriteWords } from '@/src/mobile/practice/repository';
import { markSetCompleted, markSetStarted } from '@/src/mobile/progress/repository';
import { markStationCardsCompleted, markStationStarted, type StationDescriptor } from '@/src/mobile/progress/station';
import { recordGuestLearn } from '@/src/mobile/progress/guest';
import { useSession } from '@/src/mobile/session';
import { useSettings } from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';

type LearnWord = { id: string; word: string; trans: string; source: MobileWord };
type LearnEntry = { word_id: string; show_count: number; left_swipe_count: number; final_result: 'known' | 'unfinished'; first_position: number };
type LearnState = { source: 'station' | 'favorites'; ids: string[]; index: number; repeatIds: string[]; entries: Record<string, LearnEntry>; direction: 'alan_ru' | 'ru_alan' };

function shuffled<T>(items: T[]) {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function stationFrom(params: Record<string, string | string[] | undefined>): StationDescriptor | null {
  const value = (key: string) => String(params[key] ?? '').trim();
  const station = { storyId: value('storyId'), dictionaryId: value('dictionaryId'), sectionId: value('sectionId'), setId: value('setId') };
  return Object.values(station).every(Boolean) ? station : null;
}

function entryFor(state: LearnState, id: string) {
  return state.entries[id] ?? { word_id: id, show_count: 0, left_swipe_count: 0, final_result: 'unfinished' as const, first_position: Object.keys(state.entries).length + 1 };
}

export default function LearnSessionScreen() {
  const params = useLocalSearchParams<{ source?: string; storyId?: string; dictionaryId?: string; sectionId?: string; setId?: string; direction?: string }>();
  const auth = useSession();
  const { settings } = useSettings();
  const source = String(params.source ?? 'station') === 'favorites' ? 'favorites' : 'station';
  const station = stationFrom(params);
  const [runtime, setRuntime] = useState<ActivityRuntime | null>(null);
  const [pool, setPool] = useState<LearnWord[]>([]);
  const [state, setState] = useState<LearnState | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        let words: LearnWord[];
        if (source === 'favorites') {
          const favoritePool = await favoriteWords(settings, auth.user?.id);
          words = favoritePool.map((word) => ({ id: word.id, word: word.word, trans: word.trans, source: word.source }));
        } else {
          const all = await loadAllWords();
          if (!station) throw new Error('Этап не найден.');
          words = all.filter((word) => String(word.dictionary_id) === station.dictionaryId && String(word.section_id) === station.sectionId && String(word.set_id) === station.setId)
            .map((word) => ({ id: word.word_id, word: displayedAlanWord(word, settings), trans: displayedTranslation(word, settings), source: word }))
            .filter((word) => word.id && word.word && word.trans);
        }
        if (!words.length) throw new Error('Нет слов для обучения.');
        const resumed = await resumeActivitySession<LearnState>('learn', auth.user?.id);
        const ids = new Set(words.map((word) => word.id));
        const canResume = resumed?.payload?.source === source && Array.isArray(resumed.payload.ids) && resumed.payload.ids.every((id) => ids.has(id));
        const nextRuntime = canResume && resumed ? resumed.runtime : await createActivitySession('learn', settings, auth.user?.id);
        const nextState: LearnState = canResume && resumed ? resumed.payload : {
          source,
          ids: shuffled(words.map((word) => word.id)),
          index: 0,
          repeatIds: [],
          entries: {},
          direction: String(params.direction ?? 'alan_ru') === 'ru_alan' ? 'ru_alan' : 'alan_ru',
        };
        if (station && source === 'station' && !canResume) {
          await Promise.all([markSetStarted(auth.user?.id, station.dictionaryId, station.sectionId, station.setId), markStationStarted(station, auth.user?.id)]);
        }
        if (!active) return;
        setPool(words); setRuntime(nextRuntime); setState(nextState); setBusy(false);
      } catch (reason) {
        if (active) { setError(String((reason as { message?: string })?.message ?? reason)); setBusy(false); }
      }
    }
    void boot();
    return () => { active = false; };
  }, [auth.user?.id, settings.interface_language_code, settings.translation_language_code, settings.alan_script_code, settings.alan_dialect_code]);

  const byId = useMemo(() => new Map(pool.map((word) => [word.id, word])), [pool]);
  const queue = state ? [...state.ids.slice(state.index), ...state.repeatIds] : [];
  const currentId = queue[0];
  const current = currentId ? byId.get(currentId) : null;

  useEffect(() => {
    if (!state || !runtime || !currentId) return;
    const entry = entryFor(state, currentId);
    if (entry.show_count > 0) return;
    const next = { ...state, entries: { ...state.entries, [currentId]: { ...entry, show_count: 1 } } };
    setState(next);
    void persistActivitySession(runtime, next);
  }, [runtime?.id, currentId]);

  async function finish(nextState: LearnState) {
    if (!runtime) return;
    setBusy(true);
    const entries = Object.values(nextState.entries);
    const known = entries.filter((entry) => entry.final_result === 'known').length;
    const payload = {
      dictionary_id: station?.dictionaryId ?? 'favorites', section_id: station?.sectionId ?? 'favorites', set_id: station?.setId ?? 'favorites',
      direction: nextState.direction, words_planned: nextState.ids.length, unique_words_shown: entries.length,
      card_shows_total: entries.reduce((sum, entry) => sum + entry.show_count, 0), left_swipes_total: entries.reduce((sum, entry) => sum + entry.left_swipe_count, 0),
      known_words_total: known, unfinished_words_total: entries.length - known, words: entries,
    };
    const final = await completeActivitySession(runtime, payload);
    if (!auth.user?.id) await recordGuestLearn(entries, String(final.ended_at));
    if (station && source === 'station') {
      await Promise.all([markSetCompleted(auth.user?.id, station.dictionaryId, station.sectionId, station.setId), markStationCardsCompleted(station, auth.user?.id)]);
    }
    router.replace(source === 'favorites' ? '/practice/favorites' : { pathname: '/path/station', params: { key: [station!.storyId, station!.dictionaryId, station!.sectionId, station!.setId].join('::') } });
  }

  function decide(known: boolean) {
    if (!state || !runtime || !currentId) return;
    const fromMain = state.index < state.ids.length;
    const entry = entryFor(state, currentId);
    const nextEntry: LearnEntry = {
      ...entry,
      show_count: Math.max(1, entry.show_count),
      left_swipe_count: entry.left_swipe_count + (known ? 0 : 1),
      final_result: known ? 'known' : 'unfinished',
    };
    let next: LearnState;
    if (fromMain) {
      next = { ...state, index: state.index + 1, repeatIds: known ? state.repeatIds : [...state.repeatIds, currentId], entries: { ...state.entries, [currentId]: nextEntry } };
    } else {
      const remaining = state.repeatIds.slice(1);
      next = { ...state, repeatIds: known ? remaining : [...remaining, currentId], entries: { ...state.entries, [currentId]: nextEntry } };
    }
    setRevealed(false);
    setState(next);
    void persistActivitySession(runtime, next);
    if (next.index >= next.ids.length && next.repeatIds.length === 0) void finish(next);
  }

  if (busy) return <View style={styles.center}><ActivityIndicator color={theme.colors.accentStrong} /></View>;
  if (error || !state || !runtime || !current) return <View style={styles.center}><Text style={styles.error}>{error || 'Сессия завершена.'}</Text></View>;
  const front = state.direction === 'ru_alan' ? current.trans : current.word;
  const back = state.direction === 'ru_alan' ? current.word : current.trans;
  const completed = Math.min(state.ids.length, state.index);

  return <View style={styles.screen}>
    <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.title}>{source === 'favorites' ? 'Избранное' : 'Учить слова'}</Text><Text style={styles.counter}>{completed}/{state.ids.length}</Text></View>
    <Pressable style={styles.card} onPress={() => setRevealed((value) => !value)}>
      <Text style={styles.word}>{front}</Text>
      {revealed ? <Text style={styles.trans}>{back}</Text> : <Text style={styles.hint}>Нажмите, чтобы показать перевод</Text>}
    </Pressable>
    <View style={styles.actions}>
      <Pressable onPress={() => decide(false)} style={styles.secondary}><Text style={styles.secondaryText}>НЕ ЗНАЮ</Text></Pressable>
      <Pressable onPress={() => decide(true)} style={styles.primary}><Text style={styles.primaryText}>ЗНАЮ</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background, padding: 24 },
  error: { color: theme.colors.danger, textAlign: 'center' },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 32, color: theme.colors.textMuted }, title: { fontSize: 16, fontWeight: '800', color: theme.colors.text }, counter: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted },
  card: { flex: 1, marginVertical: 18, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 24 },
  word: { fontSize: 32, lineHeight: 40, fontWeight: '900', color: theme.colors.text, textAlign: 'center' },
  trans: { marginTop: 24, fontSize: 19, lineHeight: 27, fontWeight: '600', color: theme.colors.textMuted, textAlign: 'center' },
  hint: { marginTop: 24, fontSize: 11, color: theme.colors.textSoft },
  actions: { flexDirection: 'row', gap: 10, paddingBottom: 8 },
  secondary: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primary: { flex: 1, minHeight: 48, backgroundColor: theme.colors.accentStrong, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: theme.colors.text, fontWeight: '800', fontSize: 11 }, primaryText: { color: theme.colors.inverse, fontWeight: '800', fontSize: 11 },
});
