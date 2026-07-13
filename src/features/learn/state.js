import { normalizeId } from "../../shared/domain/word-normalizer.js";
import { readJson, writeJson } from "../../shared/state/storage.js";

export const HIDDEN_KEY = "fc_hidden_by_set_v7";
export const FINISHED_KEY = "fc_finished_sets_v1";

export const learnState = {
  currentScreen: "catalog",
  currentDict: "",
  currentSection: "",
  currentSet: 1,
  currentStudyMode: "kb",
  menuHidden: new Set(),
  mainQueue: [],
  repeatQueue: [],
  round: "main",
  totalPlanned: 0,
  currentStudyId: "",
  swipeHistory: [],
  sessionFailMap: {},
  isAnimating: false,
  studySession: {
    inProgress: false,
    completed: false,
    wordsPool: [],
    progressData: {},
    tracker: null,
  },
};

function keyOf(dict, section, setNumber) {
  return `${dict}:${section}:${setNumber}`;
}

function toIdSet(values) {
  return new Set((Array.isArray(values) ? values : []).map(normalizeId).filter(Boolean));
}

export function getHiddenSet(dict, section, setNumber) {
  const map = readJson(HIDDEN_KEY, {});
  return toIdSet(map[keyOf(dict, section, setNumber)]);
}

export function setHiddenSet(dict, section, setNumber, ids) {
  const map = readJson(HIDDEN_KEY, {});
  map[keyOf(dict, section, setNumber)] = Array.from(ids);
  writeJson(HIDDEN_KEY, map);
}

export function isSetFinished(dict, section, setNumber) {
  const map = readJson(FINISHED_KEY, {});
  return Boolean(map[keyOf(dict, section, setNumber)]);
}

export function toggleSetFinished(dict, section, setNumber) {
  const map = readJson(FINISHED_KEY, {});
  const key = keyOf(dict, section, setNumber);
  if (map[key]) delete map[key];
  else map[key] = true;
  writeJson(FINISHED_KEY, map);
  return Boolean(map[key]);
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
  learnState.sessionFailMap = {};
  learnState.isAnimating = false;
  learnState.studySession.inProgress = false;
  learnState.studySession.completed = false;
  learnState.studySession.wordsPool = [];
  learnState.studySession.progressData = {};
  learnState.studySession.tracker = null;
}
