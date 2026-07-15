import { DICT_TITLES, SECTION_TITLES } from "../../config/words.js";
import { trackEvent } from "../../shared/analytics/analytics.js";
import { EVENTS, SEARCH_AREAS, SEARCH_MODES } from "../../shared/analytics/events.js";
import { dictsFrom, sectionsFrom, setsFrom, wordsForSet } from "../../shared/domain/word-selection.js";
import { createSlugMap } from "../../shared/domain/slugs.js";
import { wordFavorites } from "../../shared/state/word-favorites.js";
import { renderContentListRow, renderSectionMenu } from "../../shared/ui/list.js";
import { panel } from "../../shared/ui/panel.js";
import { escapeHtml, renderStarButton } from "../../shared/ui/word-renderers.js";
import { learnState } from "./state.js";
import { renderSetPreparation } from "./set-preparation.js";

function dictTitle(code) {
  return DICT_TITLES[code] || code;
}

function sectionTitle(code) {
  return SECTION_TITLES[code] || code;
}

function dictionarySlugMap(words) {
  return createSlugMap(dictsFrom(words), { reserved: ["favorites"] });
}

function sectionSlugMap(words, dict) {
  return createSlugMap(sectionsFrom(words, dict));
}

function setSlugMap(words, dict, section) {
  return createSlugMap(setsFrom(words, dict, section).map(String));
}

function wireStars(container, wordsById, rerender) {
  container.querySelectorAll(".starBtn[data-word-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = button.dataset.wordId;
      const on = wordFavorites.toggle(id);
      button.classList.toggle("on", on);
      if (rerender) rerender(wordsById.get(id), on);
    });
  });
}

export function renderCatalog(context, words, signal) {
  const dicts = dictsFrom(words);
  const slugs = dictionarySlugMap(words);
  const items = [
    { id: "favorites", title: "Избранное", favorite: true },
    ...dicts.map((dict) => ({ id: slugs.slugFor(dict), title: dictTitle(dict) })),
  ];

  context.root.innerHTML = panel({
    title: "Учить слова",
    body: renderSectionMenu(items, { dataName: "dictionary-slug" }),
  });

  context.root.querySelectorAll("[data-dictionary-slug]").forEach((button) => {
    button.addEventListener("click", () => {
      const dictionarySlug = button.dataset.dictionarySlug;
      if (dictionarySlug === "favorites") {
        learnState.currentDict = "__fav__";
        learnState.currentSection = "Избранное";
        learnState.currentSet = 1;
        context.router.navigate("learn.set", { dictionarySlug: "favorites", sectionSlug: null, setSlug: null });
        return;
      }
      learnState.currentDict = slugs.valueFor(dictionarySlug) || "";
      learnState.currentSection = "";
      context.router.navigate("learn.sections", { dictionarySlug, sectionSlug: null, setSlug: null });
    }, { signal });
  });
}

export function renderSections(context, words, signal) {
  const dict = learnState.currentDict;
  if (!dict) {
    context.router.replace("learn.catalog", {}, { force: true });
    return;
  }

  const dictionarySlug = dictionarySlugMap(words).slugFor(dict);
  const sectionSlugs = sectionSlugMap(words, dict);
  const availableSections = sectionsFrom(words, dict);
  const sections = learnState.currentSection ? [learnState.currentSection] : availableSections;
  const body = sections.map((section) => {
    const sets = setsFrom(words, dict, section);
    const setSlugs = setSlugMap(words, dict, section);
    const sectionSlug = sectionSlugs.slugFor(section);
    const tiles = sets.map((setNumber) => {
      const title = typeof setNumber === "number" ? `Сет ${setNumber}` : String(setNumber);
      return `
        <div class="setTile set-tile" role="button" tabindex="0" data-section="${escapeHtml(section)}" data-section-slug="${escapeHtml(sectionSlug)}" data-set="${escapeHtml(setNumber)}" data-set-slug="${escapeHtml(setSlugs.slugFor(String(setNumber)))}">
          <div class="setTileTitle">${escapeHtml(title)}</div>
        </div>`;
    }).join("");
    const sectionHeader = learnState.currentSection
      ? `<div class="secTitle">${escapeHtml(sectionTitle(section))}</div>`
      : `<button class="secTitle sectionRouteLink" type="button" data-section-open="${escapeHtml(sectionSlug)}">${escapeHtml(sectionTitle(section))}</button>`;
    return `<div class="secBlock">${sectionHeader}<div class="setsGrid">${tiles}</div></div>`;
  }).join("");

  context.root.innerHTML = panel({
    title: escapeHtml(learnState.currentSection ? sectionTitle(learnState.currentSection) : dictTitle(dict)),
    headerExtra: `<button id="btnOpenDictContent" class="iconBtn" type="button" aria-label="Содержание словаря" title="Содержание словаря"><img src="/assets/icons/words-search.svg" alt="" /></button>`,
    body: `<div id="sectionsList" class="stack">${body}</div>`,
  });

  context.root.querySelector("#btnOpenDictContent")?.addEventListener("click", () => context.router.navigate("learn.catalog-content", { dictionarySlug, sectionSlug: null, setSlug: null }), { signal });
  context.root.querySelectorAll("[data-section-open]").forEach((button) => {
    button.addEventListener("click", () => context.router.navigate("learn.sections", {
      dictionarySlug,
      sectionSlug: button.dataset.sectionOpen,
      setSlug: null,
    }), { signal });
  });

  context.root.querySelectorAll(".setTile").forEach((tile) => {
    const section = tile.dataset.section;
    const rawSet = tile.dataset.set;
    const setNumber = Number.isNaN(Number(rawSet)) ? rawSet : Number(rawSet);

    const open = () => {
      learnState.currentSection = section;
      learnState.currentSet = setNumber;
      context.router.navigate("learn.set", {
        dictionarySlug,
        sectionSlug: tile.dataset.sectionSlug,
        setSlug: tile.dataset.setSlug,
      });
    };
    tile.addEventListener("click", open, { signal });
    tile.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    }, { signal });
  });
}

