import test from "node:test";
import assert from "node:assert/strict";
import { buildStationLearningStatistics } from "../packages/alantil-core/statistics.js";

const station = {
  dictionaryId: "middle",
  sectionId: "roots",
  setId: "set-1",
  words: [
    { id: "w1", word: "тау", trans: "гора" },
    { id: "w2", word: "юй", trans: "дом" },
  ],
};

const base = { status: "completed", dictionary_id: "middle", section_id: "roots", set_id: "set-1" };

test("station learning statistics calculate first-try recall for every completed learning session", () => {
  const rows = [
    { ...base, id: "learn-1", type: "learn", ended_at: "2026-10-01T10:00:00Z", words: [
      { word_id: "w1", show_count: 4, left_swipe_count: 3, final_result: "known" },
      { word_id: "w2", show_count: 1, left_swipe_count: 0, final_result: "known" },
    ] },
    { ...base, id: "interrupted", type: "learn", status: "interrupted", ended_at: "2026-10-02T10:00:00Z", words: [
      { word_id: "w1", show_count: 99, left_swipe_count: 98, final_result: "known" },
    ] },
    { ...base, id: "learn-2", type: "learn", ended_at: "2026-10-03T10:00:00Z", words: [
      { word_id: "w1", show_count: 2, left_swipe_count: 1, final_result: "known" },
      { word_id: "w2", show_count: 1, left_swipe_count: 0, final_result: "known" },
    ] },
  ];
  const stats = buildStationLearningStatistics(rows, station);
  assert.equal(stats.learn.length, 2);
  assert.equal(stats.learn[0].firstTryPercent, 50);
  assert.equal(stats.learn[0].showsPerWord, 2.5);
  assert.equal(stats.learn[1].firstTryPercent, 50);
  assert.equal(stats.learn[1].showsPerWord, 1.5);
});

test("first-try recall covers 100 percent, zero percent and ignores interrupted sessions", () => {
  const rows = [
    { ...base, id: "all-first", type: "learn", ended_at: "2026-10-01T10:00:00Z", words: [
      { word_id: "w1", show_count: 1, left_swipe_count: 0, final_result: "known" },
      { word_id: "w2", show_count: 1, left_swipe_count: 0, final_result: "known" },
    ] },
    { ...base, id: "none-first", type: "learn", ended_at: "2026-10-02T10:00:00Z", words: [
      { word_id: "w1", show_count: 2, left_swipe_count: 1, final_result: "known" },
      { word_id: "w2", show_count: 3, left_swipe_count: 2, final_result: "known" },
    ] },
    { ...base, id: "ignored", type: "learn", status: "interrupted", ended_at: "2026-10-03T10:00:00Z", words: [
      { word_id: "w1", show_count: 1, left_swipe_count: 0, final_result: "known" },
      { word_id: "w2", show_count: 1, left_swipe_count: 0, final_result: "known" },
    ] },
  ];
  const stats = buildStationLearningStatistics(rows, station);
  assert.deepEqual(stats.learn.map((row) => row.firstTryPercent), [100, 0]);
});

test("first-try recall uses only words actually shown in the completed session", () => {
  const rows = [{ ...base, id: "partial", type: "learn", ended_at: "2026-10-01T10:00:00Z", words: [
    { word_id: "w1", show_count: 1, final_result: "known" },
    { word_id: "w2", show_count: 0, final_result: "unfinished" },
  ] }];
  const stats = buildStationLearningStatistics(rows, station);
  assert.equal(stats.learn[0].firstTryPercent, 100);
  assert.equal(stats.learn[0].wordCount, 1);
});


test("station problem words average completed learning shows and count completed test errors", () => {
  const rows = [
    { ...base, id: "learn-1", type: "learn", ended_at: "2026-10-01T10:00:00Z", words: [
      { word_id: "w1", show_count: 4, final_result: "known" },
      { word_id: "w2", show_count: 1, final_result: "known" },
    ] },
    { ...base, id: "learn-2", type: "learn", ended_at: "2026-10-02T10:00:00Z", words: [
      { word_id: "w1", show_count: 2, final_result: "known" },
      { word_id: "w2", show_count: 1, final_result: "known" },
    ] },
    { ...base, id: "test-1", type: "station_test", ended_at: "2026-10-03T10:00:00Z", correct_total: 1, wrong_total: 1, words: [
      { word_id: "w1", result: "wrong" },
      { word_id: "w2", result: "correct" },
    ] },
    { ...base, id: "test-interrupted", type: "station_test", status: "interrupted", ended_at: "2026-10-04T10:00:00Z", correct_total: 0, wrong_total: 2, words: [
      { word_id: "w1", result: "wrong" },
      { word_id: "w2", result: "wrong" },
    ] },
  ];
  const stats = buildStationLearningStatistics(rows, station);
  assert.deepEqual(stats.problems.map(({ wordId, showsPerWord, testErrors }) => ({ wordId, showsPerWord, testErrors })), [
    { wordId: "w1", showsPerWord: 3, testErrors: 1 },
  ]);
  assert.equal(stats.tests.length, 1);
  assert.equal(stats.tests[0].percent, 50);
});

test("station tests can preserve legacy percentage-only history", () => {
  const rows = [{ ...base, id: "legacy", type: "station_test", ended_at: "2026-09-01T10:00:00Z", accuracy: 87 }];
  const stats = buildStationLearningStatistics(rows, station);
  assert.equal(stats.tests[0].percent, 87);
  assert.equal(stats.tests[0].total, 0);
});
