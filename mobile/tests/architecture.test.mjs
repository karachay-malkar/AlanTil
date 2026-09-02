import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function collectJs(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      files.push(...await collectJs(full));
    } else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

const files = await collectJs(root);
const sourceEntries = await Promise.all(files.map(async (file) => [path.relative(root, file), await readFile(file, 'utf8')]));
const source = sourceEntries.map(([,value]) => value).join('\n');
const app = await readFile(path.join(root, 'AppRoot.js'), 'utf8');

test('Mobile 16.1 is a thin UI/platform layer over alantil-core', () => {
  const requiredCoreModules = ['test','match','favorites','learning-route','word-normalizer','settings'];
  for (const module of requiredCoreModules) assert.match(source, new RegExp(`packages/alantil-core/${module}\\.js`));
  assert.match(source, /packages\/alantil-core\/station-test\.js/);
  assert.match(source, /packages\/alantil-core\/learning\.js/);
  assert.match(source, /packages\/alantil-core\/profile\.js/);
  assert.match(source, /packages\/alantil-core\/songs\.js/);
});

test('Mobile 16.1 consumes the Web starter dictionary instead of copying a dictionary', () => {
  assert.match(app, /\.\.\/src\/data\/starter-dictionary\.js/);
  for (const [file,content] of sourceEntries) {
    if (file === 'AppRoot.js') continue;
    assert.doesNotMatch(content, /const\s+ROWS\s*=|STARTER_DICTIONARY\s*=\s*\[/, `copied dictionary in ${file}`);
  }
});

test('Game business algorithms are not reimplemented inside mobile', () => {
  const forbidden = [
    /function\s+buildTestOptions\s*\(/,
    /function\s+initializeTestState\s*\(/,
    /function\s+initializeMatchState\s*\(/,
    /function\s+recordMatchMismatch\s*\(/,
    /function\s+buildStationTestSessionState\s*\(/,
    /function\s+initializeLearnState\s*\(/,
    /function\s+buildLearningRoute\s*\(/,
    /function\s+normalizeLegacyWordEntry\s*\(/,
  ];
  for (const [file,content] of sourceEntries) {
    for (const pattern of forbidden) assert.doesNotMatch(content, pattern, `business algorithm duplicated in ${file}`);
  }
});

test('Mobile 16.1 has platform adapters and Web-parity screen modules', () => {
  const names = new Set(sourceEntries.map(([file]) => file.replaceAll('\\','/')));
  for (const expected of [
    'platform/storage.js',
    'screens/onboarding.js',
    'screens/station.js',
    'screens/learn.js',
    'screens/station-test.js',
    'screens/practice-games.js',
    'screens/profile.js',
    'screens/songs.js',
    'ui/theme.js',
    'ui/components.js',
    'ui/icons.js',
  ]) assert.ok(names.has(expected), `missing ${expected}`);
});
