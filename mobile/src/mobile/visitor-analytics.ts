import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/src/lib/supabase';
import {
  cleanVisitAppVersion,
  cleanVisitPath,
  createVisitUuid,
  resolveVisitIdentity,
  type StoredVisitSession,
  validVisitUuid,
} from '@/src/mobile/visitor-policy';
import { APP_VERSION } from '@/src/mobile/version';

const VISITOR_STORAGE_KEY = 'alantil_mobile_analytics_visitor_id_v14_2_0';
const SESSION_STORAGE_KEY = 'alantil_mobile_analytics_session_v14_2_0';
const QUEUE_STORAGE_KEY = 'alantil_mobile_analytics_visit_queue_v14_2_0';
const QUEUE_LIMIT = 100;

type QueuedPageView = {
  id: string;
  visitorId: string;
  sessionId: string;
  scopeId: string;
  pagePath: string;
  appVersion: string;
};

let operationTail: Promise<void> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>) {
  const running = operationTail.catch(() => undefined).then(operation);
  operationTail = running.then(() => undefined, () => undefined);
  return running;
}

function runtimeUuid() {
  const cryptoApi = globalThis.crypto as { randomUUID?: () => string } | undefined;
  const uuid = cryptoApi?.randomUUID?.();
  return typeof uuid === 'string' && validVisitUuid(uuid) ? uuid : createVisitUuid();
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function readQueue() {
  const rows = await readJson<QueuedPageView[]>(QUEUE_STORAGE_KEY, []);
  return Array.isArray(rows) ? rows.filter((row) => (
    validVisitUuid(row?.visitorId)
    && validVisitUuid(row?.sessionId)
    && typeof row?.pagePath === 'string'
  )).slice(-QUEUE_LIMIT) : [];
}

function scopeCanFlush(eventScopeId: string, currentScopeId: string) {
  return !eventScopeId || eventScopeId === currentScopeId;
}

async function flushQueue(currentScopeId: string) {
  const queue = await readQueue();
  if (!queue.length) return true;

  const remaining: QueuedPageView[] = [];
  let networkFailed = false;
  for (const event of queue) {
    if (networkFailed || !scopeCanFlush(event.scopeId, currentScopeId)) {
      remaining.push(event);
      continue;
    }
    try {
      const { error } = await supabase.rpc('record_anonymous_visit', {
        p_visitor_id: event.visitorId,
        p_session_id: event.sessionId,
        p_page_path: event.pagePath,
        p_referrer_host: null,
        p_app_version: event.appVersion,
      });
      if (error) throw error;
    } catch {
      networkFailed = true;
      remaining.push(event);
    }
  }
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remaining.slice(-QUEUE_LIMIT)));
  return !networkFailed;
}

export function flushMobilePageViews(userId?: string | null) {
  const scopeId = validVisitUuid(userId) ? String(userId) : '';
  return serialize(() => flushQueue(scopeId));
}

export function recordMobilePageView({ pagePath, userId }: { pagePath: string; userId?: string | null }) {
  return serialize(async () => {
    const [storedVisitorId, storedSession, queue] = await Promise.all([
      AsyncStorage.getItem(VISITOR_STORAGE_KEY),
      readJson<StoredVisitSession | null>(SESSION_STORAGE_KEY, null),
      readQueue(),
    ]);
    const identity = resolveVisitIdentity({
      visitorId: storedVisitorId,
      previousSession: storedSession,
      scopeId: userId,
      uuidFactory: runtimeUuid,
    });
    const appVersion = cleanVisitAppVersion(APP_VERSION);
    const event: QueuedPageView = {
      id: runtimeUuid(),
      visitorId: identity.visitorId,
      sessionId: identity.session.sessionId,
      scopeId: identity.session.scopeId,
      pagePath: cleanVisitPath(pagePath),
      appVersion,
    };
    await AsyncStorage.multiSet([
      [VISITOR_STORAGE_KEY, identity.visitorId],
      [SESSION_STORAGE_KEY, JSON.stringify(identity.session)],
      [QUEUE_STORAGE_KEY, JSON.stringify([...queue, event].slice(-QUEUE_LIMIT))],
    ]);
    return flushQueue(identity.session.scopeId);
  });
}

export const mobileVisitorAnalyticsConfig = Object.freeze({
  visitorStorageKey: VISITOR_STORAGE_KEY,
  sessionStorageKey: SESSION_STORAGE_KEY,
  queueStorageKey: QUEUE_STORAGE_KEY,
});
