import * as baseLearn from "/src/features/learn/index.js?v=13.13&base=1";
import { getWords } from "/src/shared/data/word-repository.js?v=13.14";

let enhancementController = null;

function setNameMap(words = []) {
  const map = new Map();
  for (const word of words) {
    const setId = String(word?.set_id || "");
    const name = String(word?.set_name || "").trim();
    if (setId && name && !map.has(setId)) map.set(setId, name);
  }
  return map;
}

async function enhanceSetLabels(context) {
  const tiles = [...context.root.querySelectorAll(".setTile[data-set]")];
  if (!tiles.length) return;
  const names = setNameMap(await getWords());
  if (enhancementController?.signal.aborted) return;
  for (const tile of tiles) {
    const name = names.get(String(tile.dataset.set || "")) || "";
    if (!name) continue;
    const title = tile.querySelector(".setTileTitle");
    if (title) title.textContent = name;
  }
}

export async function mount(context, params = {}) {
  enhancementController?.abort();
  enhancementController = new AbortController();
  await baseLearn.mount(context, params);
  await enhanceSetLabels(context);
}

export function unmount() {
  enhancementController?.abort();
  enhancementController = null;
  baseLearn.unmount?.();
}

export function canLeave() {
  return baseLearn.canLeave?.() ?? true;
}

export function getLeaveMessage() {
  return baseLearn.getLeaveMessage?.();
}
