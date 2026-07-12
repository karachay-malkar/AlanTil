import { buildWordsByPOSRounds } from "../../shared/domain/word-selection.js";
import { normalizeId } from "../../shared/domain/word-normalizer.js";
import { matchState } from "./state.js";

export function startMatch(pool, limit) {
  matchState.limit = [20, 40, 80].includes(Number(limit)) ? Number(limit) : 40;
  matchState.items = pool.slice();
  matchState.rounds = buildWordsByPOSRounds(pool, matchState.limit).rounds;
  matchState.roundIndex = 0;
  matchState.solvedCount = 0;
  matchState.total = matchState.rounds.reduce((sum, round) => sum + round.length, 0);
  matchState.failMap = {};
  matchState.solved = new Set();
  matchState.locked = false;
  matchState.selected = null;
  matchState.session.inProgress = true;
  matchState.session.completed = false;
  matchState.session.wordsPool = pool.slice();
  matchState.session.progressData = { solved: 0, total: matchState.total };
}

export function nextRound() {
  let round = [];
  while (matchState.roundIndex < matchState.rounds.length && round.length === 0) {
    round = matchState.rounds[matchState.roundIndex] || [];
    matchState.roundIndex += 1;
  }
  return round;
}

export function markSolved(id) {
  matchState.solved.add(normalizeId(id));
  matchState.solvedCount += 1;
  matchState.session.progressData.solved = matchState.solvedCount;
}

export function bumpFailure(id) {
  const normalized = normalizeId(id);
  if (!normalized || matchState.solved.has(normalized)) return;
  matchState.failMap[normalized] = (matchState.failMap[normalized] || 0) + 1;
}
