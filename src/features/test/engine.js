import { trackEvent } from "../../shared/analytics/analytics.js?v=13.8";
import { ACTIVITY_TYPES, CANCEL_REASONS, EVENTS, WORD_RESULTS, WORD_SOURCES, directionFromMode } from "../../shared/analytics/events.js?v=13.8";
import { createActivityTracker } from "../../shared/analytics/session-tracker.js?v=13.8";
import { buildWordsByPOSRounds, shuffle } from "../../shared/domain/word-selection.js?v=13.8";
import {
  createSessionRuntime,
  finalizeSessionRuntime,
  persistSessionRuntime,
} from "../../shared/progress/session-builders.js?v=13.8";
import { testState } from "./state.js?v=13.8";
import { recordTestWordResults } from "../../shared/progress/word-progress-store.js?v=13.8";

function sessionWords() {
  return testState.results.map((result) => ({
    word_id: result.id,
    result: result.isCorrect ? "correct" : "wrong",
    wrong_word_id: result.isCorrect ? null : result.wrongWordId || null,
  }));
}

function testSessionPayload() {
  const words = sessionWords();
  return {
    questions_planned: testState.items.length,
    questions_answered: words.length,
    correct_total: words.filter((word) => word.result === "correct").length,
    wrong_total: words.filter((word) => word.result === "wrong").length,
    words,
  };
}

function persistTestSession() {
  persistSessionRuntime(testState.session.runtime, testSessionPayload());
}

export function finalizeTestSession(status = "interrupted", exitReason = "route_change") {
  const session = testState.session;
  if (!session.runtime || session.runtime.finalized) return false;
  const payload = testSessionPayload();
  const result = finalizeSessionRuntime(session.runtime, {
    status,
    exitReason,
    payload,
  });
  if (result?.id && payload.words.length) {
    const accuracy = payload.questions_answered
      ? Math.round((payload.correct_total / payload.questions_answered) * 100)
      : 0;
    recordTestWordResults({
      sessionId: result.id,
      answers: payload.words,
      accuracy,
      requiredAccuracy: 80,
      updateMastery: false,
      completedAt: result.ended_at || new Date().toISOString(),
    });
  }
  session.inProgress = false;
  session.completed = status === "completed";
  return result;
}

function abandonPreviousSession() {
  if (testState.session.runtime && !testState.session.runtime.finalized) {
    finalizeTestSession("interrupted", CANCEL_REASONS.NEW_SESSION);
  }
  const tracker = testState.session.tracker;
  if (tracker?.getStatus() !== "active") return;
  tracker.abandon(CANCEL_REASONS.NEW_SESSION, {
    questions_total: testState.items.length,
    questions_answered: testState.index,
    items_total: testState.items.length,
    items_completed: testState.index,
    progress_percent: Math.round((testState.index / Math.max(1, testState.items.length)) * 100),
    correct_count: testState.correct,
    wrong_count: Math.max(0, testState.index - testState.correct),
  });
}

export function startTest(pool, mode, limit, metadata = {}) {
  abandonPreviousSession();
  testState.mode = mode === "ru" ? "ru" : "kb";
  testState.limit = [20, 40, 80].includes(Number(limit)) ? Number(limit) : 40;
  testState.optionPool = pool.slice();
  testState.items = buildWordsByPOSRounds(pool, testState.limit).items;
  testState.index = 0;
  testState.correct = 0;
  testState.selectedAnswer = null;
  testState.results = [];
  testState.session.inProgress = true;
  testState.session.completed = false;
  testState.session.wordsPool = pool.slice();
  testState.session.progressData = { index: 0, total: testState.items.length, correct: 0 };
  testState.session.metadata = { ...metadata };
  testState.session.runtime = testState.items.length ? createSessionRuntime("test", {
    selected_sources: Array.isArray(metadata.selectedSources) ? metadata.selectedSources : [],
    direction: directionFromMode(testState.mode),
  }) : null;
  testState.session.tracker = testState.items.length ? createActivityTracker(ACTIVITY_TYPES.TEST) : null;
  testState.session.tracker?.start({
    direction: directionFromMode(testState.mode),
    limit: testState.limit,
    items_total: testState.items.length,
    items_completed: 0,
    questions_total: testState.items.length,
    dictionary_count: metadata.dictionaryCount || 0,
    section_count: metadata.sectionCount || 0,
  });
  persistTestSession();
}

export function pickOptions(item) {
  const correctText = testState.mode === "kb" ? item.trans : item.word;
  const targetPOS = String(item.pos || "").trim();
  let pool = testState.optionPool.filter((candidate) => candidate.id !== item.id && (!targetPOS || String(candidate.pos || "").trim() === targetPOS));
  if (pool.length < 3) pool = testState.optionPool.filter((candidate) => candidate.id !== item.id);

  const options = [{ id: item.id, text: correctText }];
  const usedTexts = new Set([correctText]);
  let guard = 0;
  while (options.length < 4 && guard < 2000) {
    guard += 1;
    const candidate = pool[Math.floor(Math.random() * pool.length)];
    if (!candidate) break;
    const text = testState.mode === "kb" ? candidate.trans : candidate.word;
    if (!text || usedTexts.has(text)) continue;
    usedTexts.add(text);
    options.push({ id: candidate.id, text });
  }
  return shuffle(options);
}

export function submitAnswer(answer) {
  if (testState.index >= testState.items.length || !answer?.id || !answer?.text) return false;
  const item = testState.items[testState.index];
  const questionText = testState.mode === "kb" ? item.word : item.trans;
  const correctAnswer = testState.mode === "kb" ? item.trans : item.word;
  const isCorrect = String(answer.id) === String(item.id);
  if (isCorrect) testState.correct += 1;

  testState.results.push({
    id: item.id,
    questionText,
    word: item.word,
    trans: item.trans,
    correctAnswer,
    userAnswer: answer.text,
    wrongWordId: isCorrect ? null : String(answer.id),
    isCorrect,
  });
  trackEvent(EVENTS.WORD_RESULT, {
    word_id: item.id,
    source: WORD_SOURCES.TEST,
    result: isCorrect ? WORD_RESULTS.CORRECT : WORD_RESULTS.WRONG,
    dictionary_id: item.dict,
    section_id: item.section,
    set_id: String(item.set),
    direction: directionFromMode(testState.mode),
  });
  testState.index += 1;
  testState.selectedAnswer = null;
  testState.session.progressData.index = testState.index;
  testState.session.progressData.correct = testState.correct;
  persistTestSession();
  return true;
}

export function completeTest() {
  if (!testState.session.inProgress || testState.session.completed) return false;
  finalizeTestSession("completed", null);
  const total = testState.items.length;
  const wrong = Math.max(0, total - testState.correct);
  return testState.session.tracker?.complete({
    items_total: total,
    items_completed: total,
    questions_total: total,
    questions_answered: total,
    correct_count: testState.correct,
    wrong_count: wrong,
    accuracy_percent: Math.round((testState.correct / Math.max(1, total)) * 100),
    dictionary_count: testState.session.metadata.dictionaryCount || 0,
    section_count: testState.session.metadata.sectionCount || 0,
  }) || false;
}
