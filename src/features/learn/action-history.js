function cloneJson(value) {
  return globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export function captureLearnActionSnapshot(state) {
  return {
    mainQueue: state.mainQueue.slice(),
    repeatQueue: state.repeatQueue.slice(),
    round: state.round,
    currentStudyId: state.currentStudyId,
    sessionFailMap: cloneJson(state.sessionFailMap),
    progressData: cloneJson(state.studySession.progressData),
    wordStats: cloneJson(state.studySession.wordStats),
    analyticsActions: cloneJson(state.analyticsActions),
  };
}

export function restoreLearnActionSnapshot(state, snapshot) {
  state.mainQueue = snapshot.mainQueue.slice();
  state.repeatQueue = snapshot.repeatQueue.slice();
  state.round = snapshot.round;
  state.currentStudyId = snapshot.currentStudyId;
  state.sessionFailMap = cloneJson(snapshot.sessionFailMap);
  state.studySession.progressData = cloneJson(snapshot.progressData);
  state.studySession.wordStats = cloneJson(snapshot.wordStats);
  state.analyticsActions = cloneJson(snapshot.analyticsActions);
  return state;
}

export function cloneLearnValue(value) {
  return cloneJson(value);
}
