import { PATH_CONFIG } from "../../config/path.js";
import { trackEvent } from "../../shared/analytics/analytics.js";
import { EVENTS, WORD_RESULTS, WORD_SOURCES } from "../../shared/analytics/events.js";
import { normalizePos, parseSynonyms } from "../../shared/domain/word-normalizer.js";
import { hasWordConflict, shuffle, splitGroups } from "../../shared/domain/word-selection.js";
import { recordActivitySession } from "../../shared/progress/activity-history-store.js";
import { enqueueProgress } from "../../shared/progress/progress-queue.js";
import { stationTestPhase } from "../../shared/progress/station-progress-store.js";
import { recordTestWordResults } from "../../shared/progress/word-progress-store.js";
import { readScopedJson, writeScopedJson } from "../../shared/progress/storage-scope.js";
import { escapeHtml } from "../../shared/ui/html.js";

const ACTIVE_KEY = "alantil_station_test_active_v13_5";

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizedLexeme(value) {
  return String(value || "").normalize("NFC").toLowerCase().replace(/[’'`ʼъь\s\-–—.,;:!?()[\]{}]/g, "").trim();
}

function approximateStem(value) {
  const lexeme = normalizedLexeme(value);
  return lexeme.length > 6 ? lexeme.slice(0, Math.max(4, lexeme.length - 3)) : lexeme;
}

function normalizedTranslationSet(item) {
  return new Set(splitGroups(item?.trans).map(normalizedLexeme).filter(Boolean));
}

function isAmbiguous(candidate, item, selected) {
  if (!candidate || String(candidate.id) === String(item.id)) return true;
  if (hasWordConflict(candidate, [item, ...selected])) return true;
  const candidateWord = normalizedLexeme(candidate.word);
  const correctWord = normalizedLexeme(item.word);
  if (!candidateWord || candidateWord === correctWord) return true;
  if (approximateStem(candidate.word) && approximateStem(candidate.word) === approximateStem(item.word)) return true;
  const correctTranslations = normalizedTranslationSet(item);
  for (const translation of normalizedTranslationSet(candidate)) if (correctTranslations.has(translation)) return true;
  const correctSynonyms = new Set(parseSynonyms(item.synonyms));
  for (const synonym of parseSynonyms(candidate.synonyms)) if (correctSynonyms.has(synonym)) return true;
  return false;
}

function difficultyDistance(candidate, item) {
  const candidateOrder = Number(candidate.global_order || candidate.dict_order || 0);
  const itemOrder = Number(item.global_order || item.dict_order || 0);
  if (!candidateOrder || !itemOrder) return Number.MAX_SAFE_INTEGER;
  return Math.abs(candidateOrder - itemOrder);
}

function distractorsFor(item, allWords, count = 3) {
  const targetPos = normalizePos(item.pos);
  const samePos = allWords.filter((candidate) => normalizePos(candidate.pos) === targetPos);
  const selected = [];
  for (const pass of [samePos.slice().sort((a, b) => difficultyDistance(a, item) - difficultyDistance(b, item)), samePos, allWords]) {
    for (const candidate of shuffle(pass.slice())) {
      if (selected.length >= count) break;
      if (isAmbiguous(candidate, item, selected)) continue;
      selected.push(candidate);
    }
    if (selected.length >= count) break;
  }
  return selected;
}

function buildQuestion(item, allWords, mode = "kb") {
  return {
    item,
    options: shuffle([item, ...distractorsFor(item, allWords)]).map((word) => ({
      id: String(word.id),
      text: String(mode === "ru" ? word.word : word.trans || ""),
      word,
    })),
  };
}

function sessionPayload(session) {
  const correct = session.answers.filter((answer) => answer.result === "correct").length;
  const total = session.questions.length;
  const ended = new Date().toISOString();
  const durationSec = Math.max(0, Math.round((Date.now() - Date.parse(session.startedAt)) / 1000));
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
    status: session.completed ? "completed" : "interrupted",
    questions_total: total,
    correct_total: correct,
    wrong_total: Math.max(0, session.answers.length - correct),
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    score_percent: total ? Math.round((correct / total) * 100) : 0,
    direction: session.mode === "ru" ? "ru_to_alan" : "alan_to_ru",
    started_at: session.startedAt,
    ended_at: ended,
    completed_at: ended,
    duration_sec: durationSec,
    active_duration_sec: durationSec,
    created_at: session.startedAt,
    required_accuracy: Number(session.station.requiredAccuracy || PATH_CONFIG.stationRequiredAccuracy || 80),
    word_ids: session.questions.map((question) => String(question.item.id)),
    words: session.answers.map((answer, index) => ({
      word_id: answer.wordId,
      result: answer.result,
      is_correct: answer.result === "correct",
      wrong_word_id: answer.wrongWordId || null,
      question_order: index + 1,
    })),
  };
}

function selectionSignature(words) {
  return words.map((word) => String(word.id)).join("|");
}

function saveActive(session) {
  writeScopedJson(ACTIVE_KEY, {
    id: session.id,
    stationKey: session.station.key,
    selectionSignature: session.selectionSignature,
    questionIds: session.questions.map((question) => String(question.item.id)),
    index: session.index,
    answers: session.answers,
    startedAt: session.startedAt,
    mode: session.mode,
  });
}

function clearActive() { writeScopedJson(ACTIVE_KEY, {}); }
export function getInterruptedStationTest() { return readScopedJson(ACTIVE_KEY, {}); }

export function createStationTestSession(station, allWords, selectedWords = station.words, mode = "kb") {
  const sourceWords = Array.isArray(selectedWords) && selectedWords.length ? selectedWords : station.words;
  const normalizedMode = mode === "ru" ? "ru" : "kb";
  const signature = selectionSignature(sourceWords);
  const interrupted = getInterruptedStationTest();
  const canResume = Boolean(interrupted?.id && interrupted.stationKey === station.key && interrupted.selectionSignature === signature && interrupted.mode === normalizedMode && Array.isArray(interrupted.questionIds));
  const wordsById = new Map(sourceWords.map((item) => [String(item.id), item]));
  const restored = canResume ? interrupted.questionIds.map((id) => wordsById.get(String(id))).filter(Boolean) : [];
  const restoredIds = new Set(restored.map((item) => String(item.id)));
  const orderedWords = canResume ? [...restored, ...shuffle(sourceWords.filter((item) => !restoredIds.has(String(item.id))))] : shuffle(sourceWords.slice());
  const session = {
    id: canResume ? interrupted.id : uuid(),
    station,
    mode: normalizedMode,
    selectionSignature: signature,
    questions: orderedWords.map((item) => buildQuestion(item, allWords, normalizedMode)),
    index: canResume ? Math.min(Number(interrupted.index || 0), orderedWords.length) : 0,
    answers: canResume && Array.isArray(interrupted.answers) ? interrupted.answers.slice(0, orderedWords.length) : [],
    startedAt: canResume ? interrupted.startedAt : new Date().toISOString(),
    completed: false,
    phase: stationTestPhase(station),
  };
  saveActive(session);
  return session;
}

export function renderStationTest(context, session, { onComplete } = {}) {
  context.shell.setHeaderContent?.({ title: "Проверь знания", subtitle: session.station.name, logo: true, brand: false });
  const question = session.questions[session.index];
  if (!question) return completeStationTest(context, session, onComplete);
  const number = session.index + 1;
  context.shell.setCounter(`${number}/${session.questions.length}`);
  const questionText = session.mode === "ru" ? question.item.trans : question.item.word;
  context.root.innerHTML = `<section class="view screen stationTestView">
    <div class="stationTestPanel">
      <div class="stationTestQuestion">${escapeHtml(questionText)}</div>
      <div class="stationTestOptions">
        ${question.options.map((option) => `<button class="choiceControl optionBtn stationTestOption" type="button" data-answer-id="${escapeHtml(option.id)}">${escapeHtml(option.text)}</button>`).join("")}
      </div>
    </div>
    <footer class="modeLaunchBar"><button class="btn actionPrimary stationTestSubmit" type="button" data-answer-submit disabled>Ответить</button></footer>
  </section>`;

  const answerButtons = Array.from(context.root.querySelectorAll("[data-answer-id]"));
  const submitButton = context.root.querySelector("[data-answer-submit]");
  let selectedId = "";
  answerButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedId = button.dataset.answerId || "";
      answerButtons.forEach((option) => option.classList.toggle("selected", option === button));
      submitButton.disabled = !selectedId;
    });
  });
  submitButton.addEventListener("click", () => {
      const selected = question.options.find((option) => option.id === selectedId);
      if (!selected) return;
      const correct = selected.id === String(question.item.id);
      session.answers.push({ wordId: String(question.item.id), result: correct ? "correct" : "wrong", wrongWordId: correct ? null : selected.id });
      trackEvent(EVENTS.WORD_RESULT, {
        word_id: String(question.item.id), source: WORD_SOURCES.TEST,
        result: correct ? WORD_RESULTS.CORRECT : WORD_RESULTS.WRONG,
        dictionary_id: session.station.dictionaryId, section_id: session.station.groupId,
        set_id: session.station.sourceSetId || "", station_key: session.station.key,
      });
      session.index += 1;
      saveActive(session);
      renderStationTest(context, session, { onComplete });
  });
}

export function completeStationTest(context, session, onComplete) {
  session.completed = true;
  const payload = sessionPayload(session);
  const required = Number(session.station.requiredAccuracy || PATH_CONFIG.stationRequiredAccuracy || 80);
  const passed = payload.accuracy >= required;
  recordTestWordResults({
    sessionId: payload.id,
    answers: payload.words,
    accuracy: payload.accuracy,
    requiredAccuracy: required,
    updateMastery: true,
    completedAt: payload.ended_at,
  });
  enqueueProgress("station_test_session", payload, { id: `station_test_session:${payload.id}`, replace: false });
  recordActivitySession("station_test", payload);
  clearActive();
  context.shell.setCounter("");
  const result = { payload, passed, required, masteryLevel: payload.accuracy >= 100 ? 3 : payload.accuracy >= 90 ? 2 : payload.accuracy >= 80 ? 1 : 0 };
  onComplete?.(result);
  return result;
}
