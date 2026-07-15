import { PATH_CONFIG } from "../../config/path.js";
import { trackEvent } from "../../shared/analytics/analytics.js";
import { EVENTS, WORD_RESULTS, WORD_SOURCES } from "../../shared/analytics/events.js";
import { normalizePos, parseSynonyms } from "../../shared/domain/word-normalizer.js";
import { hasWordConflict, shuffle, splitGroups } from "../../shared/domain/word-selection.js";
import { enqueueProgress } from "../../shared/progress/progress-queue.js";
import { recordStationTest, stationTestPhase } from "../../shared/progress/station-progress-store.js";
import { readScopedJson, writeScopedJson } from "../../shared/progress/storage-scope.js";
import { recordActivitySession } from "../../shared/progress/activity-history-store.js";
import { escapeHtml } from "../../shared/ui/html.js";

const ACTIVE_KEY = "alantil_station_test_active_v13_1";

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizedLexeme(value) {
  return String(value || "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’'`ʼъь\s\-–—.,;:!?()[\]{}]/g, "")
    .trim();
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
  const candidateStem = approximateStem(candidate.word);
  const correctStem = approximateStem(item.word);
  if (candidateStem && correctStem && candidateStem === correctStem) return true;
  const correctTranslations = normalizedTranslationSet(item);
  for (const translation of normalizedTranslationSet(candidate)) {
    if (correctTranslations.has(translation)) return true;
  }
  const correctSynonyms = new Set(parseSynonyms(item.synonyms));
  for (const synonym of parseSynonyms(candidate.synonyms)) {
    if (correctSynonyms.has(synonym)) return true;
  }
  return false;
}

function difficultyDistance(candidate, item) {
  const candidateOrder = Number(candidate.dict_order || 0);
  const itemOrder = Number(item.dict_order || 0);
  if (!candidateOrder || !itemOrder) return Number.MAX_SAFE_INTEGER;
  return Math.abs(candidateOrder - itemOrder);
}

function distractorsFor(item, allWords, count = 3) {
  const targetPos = normalizePos(item.pos);
  const samePos = allWords.filter((candidate) => normalizePos(candidate.pos) === targetPos);
  const passes = [
    samePos.slice().sort((a, b) => difficultyDistance(a, item) - difficultyDistance(b, item)),
    samePos,
  ];
  const selected = [];
  for (const pass of passes) {
    for (const candidate of shuffle(pass.slice())) {
      if (selected.length >= count) break;
      if (isAmbiguous(candidate, item, selected)) continue;
      selected.push(candidate);
    }
    if (selected.length >= count) break;
  }
  return selected;
}

function buildQuestion(item, allWords) {
  const options = [item, ...distractorsFor(item, allWords)].map((word) => ({
    id: String(word.id),
    text: String(word.trans || ""),
    word,
  }));
  return { item, options: shuffle(options) };
}

function sessionPayload(session) {
  const correct = session.answers.filter((answer) => answer.result === "correct").length;
  const total = session.questions.length;
  const ended = new Date().toISOString();
  const durationSec = Math.max(0, Math.round((Date.now() - Date.parse(session.startedAt)) / 1000));
  return {
    id: session.id,
    dictionary_id: session.station.dictionaryId,
    catalog_id: session.station.catalogId,
    group_id: session.station.groupId,
    set_id: session.station.setId,
    story_type: session.station.storyType,
    phase: session.phase,
    status: session.completed ? "completed" : "interrupted",
    questions_total: total,
    correct_total: correct,
    wrong_total: Math.max(0, session.answers.length - correct),
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    started_at: session.startedAt,
    ended_at: ended,
    duration_sec: durationSec,
    active_duration_sec: durationSec,
    created_at: session.startedAt,
    words: session.answers.map((answer) => ({
      word_id: answer.wordId,
      result: answer.result,
      wrong_word_id: answer.wrongWordId || null,
    })),
  };
}

function saveActive(session) {
  writeScopedJson(ACTIVE_KEY, {
    id: session.id,
    stationKey: session.station.key,
    phase: session.phase,
    questionIds: session.questions.map((question) => String(question.item.id)),
    index: session.index,
    answers: session.answers,
    startedAt: session.startedAt,
  });
}

function clearActive() {
  writeScopedJson(ACTIVE_KEY, {});
}

export function getInterruptedStationTest() {
  return readScopedJson(ACTIVE_KEY, {});
}

export function createStationTestSession(station, allWords) {
  const phase = stationTestPhase(station);
  const interrupted = getInterruptedStationTest();
  const canResume = Boolean(
    interrupted?.id
      && interrupted.stationKey === station.key
      && interrupted.phase === phase
      && Array.isArray(interrupted.questionIds)
      && interrupted.questionIds.length,
  );
  const stationWordsById = new Map(station.words.map((item) => [String(item.id), item]));
  const restoredWords = canResume
    ? interrupted.questionIds.map((id) => stationWordsById.get(String(id))).filter(Boolean)
    : [];
  const restoredIds = new Set(restoredWords.map((item) => String(item.id)));
  const missingWords = shuffle(station.words.filter((item) => !restoredIds.has(String(item.id))));
  const orderedWords = canResume ? [...restoredWords, ...missingWords] : shuffle(station.words.slice());
  const questions = orderedWords.map((item) => buildQuestion(item, allWords));
  const session = {
    id: canResume ? interrupted.id : uuid(),
    station,
    phase,
    questions,
    index: canResume ? Math.min(Number(interrupted.index || 0), questions.length) : 0,
    answers: canResume && Array.isArray(interrupted.answers) ? interrupted.answers.slice(0, questions.length) : [],
    startedAt: canResume ? interrupted.startedAt : new Date().toISOString(),
    completed: false,
  };
  saveActive(session);
  return session;
}

export function renderStationTest(context, session, { onComplete }) {
  const question = session.questions[session.index];
  if (!question) return completeStationTest(context, session, onComplete);
  const number = session.index + 1;
  context.shell.setCounter(`${number}/${session.questions.length}`);
  context.root.innerHTML = `
    <section class="view screen stationTestView">
      <div class="stonePanel stationTestPanel">
        <div class="terminalEyebrow">[ ПРОВЕРКА СТАНЦИИ ]</div>
        <div class="stationTestQuestion">${escapeHtml(question.item.word)}</div>
        <div class="stationTestHint">Выберите точный перевод</div>
        <div class="stationTestOptions">
          ${question.options.map((option) => `<button class="stationTestOption" type="button" data-answer-id="${escapeHtml(option.id)}">${escapeHtml(option.text)}</button>`).join("")}
        </div>
      </div>
    </section>`;

  context.root.querySelectorAll("[data-answer-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = question.options.find((option) => option.id === button.dataset.answerId);
      if (!selected) return;
      const correct = selected.id === String(question.item.id);
      session.answers.push({
        wordId: String(question.item.id),
        result: correct ? "correct" : "wrong",
        wrongWordId: correct ? null : selected.id,
      });
      trackEvent(EVENTS.WORD_RESULT, {
        word_id: String(question.item.id),
        source: WORD_SOURCES.TEST,
        result: correct ? WORD_RESULTS.CORRECT : WORD_RESULTS.WRONG,
        dictionary_id: session.station.catalogId,
        section_id: session.station.groupId,
        set_id: session.station.setId,
        station_phase: session.phase,
      });
      session.index += 1;
      saveActive(session);
      renderStationTest(context, session, { onComplete });
    });
  });
}

export function completeStationTest(context, session, onComplete) {
  session.completed = true;
  const payload = sessionPayload(session);
  const required = Number(session.station.requiredAccuracy || PATH_CONFIG.stationRequiredAccuracy);
  const passed = payload.accuracy >= required;
  enqueueProgress("station_test_session", payload, {
    id: `station_test_session:${payload.id}`,
    replace: false,
  });
  recordActivitySession("station_test", payload);
  recordStationTest(session.station, {
    accuracy: payload.accuracy,
    passed,
    phase: session.phase,
    completedAt: payload.ended_at,
  });
  clearActive();
  context.shell.setCounter("");
  onComplete?.({ payload, passed, required, phase: session.phase });
  return { payload, passed, required };
}
