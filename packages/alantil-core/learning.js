import { shuffle, wordsForSet } from './word-selection.js';

function cloneJson(value) {
  return globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
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

export function normalizeLearnMode(mode) {
  return mode === 'ru' ? 'ru' : 'kb';
}

export function currentLearnQueue(state) {
  return state.round === 'main' ? state.mainQueue : state.repeatQueue;
}

export function setLearnRoundIfNeeded(state) {
  if (state.round === 'main' && state.mainQueue.length === 0) state.round = 'repeat';
  return state.round;
}

export function getLearnItemsCompleted(state) {
  const pending = new Set([...state.mainQueue, ...state.repeatQueue].map((word) => word?.id).filter(Boolean));
  return Math.max(0, state.totalPlanned - pending.size);
}

export function ensureLearnWordStats(state, item) {
  const id = String(item?.id || '').trim();
  if (!id) return null;
  if (!state.studySession.wordStats[id]) {
    state.studySession.wordStats[id] = {
      word_id: id,
      show_count: 0,
      left_swipe_count: 0,
      final_result: 'unfinished',
      first_position: Object.keys(state.studySession.wordStats).length + 1,
    };
  }
  return state.studySession.wordStats[id];
}

export function learnSessionWords(state) {
  return Object.values(state.studySession.wordStats || {})
    .filter((entry) => entry?.word_id && entry.show_count > 0)
    .sort((left, right) => left.first_position - right.first_position)
    .map((entry) => ({
      word_id: entry.word_id,
      show_count: Math.max(0, Number(entry.show_count) || 0),
      left_swipe_count: Math.max(0, Number(entry.left_swipe_count) || 0),
      final_result: entry.final_result === 'known' ? 'known' : 'unfinished',
      first_position: Math.max(1, Number(entry.first_position) || 1),
    }));
}

export function learnSessionPayload(state) {
  const words = learnSessionWords(state);
  return {
    words_planned: state.totalPlanned,
    unique_words_shown: words.length,
    card_shows_total: words.reduce((sum, word) => sum + word.show_count, 0),
    left_swipes_total: words.reduce((sum, word) => sum + word.left_swipe_count, 0),
    known_words_total: words.filter((word) => word.final_result === 'known').length,
    unfinished_words_total: words.filter((word) => word.final_result !== 'known').length,
    words,
  };
}

export function selectLearnSourceWords(words, {
  wordsOverride,
  favoritesMode = false,
  favoriteIds = new Set(),
  dictionaryId = '',
  sectionId = '',
  setId = '',
  hiddenIds = new Set(),
} = {}) {
  const all = Array.isArray(wordsOverride)
    ? wordsOverride.slice()
    : favoritesMode
      ? (Array.isArray(words) ? words : []).filter((word) => favoriteIds.has(word.id))
      : wordsForSet(words, dictionaryId, sectionId, setId);
  return all.filter((word) => !hiddenIds.has(word.id));
}

export function initializeLearnState(state, activeWords, mode, {
  dictionaryId = state.currentDict,
  sectionId = state.currentSection,
  setId = state.currentSet,
  stationContext = null,
} = {}) {
  const active = Array.isArray(activeWords) ? activeWords : [];
  state.currentStudyMode = normalizeLearnMode(mode);
  state.mainQueue = shuffle(active.slice());
  state.repeatQueue = [];
  state.round = 'main';
  state.totalPlanned = active.length;
  state.currentStudyId = '';
  state.swipeHistory = [];
  state.analyticsActions = [];
  state.analyticsFlushed = false;
  state.sessionFailMap = {};
  state.studySession.inProgress = true;
  state.studySession.completed = false;
  state.studySession.wordsPool = active.slice();
  state.studySession.progressData = { totalPlanned: active.length, known: 0, unknown: 0, undo: 0 };
  state.studySession.wordStats = {};
  state.studySession.metadata = {
    dictionaryId,
    sectionId,
    setId: String(setId),
    stationContext,
  };
  return state;
}

export function exposeCurrentLearnCard(state, { countShow = true } = {}) {
  setLearnRoundIfNeeded(state);
  const queue = currentLearnQueue(state);
  if (state.totalPlanned === 0) return { empty: true, finished: false, item: null };
  if (!queue.length) return { empty: false, finished: true, item: null };
  const item = queue[0];
  state.currentStudyId = item.id;
  const stats = ensureLearnWordStats(state, item);
  if (stats && countShow) stats.show_count += 1;
  return { empty: false, finished: false, item, stats };
}

export function decideLearnCard(state, known, analyticsPayload) {
  setLearnRoundIfNeeded(state);
  const queue = currentLearnQueue(state);
  if (!queue.length) return null;
  const snapshot = captureLearnActionSnapshot(state);
  const fromRound = state.round;
  const item = queue.shift();
  const stats = ensureLearnWordStats(state, item);

  if (!known) {
    state.sessionFailMap[item.id] = (state.sessionFailMap[item.id] || 0) + 1;
    state.repeatQueue.push(item);
    state.studySession.progressData.unknown = (state.studySession.progressData.unknown || 0) + 1;
    if (stats) stats.left_swipe_count += 1;
  } else {
    state.studySession.progressData.known = (state.studySession.progressData.known || 0) + 1;
    if (stats) stats.final_result = 'known';
  }
  if (analyticsPayload) state.analyticsActions.push(analyticsPayload);
  if (state.round === 'main' && state.mainQueue.length === 0) state.round = 'repeat';
  state.swipeHistory.push({ snapshot, itemId: item.id, known, fromRound });
  return { item, known, snapshot, fromRound, stats };
}

export function undoLearnDecision(state) {
  if (!state.swipeHistory.length) return null;
  const action = state.swipeHistory.pop();
  const totalUndo = Number(state.studySession.progressData?.undo || 0) + 1;
  restoreLearnActionSnapshot(state, action.snapshot);
  state.studySession.progressData.undo = totalUndo;
  return action;
}

export function learnCompletionSummary(state) {
  const progress = state.studySession.progressData || {};
  return {
    items_total: state.totalPlanned,
    items_completed: state.totalPlanned,
    known_count: progress.known || 0,
    unknown_count: progress.unknown || 0,
    repeated_count: progress.unknown || 0,
    undo_count: progress.undo || 0,
  };
}

export function learnAbandonSummary(state, previousProgress = state.studySession.progressData || {}) {
  return {
    items_total: previousProgress.totalPlanned || state.totalPlanned,
    items_completed: getLearnItemsCompleted(state),
    known_count: previousProgress.known || 0,
    unknown_count: previousProgress.unknown || 0,
  };
}

export function buildLearnResultSummary(state, words = []) {
  const sessionRows = Object.values(state.studySession.wordStats || {}).filter((row) => Number(row?.show_count || 0) > 0);
  const studiedTotal = sessionRows.length;
  const unknownRows = sessionRows.filter((row) => Number(row.left_swipe_count || 0) > 0);
  const leftSwipesTotal = unknownRows.reduce((sum, row) => sum + Number(row.left_swipe_count || 0), 0);
  const problemWords = unknownRows
    .map((row) => ({ ...(Array.isArray(words) ? words : []).find((word) => String(word.id) === String(row.word_id)), fails: Number(row.left_swipe_count || 0) }))
    .filter((word) => word.id)
    .sort((a, b) => b.fails - a.fails);
  return { sessionRows, studiedTotal, unknownRows, leftSwipesTotal, problemWords };
}

export function selectedPreparationWords(words = [], hiddenIds = new Set(), favoritesOnly = false, favoriteIds = new Set()) {
  const visible = favoritesOnly ? words.filter((word) => favoriteIds.has(word.id)) : words;
  const active = visible.filter((word) => !hiddenIds.has(word.id));
  return { visible, active };
}
