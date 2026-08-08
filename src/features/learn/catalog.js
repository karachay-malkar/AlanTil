import { msg } from "../../shared/i18n/index.js?v=13.9.0";
import { DICT_TITLES } from "../../config/words.js?v=13.12";
import { trackEvent } from "../../shared/analytics/analytics.js?v=13.9.0";
import { EVENTS, SEARCH_AREAS, SEARCH_MODES } from "../../shared/analytics/events.js?v=13.9.0";
import { dictsFrom, setsFrom, wordsForSet } from "../../shared/domain/word-selection.js?v=13.12";
import { createSlugMap } from "../../shared/domain/slugs.js?v=13.9.0";
import { wordFavorites } from "../../shared/state/word-favorites.js?v=13.9.0";
import { renderContentListRow, renderSectionMenu } from "../../shared/ui/list.js?v=13.9.0";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";
import { escapeHtml, renderStarButton } from "../../shared/ui/word-renderers.js?v=13.9.0";
import { learnState } from "./state.js?v=13.12";
import { renderSetPreparation } from "./set-preparation.js?v=13.9.0";

function dictTitle(code) {
  return DICT_TITLES[code] || code;
}

function dictionaryLabel(words, code) {
  const word = words.find((entry) => String(entry.dictionary_id || entry.dict || "") === String(code || ""));
  return word?.dictionary_name || dictTitle(code);
}

function dictionarySlugMap(words) {
  return createSlugMap(dictsFrom(words), { reserved: ["favorites"] });
}

function setSlugMap(words, dict) {
  return createSlugMap(setsFrom(words, dict).map(String));
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
      learnState.currentSection = learnState.currentDict;
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

  learnState.currentSection = dict;
  const dictionarySlug = dictionarySlugMap(words).slugFor(dict);
  const setSlugs = setSlugMap(words, dict);
  const sets = setsFrom(words, dict);
  const tiles = sets.map((setId) => `
    <div class="setTile set-tile" role="button" tabindex="0"
      data-set="${escapeHtml(setId)}"
      data-set-slug="${escapeHtml(setSlugs.slugFor(String(setId)))}">
      <div class="setTileTitle">${escapeHtml(setId)}</div>
    </div>`).join("");
  const pageTitle = dictionaryLabel(words, dict);

  context.shell.setHeaderContent?.({ title: pageTitle });
  context.root.innerHTML = panel({
    title: escapeHtml(pageTitle),
    headerExtra: `<button id="btnOpenDictContent" class="iconAction iconBtn" type="button" aria-label="${msg("learn.soderzhanie_slovarya")}" title="${msg("learn.soderzhanie_slovarya")}"><img src="/assets/icons/words-search.svg" alt="" /></button>`,
    body: `<div class="setsGrid">${tiles}</div>`,
  });

  context.root.querySelector("#btnOpenDictContent")?.addEventListener("click", () => context.router.navigate("learn.catalog-content", {
    dictionarySlug,
    sectionSlug: null,
    setSlug: null,
  }), { signal });

  context.root.querySelectorAll(".setTile").forEach((tile) => {
    const setId = tile.dataset.set;
    const open = () => {
      learnState.currentSection = dict;
      learnState.currentSet = setId;
      // The current router still carries a middle path segment. It is a URL
      // compatibility segment only and mirrors the dictionary; no section is
      // stored in content data.
      context.router.navigate("learn.set", {
        dictionarySlug,
        sectionSlug: dictionarySlug,
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
      .filter((word) => String(word.dictionary_id || word.dict || "") === dict
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
  const { currentDict, currentSet } = learnState;
  if (!currentDict) {
    context.router.replace("learn.catalog", {}, { force: true });
    return;
  }

  const setWords = currentDict === "__fav__"
    ? words.filter((word) => wordFavorites.has(word.id))
    : wordsForSet(words, currentDict, currentDict, currentSet);
  const title = currentDict === "__fav__"
    ? msg("learn.izbrannoe")
    : (setWords[0]?.set_name || setWords[0]?.set || String(currentSet));

  renderSetPreparation(context, {
    title,
    subtitle: currentDict === "__fav__" ? "" : dictionaryLabel(words, currentDict),
    words: setWords,
    dictionaryId: currentDict,
    sectionId: currentDict,
    setId: currentSet,
    signal,
    favoritesOnly: currentDict === "__fav__",
    onStart(mode) {
      context.router.navigate("learn.study", { mode });
    },
  });
}
