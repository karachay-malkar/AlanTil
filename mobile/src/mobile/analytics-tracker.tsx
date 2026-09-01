import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { trackMobileEvent } from '@/src/mobile/analytics';
import { useSession } from '@/src/mobile/session';
import { flushMobilePageViews, recordMobilePageView } from '@/src/mobile/visitor-analytics';

type ScreenRuntime = {
  path: string;
  userId: string | null;
  activeStartedMs: number;
  activeDurationMs: number;
};

function finishActive(runtime: ScreenRuntime, at = Date.now()) {
  if (!runtime.activeStartedMs) return;
  runtime.activeDurationMs += Math.max(0, at - runtime.activeStartedMs);
  runtime.activeStartedMs = 0;
}

function resumeActive(runtime: ScreenRuntime, at = Date.now()) {
  if (runtime.activeStartedMs) return;
  runtime.activeStartedMs = at;
}

function flushScreen(runtime: ScreenRuntime) {
  finishActive(runtime);
  const duration = Math.max(0, Math.round(runtime.activeDurationMs / 1000));
  if (runtime.path && duration > 0) void trackMobileEvent('screen_time', { screen_name: runtime.path, duration_sec: duration }, runtime.userId);
}

export function MobileAnalyticsTracker() {
  const pathname = usePathname();
  const auth = useSession();
  const runtimeRef = useRef<ScreenRuntime>({
    path: '',
    userId: auth.user?.id ?? null,
    activeStartedMs: AppState.currentState === 'active' ? Date.now() : 0,
    activeDurationMs: 0,
  });

  useEffect(() => {
    const previous = runtimeRef.current;
    if (previous.path && (previous.path !== pathname || previous.userId !== (auth.user?.id ?? null))) flushScreen(previous);
    const next: ScreenRuntime = {
      path: pathname,
      userId: auth.user?.id ?? null,
      activeStartedMs: AppState.currentState === 'active' ? Date.now() : 0,
      activeDurationMs: 0,
    };
    runtimeRef.current = next;
    void trackMobileEvent('page_view', { screen_name: pathname, page_path: pathname }, next.userId);
    void recordMobilePageView({ pagePath: pathname, userId: next.userId });
  }, [auth.user?.id, pathname]);

  useEffect(() => {
    const onState = (state: AppStateStatus) => {
      if (state === 'active') {
        resumeActive(runtimeRef.current);
        void flushMobilePageViews(runtimeRef.current.userId);
      }
      else finishActive(runtimeRef.current);
    };
    const subscription = AppState.addEventListener('change', onState);
    return () => {
      subscription.remove();
      flushScreen(runtimeRef.current);
    };
  }, []);

  return null;
}