export function renderDictionaryContent(context, words, signal) {
  const dict = learnState.currentDict;
  if (!dict || dict === "__fav__") {
    context.router.replace("learn.catalog", {}, { force: true });
    return;
  }

  context.root.innerHTML = panel({
    title: "Содержание словаря",
    headerExtra: `<input id="dictSearchInput" class="searchInput" type="search" placeholder="Поиск..." autocomplete="off" />`,
    body: `<div id="dictContentList" class="contentList contentListGrouped"></div>`,
  });

  const input = context.root.querySelector("#dictSearchInput");
  const list = context.root.querySelector("#dictContentList");
  const byId = new Map(words.map((word) => [word.id, word]));
  let searchOpened = false;
  let searchTimer = 0;

  function draw(filter = "") {
    const query = String(filter || "").toLowerCase().trim();
    const filtered = words
      .filter((word) => word.dict === dict && Number(word.dict_order) > 0 && (!query || word.word.toLowerCase().includes(query) || word.trans.toLowerCase().includes(query)))
      .sort((a, b) => Number(a.dict_order) - Number(b.dict_order));
    const grouped = new Map();
    filtered.forEach((word) => {
      const section = String(word.section || "Раздел").trim() || "Раздел";
      if (!grouped.has(section)) grouped.set(section, []);
      grouped.get(section).push(word);
    });

    list.innerHTML = Array.from(grouped.entries()).map(([section, entries]) => `
      <div class="sectionHeader" data-section-header>▸ ${escapeHtml(sectionTitle(section))}</div>
      <div class="hidden" data-section-body>
        ${entries.map((word) => renderContentListRow({
          id: word.id,
          leadingHtml: `<span class="contentListIndex">${Number(word.dict_order)}.</span>`,
          primary: word.word,
          secondary: word.trans,
          trailingHtml: renderStarButton(word.id, `data-word-id="${escapeHtml(word.id)}"`),
        })).join("")}
      </div>`).join("");

    list.querySelectorAll("[data-section-header]").forEach((header) => {
      header.addEventListener("click", () => {
        const body = header.nextElementSibling;
        const closed = body.classList.toggle("hidden");
        const title = header.textContent.replace(/^[▸▾]\s*/, "");
        header.textContent = `${closed ? "▸" : "▾"} ${title}`;
      }, { signal });
    });
    wireStars(list, byId);
    return filtered.length;
  }

  function scheduleSearchEvent(resultCount) {
    window.clearTimeout(searchTimer);
    const queryLength = input.value.trim().length;
    if (!queryLength) return;
    searchTimer = window.setTimeout(() => {
      trackEvent(resultCount ? EVENTS.SEARCH_RESULT : EVENTS.SEARCH_EMPTY, {
        search_area: SEARCH_AREAS.DICTIONARY,
        search_mode: SEARCH_MODES.WORD,
        query_length: queryLength,
        result_count: resultCount,
      });
    }, 600);
  }

  input.addEventListener("focus", () => {
    if (searchOpened) return;
    searchOpened = true;
    trackEvent(EVENTS.SEARCH_OPEN, { search_area: SEARCH_AREAS.DICTIONARY, search_mode: SEARCH_MODES.WORD });
  }, { signal });
  input.addEventListener("input", () => scheduleSearchEvent(draw(input.value)), { signal });
  signal.addEventListener("abort", () => window.clearTimeout(searchTimer), { once: true });
  draw();
}

export function renderSetMenu(context, words, signal) {
  const { currentDict, currentSection, currentSet } = learnState;
  if (!currentDict) {
    context.router.replace("learn.catalog", {}, { force: true });
    return;
  }

  const setWords = currentDict === "__fav__"
    ? words.filter((word) => wordFavorites.has(word.id))
    : wordsForSet(words, currentDict, currentSection, currentSet);
  const title = currentDict === "__fav__"
    ? "Избранное"
    : (typeof currentSet === "number" ? `Сет ${currentSet}` : String(currentSet));

  renderSetPreparation(context, {
    title,
    subtitle: currentDict === "__fav__" ? "" : sectionTitle(currentSection),
    words: setWords,
    dictionaryId: currentDict,
    sectionId: currentSection,
    setId: currentSet,
    signal,
    favoritesOnly: currentDict === "__fav__",
    onStart(mode) {
      context.router.navigate("learn.study", { mode });
    },
  });
}
