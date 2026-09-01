export type ActivityHistoryRow = {
  id?: unknown;
  type?: unknown;
  status?: unknown;
  started_at?: unknown;
  ended_at?: unknown;
  words?: unknown;
};

export type StationTestSummary = {
  id: string;
  date: string;
  correct: number;
  total: number;
  percent: number;
};

export type ProblemWord<T> = {
  word: T;
  shows: number;
  errors: number;
  difficulty: number;
};

function id(value: unknown) {
  return String(value ?? '').trim();
}

function count(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function time(value: unknown) {
  const parsed = Date.parse(id(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function stationTestSummaries(history: ActivityHistoryRow[], wordIds: Iterable<string>) {
  const ids = new Set(Array.from(wordIds, id).filter(Boolean));
  return history
    .filter((row) => row.status === 'completed' && ['test', 'station_test'].includes(id(row.type)))
    .map((row): StationTestSummary | null => {
      const answers = Array.isArray(row.words) ? row.words as Record<string, unknown>[] : [];
      const selected = answers.filter((answer) => ids.has(id(answer.word_id)));
      if (!selected.length) return null;
      const correct = selected.filter((answer) => answer.result === 'correct' || answer.is_correct === true).length;
      return {
        id: id(row.id),
        date: id(row.ended_at || row.started_at),
        correct,
        total: selected.length,
        percent: Math.round((correct / selected.length) * 100),
      };
    })
    .filter((row): row is StationTestSummary => Boolean(row?.id))
    .sort((left, right) => time(right.date) - time(left.date));
}

export function masteryMark(percent: number) {
  if (percent >= 100) return { level: 3, symbol: '⌃⌃⌃', label: 'III знак' };
  if (percent >= 90) return { level: 2, symbol: '⌃⌃', label: 'II знак' };
  if (percent >= 80) return { level: 1, symbol: '⌃', label: 'I знак' };
  return { level: 0, symbol: '—', label: 'Не сдан' };
}

export function stationProblemWords<T extends { word_id: string }>(
  words: T[],
  progressRows: Record<string, unknown>[],
  limit = 7,
): ProblemWord<T>[] {
  const progress = new Map(progressRows.map((row) => [id(row.word_id), row]));
  return words.map((word) => {
    const row = progress.get(id(word.word_id)) ?? {};
    const shows = Math.max(count(row.study_shown_count), count(row.learn_shows_total));
    const unknown = Math.max(count(row.unknown_count), count(row.learn_left_swipes_total));
    const correct = Math.max(count(row.test_correct_count), count(row.test_correct_total));
    const wrong = Math.max(count(row.test_wrong_count), count(row.test_wrong_total));
    const errors = unknown + wrong;
    const evaluated = shows + correct + wrong;
    return { word, shows, errors, difficulty: evaluated ? Math.round((errors / evaluated) * 100) : 0 };
  }).filter((entry) => entry.errors > 0)
    .sort((left, right) => right.difficulty - left.difficulty || right.errors - left.errors || right.shows - left.shows)
    .slice(0, Math.max(1, limit));
}
