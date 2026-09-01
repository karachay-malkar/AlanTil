import { hasWordConflict, normalizePos, parseSynonyms, shuffle, splitGroups } from './practice.js';

export function normalizedLexeme(value) {
  return String(value || '').normalize('NFC').toLowerCase().replace(/[’'`ʼъь\s\-–—.,;:!?()[\]{}]/g, '').trim();
}

export function approximateStem(value) {
  const lexeme = normalizedLexeme(value);
  return lexeme.length > 6 ? lexeme.slice(0, Math.max(4, lexeme.length - 3)) : lexeme;
}

function normalizedTranslationSet(item) {
  return new Set(splitGroups(item?.trans).map(normalizedLexeme).filter(Boolean));
}

export function stationTestCandidateIsAmbiguous(candidate, item, selected = []) {
  if (!candidate || String(candidate.id) === String(item?.id)) return true;
  if (hasWordConflict(candidate, [item, ...selected])) return true;
  const candidateWord = normalizedLexeme(candidate.word);
  const correctWord = normalizedLexeme(item?.word);
  if (!candidateWord || candidateWord === correctWord) return true;
  if (approximateStem(candidate.word) && approximateStem(candidate.word) === approximateStem(item?.word)) return true;
  const correctTranslations = normalizedTranslationSet(item);
  for (const translation of normalizedTranslationSet(candidate)) {
    if (correctTranslations.has(translation)) return true;
  }
  const correctSynonyms = new Set(parseSynonyms(item?.synonyms));
  for (const synonym of parseSynonyms(candidate.synonyms)) {
    if (correctSynonyms.has(synonym)) return true;
  }
  return false;
}

export function stationTestDistractors(item, allWords, count = 3) {
  const targetPos = normalizePos(item?.pos);
  const samePos = shuffle((Array.isArray(allWords) ? allWords : []).filter((candidate) => normalizePos(candidate?.pos) === targetPos).slice());
  const selected = [];
  for (const candidate of samePos) {
    if (selected.length >= Math.max(0, Number(count || 0))) break;
    if (stationTestCandidateIsAmbiguous(candidate, item, selected)) continue;
    selected.push(candidate);
  }
  return selected;
}

export function buildStationTestOptions(item, allWords, mode = 'kb', count = 3) {
  const words = [item, ...stationTestDistractors(item, allWords, count)].filter(Boolean);
  return shuffle(words).map((word) => ({
    id: String(word.id),
    text: String(mode === 'ru' || mode === 'ru_alan' ? word.word : word.trans || ''),
    word,
  }));
}

export function buildStationTestQuestion(item, allWords, mode = 'kb', count = 3) {
  return { item, options: buildStationTestOptions(item, allWords, mode, count) };
}

export function stationTestSelectionSignature(words) {
  return (Array.isArray(words) ? words : []).map((word) => String(word?.id ?? '')).join('|');
}

export function stationTestAccuracy(answers, questionsTotal) {
  const rows = Array.isArray(answers) ? answers : [];
  const total = Math.max(0, Number(questionsTotal ?? rows.length) || 0);
  const correct = rows.filter((answer) => answer?.result === 'correct' || answer?.is_correct === true).length;
  return total ? Math.round((correct / total) * 100) : 0;
}

export function stationTestMasteryLevel(accuracy) {
  const value = Math.max(0, Number(accuracy || 0));
  if (value >= 100) return 3;
  if (value >= 90) return 2;
  if (value >= 80) return 1;
  return 0;
}

export function stationTestResult(answers, requiredAccuracy = 80, questionsTotal) {
  const accuracy = stationTestAccuracy(answers, questionsTotal);
  const required = Math.max(0, Number(requiredAccuracy || 80));
  return {
    accuracy,
    required,
    passed: accuracy >= required,
    masteryLevel: stationTestMasteryLevel(accuracy),
  };
}
