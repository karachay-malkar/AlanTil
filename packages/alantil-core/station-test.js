import { buildTestOptions, hasWordConflict, normalizeId, normalizePos, parseSynonyms, shuffle, splitGroups } from './practice.js';

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
  const source = (Array.isArray(allWords) ? allWords : []).filter(Boolean);
  const selected = [];
  const appendSafe = (candidates) => {
    for (const candidate of shuffle(candidates.slice())) {
      if (selected.length >= Math.max(0, Number(count || 0))) break;
      if (stationTestCandidateIsAmbiguous(candidate, item, selected)) continue;
      selected.push(candidate);
    }
  };
  appendSafe(source.filter((candidate) => normalizePos(candidate?.pos) === targetPos));
  if (selected.length < count) appendSafe(source);
  return selected;
}

export function buildStationTestOptions(item, allWords, mode = 'kb', count = 3) {
  const desired = Math.max(1, Math.floor(Number(count || 0)) + 1);
  const strictWords = [item, ...stationTestDistractors(item, allWords, count)].filter(Boolean);
  if (strictWords.length >= desired) {
    return shuffle(strictWords).map((word) => ({
      id: String(word.id),
      text: String(mode === 'ru' || mode === 'ru_alan' ? word.word : word.trans || ''),
      word,
    }));
  }
  const normalizedMode = mode === 'ru' || mode === 'ru_alan' ? 'ru' : 'kb';
  const byId = new Map((Array.isArray(allWords) ? allWords : []).map((word) => [String(word?.id ?? ''), word]));
  return buildTestOptions(item, allWords, normalizedMode, desired).map((option) => ({
    ...option,
    word: byId.get(String(option.id)) || item,
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

export function normalizeStationTestDirection(value) {
  return value === 'ru_alan' || value === 'ru' ? 'ru_alan' : 'alan_ru';
}

export function createStationTestState(words, direction = 'alan_ru', phase = '') {
  const ids = shuffle((Array.isArray(words) ? words : []).map((word) => normalizeId(word?.id ?? word?.word_id)).filter(Boolean));
  return {
    ids,
    index: 0,
    answers: [],
    direction: normalizeStationTestDirection(direction),
    phase: String(phase ?? ''),
  };
}

export function restoreStationTestState(snapshot, words) {
  if (!snapshot || !Array.isArray(words)) return null;
  const validIds = new Set(words.map((word) => normalizeId(word?.id ?? word?.word_id)).filter(Boolean));
  const ids = (Array.isArray(snapshot.ids) ? snapshot.ids : []).map(normalizeId).filter(Boolean);
  if (!ids.length || !ids.every((id) => validIds.has(id))) return null;
  return {
    ids,
    index: Math.min(ids.length, Math.max(0, Number(snapshot.index || 0))),
    answers: Array.isArray(snapshot.answers) ? snapshot.answers.slice() : [],
    direction: normalizeStationTestDirection(snapshot.direction),
    phase: String(snapshot.phase ?? ''),
  };
}

export function submitStationTestAnswer(state, itemId, selectedId) {
  if (!state) return null;
  const item = normalizeId(itemId);
  const selected = normalizeId(selectedId);
  if (!item || !selected) return null;
  const correct = item === selected;
  const answer = {
    word_id: item,
    result: correct ? 'correct' : 'wrong',
    wrong_word_id: correct ? null : selected,
  };
  return {
    answer,
    state: {
      ...state,
      index: Math.min((state.ids || []).length, Math.max(0, Number(state.index || 0)) + 1),
      answers: [...(Array.isArray(state.answers) ? state.answers : []), answer],
    },
  };
}

export function stationTestSessionPayload(state, station, requiredAccuracy = 80) {
  if (!state || !station) return {};
  const answers = Array.isArray(state.answers) ? state.answers : [];
  const total = Array.isArray(state.ids) ? state.ids.length : answers.length;
  const correctTotal = answers.filter((entry) => entry?.result === 'correct').length;
  const result = stationTestResult(answers, requiredAccuracy, total);
  const dictionaryId = normalizeId(station.dictionaryId ?? station.dictionary_id ?? station.catalog_id);
  const sectionId = normalizeId(station.sectionId ?? station.section_id ?? station.group_id);
  const setId = normalizeId(station.setId ?? station.set_id);
  const storyId = normalizeId(station.storyId ?? station.story_id ?? station.story_type);
  return {
    dictionary_id: dictionaryId,
    catalog_id: dictionaryId,
    group_id: sectionId,
    section_id: sectionId,
    set_id: setId,
    story_type: storyId,
    phase: String(state.phase ?? ''),
    questions_total: total,
    questions_answered: answers.length,
    correct_total: correctTotal,
    wrong_total: answers.length - correctTotal,
    accuracy: result.accuracy,
    required_accuracy: Math.max(0, Number(requiredAccuracy || 80)),
    words: answers,
    direction: normalizeStationTestDirection(state.direction) === 'ru_alan' ? 'ru_to_alan' : 'alan_to_translation',
  };
}

export function restartStationTestState(previousState, words, phase = previousState?.phase ?? '') {
  return createStationTestState(words, previousState?.direction, phase);
}
