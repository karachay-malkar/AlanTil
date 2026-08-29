import { wordFavorites } from "../../shared/state/word-favorites.js?v=13.9.0";
import { escapeHtml } from "../../shared/ui/html.js?v=13.9.0";
import { renderStarButton } from "../../shared/ui/word-renderers.js?v=13.9.0";

function normalized(value) { return String(value || "").normalize("NFC").trim().toLocaleLowerCase(); }
function entriesFor(story) {
  const seen = new Set(); let ordinal = 0; const entries = [];
  (story?.catalogs || []).forEach((catalog) => (catalog.sections || []).forEach((section) =>
    (section.stations || []).forEach((station) => (station.words || []).forEach((word) => {
      const id = String(word?.id || ""); if (!id || seen.has(id)) return;
      seen.add(id); entries.push({ word, ordinal: ++ordinal, catalog, section });
    }))));
  return entries;
}
function thematic(catalog) {
  const id = normalized(catalog?.dictionaryId || catalog?.catalogId);
  return id.includes("thematic") || id.includes("temat") || (catalog?.sections?.length || 0) > 2;
}
function row(entry) {
  return `<div class="storyWordRow" data-story-word-row data-search="${escapeHtml(normalized(`${entry.word.word} ${entry.word.trans}`))}"><span class="storyWordOrdinal">${entry.ordinal}.</span><span class="storyWordText"><strong>${escapeHtml(entry.word.word)}</strong><small>${escapeHtml(entry.word.trans)}</small></span>${renderStarButton(entry.word.id, `data-story-favorite="${escapeHtml(entry.word.id)}"`)}</div>`;
}
export function mountStoryWordList({ context, route, storyType, signal } = {}) {
  const story = route?.stories?.[storyType]; if (!story || !context?.shell?.modalRoot) return null;
  wordFavorites.reload(); const entries = entriesFor(story);
  let catalog = null; let section = null;
  const content = entries.map((entry) => {
    const catalogChanged = entry.catalog !== catalog; const sectionChanged = entry.section !== section;
    catalog = entry.catalog; section = entry.section;
    const catalogHeading = catalogChanged && catalog?.name ? `<h2 class="storyWordCatalog">${escapeHtml(catalog.name)}</h2>` : "";
    const sectionHeading = sectionChanged && thematic(catalog) && section?.name ? `<h3 class="storyWordSection">${escapeHtml(section.name)}</h3>` : "";
    return `${catalogHeading}${sectionHeading}${row(entry)}`;
  }).join("");
  const overlay = document.createElement("div"); overlay.className = "storyWordsOverlay"; overlay.hidden = true;
  overlay.innerHTML = `<section class="storyWordsPanel" role="dialog" aria-modal="true" aria-label="Список слов"><header class="storyWordsHeader"><button type="button" data-story-words-close aria-label="Назад">‹</button><h1>Список слов</h1></header><div class="storyWordsSearch"><span aria-hidden="true">⌕</span><input type="search" inputmode="search" autocomplete="off" aria-label="Поиск слова" placeholder="Поиск слова"></div><div class="storyWordsList">${content || '<div class="storyWordsEmpty">Слов нет</div>'}</div></section>`;
  context.shell.modalRoot.appendChild(overlay);
  const input = overlay.querySelector("input"); const rows = [...overlay.querySelectorAll("[data-story-word-row]")]; const headings = [...overlay.querySelectorAll(".storyWordCatalog,.storyWordSection")];
  input?.addEventListener("input", () => { const q = normalized(input.value); rows.forEach((r) => { r.hidden = Boolean(q && !r.dataset.search.includes(q)); }); headings.forEach((h) => { let n=h.nextElementSibling,v=false; while(n&&!n.matches(".storyWordCatalog,.storyWordSection")){if(n.matches("[data-story-word-row]")&&!n.hidden){v=true;break}n=n.nextElementSibling} h.hidden=!v; }); }, { signal });
  overlay.querySelectorAll("[data-story-favorite]").forEach((b) => b.addEventListener("click", () => b.classList.toggle("on", wordFavorites.toggle(b.dataset.storyFavorite)), { signal }));
  const close = () => { overlay.hidden = true; document.body.classList.remove("story-words-open"); };
  overlay.querySelector("[data-story-words-close]")?.addEventListener("click", close, { signal });
  signal?.addEventListener("abort", () => { close(); overlay.remove(); }, { once:true });
  return { open(){ overlay.hidden=false; document.body.classList.add("story-words-open"); input?.focus({preventScroll:true}); }, close };
}
