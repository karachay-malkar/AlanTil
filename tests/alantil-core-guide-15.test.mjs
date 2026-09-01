import assert from 'node:assert/strict';
import test from 'node:test';

import { GENERAL_GUIDE_STEPS, GUIDE_STORY_SEQUENCE, guideMessage, stripGuideMarkup } from '../packages/alantil-core/guide.js';

test('mobile general guide follows the exact web flow order', () => {
  assert.deepEqual(GUIDE_STORY_SEQUENCE, ['oblivion', 'roots', 'ascent', 'pathways']);
  assert.deepEqual(GENERAL_GUIDE_STEPS.map((step) => step.id), [
    'intro', 'stories', 'story-oblivion', 'story-roots', 'story-ascent', 'story-pathways', 'summary', 'stages', 'study', 'test',
  ]);
});

test('guide messages use web copy and interpolate the pass threshold', () => {
  assert.equal(guideMessage('ru', 'guide.general.intro.title'), 'Ассаламу алейкум, алан!');
  const body = guideMessage('ru', 'guide.general.test.body', { required: 80 }, { plain: true });
  assert.match(body, /не менее 80%/);
  assert.equal(body.includes('<p>'), false);
});

test('guide markup becomes native-safe readable text', () => {
  assert.equal(stripGuideMarkup('<p>Один <strong>два</strong>.</p><p>Три.</p>'), 'Один два.\nТри.');
});
