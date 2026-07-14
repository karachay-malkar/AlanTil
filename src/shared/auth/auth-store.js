const subscribers = new Set();

let state = Object.freeze({
  ready: false,
  session: null,
  user: null,
  error: null,
});

function sameUser(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.id === right.id
    && left.email === right.email
    && left.app_metadata?.provider === right.app_metadata?.provider;
}

function sameSession(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.access_token === right.access_token
    && left.refresh_token === right.refresh_token
    && left.expires_at === right.expires_at
    && left.user?.id === right.user?.id;
}

function sameAuthState(left, right) {
  return left.ready === right.ready
    && left.error === right.error
    && sameSession(left.session, right.session)
    && sameUser(left.user, right.user);
}

export function getAuthState() {
  return state;
}

export function setAuthState(nextState) {
  const mergedState = {
    ...state,
    ...nextState,
  };
  if (sameAuthState(state, mergedState)) return state;

  state = Object.freeze(mergedState);
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
