import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { textSizeScale } from '../src/mobile/typography-policy.ts';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Small, Medium and Large have stable application-wide scales', () => {
  assert.equal(textSizeScale('small'), 0.9);
  assert.equal(textSizeScale('medium'), 1);
  assert.equal(textSizeScale('large'), 1.15);
});

test('core routes use the shared scalable Text component', async () => {
  const paths = [
    'src/mobile/chrome.tsx',
    'src/mobile/path.tsx',
    'src/mobile/station.tsx',
    'src/mobile/learn/engine.tsx',
    'src/mobile/practice/common.tsx',
    'src/mobile/songs.tsx',
    'src/mobile/profile/home-screen.tsx',
  ];
  for (const path of paths) {
    const source = await read(path);
    assert.match(source, /AppText as Text/, path);
  }
});
