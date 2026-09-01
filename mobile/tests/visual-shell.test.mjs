import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('the Expo-compatible native SVG renderer is pinned', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  assert.equal(packageJson.dependencies['react-native-svg'], '15.15.4');
});

test('official icon paths replace primitive tab and Practice drawings', async () => {
  const [icons, chrome, practice] = await Promise.all([
    read('src/mobile/icons.tsx'),
    read('src/mobile/chrome.tsx'),
    read('src/mobile/shell.tsx'),
  ]);
  assert.match(icons, /from 'react-native-svg'/);
  for (const name of ['practice', 'profile', 'test', 'match', 'favorite', 'songs', 'back']) {
    assert.match(icons, new RegExp(`${name}:`));
  }
  assert.match(chrome, /<AlanIcon/);
  assert.doesNotMatch(chrome, /PracticeIcon|ProfileIcon|practiceSquare|profileHead/);
  assert.match(practice, /\['test'/);
  assert.match(practice, /\['match'/);
  assert.match(practice, /\['favorite'/);
  assert.match(practice, /\['songs'/);
});

test('core headers and Path controls use shared vector icons', async () => {
  const [common, path, station, learn] = await Promise.all([
    read('src/mobile/practice/common.tsx'),
    read('src/mobile/path.tsx'),
    read('src/mobile/station.tsx'),
    read('src/mobile/learn/engine.tsx'),
  ]);
  assert.match(common, /name="back"/);
  assert.match(station, /name="back"/);
  assert.match(learn, /name="back"/);
  assert.match(path, /name="list"/);
  assert.match(path, /name="artifact"/);
  assert.match(path, /name="help"/);
});
