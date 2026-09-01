import { CORE_PATH_CONFIG } from './path-config.js';
import { normalizePos, parseSynonyms } from './word-normalizer.js';
import { hasWordConflict, shuffle, splitGroups } from './word-selection.js';

export function normalizedStationLexeme(value) {
  return String(value || '').normalize('NFC').toLowerCase().replace(/[’'`ʼъь\s\-–—.,;:!?()[\]{}]/g, '').trim();
}

export function approximateStationStem(value) {
  const lexeme = normalizedStationLexeme(value);
  return lexeme.length > 6 ? lexeme.slice(0, Math.max(4, lexeme.length - 3)) : lexeme;
}

function normalizedTranslationSet(item) {
  return new Set(splitGroups(item?.trans).map(normalizedStationLexeme).filter(Boolean));
}

export function isStationTestCandidateAmbiguous(candidate, item, selected = []) {
  if (!candidate || String(candidate.id) === String(item.id)) return true;
  if (hasWordConflict(candidate, [item, ...selected])) return true;
  const candidateWord = normalizedStationLexeme(candidate.word);
  const correctWord = normalizedStationLexeme(item.word);
  if (!candidateWord || candidateWord === correctWord) return true;
  if (approximateStationStem(candidate.word) && approximateStationStem(candidate.word) === approximateStationStem(item.word)) return true;
  const correctTranslations = normalizedTranslationSet(item);
  for (const translation of normalizedTranslationSet(candidate)) if (correctTranslations.has(translation)) return true;
  const correctSynonyms = new Set(parseSynonyms(item.synonyms));
  for (const synonym of parseSynonyms(candidate.synonyms)) if (correctSynonyms.has(synonym)) return true;
  return false;
}

export function stationTestDistractors(item, allWords, count = 3) {
  const targetPos = normalizePos(item.pos);
  const samePos = shuffle(allWords.filter((candidate) => normalizePos(candidate.pos) === targetPos));
  const selected = [];
  for (const candidate of samePos) {
    if (selected.length >= count) break;
    if (isStationTestCandidateAmbiguous(candidate, item, selected)) continue;
    selected.push(candidate);
  }
  return selected;
}

export function buildStationTestQuestion(item, allWords, mode = 'kb') {
  return {
    item,
    options: shuffle([item, ...stationTestDistractors(item, allWords)]).map((word) => ({
      id: String(word.id),
      text: String(mode === 'ru' ? word.word : word.trans || ''),
      word,
    })),
  };
}

export function stationTestSelectionSignature(words) {
  return words.map((word) => String(word.id)).join('|');
}

export function normalizeStationTestMode(mode) {
  return mode === 'ru' ? 'ru' : 'kb';
}

export function buildStationTestSessionState({ station, optionWords, mode = 'kb', interrupted = null, id, startedAt } = {}) {
  const sourceWords = Array.isArray(station?.words) ? station.words : [];
  const normalizedMode = normalizeStationTestMode(mode);
  const signature = stationTestSelectionSignature(sourceWords);
  const canResume = Boolean(interrupted?.id && interrupted.stationKey === station.key && interrupted.selectionSignature === signature && interrupted.mode === normalizedMode && Array.isArray(interrupted.questionIds));
  const wordsById = new Map(sourceWords.map((item) => [String(item.id), item]));
  const restored = canResume ? interrupted.questionIds.map((wordId) => wordsById.get(String(wordId))).filter(Boolean) : [];
  const restoredIds = new Set(restored.map((item) => String(item.id)));
  const orderedWords = canResume ? [...restored, ...shuffle(sourceWords.filter((item) => !restoredIds.has(String(item.id))))] : shuffle(sourceWords.slice());
  return {
    id: canResume ? interrupted.id : id,
    station,
    mode: normalizedMode,
    selectionSignature: signature,
    questions: orderedWords.map((item) => buildStationTestQuestion(item, optionWords, normalizedMode)),
    index: canResume ? Math.min(Number(interrupted.index || 0), orderedWords.length) : 0,
    answers: canResume && Array.isArray(interrupted.answers) ? interrupted.answers.slice(0, orderedWords.length) : [],
    startedAt: canResume ? interrupted.startedAt : startedAt,
    completed: false,
    phase: '',
  };
}

export function stationTestActiveSnapshot(session) {
  return {
    id: session.id,
    stationKey: session.station.key,
    selectionSignature: session.selectionSignature,
    questionIds: session.questions.map((question) => String(question.item.id)),
    index: session.index,
    answers: session.answers,
    startedAt: session.startedAt,
    mode: session.mode,
  };
}

export function applyStationTestAnswer(session, selectedId) {
  const question = session.questions[session.index];
  if (!question) return null;
  const selected = question.options.find((option) => option.id === selectedId);
  if (!selected) return null;
  const correct = selected.id === String(question.item.id);
  const answer = {
    wordId: String(question.item.id),
    result: correct ? 'correct' : 'wrong',
    wrongWordId: correct ? null : selected.id,
  };
  session.answers.push(answer);
  session.index += 1;
  return { question, selected, correct, answer };
}

export function stationTestPayload(session, endedAt = new Date().toISOString(), nowMs = Date.now()) {
  const correct = session.answers.filter((answer) => answer.result === 'correct').length;
  const total = session.questions.length;
  const durationSec = Math.max(0, Math.round((nowMs - Date.parse(session.startedAt)) / 1000));
  return {
    id: session.id,
    attempt_id: session.id,
    dictionary_id: session.station.dictionaryId,
    catalog_id: session.station.catalogId,
    group_id: session.station.groupId,
    section_id: session.station.groupId,
    set_id: session.station.sourceSetId || null,
    story_type: session.station.storyType,
    phase: session.phase,
    station_key: session.station.key,
    status: session.completed ? 'completed' : 'interrupted',
    questions_total: total,
    correct_total: correct,
    wrong_total: Math.max(0, session.answers.length - correct),
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    score_percent: total ? Math.round((correct / total) * 100) : 0,
    direction: session.mode === 'ru' ? 'ru_to_alan' : 'alan_to_ru',
    started_at: session.startedAt,
    ended_at: endedAt,
    completed_at: endedAt,
    duration_sec: durationSec,
    active_duration_sec: durationSec,
    created_at: session.startedAt,
    required_accuracy: Number(session.station.requiredAccuracy || CORE_PATH_CONFIG.stationRequiredAccuracy || 80),
    word_ids: session.questions.map((question) => String(question.item.id)),
    words: session.answers.map((answer, index) => ({
      word_id: answer.wordId,
      result: answer.result,
      is_correct: answer.result === 'correct',
      wrong_word_id: answer.wrongWordId || null,
      question_order: index + 1,
    })),
  };
}

export function stationTestResult(session, payload = stationTestPayload(session)) {
  const required = Number(session.station.requiredAccuracy || CORE_PATH_CONFIG.stationRequiredAccuracy || 80);
  return {
    payload,
    passed: payload.accuracy >= required,
    required,
    masteryLevel: payload.accuracy >= 100 ? 3 : payload.accuracy >= 90 ? 2 : payload.accuracy >= 80 ? 1 : 0,
  };
}
