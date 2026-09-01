import { getActivityHistory } from "./activity-history-store.js?v=13.9.0";
import {
  getStorageScope,
  readScopedJson,
  subscribeStorageScope,
  writeScopedJson,
} from "./storage-scope.js?v=13.9.0";
import { awardReward } from "./reward-store.js?v=13.9.0";
import {
  applyLearnWordResults,
  applyMatchWordResults,
  applyTestWordResults,
  buildProblemWordRows,
  buildTestSummariesForWords,
  emptyWordProgressRow,
  mergeCloudWordProgressState,
  normalizeProgressId,
  normalizeWordProgressState,
  trimWordProgressState,
  summarizeWordProgress,
  wordMilestoneHighest,
  wordProgressMapFromState,
} from "../../../packages/alantil-core/word-progress.js";

export const WORD_PROGRESS_LOCAL_KEY = "alantil_word_progress_v13_5";
let cachedScope = "";
let cachedState = null;
let cachedProgressMap = null;

function readState() {
  const scope = getStorageScope();
  if (cachedState && cachedScope === scope) return cachedState;
  const raw = readScopedJson(WORD_PROGRESS_LOCAL_KEY, {});
  cachedScope = scope;
  cachedState = normalizeWordProgressState(raw);
  cachedProgressMap = null;
  return cachedState;
}

function writeState(state) {
  cachedScope = getStorageScope();
  cachedState = trimWordProgressState(state);
  cachedProgressMap = null;
  writeScopedJson(WORD_PROGRESS_LOCAL_KEY, cachedState);
}

export function recordLearnWordResults(sessionId, words = [], completedAt = new Date().toISOString()) {
  const state = readState();
  if (!applyLearnWordResults(state, sessionId, words, completedAt)) return false;
  writeState(state);
  return true;
}

export function recordTestWordResults({
  sessionId,
  answers = [],
  accuracy = 0,
  requiredAccuracy = 80,
  updateMastery = false,
  completedAt = new Date().toISOString(),
} = {}) {
  const state = readState();
  const result = applyTestWordResults(state, {
    sessionId,
    answers,
    accuracy,
    requiredAccuracy,
    updateMastery,
    completedAt,
  });
  if (!result.applied) return false;
  writeState(state);
  if (updateMastery && result.passed) awardWordMilestones();
  return true;
}

export function recordMatchWordResults(sessionId, words = [], completedAt = new Date().toISOString()) {
  const state = readState();
  if (!applyMatchWordResults(state, sessionId, words, completedAt)) return false;
  writeState(state);
  return true;
}

export function mergeCloudWordProgress(rows = []) {
  const state = readState();
  mergeCloudWordProgressState(state, rows);
  writeState(state);
}

export function getWordProgressSnapshotRows() {
  return Array.from(getWordProgressMap().values()).map((row) => ({ ...row }));
}

export function getWordProgress(wordId) {
  const id = normalizeProgressId(wordId);
  return getWordProgressMap().get(id) || emptyWordProgressRow(id);
}

export function getWordProgressMap() {
  readState();
  if (cachedProgressMap) return cachedProgressMap;
  cachedProgressMap = wordProgressMapFromState(readState());
  return cachedProgressMap;
}

export function wordProgressSummary(words = []) {
  return summarizeWordProgress(words, getWordProgressMap());
}

export function problemWordRows(words = [], limit = 7) {
  return buildProblemWordRows(words, getWordProgressMap(), limit);
}

export function testSummariesForWords(words = []) {
  return buildTestSummariesForWords(getActivityHistory(), words);
}

export function recentTestSummariesForWords(words = [], limit = 3) {
  return testSummariesForWords(words).slice(0, Math.max(1, Number(limit || 3)));
}

export function allWordMasterySummary(words = []) {
  return wordProgressSummary(words);
}

export function awardWordMilestones(words = []) {
  const highest = wordMilestoneHighest(getWordProgressMap(), words);
  for (let value = 20; value <= highest; value += 20) {
    awardReward({ rewardId: `achievement:words:${value}` });
  }
  return highest;
}

subscribeStorageScope(() => {
  cachedScope = "";
  cachedState = null;
  cachedProgressMap = null;
});
