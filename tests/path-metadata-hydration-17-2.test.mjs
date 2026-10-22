import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/features/path/feature.js", import.meta.url), "utf8");
const start = source.indexOf("function refreshSetMetadataInPlace(");
const end = source.indexOf("\nfunction refreshSetMetadataAsync(", start);
assert.ok(start !== -1 && end > start, "metadata refresh function must exist");

function scenario({ icon = "01_sample.webp", hasLabel = false } = {}) {
  const label = { textContent: "Old label" };
  const count = { textContent: "3/10" };
  const attrs = new Map([["data-adaptive-station-meta", ""]]);
  let rendered = "";
  let bindingCalls = 0;
  let templateCalls = 0;
  const button = {
    className: "choiceControl stationNode studying",
    style: { cssText: "--station-progress:108deg" },
    classList: { contains(name) { return button.className.split(/\s+/).includes(name); } },
    querySelector(selector) {
      if (selector === ".stationLabel") return hasLabel || rendered ? label : null;
      if (selector === ".stationWordCount") return count;
      return null;
    },
    querySelectorAll(selector) {
      return selector === ".beginnerDioramaImage" && rendered
        ? [{ getAttribute: () => "/assets/icons/sets/" + icon, setAttribute() {} }]
        : [];
    },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.get(name) ?? null; },
    removeAttribute(name) { attrs.delete(name); },
    get innerHTML() { return rendered; },
    set innerHTML(value) { rendered = String(value); }
  };
  const context = {
    CSS: { escape: value => value },
    msg: (_, values) => [values.label, values.mastered, values.total].join(":"),
    beginnerSetIconName: () => "",
    intermediateSetIconName: () => icon,
    createRouteProgressSnapshot: () => ({ current: true }),
    bindBeginnerDioramaFallbacks(root) {
      assert.equal(root, button, "fallback listeners must bind on the original button");
      bindingCalls++;
    },
    stationButton() { return '<button class="beginnerDioramaNode"><img class="beginnerDioramaImage"></button>'; },
    SET_ICON_ASSET_VERSION: "16.8.0.14",
    document: {
      createElement(tag) {
        assert.equal(tag, "template");
        templateCalls++;
        const template = { content: { firstElementChild: null } };
        Object.defineProperty(template, "innerHTML", {
          set(value) {
            assert.match(value, /beginnerDioramaNode/);
            template.content.firstElementChild = {
              className: "choiceControl stationNode studying beginnerDioramaNode",
              innerHTML: '<span class="stationLabel">New label</span><img class="beginnerDioramaImage" />',
              style: { cssText: "--station-progress:108deg;min-height:148px" },
              getAttribute: name => ({
                "data-achievement-level": "1",
                "data-station-progress-percent": "30"
              })[name] ?? null
            };
          }
        });
        return template;
      }
    }
  };
  const run = vm.runInNewContext("(" + source.slice(start, end) + ")", context);
  const story = { stations: [{ key: "mid-1", name: "Updated label", dictionaryId: "intermediate" }] };
  const route = { stories: { oblivion: story } };
  const root = {
    isConnected: true,
    querySelector(selector) {
      assert.match(selector, /data-station-key/);
      return button;
    }
  };
  run({ root }, route, "oblivion", { aborted: false });
  return { button, attrs, count, get bindingCalls() { return bindingCalls; }, get templateCalls() { return templateCalls; } };
}

test("late metadata upgrades intermediate placeholder to a diorama without replacing button", () => {
  const s = scenario();
  assert.match(s.button.className, /beginnerDioramaNode/);
  assert.match(s.button.innerHTML, /beginnerDioramaImage/);
  assert.equal(s.bindingCalls, 1);
  assert.equal(s.templateCalls, 1);
  assert.equal(s.button.getAttribute("data-adaptive-station-meta"), null);
  assert.equal(s.button.getAttribute("data-achievement-level"), "1");
  assert.equal(s.button.getAttribute("data-station-progress-percent"), "30");
});

test("missing remote icon leaves existing station and progress accessible", () => {
  const s = scenario({ icon: "", hasLabel: true });
  assert.equal(s.button.className, "choiceControl stationNode studying");
  assert.equal(s.count.textContent, "3/10");
  assert.equal(s.button.getAttribute("aria-label"), "Updated label:3:10");
  assert.equal(s.bindingCalls, 0);
});
