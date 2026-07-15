const clocks = new Set();
let lifecycleBound = false;

function nowMs() {
  return Date.now();
}

function seconds(milliseconds) {
  return Math.max(0, Math.round(Number(milliseconds || 0) / 1000));
}

function bindLifecycle() {
  if (lifecycleBound) return;
  lifecycleBound = true;
  document.addEventListener("visibilitychange", () => {
    clocks.forEach((clock) => clock.handleVisibilityChange());
  });
  window.addEventListener("pagehide", () => {
    clocks.forEach((clock) => clock.pause());
  });
  window.addEventListener("pageshow", () => {
    clocks.forEach((clock) => clock.resume());
  });
}

export function createActivityClock({
  startedAt = new Date().toISOString(),
  activeDurationMs = 0,
} = {}) {
  bindLifecycle();
  const startedTimestamp = Date.parse(startedAt) || nowMs();
  let activeMs = Math.max(0, Number(activeDurationMs) || 0);
  let activeStartedAt = document.visibilityState === "hidden" ? 0 : nowMs();
  let stoppedAt = 0;

  function pause() {
    if (!activeStartedAt) return;
    activeMs += Math.max(0, nowMs() - activeStartedAt);
    activeStartedAt = 0;
  }

  function resume() {
    if (stoppedAt || document.visibilityState === "hidden" || activeStartedAt) return;
    activeStartedAt = nowMs();
  }

  function snapshot() {
    const current = nowMs();
    const liveActive = activeStartedAt ? Math.max(0, current - activeStartedAt) : 0;
    const end = stoppedAt || current;
    return {
      started_at: new Date(startedTimestamp).toISOString(),
      ended_at: stoppedAt ? new Date(stoppedAt).toISOString() : null,
      duration_sec: seconds(end - startedTimestamp),
      active_duration_sec: seconds(activeMs + liveActive),
    };
  }

  const api = {
    pause,
    resume,
    stop() {
      if (!stoppedAt) {
        pause();
        stoppedAt = nowMs();
        clocks.delete(api);
      }
      return snapshot();
    },
    snapshot,
    handleVisibilityChange() {
      if (document.visibilityState === "hidden") pause();
      else resume();
    },
  };

  clocks.add(api);
  return api;
}
