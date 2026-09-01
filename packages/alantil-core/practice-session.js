import {
  buildMatchRounds,
  buildSelectedSources,
  buildTestOptions,
  buildTestWords,
  normalizeId,
  shuffle,
} from './practice.js';

export const PRACTICE_LIMITS = Object.freeze([20, 40, 80]);

export function normalizePracticeLimit(value, fallback = 40) {
  const numeric = Number(value);
  return PRACTICE_LIMITS.includes(numeric) ? numeric : fallback;
}

export function normalizeTestMode(value) {
  return value === 'ru' ? 'ru' : 'kb';
}

export function createTestSessionState({ pool, optionPool = pool, mode = 'kb', limit = 40, selectedSources, runtime = null } = {}) {
  const source = Array.isArray(pool) ? pool : [];
  const options = Array.isArray(optionPool) && optionPool.length ? optionPool : source;
  const normalizedLimit = normalizePracticeLimit(limit);
  const built = buildTestWords(source, normalizedLimit);
  return {
    runtime,
    mode: normalizeTestMode(mode),
    limit: normalizedLimit,
    items: built.items,
    optionPool: options.slice(),
    index: 0,
    correct: 0,
    results: [],
    selectedSources: Array.isArray(selectedSources) ? selectedSources : buildSelectedSources(source),
  };
}

export function buildTestSessionOptions(state, item, count = 4) {
  if (!state || !item) return [];
  return buildTestOptions(item, state.optionPool || state.items || [], normalizeTestMode(state.mode), count);
}

export function submitTestAnswer(state, answer) {
  if (!state || !answer?.id || !answer?.text) return null;
  const items = Array.isArray(state.items) ? state.items : [];
  const index = Math.max(0, Number(state.index || 0));
  if (index >= items.length) return null;
  const item = items[index];
  if (!item) return null;
  const mode = normalizeTestMode(state.mode);
  const questionText = mode === 'kb' ? item.word : item.trans;
  const correctAnswer = mode === 'kb' ? item.trans : item.word;
  const isCorrect = normalizeId(answer.id) === normalizeId(item.id ?? item.word_id);
  const result = {
    id: normalizeId(item.id ?? item.word_id),
    questionText: String(questionText ?? ''),
    word: String(item.word ?? ''),
    trans: String(item.trans ?? ''),
    correctAnswer: String(correctAnswer ?? ''),
    userAnswer: String(answer.text ?? ''),
    wrongWordId: isCorrect ? null : normalizeId(answer.id),
    isCorrect,
  };
  return {
    result,
    state: {
      ...state,
      index: index + 1,
      correct: Math.max(0, Number(state.correct || 0)) + (isCorrect ? 1 : 0),
      results: [...(Array.isArray(state.results) ? state.results : []), result],
    },
  };
}

export function testSessionSummary(state) {
  const total = Array.isArray(state?.items) ? state.items.length : 0;
  const correct = Math.max(0, Math.min(total, Number(state?.correct || 0)));
  const percentage = Math.round((correct / Math.max(1, total)) * 100);
  const level = percentage >= 100 ? 3 : percentage >= 90 ? 2 : percentage >= 80 ? 1 : 0;
  return { total, correct, wrong: Math.max(0, total - correct), percentage, level };
}

export function testSessionPayload(state, { includeSnapshot = true } = {}) {
  if (!state) return {};
  const results = Array.isArray(state.results) ? state.results : [];
  const words = results.map((result) => ({
    word_id: normalizeId(result.id),
    result: result.isCorrect ? 'correct' : 'wrong',
    wrong_word_id: result.isCorrect ? null : normalizeId(result.wrongWordId) || null,
  }));
  const payload = {
    selected_sources: Array.isArray(state.selectedSources) ? state.selectedSources : [],
    direction: normalizeTestMode(state.mode) === 'kb' ? 'alan_to_translation' : 'translation_to_alan',
    questions_planned: Array.isArray(state.items) ? state.items.length : 0,
    questions_answered: words.length,
    correct_total: words.filter((word) => word.result === 'correct').length,
    wrong_total: words.filter((word) => word.result === 'wrong').length,
    words,
  };
  if (!includeSnapshot) return payload;
  return {
    ...payload,
    session_snapshot: {
      mode: normalizeTestMode(state.mode),
      limit: normalizePracticeLimit(state.limit),
      item_ids: (state.items || []).map((item) => normalizeId(item?.id ?? item?.word_id)).filter(Boolean),
      option_pool_ids: (state.optionPool || []).map((item) => normalizeId(item?.id ?? item?.word_id)).filter(Boolean),
      index: Math.max(0, Number(state.index || 0)),
      correct: Math.max(0, Number(state.correct || 0)),
      results,
      selected_sources: Array.isArray(state.selectedSources) ? state.selectedSources : [],
    },
  };
}

