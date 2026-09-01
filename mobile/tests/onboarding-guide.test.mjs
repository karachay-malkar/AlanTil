import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../src/mobile/', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const readRepo = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('first launch persists setup, account choice and guide stages', async () => {
  const [onboarding, settings, settingsCoreTypes, settingsCore] = await Promise.all([
    read('onboarding.tsx'),
    read('settings.tsx'),
    readRepo('packages/alantil-core/settings.d.ts'),
    readRepo('packages/alantil-core/settings.js'),
  ]);
  assert.match(settings, /packages\/alantil-core\/settings\.js/);
  assert.match(settingsCoreTypes, /onboarding_step: OnboardingStep/);
  assert.match(settingsCoreTypes, /onboarding_access_mode: OnboardingAccessMode/);
  assert.match(settingsCore, /onboarding_step: 'done'/);
  assert.match(onboarding, /saveConfiguration/);
  assert.match(onboarding, /chooseAccess\('account'\)/);
  assert.match(onboarding, /chooseAccess\('guest'\)/);
  assert.match(onboarding, /auth\.signInWithGoogle\(\)/);
  assert.match(onboarding, /<GuideCarousel onDone=\{finishGuide\} onSkip=\{finishGuide\}/);
});

test('general guide is repeatable from Path and uses the shared web guide flow', async () => {
  const [guide, path, layout, guideCore] = await Promise.all([
    read('guide.tsx'),
    read('path.tsx'),
    read('../../app/_layout.tsx'),
    readRepo('packages/alantil-core/guide.js'),
  ]);
  assert.match(layout, /<GuideProvider>/);
  assert.match(path, /const \{ openGuide \} = useGuide\(\)/);
  assert.match(path, /accessibilityLabel=\{t\('guide\.help_app'\)\}/);
  assert.match(guide, /GENERAL_GUIDE_STEPS/);
  assert.match(guide, /guideMessage/);
  for (const key of [
    'guide.general.intro.title',
    'guide.story.oblivion.title',
    'guide.story.roots.title',
    'guide.story.ascent.title',
    'guide.story.pathways.title',
    'guide.general.stages.title',
    'guide.general.study.title',
    'guide.general.test.title',
    'guide.learning.card.title',
    'guide.learning.decision.title',
    'guide.learning.favorite.title',
  ]) {
    assert.match(guideCore, new RegExp(key.replaceAll('.', '\\.')));
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
