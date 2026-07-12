import { buildWordsByPOSRounds, shuffle } from "../../shared/domain/word-selection.js";
import { testState } from "./state.js";

export function startTest(pool, mode, limit) {
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
  testState.index += 1;
  testState.selectedAnswer = null;
  testState.session.progressData.index = testState.index;
  testState.session.progressData.correct = testState.correct;
  return true;
}
