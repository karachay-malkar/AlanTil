import * as basePath from "/src/features/path/index.js?v=13.13&base=1";
import { getWords } from "/src/shared/data/word-repository.js?v=13.13";

let enhancementController = null;
let resizeObserver = null;
let scrollFrame = 0;
let cssPromise = null;

function ensureStyles() {
  if (cssPromise) return cssPromise;
  cssPromise = new Promise((resolve) => {
    const existing = document.querySelector('link[data-path-13-14]');
    if (existing) { resolve(); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/src/features/path/path-13-14.css?v=13.14";
    link.dataset.path1314 = "";
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    document.head.append(link);
  });
  return cssPromise;
}

function sectionNameMap(words = []) {
  const map = new Map();
  for (const word of words) {
    const dictionaryId = String(word?.dictionary_id || "");
    const sectionId = String(word?.section_id || "");
    const name = String(word?.section_name || "").trim();
    if (dictionaryId && sectionId && name && !map.has(`${dictionaryId}::${sectionId}`)) {
      map.set(`${dictionaryId}::${sectionId}`, name);
    }
  }
  return map;
}

function enhanceSections(root, words) {
  const names = sectionNameMap(words);
  root.querySelectorAll(".routeSection[data-route-section]").forEach((section) => {
    if (section.querySelector(":scope > .routeSectionHeading")) return;
    const key = String(section.dataset.routeSection || "");
    const name = names.get(key) || "";
    if (!name) return;
    const heading = document.createElement("h3");
    heading.className = "routeSectionHeading";
    heading.textContent = name;
    section.append(heading);
  });

  for (const dictionaryId of ["beginner", "intermediate", "advanced"]) {
    root.querySelectorAll(`.routeCatalog[data-route-catalog="${dictionaryId}"] .stationLabel`).forEach((label) => label.remove());
  }
}

function syncStoryTabEdges(shell, scroller) {
  const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  const scrollable = max > 3;
  shell.classList.toggle("isScrollable", scrollable);
  shell.classList.toggle("canScrollStart", scrollable && scroller.scrollLeft > 3);
  shell.classList.toggle("canScrollEnd", scrollable && scroller.scrollLeft < max - 3);
}

function enhanceStoryTabs(root, signal) {
  const scroller = root.querySelector(".storyTabs");
  if (!scroller) return;
  let shell = scroller.parentElement?.classList.contains("storyTabsShell") ? scroller.parentElement : null;
  if (!shell) {
    shell = document.createElement("div");
    shell.className = "storyTabsShell";
    scroller.parentNode?.insertBefore(shell, scroller);
    shell.append(scroller);
  }

  const schedule = () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      syncStoryTabEdges(shell, scroller);
    });
  };

  const active = scroller.querySelector(".storyTab.active");
  requestAnimationFrame(() => {
    active?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
    syncStoryTabEdges(shell, scroller);
  });
  scroller.addEventListener("scroll", schedule, { signal, passive: true });

  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(scroller);
  }
}

async function enhancePath(context) {
  if (!context.root.querySelector(".pathView")) return;
  await ensureStyles();
  if (!context.root.querySelector(".pathView")) return;
  const words = await getWords();
  if (!context.root.querySelector(".pathView")) return;
  enhanceSections(context.root, words);
  enhanceStoryTabs(context.root, enhancementController.signal);
}

export async function mount(context, params = {}) {
  enhancementController?.abort();
  resizeObserver?.disconnect();
  resizeObserver = null;
  enhancementController = new AbortController();
  await basePath.mount(context, params);
  await enhancePath(context);
}

export function unmount() {
  enhancementController?.abort();
  enhancementController = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  scrollFrame = 0;
  basePath.unmount?.();
}

export function canLeave() {
  return basePath.canLeave?.() ?? true;
}

export function getLeaveMessage() {
  return basePath.getLeaveMessage?.();
}
