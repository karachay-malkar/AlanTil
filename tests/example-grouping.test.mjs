import assert from "node:assert/strict";
import test from "node:test";
import { combineNumberedExamples, parseExampleGroups } from "../src/shared/domain/example-groups.js";

test("numbered examples stay attached to their translation meaning", () => {
  const combined = combineNumberedExamples(
    "1.1 ала джаулукъ\n1.2 ала кёзле\n2.1 ингир ала\n2.2 бир алада",
    "1.1 пёстрый платок\n1.2 светлые глаза\n2.1 вечерком\n2.2 иногда",
  );
  assert.equal(combined, "1.1 ала джаулукъ ✦ пёстрый платок; 1.2 ала кёзле ✦ светлые глаза; 2.1 ингир ала ✦ вечерком; 2.2 бир алада ✦ иногда");
  assert.deepEqual(parseExampleGroups(combined), [
    { index: 0, lines: ["ала джаулукъ ✦ пёстрый платок", "ала кёзле ✦ светлые глаза"] },
    { index: 1, lines: ["ингир ала ✦ вечерком", "бир алада ✦ иногда"] },
  ]);
});

test("legacy unnumbered examples remain in the first meaning", () => {
  assert.deepEqual(parseExampleGroups("пример один; пример два"), [
    { index: 0, lines: ["пример один", "пример два"] },
  ]);
});
