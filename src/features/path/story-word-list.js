import { msg } from "../../shared/i18n/index.js?v=13.15.12";
import { wordFavorites } from "../../shared/state/word-favorites.js?v=13.9.0";
import { escapeHtml } from "../../shared/ui/html.js?v=13.9.0";
import { SEARCH_ICON_SVG } from "../../shared/ui/icons.js?v=13.9.0";
import { bindOverflowMarquees, renderOverflowMarquee } from "../../shared/ui/overflow-marquee.js?v=13.10.12";
import { renderStarButton } from "../../shared/ui/word-renderers.js?v=13.9.0";

function normalized(value) { return String(value || "").normalize("NFC").trim().toLocaleLowerCase(); }

function thematic(catalog) {
  const id = normalized(catalog?.dictionaryId || catalog?.catalogId);
  return id.includes("thematic") || id.includes("temat") || (catalog?.sections?.length || 0) > 2;
}

function groupedEntries(story) {
  const seen = new Set();
  let ordinal = 0;
  return (story?.catalogs || []).map((catalog) => ({
    catalog,
    sections: (catalog.sections || []).map((section) => ({
      section,
      entries: (section.stations || []).flatMap((station) => (station.words || []).flatMap((word) => {
        const id = String(word?.id || "");
        if (!id || seen.has(id)) return [];
        seen.add(id);
        return [{ word, ordinal: ++ordinal }];
      })),
    })).filter((group) => group.entries.length),
  })).filter((group) => group.sections.length);
}

function wordRow(entry) {
  const searchText = normalized(`${entry.word.word} ${entry.word.trans}`);
  return `<div class="contentListRow stationWordRow storyWordRow" data-story-word-row data-search="${escapeHtml(searchText)}">
    <span class="storyWordOrdinal">${entry.ordinal}.</span>
    <span class="contentListMain storyWordMain">
      <span data-station-line><span class="contentListPrimary stationTextClip stationStaticText" title="${escapeHtml(entry.word.word)}">${escapeHtml(entry.word.word)}</span></span>
      <span data-station-line>${renderOverflowMarquee(entry.word.trans, { clipClass: "contentListSecondary stationTextClip", trackClass: "stationMarquee" })}</span>
    </span>
    ${renderStarButton(entry.word.id, `data-story-favorite="${escapeHtml(entry.word.id)}"`)}
  </div>`;
}

function listMarkup(groups) {
  return groups.map(({ catalog, sections }) => `<section class="storyWordCatalogGroup" data-story-catalog-group>
    ${catalog?.name ? `<h2 class="storyWordCatalog">${escapeHtml(catalog.name)}</h2>` : ""}
    ${sections.map(({ section, entries }) => `<section class="storyWordSectionGroup" data-story-section-group>
      ${thematic(catalog) && section?.name ? `<h3 class="storyWordSection">${escapeHtml(section.name)}</h3>` : ""}
      ${entries.map(wordRow).join("")}
    </section>`).join("")}
  </section>`).join("");
}

export function renderStoryWordList({ context, route, storyType, signal } = {}) {
  const story = route?.stories?.[storyType];
  if (!story) return;

  wordFavorites.reload();
  const groups = groupedEntries(story);
  context.shell.setHeaderContent?.({ title: msg("common.spisok_slov") });
  context.shell.setHeaderAction?.(`<div class="storyWordHeaderSearch" data-story-search-control>
    <input class="storyWordHeaderSearchInput" type="search" inputmode="search" autocomplete="off" aria-label="${escapeHtml(msg("common.poisk_slova"))}" placeholder="${escapeHtml(msg("common.poisk_slova"))}">
    <button class="appHeaderAction storyWordSearchToggle" type="button" aria-label="${escapeHtml(msg("common.otkryt_poisk"))}" aria-expanded="false">
      <span class="storyWordSearchIcon" aria-hidden="true">${SEARCH_ICON_SVG}</span><span class="storyWordSearchClose" aria-hidden="true">×</span>
    </button>
  </div>`);

  context.root.innerHTML = `<section class="view screen storyWordsView">
    <div class="contentList storyWordsList">${listMarkup(groups) || '<div class="storyWordsEmpty">Слов нет</div>'}</div>
  </section>`;

  const searchControl = context.shell.headerActionSlot?.querySelector("[data-story-search-control]");
  const input = searchControl?.querySelector(".storyWordHeaderSearchInput");
  const toggle = searchControl?.querySelector(".storyWordSearchToggle");
  const list = context.root.querySelector(".storyWordsList");
  const rows = [...context.root.querySelectorAll("[data-story-word-row]")];
  const sectionGroups = [...context.root.querySelectorAll("[data-story-section-group]")];
  const catalogGroups = [...context.root.querySelectorAll("[data-story-catalog-group]")];
  let searchOpen = false;
  let stopMarquees = () => {};

  function bindMarquees() {
    stopMarquees();
    stopMarquees = bindOverflowMarquees(context.root, { signal, scrollRoot: list });
  }

  function applyFilter() {
    const query = normalized(input?.value);
    rows.forEach((row) => { row.hidden = Boolean(query && !row.dataset.search.includes(query)); });
    sectionGroups.forEach((group) => { group.hidden = !group.querySelector("[data-story-word-row]:not([hidden])"); });
    catalogGroups.forEach((group) => { group.hidden = !group.querySelector("[data-story-section-group]:not([hidden])"); });
    requestAnimationFrame(bindMarquees);
  }

  function setSearchOpen(next) {
    searchOpen = Boolean(next);
    searchControl?.classList.toggle("isOpen", searchOpen);
    toggle?.setAttribute("aria-expanded", String(searchOpen));
    toggle?.setAttribute("aria-label", searchOpen ? msg("common.zakryt_poisk") : msg("common.otkryt_poisk"));
    context.shell.setHeaderContent?.({ title: searchOpen ? "" : msg("common.spisok_slov") });
    if (searchOpen) {
      requestAnimationFrame(() => input?.focus({ preventScroll: true }));
    } else {
      if (input) input.value = "";
      input?.blur();
      applyFilter();
    }
  }

  input?.addEventListener("input", applyFilter, { signal });
  input?.addEventListener("keydown", (event) => { if (event.key === "Escape") setSearchOpen(false); }, { signal });
  toggle?.addEventListener("click", () => setSearchOpen(!searchOpen), { signal });
  context.root.querySelectorAll("[data-story-favorite]").forEach((button) => {
    button.addEventListener("click", () => button.classList.toggle("on", wordFavorites.toggle(button.dataset.storyFavorite)), { signal });
  });
  signal?.addEventListener("abort", () => stopMarquees(), { once: true });
  bindMarquees();
}
