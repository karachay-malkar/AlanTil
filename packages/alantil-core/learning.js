function cloneJson(value) {
  if (globalThis.structuredClone) return structuredClone(value);
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function cloneLearnValue(value) {
  return cloneJson(value);
}

export function captureLearnActionSnapshot(state) {
  return {
    mainQueue: state.mainQueue.slice(),
    repeatQueue: state.repeatQueue.slice(),
    round: state.round,
    currentStudyId: state.currentStudyId,
    sessionFailMap: cloneJson(state.sessionFailMap),
    progressData: cloneJson(state.studySession.progressData),
    wordStats: cloneJson(state.studySession.wordStats),
    analyticsActions: cloneJson(state.analyticsActions),
  };
}

export function restoreLearnActionSnapshot(state, snapshot) {
  state.mainQueue = snapshot.mainQueue.slice();
  state.repeatQueue = snapshot.repeatQueue.slice();
  state.round = snapshot.round;
  state.currentStudyId = snapshot.currentStudyId;
  state.sessionFailMap = cloneJson(snapshot.sessionFailMap);
  state.studySession.progressData = cloneJson(snapshot.progressData);
  state.studySession.wordStats = cloneJson(snapshot.wordStats);
  state.analyticsActions = cloneJson(snapshot.analyticsActions);
  return state;
}

function cloneEntries(entries) {
  return Object.fromEntries(Object.entries(entries || {}).map(([id, entry]) => [id, { ...entry }]));
}

export function entryFor(state, wordId) {
  return state.entries?.[wordId] ?? {
    word_id: wordId,
    show_count: 0,
    left_swipe_count: 0,
    final_result: "unfinished",
    first_position: Object.keys(state.entries || {}).length + 1,
  };
}

export function learnQueue(state) {
  return [...(state.ids || []).slice(state.index || 0), ...(state.repeatIds || [])];
}

export function applyLearnDecision(state, wordId, known) {
  const ids = Array.isArray(state.ids) ? state.ids : [];
  const repeatIds = Array.isArray(state.repeatIds) ? state.repeatIds : [];
  const fromMain = Number(state.index || 0) < ids.length;
  const entry = entryFor(state, wordId);
  const nextEntry = {
    ...entry,
    show_count: Math.max(0, Number(entry.show_count || 0)) + 1,
    left_swipe_count: Math.max(0, Number(entry.left_swipe_count || 0)) + (known ? 0 : 1),
    final_result: known ? "known" : "unfinished",
  };
  const undo = {
    index: Number(state.index || 0),
    repeatIds: repeatIds.slice(),
    entries: cloneEntries(state.entries || {}),
  };
  if (fromMain) {
    return {
      ...state,
      index: Number(state.index || 0) + 1,
      repeatIds: known ? repeatIds : [...repeatIds, wordId],
      entries: { ...(state.entries || {}), [wordId]: nextEntry },
      undo,
    };
  }
  const remaining = repeatIds.slice(1);
  return {
    ...state,
    repeatIds: known ? remaining : [...remaining, wordId],
    entries: { ...(state.entries || {}), [wordId]: nextEntry },
    undo,
  };
}

export function undoLearnDecision(state) {
  if (!state?.undo) return null;
  return {
    ...state,
    index: state.undo.index,
    repeatIds: state.undo.repeatIds.slice(),
    entries: cloneEntries(state.undo.entries),
    undo: null,
    undo_count: Math.max(0, Number(state.undo_count || 0)) + 1,
  };
}

export function splitMeaningGroups(value) {
  return String(value ?? "")
    .split(/\s*[;；]\s*|\n+/g)
    .map((group) => group.trim().replace(/^\s*\d+\s*(?:[.)]|[-–—])\s*/, "").trim())
    .filter(Boolean);
}

export function learningSessionWords(entries) {
  return Object.values(entries || {})
    .filter((entry) => entry?.word_id && Number(entry.show_count || 0) > 0)
    .sort((left, right) => Number(left.first_position || 0) - Number(right.first_position || 0))
    .map((entry) => ({
      word_id: String(entry.word_id),
      show_count: Math.max(0, Number(entry.show_count || 0)),
      left_swipe_count: Math.max(0, Number(entry.left_swipe_count || 0)),
      final_result: entry.final_result === "known" ? "known" : "unfinished",
      first_position: Math.max(1, Number(entry.first_position || 1)),
    }));
}

export function learningSessionSummary(entries, words = []) {
  const rows = learningSessionWords(entries);
  const byId = new Map((Array.isArray(words) ? words : []).map((word) => [String(word?.id ?? word?.word_id ?? ""), word]));
  const unknownRows = rows.filter((row) => row.left_swipe_count > 0);
  const problemWords = unknownRows
    .map((row) => {
      const word = byId.get(row.word_id);
      return word ? { ...word, fails: row.left_swipe_count } : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.fails - left.fails);
  return {
    studiedTotal: rows.length,
    knownTotal: rows.filter((row) => row.final_result === "known").length,
    unknownTotal: unknownRows.length,
    leftSwipesTotal: unknownRows.reduce((sum, row) => sum + row.left_swipe_count, 0),
    unfinishedTotal: rows.filter((row) => row.final_result !== "known").length,
    problemWords,
    rows,
  };
}

export function learningSessionPayload(state, scope = {}) {
  const words = learningSessionWords(state?.entries || state?.wordStats || {});
  return {
    dictionary_id: scope.dictionaryId ?? scope.dictionary_id ?? "",
    section_id: scope.sectionId ?? scope.section_id ?? "",
    set_id: scope.setId ?? scope.set_id ?? "",
    direction: state?.direction ?? scope.direction ?? "",
    words_planned: Array.isArray(state?.ids) ? state.ids.length : Math.max(0, Number(scope.wordsPlanned ?? scope.words_planned ?? words.length)),
    unique_words_shown: words.length,
    card_shows_total: words.reduce((sum, word) => sum + word.show_count, 0),
    left_swipes_total: words.reduce((sum, word) => sum + word.left_swipe_count, 0),
    known_words_total: words.filter((word) => word.final_result === "known").length,
    unfinished_words_total: words.filter((word) => word.final_result !== "known").length,
    undo_count: Math.max(0, Number(state?.undo_count ?? scope.undoCount ?? 0)),
    words,
  };
}
