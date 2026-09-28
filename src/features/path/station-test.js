import { trackEvent } from "../../shared/analytics/analytics.js?v=16.8.0.8";
import { EVENTS, WORD_RESULTS, WORD_SOURCES } from "../../shared/analytics/events.js?v=16.8.0.8";
import { getCachedWords } from "../../shared/data/word-repository.js?v=16.8.0.8";
import { recordActivitySession } from "../../shared/progress/activity-history-store.js?v=16.8.0.8";
import { enqueueProgress } from "../../shared/progress/progress-queue.js?v=16.8.0.8";
import { stationTestPhase } from "../../shared/progress/station-progress-store.js?v=16.8.0.8";
import { recordTestWordResults } from "../../shared/progress/word-progress-store.js?v=16.8.0.8";
import { removeScopedValue } from "../../shared/progress/storage-scope.js?v=16.8.0.8";
import { msg } from "../../shared/i18n/index.js?v=16.8.0.8";
import { escapeHtml } from "../../shared/ui/html.js?v=16.8.0.8";
import {
  applyStationTestAnswer,
  buildStationTestSessionState,
  stationTestDistractors,
  stationTestPayload,
  stationTestResult,
} from "../../../packages/alantil-core/station-test.js?v=16.8.0.8";

const LEGACY_ACTIVE_KEY = "alantil_station_test_active_v13_5";

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function distractorsFor(item, allWords, count = 3) {
  return stationTestDistractors(item, allWords, count);
}

function clearLegacyActiveSnapshot() {
  removeScopedValue(LEGACY_ACTIVE_KEY);
}

export function createStationTestSession(station, allWords, mode = "kb") {
  clearLegacyActiveSnapshot();
  const globalWords = getCachedWords();
  const optionWords = Array.isArray(globalWords) && globalWords.length ? globalWords : allWords;
  const session = buildStationTestSessionState({
    station,
    optionWords,
    mode,
    interrupted: null,
    id: uuid(),
    startedAt: new Date().toISOString(),
  });
  session.phase = stationTestPhase(station);
  return session;
}

export function discardStationTestSession(session) {
  clearLegacyActiveSnapshot();
  if (!session || session.completed) return false;
  session.answers = [];
  session.index = 0;
  session.completed = false;
  return true;
}

export function renderStationTest(context, session, { onComplete } = {}) {
  context.shell.setHeaderContent?.({ title: msg("common.prover_znaniya"), subtitle: session.station.name, logo: true, brand: false });
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
    <footer class="modeLaunchBar"><button class="btn actionPrimary stationTestSubmit" type="button" data-answer-submit disabled>${msg("stage.otvetit")}</button></footer>
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
    const transition = applyStationTestAnswer(session, selectedId);
    if (!transition) return;
    const { question: answeredQuestion, correct } = transition;
    trackEvent(EVENTS.WORD_RESULT, {
      word_id: String(answeredQuestion.item.id), source: WORD_SOURCES.TEST,
      result: correct ? WORD_RESULTS.CORRECT : WORD_RESULTS.WRONG,
      dictionary_id: session.station.dictionaryId, section_id: session.station.groupId,
      set_id: session.station.sourceSetId || "", station_key: session.station.key,
    });
    renderStationTest(context, session, { onComplete });
  });
}

export function completeStationTest(context, session, onComplete) {
  session.completed = true;
  const payload = stationTestPayload(session);
  const result = stationTestResult(session, payload);
  recordTestWordResults({
    sessionId: payload.id,
    answers: payload.words,
    accuracy: payload.accuracy,
    requiredAccuracy: result.required,
    updateMastery: true,
    completedAt: payload.ended_at,
  });
  enqueueProgress("station_test_session", payload, { id: `station_test_session:${payload.id}`, replace: false });
  recordActivitySession("station_test", payload);
  clearLegacyActiveSnapshot();
  context.shell.setCounter("");
  onComplete?.(result);
  return result;
}
