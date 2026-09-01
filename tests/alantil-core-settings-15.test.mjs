import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeUserSettings, settingsCloudPayload } from '../packages/alantil-core/settings.js';

test('shared settings normalize common values', () => {
  const settings = normalizeUserSettings({ interface_language_code: 'tr', translation_language_code: 'en', alan_script_code: 'turkic', alan_dialect_code: 'balkar', text_size_code: 'large' });
  assert.equal(settings.interface_language_code, 'tr');
  assert.equal(settings.translation_language_code, 'en');
  assert.equal(settings.alan_script_code, 'turkic');
  assert.equal(settings.alan_dialect_code, 'balkar');
  assert.equal(settings.text_size_code, 'large');
});

test('shared settings cloud payload excludes mobile-only onboarding state', () => {
  const payload = settingsCloudPayload({ interface_language_code: 'en', updated_at: '2026-09-01T12:00:00Z' }, 'user-1');
  assert.equal(payload.user_id, 'user-1');
  assert.equal(payload.interface_language_code, 'en');
  assert.equal(payload.updated_at, '2026-09-01T12:00:00.000Z');
  assert.equal('onboarding_step' in payload, false);
});
