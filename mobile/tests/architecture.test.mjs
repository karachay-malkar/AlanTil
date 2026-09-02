import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../App.js', import.meta.url), 'utf8');

test('Mobile 16.0 consumes Test Match and Favorites from shared Web core', () => {
  assert.match(app, /\.\.\/packages\/alantil-core\/test\.js/);
  assert.match(app, /\.\.\/packages\/alantil-core\/match\.js/);
  assert.match(app, /\.\.\/packages\/alantil-core\/favorites\.js/);
  assert.doesNotMatch(app, /function\s+buildTestOptions\s*\(/);
  assert.doesNotMatch(app, /function\s+applyTestAnswer\s*\(/);
  assert.doesNotMatch(app, /function\s+recordMatchMismatch\s*\(/);
  assert.doesNotMatch(app, /function\s+toggleFavorite\s*\(/);
});

test('Mobile 16.0 starts from the Web starter dictionary rather than a copied Mobile dictionary', () => {
  assert.match(app, /\.\.\/src\/data\/starter-dictionary\.js/);
  assert.doesNotMatch(app, /const\s+ROWS\s*=|STARTER_DICTIONARY\s*=\s*\[/);
});
