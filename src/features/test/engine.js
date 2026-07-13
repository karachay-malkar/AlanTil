import { trackEvent } from "../../shared/analytics/analytics.js";
import { ACTIVITY_TYPES, CANCEL_REASONS, EVENTS, WORD_RESULTS, WORD_SOURCES, directionFromMode } from "../../shared/analytics/events.js";
import { createActivityTracker } from "../../shared/analytics/session-tracker.js";
import { buildWordsByPOSRounds, shuffle } from "../../shared/domain/word-selection.js";
import { testState } from "./state.js";

function abandonPreviousSession() {
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
}

export function pickOptions(item) {
  const correct = testState.mode === "kb" ? item.trans : item.word;
  const targetPOS = String(item.pos || "").trim();
  let pool = testState.optionPool.filter((candidate) => candidate.id !== item.id && (!targetPOS || String(candidate.pos || "").trim() === targetPOS));
  if (pool.length < 3) pool = testState.optionPool.filter((candidate) => candidate.id !== item.id);

  const options = [correct];
  let guard = 0;
  while (options.length < 4 && guard < 2000) {
    guard += 1;
    const candidate = pool[Math.floor(Math.random() * pool.length)];
    if (!candidate) break;
    const text = testState.mode === "kb" ? candidate.trans : candidate.word;
    if (!text || options.includes(text)) continue;
    options.push(text);
  }
  return shuffle(options);
}

export function submitAnswer(answer) {
  if (testState.index >= testState.items.length || !answer) return false;
  const item = testState.items[testState.index];
  const questionText = testState.mode === "kb" ? item.word : item.trans;
  const correctAnswer = testState.mode === "kb" ? item.trans : item.word;
  const isCorrect = answer === correctAnswer;
  if (isCorrect) testState.correct += 1;

  testState.results.push({
    id: item.id,
    questionText,
    word: item.word,
    trans: item.trans,
    correctAnswer,
    userAnswer: answer,
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
  return true;
}

export function completeTest() {
  if (!testState.session.inProgress || testState.session.completed) return false;
  testState.session.inProgress = false;
  testState.session.completed = true;
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
