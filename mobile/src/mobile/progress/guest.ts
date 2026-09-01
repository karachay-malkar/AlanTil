import { readScopedJson, STORAGE_KEYS, writeScopedJson } from '@/src/mobile/storage';

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

export async function loadLocalWordProgress(userId?: string | null) {
  const parsed = await readScopedJson<unknown>(STORAGE_KEYS.wordProgress, [], userId);
  return Array.isArray(parsed) ? parsed as WordProgress[] : [];
}

export async function loadGuestWordProgress() {
  return loadLocalWordProgress(null);
}

async function save(rows: WordProgress[], userId?: string | null) {
  await writeScopedJson(STORAGE_KEYS.wordProgress, rows, userId);
}

export async function recordLocalLearn(words: { word_id: string; show_count: number; left_swipe_count: number; final_result: string }[], completedAt: string, userId?: string | null) {
  const rows = await loadLocalWordProgress(userId);
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
  await save(Array.from(map.values()), userId);
}

export async function recordLocalStationTest(words: { word_id: string; result: string }[], passed: boolean, completedAt: string, userId?: string | null) {
  const rows = await loadLocalWordProgress(userId);
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
  await save(Array.from(map.values()), userId);
}

export const recordGuestLearn = recordLocalLearn;
export const recordGuestStationTest = recordLocalStationTest;
