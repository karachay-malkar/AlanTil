import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  cleanVisitAppVersion,
  cleanVisitPath,
  createVisitUuid,
  resolveVisitIdentity,
  VISIT_SESSION_TIMEOUT_MS,
} from '../src/mobile/visitor-policy.ts';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const visitorId = '11111111-1111-4111-8111-111111111111';
const guestSessionId = '22222222-2222-4222-8222-222222222222';
const nextSessionId = '33333333-3333-4333-8333-333333333333';
const userId = '44444444-4444-4444-8444-444444444444';

test('visit identity reuses a fresh guest session when an account is attached', () => {
  const identity = resolveVisitIdentity({
    visitorId,
    previousSession: { sessionId: guestSessionId, lastActivityAt: 100, scopeId: '' },
    scopeId: userId,
    nowMs: 200,
    uuidFactory: () => nextSessionId,
  });
  assert.equal(identity.visitorId, visitorId);
  assert.equal(identity.session.sessionId, guestSessionId);
  assert.equal(identity.session.scopeId, userId);
  assert.equal(identity.isNewSession, false);
});

test('visit identity starts a new session after timeout, sign-out or account switch', () => {
  const previous = { sessionId: guestSessionId, lastActivityAt: 100, scopeId: userId };
  const afterTimeout = resolveVisitIdentity({ visitorId, previousSession: previous, scopeId: userId, nowMs: 101 + VISIT_SESSION_TIMEOUT_MS, uuidFactory: () => nextSessionId });
  const afterSignOut = resolveVisitIdentity({ visitorId, previousSession: previous, scopeId: '', nowMs: 200, uuidFactory: () => nextSessionId });
  const otherUser = resolveVisitIdentity({ visitorId, previousSession: previous, scopeId: visitorId, nowMs: 200, uuidFactory: () => nextSessionId });
  assert.equal(afterTimeout.session.sessionId, nextSessionId);
  assert.equal(afterSignOut.session.sessionId, nextSessionId);
  assert.equal(otherUser.session.sessionId, nextSessionId);
});

test('visit values are bounded before calling the protected RPC', () => {
  assert.equal(cleanVisitPath('/path?word=secret#row'), '/path');
  assert.equal(cleanVisitPath('invalid'), '/');
  assert.equal(cleanVisitAppVersion(' 14.2.0 dangerous! '), '14.2.0dangerous');
  assert.match(createVisitUuid(() => 0.5), /^[0-9a-f-]{36}$/);
});

test('mobile tracker queues technical visits and sends them through the existing RPC', async () => {
  const [tracker, transport] = await Promise.all([
    read('src/mobile/analytics-tracker.tsx'),
    read('src/mobile/visitor-analytics.ts'),
  ]);
  assert.match(tracker, /recordMobilePageView/);
  assert.match(tracker, /flushMobilePageViews/);
  assert.match(transport, /record_anonymous_visit/);
  assert.match(transport, /QUEUE_STORAGE_KEY/);
  assert.match(transport, /scopeCanFlush/);
  assert.doesNotMatch(transport, /service_role/);
});
