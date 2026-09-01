export const VISIT_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StoredVisitSession = {
  sessionId: string;
  lastActivityAt: number;
  scopeId: string;
};

export type VisitIdentity = {
  visitorId: string;
  session: StoredVisitSession;
  isNewSession: boolean;
};

export function validVisitUuid(value: unknown) {
  return UUID_PATTERN.test(String(value ?? ''));
}

export function createVisitUuid(random: () => number = Math.random) {
  const bytes = Array.from({ length: 16 }, () => Math.max(0, Math.min(255, Math.floor(random() * 256))));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((value) => value.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

function cleanScopeId(value: unknown) {
  const scopeId = String(value ?? '').trim();
  return validVisitUuid(scopeId) ? scopeId : '';
}

export function resolveVisitIdentity({
  visitorId,
  previousSession,
  scopeId,
  nowMs = Date.now(),
  uuidFactory = createVisitUuid,
}: {
  visitorId?: unknown;
  previousSession?: Partial<StoredVisitSession> | null;
  scopeId?: unknown;
  nowMs?: number;
  uuidFactory?: () => string;
}): VisitIdentity {
  const resolvedVisitorId = validVisitUuid(visitorId) ? String(visitorId) : uuidFactory();
  if (!validVisitUuid(resolvedVisitorId)) throw new Error('Visit UUID factory returned an invalid visitor id.');

  const normalizedScope = cleanScopeId(scopeId);
  const previousScope = cleanScopeId(previousSession?.scopeId);
  const previousLastActivity = Number(previousSession?.lastActivityAt);
  const elapsed = Number(nowMs) - previousLastActivity;
  const previousValid = validVisitUuid(previousSession?.sessionId) && Number.isFinite(previousLastActivity);
  const scopeCompatible = previousValid && (
    previousScope === normalizedScope
    || (!previousScope && Boolean(normalizedScope))
  );
  const reuse = scopeCompatible && elapsed >= 0 && elapsed <= VISIT_SESSION_TIMEOUT_MS;
  const sessionId = reuse ? String(previousSession?.sessionId) : uuidFactory();
  if (!validVisitUuid(sessionId)) throw new Error('Visit UUID factory returned an invalid session id.');

  return {
    visitorId: resolvedVisitorId,
    session: { sessionId, lastActivityAt: Number(nowMs), scopeId: normalizedScope },
    isNewSession: !reuse,
  };
}

export function cleanVisitPath(value: unknown) {
  const raw = String(value || '/').split('?')[0].split('#')[0].trim();
  return raw.startsWith('/') ? raw.slice(0, 300) || '/' : '/';
}

export function cleanVisitAppVersion(value: unknown) {
  const version = String(value || 'unknown').trim().replace(/[^0-9A-Za-z._-]/g, '').slice(0, 32);
  return version || 'unknown';
}
