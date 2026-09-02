import { normalizeId } from './word-normalizer.js';
import { buildWordsByPOSRounds } from './word-selection.js';

export function normalizeMatchLimit(limit) {
  return [20, 40, 80].includes(Number(limit)) ? Number(limit) : 40;
}

export function initializeMatchState(state, pool, limit, metadata = {}) {
  state.limit = normalizeMatchLimit(limit);
  state.items = pool.slice();
  state.rounds = buildWordsByPOSRounds(pool, state.limit).rounds.filter((round) => round.length);
  state.roundIndex = 0;
  state.solvedCount = 0;
  state.total = state.rounds.reduce((sum, round) => sum + round.length, 0);
  state.errorsCount = 0;
  state.failMap = {};
  state.errorPairs = {};
  state.solved = new Set();
  state.shown = new Set();
  state.locked = false;
  state.selected = null;
  state.session.inProgress = true;
  state.session.completed = false;
  state.session.wordsPool = pool.slice();
  state.session.progressData = { solved: 0, total: state.total, errors: 0 };
  state.session.metadata = { ...metadata };
  return state;
}

export function matchWordById(state, id) {
  const normalized = normalizeId(id);
  return state.items.find((word) => normalizeId(word.id) === normalized) || null;
}

export function matchSessionItemIds(state) {
  return Array.from(state.shown || []).map(normalizeId).filter(Boolean);
}

export function matchSessionWords(state) {
  return matchSessionItemIds(state).map((wordId) => ({
    word_id: wordId,
    matched: state.solved.has(wordId),
    error_count: Math.max(0, Number(state.failMap[wordId]) || 0),
  }));
}

export function matchSessionErrors(state) {
  return Object.values(state.errorPairs || {})
    .filter((entry) => entry?.word_id_a && entry?.word_id_b && entry.error_count > 0)
    .map((entry) => ({
      word_id_a: entry.word_id_a,
      word_id_b: entry.word_id_b,
      error_count: Math.max(1, Number(entry.error_count) || 1),
    }));
}

export function matchSessionPayload(state) {
  return {
    pairs_planned: state.total,
    pairs_completed: state.solvedCount,
    errors_total: state.errorsCount,
    rounds_total: state.roundIndex,
    words: matchSessionWords(state),
    errors: matchSessionErrors(state),
  };
}

export function matchAbandonSummary(state) {
  return {
    items_total: state.total,
    items_completed: state.solvedCount,
    pairs_total: state.total,
    pairs_completed: state.solvedCount,
    progress_percent: Math.round((state.solvedCount / Math.max(1, state.total)) * 100),
    errors_count: state.errorsCount,
  };
}

export function takeNextMatchRound(state) {
  let round = [];
  while (state.roundIndex < state.rounds.length && round.length === 0) {
    round = state.rounds[state.roundIndex] || [];
    state.roundIndex += 1;
  }
  round.forEach((word) => {
    const wordId = normalizeId(word?.id);
    if (wordId) state.shown.add(wordId);
  });
  return round;
}

export function markMatchSolved(state, id) {
  const normalized = normalizeId(id);
  if (!normalized || state.solved.has(normalized)) return null;
  state.solved.add(normalized);
  state.solvedCount += 1;
  state.session.progressData.solved = state.solvedCount;
  return normalized;
}

function bumpFailure(state, id) {
  const normalized = normalizeId(id);
  if (!normalized || state.solved.has(normalized)) return;
  state.failMap[normalized] = (state.failMap[normalized] || 0) + 1;
}

function bumpErrorPair(state, firstId, secondId) {
  const pair = [normalizeId(firstId), normalizeId(secondId)].filter(Boolean).sort();
  if (pair.length !== 2 || pair[0] === pair[1]) return;
  const key = `${pair[0]}||${pair[1]}`;
  if (!state.errorPairs[key]) {
    state.errorPairs[key] = { word_id_a: pair[0], word_id_b: pair[1], error_count: 0 };
  }
  state.errorPairs[key].error_count += 1;
}

export function recordMatchMismatch(state, firstId, secondId) {
  state.errorsCount += 1;
  state.session.progressData.errors = state.errorsCount;
  bumpFailure(state, firstId);
  bumpFailure(state, secondId);
  bumpErrorPair(state, firstId, secondId);
  return [normalizeId(firstId), normalizeId(secondId)];
}

export function matchCompletionSummary(state) {
  return {
    items_total: state.total,
    items_completed: state.total,
    pairs_total: state.total,
    pairs_completed: state.total,
    errors_count: state.errorsCount,
    rounds_count: state.rounds.length,
    dictionary_count: state.session.metadata.dictionaryCount || 0,
    section_count: state.session.metadata.sectionCount || 0,
  };
}

export function matchStateSnapshot(state){if(!state?.session?.id)return null;return{id:state.session.id,startedAt:state.session.startedAt,limit:state.limit,poolIds:(state.items||[]).map((word)=>String(word.id)),rounds:(state.rounds||[]).map((round)=>round.map((word)=>String(word.id))),roundIndex:Math.max(0,Number(state.roundIndex)||0),solvedCount:Math.max(0,Number(state.solvedCount)||0),total:Math.max(0,Number(state.total)||0),errorsCount:Math.max(0,Number(state.errorsCount)||0),failMap:{...(state.failMap||{})},errorPairs:{...(state.errorPairs||{})},solved:Array.from(state.solved||[]).map(String),shown:Array.from(state.shown||[]).map(String)};}
export function restoreMatchStateSnapshot(snapshot,words){if(!snapshot?.id)return null;const source=Array.isArray(words)?words:[],byId=new Map(source.map((word)=>[String(word.id),word])),pool=(snapshot.poolIds||[]).map((id)=>byId.get(String(id))).filter(Boolean);if(!pool.length)return null;const state={session:{id:snapshot.id,startedAt:snapshot.startedAt}};initializeMatchState(state,pool,snapshot.limit,{});const restoredRounds=(snapshot.rounds||[]).map((ids)=>ids.map((id)=>byId.get(String(id))).filter(Boolean)).filter((round)=>round.length);if(restoredRounds.length)state.rounds=restoredRounds;state.roundIndex=Math.min(state.rounds.length,Math.max(0,Number(snapshot.roundIndex)||0));state.solvedCount=Math.min(state.total,Math.max(0,Number(snapshot.solvedCount)||0));state.total=Math.max(state.solvedCount,Number(snapshot.total)||state.total);state.errorsCount=Math.max(0,Number(snapshot.errorsCount)||0);state.failMap=snapshot.failMap&&typeof snapshot.failMap==='object'?{...snapshot.failMap}:{};state.errorPairs=snapshot.errorPairs&&typeof snapshot.errorPairs==='object'?{...snapshot.errorPairs}:{};state.solved=new Set((snapshot.solved||[]).map(String));state.shown=new Set((snapshot.shown||[]).map(String));state.session.id=snapshot.id;state.session.startedAt=snapshot.startedAt;state.session.progressData={solved:state.solvedCount,total:state.total,errors:state.errorsCount};return state;}
