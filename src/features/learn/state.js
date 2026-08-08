import { normalizeId } from "../../shared/domain/word-normalizer.js?v=13.13";
import { enqueueProgress } from "../../shared/progress/progress-queue.js?v=13.9.0";
import { readScopedJson, writeScopedJson } from "../../shared/progress/storage-scope.js?v=13.9.0";

export const HIDDEN_KEY = "fc_hidden_by_set_v7";
export const FINISHED_KEY = "fc_finished_sets_v1";

export const learnState = {
  currentScreen: "catalog",
  currentDict: "",
  currentSection: "",
  currentSet: "",
  currentStudyMode: "kb",
  menuHidden: new Set(),
  mainQueue: [],
  repeatQueue: [],
  round: "main",
  totalPlanned: 0,
  currentStudyId: "",
  swipeHistory: [],
  analyticsActions: [],
  analyticsFlushed: false,
  sessionFailMap: {},
  isAnimating: false,
  studySession: {
    inProgress: false,
    completed: false,
    wordsPool: [],
    progressData: {},
    wordStats: {},
    metadata: {},
    tracker: null,
    runtime: null,
  },
};

function keyOf(dict, section, setNumber) {
  return `${dict}:${section}:${setNumber}`;
}

function legacyKeyOf(dict, setNumber) {
  return keyOf(dict, dict, setNumber);
}

function toIdSet(values) {
  return new Set((Array.isArray(values) ? values : []).map(normalizeId).filter(Boolean));
}

function readWithLegacyFallback(storageKey, dict, section, setNumber, fallback) {
  const map = readScopedJson(storageKey, {});
  const key = keyOf(dict, section, setNumber);
  if (Object.prototype.hasOwnProperty.call(map, key)) return { map, key, value: map[key] };
  const legacyKey = legacyKeyOf(dict, setNumber);
  if (legacyKey !== key && Object.prototype.hasOwnProperty.call(map, legacyKey)) {
    map[key] = map[legacyKey];
    delete map[legacyKey];
    writeScopedJson(storageKey, map);
    return { map, key, value: map[key] };
  }
  return { map, key, value: fallback };
}

export function getHiddenSet(dict, section, setNumber) {
  return toIdSet(readWithLegacyFallback(HIDDEN_KEY, dict, section, setNumber, []).value);
}

export function setHiddenSet(dict, section, setNumber, ids) {
  const result = readWithLegacyFallback(HIDDEN_KEY, dict, section, setNumber, []);
  const { map, key } = result;
  const before = toIdSet(result.value);
  const after = toIdSet(Array.from(ids || []));
  map[key] = Array.from(after);
  writeScopedJson(HIDDEN_KEY, map);

  const changed = new Set([...before, ...after]);
  changed.forEach((wordId) => {
    if (before.has(wordId) === after.has(wordId)) return;
    enqueueProgress("hidden_word", {
      dictionary_id: String(dict || ""),
      section_id: String(section || ""),
      set_id: String(setNumber || ""),
      word_id: wordId,
      is_hidden: after.has(wordId),
      updated_at: new Date().toISOString(),
    }, { id: `hidden_word:${dict}:${section}:${setNumber}:${wordId}` });
  });
  return after;
}

export function isSetFinished(dict, section, setNumber) {
  return Boolean(readWithLegacyFallback(FINISHED_KEY, dict, section, setNumber, false).value);
}

export function toggleSetFinished(dict, section, setNumber) {
  const result = readWithLegacyFallback(FINISHED_KEY, dict, section, setNumber, false);
  const { map, key } = result;
  const next = !Boolean(result.value);
  if (next) map[key] = true;
  else delete map[key];
  writeScopedJson(FINISHED_KEY, map);
  enqueueProgress("set_progress", {
    dictionary_id: String(dict || ""),
    section_id: String(section || ""),
    set_id: String(setNumber || ""),
    is_finished: next,
    updated_at: new Date().toISOString(),
  }, { id: `set_progress:${dict}:${section}:${setNumber}` });
  return next;
}

export function getLearnItemsCompleted() {
  const pending = new Set([...learnState.mainQueue, ...learnState.repeatQueue].map((word) => word?.id).filter(Boolean));
  return Math.max(0, learnState.totalPlanned - pending.size);
}

export function clearStudySession() {
  learnState.mainQueue = [];
  learnState.repeatQueue = [];
  learnState.round = "main";
  learnState.totalPlanned = 0;
  learnState.currentStudyId = "";
  learnState.swipeHistory = [];
  learnState.analyticsActions = [];
  learnState.analyticsFlushed = false;
  learnState.sessionFailMap = {};
  learnState.isAnimating = false;
  learnState.studySession.inProgress = false;
  learnState.studySession.completed = false;
  learnState.studySession.wordsPool = [];
  learnState.studySession.progressData = {};
  learnState.studySession.wordStats = {};
  learnState.studySession.metadata = {};
  learnState.studySession.tracker = null;
  learnState.studySession.runtime = null;
}
