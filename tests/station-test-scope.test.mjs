import test from "node:test";
import assert from "node:assert/strict";

const storage = new Map();
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
};
globalThis.window = { location: { pathname: "/path/test" } };

const { createStationTestSession, distractorsFor } = await import("../src/features/path/station-test.js?v=13.9.0");

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

test("test distractors never fall back to another part of speech", () => {
  const target = word("target", "pronoun", 1);
  const samePos = word("same", "pronoun", 2);
  const otherPos = word("other", "noun", 3);
  const distractors = distractorsFor(target, [target, samePos, otherPos], 3);
  assert.deepEqual(distractors.map((item) => item.id), ["same"]);
});
