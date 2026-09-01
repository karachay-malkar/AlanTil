import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('stage, station test, Test and Match contain no hard-coded Cyrillic UI copy', async () => {
  const sources = await Promise.all([
    read('src/mobile/station.tsx'),
    read('src/mobile/learn/station-test.tsx'),
    read('src/mobile/practice/test.tsx'),
    read('src/mobile/practice/match.tsx'),
    read('src/mobile/practice/common.tsx'),
  ]);
  sources.forEach((source) => {
    assert.doesNotMatch(source, /[А-Яа-яЁё]/);
    assert.match(source, /useI18n/);
  });
});

test('Test and Match retain retryable state when local persistence fails', async () => {
  const [testSource, matchSource] = await Promise.all([
    read('src/mobile/practice/test.tsx'),
    read('src/mobile/practice/match.tsx'),
  ]);
  assert.match(testSource, /const next: TestSessionState/);
  assert.match(testSource, /await persistActiveSession\(next\.runtime, sessionPayload\(next\)\)/);
  assert.match(testSource, /completionPending/);
  assert.match(testSource, /test\.save_error/);
  assert.match(matchSource, /const solved = new Set\(session\.solved\)/);
  assert.match(matchSource, /const failMap = \{ \.\.\.session\.failMap \}/);
  assert.match(matchSource, /completionPending/);
  assert.match(matchSource, /match\.save_error/);
});

test('long Test and Match labels use the shared reduced-motion marquee', async () => {
  const [testSource, matchSource] = await Promise.all([
    read('src/mobile/practice/test.tsx'),
    read('src/mobile/practice/match.tsx'),
  ]);
  assert.match(testSource, /<OverflowMarquee style=\{styles\.question\}>/);
  assert.match(testSource, /<OverflowMarquee style=\{\[styles\.optionText/);
  assert.match(matchSource, /<OverflowMarquee style=\{\[styles\.matchCardText/);
});
