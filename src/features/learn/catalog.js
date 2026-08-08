import { msg } from "../../shared/i18n/index.js?v=13.9.0";
import { trackEvent } from "../../shared/analytics/analytics.js?v=13.9.0";
import { EVENTS, SEARCH_AREAS, SEARCH_MODES } from "../../shared/analytics/events.js?v=13.9.0";
import { dictsFrom, sectionsFrom, setsFrom, wordsForSet } from "../../shared/domain/word-selection.js?v=13.13";
import { createSlugMap } from "../../shared/domain/slugs.js?v=13.9.0";
import { wordFavorites } from "../../shared/state/word-favorites.js?v=13.9.0";
import { renderContentListRow, renderSectionMenu } from "../../shared/ui/list.js?v=13.9.0";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";
import { escapeHtml, renderStarButton } from "../../shared/ui/word-renderers.js?v=13.9.0";
import { learnState } from "./state.js?v=13.13";
import { renderSetPreparation } from "./set-preparation.js?v=13.9.0";

function dictionaryLabel(words, code) {
  const word = words.find((entry) => String(entry.dictionary_id || "") === String(code || ""));
  return String(word?.dictionary_name || "").trim();
}

function sectionLabel(words, dict, section) {
  const word = words.find((entry) => String(entry.dictionary_id || "") === String(dict || "")
    && String(entry.section_id || "") === String(section || ""));
  return String(word?.section_name || "").trim();
}

function setNumberLabel(setId) {
  const match = String(setId || "").match(/(\d+)$/);
  return match ? match[1] : "";
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
  context.shell.setHeaderContent?.({ title: msg("learn.uchit_slova") });
  const dicts = dictsFrom(words);
  const slugs = dictionarySlugMap(words);
  const items = [
    { id: "favorites", title: msg("learn.izbrannoe"), favorite: true },
    ...dicts.map((dict) => ({ id: slugs.slugFor(dict), title: dictionaryLabel(words, dict) })),
  ];

  context.root.innerHTML = panel({
    title: msg("learn.uchit_slova"),
    body: renderSectionMenu(items, { dataName: "dictionary-slug" }),
  });

  context.root.querySelectorAll("[data-dictionary-slug]").forEach((button) => {
    button.addEventListener("click", () => {
      const dictionarySlug = button.dataset.dictionarySlug;
      if (dictionarySlug === "favorites") {
        learnState.currentDict = "__fav__";
        learnState.currentSection = "__fav__";
        learnState.currentSet = "favorites";
        context.router.navigate("learn.set", { dictionarySlug: "favorites", sectionSlug: null, setSlug: null });
        return;
      }
      learnState.currentDict = slugs.valueFor(dictionarySlug) || "";
      learnState.currentSection = "";
      learnState.currentSet = "";
      context.router.navigate("learn.sections", { dictionarySlug, sectionSlug: null, setSlug: null });
    }, { signal });
  });
}

function renderSectionList(context, words, signal, dict, dictionarySlug) {
  const sections = sectionsFrom(words, dict);
  const sectionSlugs = sectionSlugMap(words, dict);
  const items = sections.map((section) => ({
    id: sectionSlugs.slugFor(section),
    title: sectionLabel(words, dict, section),
  }));
  const pageTitle = dictionaryLabel(words, dict);

  context.shell.setHeaderContent?.({ title: pageTitle });
  context.root.innerHTML = panel({
    title: escapeHtml(pageTitle),
    headerExtra: `<button id="btnOpenDictContent" class="iconAction iconBtn" type="button" aria-label="${msg("learn.soderzhanie_slovarya")}" title="${msg("learn.soderzhanie_slovarya")}"><img src="/assets/icons/words-search.svg" alt="" /></button>`,
    body: renderSectionMenu(items, { dataName: "section-slug" }),
  });

  context.root.querySelector("#btnOpenDictContent")?.addEventListener("click", () => context.router.navigate("learn.catalog-content", {
    dictionarySlug,
    sectionSlug: null,
    setSlug: null,
  }), { signal });

  context.root.querySelectorAll("[data-section-slug]").forEach((button) => {
    button.addEventListener("click", () => {
      const sectionSlug = button.dataset.sectionSlug;
      const section = sectionSlugs.valueFor(sectionSlug) || "";
      if (!section) return;
      learnState.currentSection = section;
      learnState.currentSet = "";
      context.router.navigate("learn.sections", { dictionarySlug, sectionSlug, setSlug: null });
    }, { signal });
  });
}

