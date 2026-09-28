import test from "node:test";
import assert from "node:assert/strict";

const storage = new Map();
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
};
globalThis.window = { location: { pathname: "/path/test" } };

const { createStationTestSession, distractorsFor } = await import("../src/features/path/station-test.js?v=16.8.0.8");

function word(id, pos, order) {
  return {
    id,
    pos,
    global_order: order,
    word: `word-${id}`,
    trans: `translation-${id}`,
    synonyms: [],
  };
}

test("stage test asks every stage word regardless of study checkboxes", () => {
  const stationWords = [word("s1", "noun", 1), word("s2", "verb", 2)];
  const routeWords = [
    ...stationWords,
    word("n1", "noun", 3), word("n2", "noun", 4), word("n3", "noun", 5),
    word("v1", "verb", 6), word("v2", "verb", 7), word("v3", "verb", 8),
    word("a1", "adjective", 9),
  ];
  const station = {
    key: "stage-1",
    words: stationWords,
    dictionaryId: "dictionary",
    catalogId: "catalog",
    groupId: "section",
    setId: "set",
    storyType: "ascent",
  };

  const session = createStationTestSession(station, routeWords, "kb");
  assert.deepEqual(new Set(session.questions.map((question) => question.item.id)), new Set(["s1", "s2"]));
  assert.equal(session.questions.length, stationWords.length);
  session.questions.forEach((question) => {
    question.options
      .filter((option) => option.id !== question.item.id)
      .forEach((option) => assert.equal(option.word.pos, question.item.pos));
  });
});

test("stale station-test snapshot is discarded and never resumed", () => {
  const stationWords = [word("s1", "noun", 1), word("s2", "noun", 2)];
  const station = { key: "stage-resume", words: stationWords, dictionaryId: "dictionary", catalogId: "catalog", groupId: "section", setId: "set", storyType: "roots" };
  const staleKey = "alantil_scope_v1:guest:alantil_station_test_active_v13_5";
  localStorage.setItem(staleKey, JSON.stringify({ id: "old-attempt", stationKey: station.key, index: 1, answers: [{wordId:"s1",result:"correct"}] }));
  const session = createStationTestSession(station, stationWords, "kb");
  assert.equal(session.index, 0);
  assert.deepEqual(session.answers, []);
  assert.notEqual(session.id, "old-attempt");
  assert.equal(localStorage.getItem(staleKey), null);
});

test("test distractors never fall back to another part of speech", () => {
  const target = word("target", "pronoun", 1);
  const samePos = word("same", "pronoun", 2);
  const otherPos = word("other", "noun", 3);
  const distractors = distractorsFor(target, [target, samePos, otherPos], 3);
  assert.deepEqual(distractors.map((item) => item.id), ["same"]);
});
