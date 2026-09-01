import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  crossedSongThresholds,
  filterSongs,
  pairLyrics,
  parseLyricsBlocks,
  tokenizeSongLine,
  wordForms,
} from '../src/mobile/songs/policy.ts';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('lyrics recognize verses, choruses and repeated chorus markers', () => {
  const blocks = parseLyricsBlocks('Verse 1:\nFirst\nSecond\n\nChorus:\nReturn\nAgain\n\nChorus:');
  assert.deepEqual(blocks, [
    { type: 'verse', lines: ['First', 'Second'], repeated: false },
    { type: 'chorus', lines: ['Return', 'Again'], repeated: false },
    { type: 'chorus', lines: ['Return', 'Again'], repeated: true },
  ]);
});

test('original and translation lines remain paired even when counts differ', () => {
  const blocks = pairLyrics('A\nB\nC', 'One\nTwo');
  assert.deepEqual(blocks[0].lines, [
    { original: 'A', translation: 'One' },
    { original: 'B', translation: 'Two' },
    { original: 'C', translation: '' },
  ]);
});

test('song tokens retain punctuation and expose dictionary-compatible forms', () => {
  const tokens = tokenizeSongLine("Салам, джол-д'а!");
  assert.equal(tokens.map((token) => token.text).join(''), "Салам, джол-д'а!");
  assert.equal(tokens.filter((token) => token.wordLike).length, 2);
  const forms = wordForms({ word_alan_cyrillic: 'Җол', word_alan_turkic: 'Col' });
  assert.ok(forms.includes('жол'));
  assert.ok(forms.includes('джол'));
  assert.ok(forms.includes('col'));
});

test('catalog search respects its selected field', () => {
  const songs = [
    { title: 'Mountain', artist: 'Aida', lyrics: 'snow' },
    { title: 'River', artist: 'Murat', lyrics: 'mountain road' },
  ];
  assert.deepEqual(filterSongs(songs, 'mountain', 'title').map((song) => song.title), ['Mountain']);
  assert.deepEqual(filterSongs(songs, 'mountain', 'lyrics').map((song) => song.title), ['River']);
  assert.deepEqual(filterSongs(songs, 'aida', 'artist').map((song) => song.title), ['Mountain']);
});

test('audio progress emits each web threshold once', () => {
  assert.deepEqual(crossedSongThresholds(52, 100, new Set([25])), [50]);
  assert.deepEqual(crossedSongThresholds(95, 100, new Set([25, 50])), [75, 90]);
  assert.deepEqual(crossedSongThresholds(10, 0, new Set()), []);
});

test('songs screen implements the web interaction contract without embedded Russian UI', async () => {
  const [screen, repository, storage] = await Promise.all([
    read('src/mobile/songs.tsx'),
    read('src/mobile/songs/repository.ts'),
    read('src/mobile/storage.ts'),
  ]);
  assert.doesNotMatch(screen, /[А-Яа-яЁё]/);
  assert.match(screen, /readSongCatalogState/);
  assert.match(screen, /writeSongCatalogState/);
  assert.match(screen, /searchOpen/);
  assert.match(screen, /'title'.*'artist'.*'lyrics'/s);
  assert.match(screen, /player\.seekTo/);
  assert.match(screen, /status\.error/);
  assert.match(screen, /song_progress/);
  assert.match(screen, /song_complete/);
  assert.match(screen, /pairLyrics/);
  assert.match(screen, /InteractiveSongLine/);
  assert.match(screen, /WordCardModal/);
  assert.match(screen, /SongInformationModal/);
  assert.doesNotMatch(screen, /<Image/);
  assert.match(repository, /REQUEST_TIMEOUT_MS/);
  assert.match(repository, /void refreshSongs\(\)\.catch/);
  assert.match(storage, /songsCatalogState/);
});
