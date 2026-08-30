import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { loadAllWords } from '@/src/mobile/dictionary';
import { createActivitySession, completeActivitySession, persistActivitySession, resumeActivitySession, type ActivityRuntime } from '@/src/mobile/activity-session';
import { hasWordConflict, shuffle, toPracticeWord, type PracticeWord } from '@/src/mobile/practice/selection';
import { recordGuestStationTest } from '@/src/mobile/progress/guest';
import { recordStationTest, REQUIRED_ACCURACY, stationTestPhase, type StationDescriptor } from '@/src/mobile/progress/station';
import { useSession } from '@/src/mobile/session';
import { useSettings } from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';

type Answer = { word_id: string; result: 'correct' | 'wrong'; wrong_word_id: string | null };
type State = { ids: string[]; index: number; answers: Answer[]; direction: 'alan_ru' | 'ru_alan'; phase: string };

function stationFrom(params: Record<string, string | string[] | undefined>): StationDescriptor | null {
  const v = (key: string) => String(params[key] ?? '').trim();
  const station = { storyId: v('storyId'), dictionaryId: v('dictionaryId'), sectionId: v('sectionId'), setId: v('setId') };
  return Object.values(station).every(Boolean) ? station : null;
}

function optionsFor(item: PracticeWord, all: PracticeWord[]) {
  const candidates = shuffle(all.filter((candidate) => candidate.id !== item.id && candidate.pos === item.pos));
  const selected: PracticeWord[] = [];
  for (const candidate of candidates) {
    if (selected.length >= 3) break;
    if (hasWordConflict(candidate, [item, ...selected])) continue;
    selected.push(candidate);
  }
  return shuffle([item, ...selected]);
}

export default function StationTestScreen() {
  const params = useLocalSearchParams<{ source?: string; storyId?: string; dictionaryId?: string; sectionId?: string; setId?: string; direction?: string }>();
  const station = stationFrom(params);
  const auth = useSession();
  const { settings } = useSettings();
  const [runtime, setRuntime] = useState<ActivityRuntime | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [all, setAll] = useState<PracticeWord[]>([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        if (!station) throw new Error('Этап не найден.');
        const raw = await loadAllWords();
        const words = raw.map((word) => toPracticeWord(word, settings)).filter((word): word is PracticeWord => Boolean(word));
        const pool = words.filter((word) => word.dictionary_id === station.dictionaryId && word.section_id === station.sectionId && word.set_id === station.setId);
        if (!pool.length) throw new Error('Нет слов для теста.');
        const phase = await stationTestPhase(station, auth.user?.id);
        const resumed = await resumeActivitySession<State>('station_test', auth.user?.id);
        const validIds = new Set(pool.map((word) => word.id));
        const canResume = Boolean(resumed?.payload?.ids?.length && resumed.payload.ids.every((id) => validIds.has(id)));
        const runtimeNext = canResume && resumed ? resumed.runtime : await createActivitySession('station_test', settings, auth.user?.id);
        const stateNext: State = canResume && resumed ? resumed.payload : {
          ids: shuffle(pool.map((word) => word.id)), index: 0, answers: [], direction: String(params.direction ?? 'alan_ru') === 'ru_alan' ? 'ru_alan' : 'alan_ru', phase,
        };
        if (!active) return;
        setAll(words); setRuntime(runtimeNext); setState(stateNext); setBusy(false);
      } catch (reason) {
        if (active) { setError(String((reason as { message?: string })?.message ?? reason)); setBusy(false); }
      }
    }
    void boot();
    return () => { active = false; };
  }, [auth.user?.id, settings.interface_language_code, settings.translation_language_code, settings.alan_script_code, settings.alan_dialect_code]);

  const map = useMemo(() => new Map(all.map((word) => [word.id, word])), [all]);
  const item = state ? map.get(state.ids[state.index]) : null;
  const options = useMemo(() => item ? optionsFor(item, all) : [], [item?.id, all]);

  async function submit() {
    if (!state || !runtime || !station || !item || !selected) return;
    const correct = selected === item.id;
    const answer: Answer = { word_id: item.id, result: correct ? 'correct' : 'wrong', wrong_word_id: correct ? null : selected };
    const next = { ...state, index: state.index + 1, answers: [...state.answers, answer] };
    setSelected(''); setState(next);
    await persistActivitySession(runtime, next);
    if (next.index < next.ids.length) return;
    setBusy(true);
    const correctTotal = next.answers.filter((entry) => entry.result === 'correct').length;
    const accuracy = next.answers.length ? Math.round((correctTotal / next.answers.length) * 100) : 0;
    const payload = {
      dictionary_id: station.dictionaryId, catalog_id: station.dictionaryId, group_id: station.sectionId, section_id: station.sectionId, set_id: station.setId,
      story_type: station.storyId, phase: next.phase, questions_total: next.answers.length, correct_total: correctTotal, wrong_total: next.answers.length - correctTotal,
      accuracy, required_accuracy: REQUIRED_ACCURACY, words: next.answers,
    };
    const final = await completeActivitySession(runtime, payload);
    const passed = accuracy >= REQUIRED_ACCURACY;
    if (!auth.user?.id) await recordGuestStationTest(next.answers, passed, String(final.ended_at));
    await recordStationTest(station, auth.user?.id, accuracy, passed, next.phase, String(final.ended_at));
    router.replace({ pathname: '/path/station', params: { key: [station.storyId, station.dictionaryId, station.sectionId, station.setId].join('::') } });
  }

  if (busy) return <View style={styles.center}><ActivityIndicator color={theme.colors.accentStrong} /></View>;
  if (error || !state || !runtime || !item) return <View style={styles.center}><Text style={styles.error}>{error || 'Тест завершён.'}</Text></View>;
  const question = state.direction === 'ru_alan' ? item.trans : item.word;
  return <View style={styles.screen}>
    <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.title}>Проверка знаний</Text><Text style={styles.counter}>{state.index + 1}/{state.ids.length}</Text></View>
    <View style={styles.body}><Text style={styles.question}>{question}</Text><View style={styles.options}>{options.map((option) => {
      const label = state.direction === 'ru_alan' ? option.word : option.trans;
      return <Pressable key={option.id} onPress={() => setSelected(option.id)} style={[styles.option, selected === option.id && styles.optionOn]}><Text style={styles.optionText}>{label}</Text></Pressable>;
    })}</View></View>
    <Pressable disabled={!selected} onPress={() => { void submit(); }} style={[styles.submit, !selected && styles.disabled]}><Text style={styles.submitText}>ОТВЕТИТЬ</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: 16 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background, padding: 24 }, error: { color: theme.colors.danger, textAlign: 'center' },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { fontSize: 32, color: theme.colors.textMuted }, title: { fontSize: 16, fontWeight: '800', color: theme.colors.text }, counter: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '700' },
  body: { flex: 1, justifyContent: 'center' }, question: { fontSize: 30, lineHeight: 38, fontWeight: '900', color: theme.colors.text, textAlign: 'center', marginBottom: 28 }, options: { gap: 10 }, option: { minHeight: 54, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 14, backgroundColor: theme.colors.surface }, optionOn: { borderColor: theme.colors.accentStrong, backgroundColor: 'rgba(139,107,59,0.10)' }, optionText: { color: theme.colors.text, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  submit: { minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentStrong }, disabled: { opacity: 0.4 }, submitText: { color: theme.colors.inverse, fontSize: 11, fontWeight: '800' },
});
