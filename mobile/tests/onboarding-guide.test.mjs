import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../src/mobile/', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('first launch persists setup, account choice and guide stages', async () => {
  const [onboarding, settings] = await Promise.all([
    read('onboarding.tsx'),
    read('settings.tsx'),
  ]);
  assert.match(settings, /onboarding_step: OnboardingStep/);
  assert.match(settings, /onboarding_access_mode: OnboardingAccessMode/);
  assert.match(settings, /onboarding_step: 'done'/);
  assert.match(onboarding, /saveConfiguration/);
  assert.match(onboarding, /chooseAccess\('account'\)/);
  assert.match(onboarding, /chooseAccess\('guest'\)/);
  assert.match(onboarding, /auth\.signInWithGoogle\(\)/);
  assert.match(onboarding, /<GuideCarousel onDone=\{finishGuide\} onSkip=\{finishGuide\}/);
});

test('general guide is repeatable from Path and covers the core learning controls', async () => {
  const [guide, path, layout] = await Promise.all([
    read('guide.tsx'),
    read('path.tsx'),
    read('../../app/_layout.tsx'),
  ]);
  assert.match(layout, /<GuideProvider>/);
  assert.match(path, /const \{ openGuide \} = useGuide\(\)/);
  assert.match(path, /accessibilityLabel=\{t\('guide\.help_app'\)\}/);
  for (const key of ['guide.card.title', 'guide.gestures.title', 'guide.favorite.title', 'guide.counter.title', 'guide.offline.title']) {
    assert.match(guide, new RegExp(key.replaceAll('.', '\\.')));
  }
});

test('mobile message catalog has complete RU, EN and TR values', async () => {
  const source = await read('i18n.ts');
  const messageLines = source.split('\n').filter((line) => /^\s+'[^']+': \{ ru: /.test(line));
  assert.ok(messageLines.length >= 40);
  messageLines.forEach((line) => {
    assert.match(line, /ru: ['"`]/);
    assert.match(line, /en: ['"`]/);
    assert.match(line, /tr: ['"`]/);
  });
  assert.match(source, /replace\(\/\\\{\(\[a-zA-Z0-9_\]\+\)\\\}\/g/);
});
