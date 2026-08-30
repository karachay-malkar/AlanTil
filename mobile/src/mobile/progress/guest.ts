import AsyncStorage from '@react-native-async-storage/async-storage';

export type WordProgress = {
  word_id: string;
  mastery_status: 'not_started' | 'learning' | 'mastered' | 'review';
  study_shown_count: number;
  known_count: number;
  unknown_count: number;
  test_correct_count: number;
  test_wrong_count: number;
  last_mode?: string | null;
  last_result?: string | null;
  last_seen_at?: string | null;
  last_studied_at?: string | null;
  last_tested_at?: string | null;
  mastered_at?: string | null;
};

export const GUEST_WORD_PROGRESS_KEY = 'alantil_mobile_word_progress_guest_v1';
export const GUEST_STATION_PROGRESS_KEY = 'alantil_mobile_station_progress_guest_v14_1_6';

function empty(wordId: string): WordProgress {
  return {
    word_id: wordId,
    mastery_status: 'not_started',
    study_shown_count: 0,
    known_count: 0,
    unknown_count: 0,
    test_correct_count: 0,
    test_wrong_count: 0,
  };
}

export async function loadGuestWordProgress() {
  const raw = await AsyncStorage.getItem(GUEST_WORD_PROGRESS_KEY);
  if (!raw) return [] as WordProgress[];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as WordProgress[] : [];
  } catch {
    return [];
  }
}

async function save(rows: WordProgress[]) {
  await AsyncStorage.setItem(GUEST_WORD_PROGRESS_KEY, JSON.stringify(rows));
}

export async function recordGuestLearn(words: { word_id: string; show_count: number; left_swipe_count: number; final_result: string }[], completedAt: string) {
  const rows = await loadGuestWordProgress();
  const map = new Map(rows.map((row) => [row.word_id, { ...empty(row.word_id), ...row }]));
  words.forEach((entry) => {
    const row = map.get(entry.word_id) ?? empty(entry.word_id);
    row.study_shown_count += Math.max(0, Number(entry.show_count || 0));
    row.unknown_count += Math.max(0, Number(entry.left_swipe_count || 0));
    if (entry.final_result === 'known') row.known_count += 1;
    if (row.mastery_status === 'not_started') row.mastery_status = 'learning';
    row.last_mode = 'learn';
    row.last_result = entry.final_result === 'known' ? 'known' : 'unfinished';
    row.last_seen_at = completedAt;
    row.last_studied_at = completedAt;
    map.set(entry.word_id, row);
  });
  await save(Array.from(map.values()));
}

export async function recordGuestStationTest(words: { word_id: string; result: string }[], passed: boolean, completedAt: string) {
  const rows = await loadGuestWordProgress();
  const map = new Map(rows.map((row) => [row.word_id, { ...empty(row.word_id), ...row }]));
  words.forEach((entry) => {
    const row = map.get(entry.word_id) ?? empty(entry.word_id);
    const correct = entry.result === 'correct';
    if (correct) row.test_correct_count += 1; else row.test_wrong_count += 1;
    if (passed && correct) {
      row.mastery_status = 'mastered';
      row.mastered_at ||= completedAt;
    } else if (!correct && (row.mastery_status === 'mastered' || row.mastery_status === 'review')) {
      row.mastery_status = 'review';
    } else if (row.mastery_status === 'not_started') {
      row.mastery_status = 'learning';
    }
    row.last_mode = 'test';
    row.last_result = correct ? 'correct' : 'wrong';
    row.last_seen_at = completedAt;
    row.last_tested_at = completedAt;
    map.set(entry.word_id, row);
  });
  await save(Array.from(map.values()));
}
