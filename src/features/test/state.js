export const testState = {
  currentScreen: "menu",
  mode: "kb",
  limit: 40,
  selectedScopeKeys: new Set(),
  optionPool: [],
  items: [],
  index: 0,
  correct: 0,
  selectedAnswer: null,
  results: [],
  session: {
    inProgress: false,
    completed: false,
    wordsPool: [],
    progressData: {},
  },
};

export function clearTestSession() {
  testState.optionPool = [];
  testState.items = [];
  testState.index = 0;
  testState.correct = 0;
  testState.selectedAnswer = null;
  testState.results = [];
  testState.session.inProgress = false;
  testState.session.completed = false;
  testState.session.wordsPool = [];
  testState.session.progressData = {};
}