export function restoreTestSessionState(runtime, snapshot, words) {
  if (!snapshot || !Array.isArray(words)) return null;
  const byId = new Map(words.map((word) => [normalizeId(word?.id ?? word?.word_id), word]));
  const items = (Array.isArray(snapshot.item_ids) ? snapshot.item_ids : [])
    .map((id) => byId.get(normalizeId(id))).filter(Boolean);
  const optionPool = (Array.isArray(snapshot.option_pool_ids) ? snapshot.option_pool_ids : [])
    .map((id) => byId.get(normalizeId(id))).filter(Boolean);
  const index = Math.max(0, Number(snapshot.index || 0));
  if (!items.length || index >= items.length) return null;
  return {
    runtime,
    mode: normalizeTestMode(snapshot.mode),
    limit: normalizePracticeLimit(snapshot.limit, items.length),
    items,
    optionPool: optionPool.length ? optionPool : words.slice(),
    index,
    correct: Math.max(0, Number(snapshot.correct || 0)),
    results: Array.isArray(snapshot.results) ? snapshot.results.slice() : [],
    selectedSources: Array.isArray(snapshot.selected_sources) ? snapshot.selected_sources : [],
  };
}

export function restartTestSessionState(state, runtime = state?.runtime ?? null) {
  if (!state) return null;
  return {
    ...state,
    runtime,
    items: shuffle((state.items || []).slice()),
    index: 0,
    correct: 0,
    results: [],
  };
}

export function createMatchSessionState({ pool, limit = 40, selectedSources, runtime = null } = {}) {
  const source = Array.isArray(pool) ? pool : [];
  const normalizedLimit = normalizePracticeLimit(limit);
  const built = buildMatchRounds(source, normalizedLimit);
  const rounds = built.rounds.filter((round) => Array.isArray(round) && round.length);
  const shown = new Set();
  (rounds[0] || []).forEach((word) => {
    const id = normalizeId(word?.id ?? word?.word_id);
    if (id) shown.add(id);
  });
  return {
    runtime,
    limit: normalizedLimit,
    items: built.items,
    rounds,
    roundIndex: 0,
    solved: new Set(),
    shown,
    failMap: {},
    errorPairs: {},
    errorsCount: 0,
    selectedSources: Array.isArray(selectedSources) ? selectedSources : buildSelectedSources(source),
  };
}

export function matchTranslationOptions(round) {
  return shuffle((Array.isArray(round) ? round : []).map((word) => ({
    id: normalizeId(word?.id ?? word?.word_id),
    text: String(word?.trans ?? ''),
  })).filter((entry) => entry.id && entry.text));
}

export function applyMatchPair(state, firstId, secondId) {
  if (!state) return null;
  const first = normalizeId(firstId);
  const second = normalizeId(secondId);
  if (!first || !second) return null;
  if (first === second) {
    const solved = new Set(state.solved || []);
    solved.add(first);
    return { correct: true, wrongIds: [], state: { ...state, solved } };
  }
  const failMap = { ...(state.failMap || {}) };
  failMap[first] = Math.max(0, Number(failMap[first] || 0)) + 1;
  failMap[second] = Math.max(0, Number(failMap[second] || 0)) + 1;
  const pair = [first, second].sort();
  const key = `${pair[0]}||${pair[1]}`;
  const previous = state.errorPairs?.[key] ?? { word_id_a: pair[0], word_id_b: pair[1], error_count: 0 };
  const errorPairs = {
    ...(state.errorPairs || {}),
    [key]: { ...previous, error_count: Math.max(0, Number(previous.error_count || 0)) + 1 },
  };
  return {
    correct: false,
    wrongIds: pair,
    state: {
      ...state,
      errorsCount: Math.max(0, Number(state.errorsCount || 0)) + 1,
      failMap,
      errorPairs,
    },
  };
}

export function advanceMatchRound(state) {
  if (!state) return { state, advanced: false, completed: false };
  const rounds = Array.isArray(state.rounds) ? state.rounds : [];
  const roundIndex = Math.max(0, Number(state.roundIndex || 0));
  const currentRound = rounds[roundIndex] || [];
  const solved = state.solved instanceof Set ? state.solved : new Set(state.solved || []);
  const done = currentRound.length > 0 && currentRound.every((word) => solved.has(normalizeId(word?.id ?? word?.word_id)));
  if (!done) return { state, advanced: false, completed: false };
  if (roundIndex >= rounds.length - 1) return { state, advanced: false, completed: true };
  const nextRoundIndex = roundIndex + 1;
  const shown = new Set(state.shown || []);
  (rounds[nextRoundIndex] || []).forEach((word) => {
    const id = normalizeId(word?.id ?? word?.word_id);
    if (id) shown.add(id);
  });
  return { state: { ...state, roundIndex: nextRoundIndex, shown }, advanced: true, completed: false };
}

