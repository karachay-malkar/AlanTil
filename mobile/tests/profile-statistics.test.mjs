import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildProfileStatistics } from '../src/mobile/profile/statistics-policy.ts';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('profile statistics follow the web summary contract', () => {
  const words = [
    { word_id: 'a', story_id: 's1', dictionary_id: 'd1' },
    { word_id: 'a', story_id: 's1', dictionary_id: 'd1' },
    { word_id: 'b', story_id: 's1', dictionary_id: 'd1' },
    { word_id: 'c', story_id: 's1', dictionary_id: 'd2' },
  ];
  const progress = [
    { word_id: 'a', mastery_status: 'mastered' },
    { word_id: 'b', mastery_status: 'review', study_shown_count: 4, unknown_count: 1 },
    { word_id: 'c', mastery_status: 'learning', study_shown_count: 2, unknown_count: 1, test_wrong_count: 1 },
  ];
  const history = [
    { type: 'learn', active_duration_sec: 120 },
    { type: 'test', active_duration_sec: 60, correct_total: 8, wrong_total: 2 },
    { type: 'station_test', active_duration_sec: 30, correct_total: 1, wrong_total: 1, status: 'interrupted' },
  ];
  const summary = buildProfileStatistics(words, progress, history);
  assert.equal(summary.masteredWords, 2);
  assert.equal(summary.completedDictionaries, 1);
  assert.equal(summary.activeSeconds, 210);
  assert.equal(summary.learnSessions, 1);
  assert.equal(summary.accuracy, 75);
  assert.equal(summary.reviewWords, 1);
  assert.deepEqual(summary.problemWords.map(({ word, errors, difficulty }) => [word.word_id, errors, difficulty]), [
    ['c', 2, 50],
    ['b', 1, 25],
  ]);
});

test('statistics and settings remain inside the Profile tab shell', async () => {
  const [tabs, profileLayout, navigation, statistics] = await Promise.all([
    read('app/(tabs)/_layout.tsx'),
    read('app/(tabs)/profile/_layout.tsx'),
    read('src/mobile/profile/navigation.tsx'),
    read('src/mobile/profile/statistics-screen.tsx'),
  ]);
  assert.match(tabs, /Tabs\.Screen name="profile"/);
  assert.match(profileLayout, /Stack\.Screen name="statistics"/);
  assert.match(profileLayout, /Stack\.Screen name="settings"/);
  assert.match(navigation, /accessibilityRole="tab"/);
  assert.match(statistics, /completedDictionaries/);
  assert.match(statistics, /activeSeconds/);
  assert.match(statistics, /learnSessions/);
  assert.match(statistics, /problemWords/);
  assert.match(statistics, /setFavorite/);
});
