export type LearnEntry = {
  word_id: string;
  show_count: number;
  left_swipe_count: number;
  final_result: 'known' | 'unfinished';
  first_position: number;
};

export type LearnSnapshot = {
  index: number;
  repeatIds: string[];
  entries: Record<string, LearnEntry>;
};

export type LearnState = {
  source: 'station' | 'favorites';
  ids: string[];
  index: number;
  repeatIds: string[];
  entries: Record<string, LearnEntry>;
  direction: 'alan_ru' | 'ru_alan';
  undo?: LearnSnapshot | null;
  undo_count?: number;
};

function cloneEntries(entries: Record<string, LearnEntry>) {
  return Object.fromEntries(Object.entries(entries).map(([id, entry]) => [id, { ...entry }]));
}

export function entryFor(state: LearnState, wordId: string) {
  return state.entries[wordId] ?? {
    word_id: wordId,
    show_count: 0,
    left_swipe_count: 0,
    final_result: 'unfinished' as const,
    first_position: Object.keys(state.entries).length + 1,
  };
}

export function learnQueue(state: LearnState) {
  return [...state.ids.slice(state.index), ...state.repeatIds];
}

export function applyLearnDecision(state: LearnState, wordId: string, known: boolean): LearnState {
  const fromMain = state.index < state.ids.length;
  const entry = entryFor(state, wordId);
  const nextEntry: LearnEntry = {
    ...entry,
    show_count: entry.show_count + 1,
    left_swipe_count: entry.left_swipe_count + (known ? 0 : 1),
    final_result: known ? 'known' : 'unfinished',
  };
  const undo: LearnSnapshot = {
    index: state.index,
    repeatIds: state.repeatIds.slice(),
    entries: cloneEntries(state.entries),
  };
  if (fromMain) {
    return {
      ...state,
      index: state.index + 1,
      repeatIds: known ? state.repeatIds : [...state.repeatIds, wordId],
      entries: { ...state.entries, [wordId]: nextEntry },
      undo,
    };
  }
  const remaining = state.repeatIds.slice(1);
  return {
    ...state,
    repeatIds: known ? remaining : [...remaining, wordId],
    entries: { ...state.entries, [wordId]: nextEntry },
    undo,
  };
}

export function undoLearnDecision(state: LearnState): LearnState | null {
  if (!state.undo) return null;
  return {
    ...state,
    index: state.undo.index,
    repeatIds: state.undo.repeatIds.slice(),
    entries: cloneEntries(state.undo.entries),
    undo: null,
    undo_count: Math.max(0, Number(state.undo_count || 0)) + 1,
  };
}

export function splitMeaningGroups(value: unknown) {
  return String(value ?? '')
    .split(/\s*[;；]\s*|\n+/g)
    .map((group) => group.trim().replace(/^\s*\d+\s*(?:[.)]|[-–—])\s*/, '').trim())
    .filter(Boolean);
}
