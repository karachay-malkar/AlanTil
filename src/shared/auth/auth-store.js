const subscribers = new Set();

let state = Object.freeze({
  ready: false,
  session: null,
  user: null,
  error: null,
});

export function getAuthState() {
  return state;
}

export function setAuthState(nextState) {
  state = Object.freeze({ ...state, ...nextState });
  subscribers.forEach((subscriber) => {
    try {
      subscriber(state);
    } catch (error) {
      console.error("Auth state subscriber failed", error);
    }
  });
  return state;
}

export function subscribeAuthState(subscriber) {
  subscribers.add(subscriber);
  subscriber(state);
  return () => subscribers.delete(subscriber);
}
