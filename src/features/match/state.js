export const matchState = {
  currentScreen: "menu",
  limit: 40,
  selectedScopeKeys: new Set(),
  items: [],
  rounds: [],
  roundIndex: 0,
  solvedCount: 0,
  total: 0,
  failMap: {},
  solved: new Set(),
  locked: false,
  selected: null,
  session: {
    inProgress: false,
    completed: false,
    wordsPool: [],
    progressData: {},
  },
};

export function clearMatchSession() {
  matchState.items = [];
  matchState.rounds = [];
  matchState.roundIndex = 0;
  matchState.solvedCount = 0;
  matchState.total = 0;
  matchState.failMap = {};
  matchState.solved = new Set();
  matchState.locked = false;
  matchState.selected = null;
  matchState.session.inProgress = false;
  matchState.session.completed = false;
  matchState.session.wordsPool = [];
  matchState.session.progressData = {};
}
