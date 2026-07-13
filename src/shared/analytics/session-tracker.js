import { trackEvent } from "./analytics.js";
import { CANCEL_REASONS, EVENTS } from "./events.js";

const trackers = new Set();
let lifecycleBound = false;

function now() {
  return performance.now();
}

function seconds(milliseconds) {
  return Math.max(0, Math.round(milliseconds / 1000));
}

function bindLifecycle() {
  if (lifecycleBound) return;
  lifecycleBound = true;
  document.addEventListener("visibilitychange", () => {
    trackers.forEach((tracker) => tracker.handleVisibilityChange());
  });
  window.addEventListener("pagehide", () => {
    trackers.forEach((tracker) => tracker.abandon(CANCEL_REASONS.CLOSE));
  });
}

export function createActivityTracker(activityType) {
  bindLifecycle();
  let status = "idle";
  let startedAt = 0;
  let activeStartedAt = 0;
  let activeDuration = 0;
  let baseParameters = {};

  function pauseActive() {
    if (!activeStartedAt) return;
    activeDuration += now() - activeStartedAt;
    activeStartedAt = 0;
  }

  function resumeActive() {
    if (status !== "active" || document.visibilityState === "hidden" || activeStartedAt) return;
    activeStartedAt = now();
  }

  function durationParameters() {
    pauseActive();
    const parameters = {
      duration_sec: seconds(now() - startedAt),
      active_duration_sec: seconds(activeDuration),
    };
    resumeActive();
    return parameters;
  }

  const api = {
    start(parameters = {}) {
      if (status === "active") api.abandon(CANCEL_REASONS.NEW_SESSION);
      status = "active";
      startedAt = now();
      activeDuration = 0;
      activeStartedAt = document.visibilityState === "hidden" ? 0 : startedAt;
      baseParameters = { activity_type: activityType, ...parameters };
      trackers.add(api);
      trackEvent(EVENTS.ACTIVITY_START, baseParameters);
      return true;
    },

    complete(parameters = {}) {
      if (status !== "active") return false;
      pauseActive();
      status = "completed";
      trackers.delete(api);
      trackEvent(EVENTS.ACTIVITY_COMPLETE, {
        ...baseParameters,
        ...parameters,
        duration_sec: seconds(now() - startedAt),
        active_duration_sec: seconds(activeDuration),
      });
      return true;
    },

    abandon(cancelReason = CANCEL_REASONS.ROUTE_CHANGE, parameters = {}) {
      if (status !== "active") return false;
      pauseActive();
      status = "abandoned";
      trackers.delete(api);
      trackEvent(EVENTS.ACTIVITY_ABANDON, {
        ...baseParameters,
        ...parameters,
        cancel_reason: cancelReason,
        duration_sec: seconds(now() - startedAt),
        active_duration_sec: seconds(activeDuration),
      });
      return true;
    },

    snapshot() {
      return { status, ...durationParameters() };
    },

    handleVisibilityChange() {
      if (status !== "active") return;
      if (document.visibilityState === "hidden") pauseActive();
      else resumeActive();
    },

    getStatus() {
      return status;
    },
  };

  return api;
}