function renderSetList(context, words, signal, dict, section, dictionarySlug) {
  const sectionSlugs = sectionSlugMap(words, dict);
  const sectionSlug = sectionSlugs.slugFor(section);
  const setSlugs = setSlugMap(words, dict, section);
  const sets = setsFrom(words, dict, section);
  const tiles = sets.map((setId) => `
    <div class="setTile set-tile" role="button" tabindex="0"
      data-set="${escapeHtml(setId)}"
      data-set-slug="${escapeHtml(setSlugs.slugFor(String(setId)))}">
      <div class="setTileTitle">${escapeHtml(setNumberLabel(setId))}</div>
    </div>`).join("");
  const pageTitle = sectionLabel(words, dict, section);

  context.shell.setHeaderContent?.({ title: pageTitle, subtitle: dictionaryLabel(words, dict) });
  context.root.innerHTML = panel({
    title: escapeHtml(pageTitle),
    body: `<div class="setsGrid">${tiles}</div>`,
  });

  context.root.querySelectorAll(".setTile").forEach((tile) => {
    const open = () => {
      learnState.currentSet = tile.dataset.set;
      context.router.navigate("learn.set", {
        dictionarySlug,
        sectionSlug,
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

export function renderSections(context, words, signal) {
  const dict = learnState.currentDict;
  if (!dict || dict === "__fav__") {
    context.router.replace("learn.catalog", {}, { force: true });
    return;
  }
  const dictionarySlug = dictionarySlugMap(words).slugFor(dict);
  if (!learnState.currentSection) {
    renderSectionList(context, words, signal, dict, dictionarySlug);
    return;
  }
  renderSetList(context, words, signal, dict, learnState.currentSection, dictionarySlug);
}

export function renderDictionaryContent(context, words, signal) {
  const dict = learnState.currentDict;
  if (!dict || dict === "__fav__") {
    context.router.replace("learn.catalog", {}, { force: true });
    return;
  }

  context.shell.setHeaderContent?.({ title: msg("learn.soderzhanie_slovarya"), subtitle: dictionaryLabel(words, dict) });
  context.root.innerHTML = panel({
    title: msg("learn.soderzhanie_slovarya"),
    headerExtra: `<input id="dictSearchInput" class="searchInput" type="search" placeholder="${msg("learn.poisk")}" autocomplete="off" />`,
    body: `<div id="dictContentList" class="contentList"></div>`,
  });

  const input = context.root.querySelector("#dictSearchInput");
  const list = context.root.querySelector("#dictContentList");
  const byId = new Map(words.map((word) => [word.id, word]));
  let searchOpened = false;
  let searchTimer = 0;

  function draw(filter = "") {
    const query = String(filter || "").toLowerCase().trim();
    const filtered = words
      .filter((word) => String(word.dictionary_id || "") === dict
        && Number(word.dict_order) > 0
        && (!query || word.word.toLowerCase().includes(query) || word.trans.toLowerCase().includes(query)))
      .sort((a, b) => Number(a.dict_order) - Number(b.dict_order));

    list.innerHTML = filtered.map((word) => renderContentListRow({
      id: word.id,
      leadingHtml: `<span class="contentListIndex">${Number(word.dict_order)}.</span>`,
      primary: word.word,
      secondary: word.trans,
      trailingHtml: renderStarButton(word.id, `data-word-id="${escapeHtml(word.id)}"`),
    })).join("");

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
    ? msg("learn.izbrannoe")
    : (String(setWords[0]?.set_name || "").trim() || setNumberLabel(currentSet));

  renderSetPreparation(context, {
    title,
    subtitle: currentDict === "__fav__" ? "" : sectionLabel(words, currentDict, currentSection),
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
