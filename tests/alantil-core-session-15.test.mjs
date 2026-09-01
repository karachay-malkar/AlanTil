import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authProviderCode,
  normalizeOAuthProvider,
  readAuthCallback,
  sameAuthSession,
  sameAuthState,
  sameAuthUser,
} from '../packages/alantil-core/session.js';

test('shared callback contract reads web URLSearchParams', () => {
  const callback = readAuthCallback(new URLSearchParams('code=abc&sb_flow_id=flow-1'));
  assert.deepEqual(callback, {
    code: 'abc',
    error: '',
    errorCode: '',
    flowId: 'flow-1',
    present: true,
  });
});

test('shared callback contract reads native query objects and OAuth errors', () => {
  assert.deepEqual(readAuthCallback({ error: 'access_denied', error_description: 'Cancelled' }), {
    code: '',
    error: 'Cancelled',
    errorCode: '',
    flowId: '',
    present: true,
  });
});

test('OAuth provider normalization is identical across clients', () => {
  assert.equal(normalizeOAuthProvider(' Google '), 'google');
  assert.equal(normalizeOAuthProvider('APPLE'), 'apple');
  assert.equal(normalizeOAuthProvider('email'), '');
  assert.equal(authProviderCode({ app_metadata: { provider: 'Google' } }), 'google');
});

test('auth identity comparison matches web session semantics', () => {
  const user = { id: 'u1', email: 'a@example.test', app_metadata: { provider: 'google' } };
  const session = { access_token: 'a', refresh_token: 'r', expires_at: 123, user };
  assert.equal(sameAuthUser(user, { ...user }), true);
  assert.equal(sameAuthUser(user, { ...user, email: 'b@example.test' }), false);
  assert.equal(sameAuthSession(session, { ...session, user: { ...user } }), true);
  assert.equal(sameAuthSession(session, { ...session, access_token: 'b' }), false);
  assert.equal(sameAuthState(
    { ready: true, error: null, session, user },
    { ready: true, error: null, session: { ...session }, user: { ...user } },
  ), true);
});
