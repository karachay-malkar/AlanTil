import test from "node:test";
import assert from "node:assert/strict";

const storage = new Map();
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
  clear() { storage.clear(); },
};

const progress = await import("../src/shared/progress/word-progress-store.js");

test("local progress is idempotent per session and never decreases on cloud merge", () => {
  storage.clear();

  assert.equal(progress.recordLearnWordResults("learn-1", [{
    word_id: "0012",
    show_count: 3,
    left_swipe_count: 1,
    final_result: "known",
  }], "2026-07-16T10:00:00.000Z"), true);
  assert.equal(progress.recordLearnWordResults("learn-1", [{
    word_id: "0012",
    show_count: 99,
    left_swipe_count: 99,
    final_result: "known",
  }], "2026-07-16T10:00:00.000Z"), false);

  progress.recordTestWordResults({
    sessionId: "test-1",
    answers: [{ word_id: "0012", result: "wrong" }],
    completedAt: "2026-07-16T11:00:00.000Z",
  });
  progress.recordMatchWordResults("match-1", [{
    word_id: "0012",
    matched: true,
    error_count: 2,
  }], "2026-07-16T12:00:00.000Z");

  let row = progress.getWordProgress("0012");
  assert.equal(row.sessions_total, 3);
  assert.equal(row.study_shown_count, 3);
  assert.equal(row.known_count, 1);
  assert.equal(row.unknown_count, 1);
  assert.equal(row.test_wrong_count, 1);
  assert.equal(row.match_success_total, 1);
  assert.equal(row.match_errors_total, 2);

  progress.mergeCloudWordProgress([{
    word_id: "0012",
    sessions_total: 1,
    study_shown_count: 1,
    known_count: 0,
    test_wrong_count: 0,
    mastery_status: "not_started",
  }]);
  row = progress.getWordProgress("0012");
  assert.equal(row.sessions_total, 3);
  assert.equal(row.study_shown_count, 3);
  assert.equal(row.known_count, 1);

  progress.mergeCloudWordProgress([{
    word_id: "0012",
    sessions_total: 8,
    study_shown_count: 11,
    known_count: 5,
    mastery_status: "mastered",
    mastered_at: "2026-07-16T13:00:00.000Z",
  }]);
  row = progress.getWordProgress("0012");
  assert.equal(row.sessions_total, 8);
  assert.equal(row.study_shown_count, 11);
  assert.equal(row.known_count, 5);
  assert.equal(row.mastery_status, "mastered");
  assert.equal(progress.getWordProgressSnapshotRows().length, 1);
});

test("only a station test changes mastery and later station errors require review", () => {
  storage.clear();

  progress.recordTestWordResults({
    sessionId: "ordinary-test",
    answers: [{ word_id: "0042", result: "correct" }],
    accuracy: 100,
    updateMastery: false,
    completedAt: "2026-07-16T14:00:00.000Z",
  });
  assert.equal(progress.getWordProgress("0042").mastery_status, "learning");

  progress.recordTestWordResults({
    sessionId: "station-pass",
    answers: [{ word_id: "0042", result: "correct" }],
    accuracy: 100,
    updateMastery: true,
    completedAt: "2026-07-16T15:00:00.000Z",
  });
  assert.equal(progress.getWordProgress("0042").mastery_status, "mastered");

  progress.recordTestWordResults({
    sessionId: "station-review",
    answers: [{ word_id: "0042", result: "wrong" }],
    accuracy: 0,
    updateMastery: true,
    completedAt: "2026-07-16T16:00:00.000Z",
  });
  assert.equal(progress.getWordProgress("0042").mastery_status, "review");
});
