import test from "node:test";
import assert from "node:assert/strict";

import {
  nextUnattemptedProgressEntry,
  shouldDiscardProgressError,
} from "../src/shared/progress/progress-sync-policy.js?v=13.8";

test("a failed entry does not hide later settings from the same queue pass", () => {
  const queue = [
    { id: "word_favorite:legacy", type: "word_favorite" },
    { id: "user_settings:current", type: "user_settings" },
  ];
  const attempted = new Set(["word_favorite:legacy"]);
  assert.equal(nextUnattemptedProgressEntry(queue, attempted)?.id, "user_settings:current");
});

test("only obsolete word favorite foreign keys are discarded", () => {
  assert.equal(shouldDiscardProgressError({ type: "word_favorite" }, { code: "23503" }), true);
  assert.equal(shouldDiscardProgressError({ type: "user_settings" }, { code: "23503" }), false);
  assert.equal(shouldDiscardProgressError({ type: "word_favorite" }, { code: "42501" }), false);
});