export function matchSessionPayload(state, { includeSnapshot = true } = {}) {
  if (!state) return {};
  const shown = state.shown instanceof Set ? state.shown : new Set(state.shown || []);
  const solved = state.solved instanceof Set ? state.solved : new Set(state.solved || []);
  const failMap = state.failMap || {};
  const errorPairs = state.errorPairs || {};
  const words = Array.from(shown).map((wordId) => ({
    word_id: normalizeId(wordId),
    matched: solved.has(wordId),
    error_count: Math.max(0, Number(failMap[wordId] || 0)),
  }));
  const errors = Object.values(errorPairs).filter((entry) => entry?.word_id_a && entry?.word_id_b && Number(entry.error_count || 0) > 0)
    .map((entry) => ({
      word_id_a: normalizeId(entry.word_id_a),
      word_id_b: normalizeId(entry.word_id_b),
      error_count: Math.max(1, Number(entry.error_count || 1)),
    }));
  const total = (state.rounds || []).reduce((sum, round) => sum + round.length, 0);
  const payload = {
    selected_sources: Array.isArray(state.selectedSources) ? state.selectedSources : [],
    pairs_planned: total,
    pairs_completed: solved.size,
    errors_total: Math.max(0, Number(state.errorsCount || 0)),
    rounds_total: Math.min((state.rounds || []).length, Math.max(0, Number(state.roundIndex || 0)) + 1),
    words,
    errors,
  };
  if (!includeSnapshot) return payload;
  return {
    ...payload,
    session_snapshot: {
      limit: normalizePracticeLimit(state.limit),
      item_ids: (state.items || []).map((item) => normalizeId(item?.id ?? item?.word_id)).filter(Boolean),
      rounds: (state.rounds || []).map((round) => round.map((item) => normalizeId(item?.id ?? item?.word_id)).filter(Boolean)),
      round_index: Math.max(0, Number(state.roundIndex || 0)),
      solved: Array.from(solved),
      shown: Array.from(shown),
      fail_map: failMap,
      error_pairs: errorPairs,
      errors_count: Math.max(0, Number(state.errorsCount || 0)),
      selected_sources: Array.isArray(state.selectedSources) ? state.selectedSources : [],
    },
  };
}

export function restoreMatchSessionState(runtime, snapshot, words) {
  if (!snapshot || !Array.isArray(words)) return null;
  const byId = new Map(words.map((word) => [normalizeId(word?.id ?? word?.word_id), word]));
  const rounds = (Array.isArray(snapshot.rounds) ? snapshot.rounds : [])
    .map((ids) => (Array.isArray(ids) ? ids : []).map((id) => byId.get(normalizeId(id))).filter(Boolean))
    .filter((round) => round.length);
  if (!rounds.length) return null;
  const items = (Array.isArray(snapshot.item_ids) ? snapshot.item_ids : [])
    .map((id) => byId.get(normalizeId(id))).filter(Boolean);
  return {
    runtime,
    limit: normalizePracticeLimit(snapshot.limit, items.length || rounds.flat().length),
    items: items.length ? items : rounds.flat(),
    rounds,
    roundIndex: Math.min(rounds.length - 1, Math.max(0, Number(snapshot.round_index || 0))),
    solved: new Set((Array.isArray(snapshot.solved) ? snapshot.solved : []).map(normalizeId).filter(Boolean)),
    shown: new Set((Array.isArray(snapshot.shown) ? snapshot.shown : []).map(normalizeId).filter(Boolean)),
    failMap: snapshot.fail_map && typeof snapshot.fail_map === 'object' ? { ...snapshot.fail_map } : {},
    errorPairs: snapshot.error_pairs && typeof snapshot.error_pairs === 'object' ? { ...snapshot.error_pairs } : {},
    errorsCount: Math.max(0, Number(snapshot.errors_count || 0)),
    selectedSources: Array.isArray(snapshot.selected_sources) ? snapshot.selected_sources : [],
  };
}

export function matchSessionSummary(state) {
  const total = (state?.rounds || []).reduce((sum, round) => sum + round.length, 0);
  const failMap = state?.failMap || {};
  const problemIds = new Set(Object.entries(failMap).filter(([, count]) => Number(count || 0) > 0).map(([id]) => id));
  const problemWords = (state?.items || []).filter((word) => problemIds.has(normalizeId(word?.id ?? word?.word_id)));
  return {
    total,
    solved: state?.solved instanceof Set ? state.solved.size : new Set(state?.solved || []).size,
    errors: Math.max(0, Number(state?.errorsCount || 0)),
    clean: Math.max(0, total - problemIds.size),
    problemWords,
  };
}
