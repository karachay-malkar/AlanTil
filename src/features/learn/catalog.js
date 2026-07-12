import { DICT_TITLES, SECTION_TITLES } from "../../config/words.js";
import { dictsFrom, sectionsFrom, setsFrom, wordsForSet } from "../../shared/domain/word-selection.js";
import { wordFavorites } from "../../shared/state/word-favorites.js";
import { panel } from "../../shared/ui/panel.js";
import { escapeHtml, renderStarButton } from "../../shared/ui/word-renderers.js";
import { getHiddenSet, isSetFinished, learnState, setHiddenSet, toggleSetFinished } from "./state.js";

function dictTitle(code) {
  return DICT_TITLES[code] || code;
}

function sectionTitle(code) {
  return SECTION_TITLES[code] || code;
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
  context.root.innerHTML = panel({
    title: "Учить слова",
    body: `<div id="dictsList" class="stack">
      <button class="btn" type="button" data-dict="__fav__">⭐ Избранное</button>
      ${dicts.map((dict) => `<button class="btn" type="button" data-dict="${escapeHtml(dict)}">${escapeHtml(dictTitle(dict))}</button>`).join("")}
    </div><div class="smallNote"></div>`,
  });

  context.root.querySelectorAll("[data-dict]").forEach((button) => {
    button.addEventListener("click", () => {
      learnState.currentDict = button.dataset.dict;
      if (learnState.currentDict === "__fav__") {
        learnState.currentSection = "Избранное";
        learnState.currentSet = 1;
        context.router.navigate("learn.set");
      } else {
        context.router.navigate("learn.sections");
      }
    }, { signal });
  });
}

export function renderSections(context, words, signal) {
  const dict = learnState.currentDict;
  if (!dict) {
    context.router.replace("learn.catalog", {}, { force: true });
    return;
  }

  const sections = dict === "__fav__" ? ["Избранное"] : sectionsFrom(words, dict);
  const body = sections.map((section) => {
    const sets = dict === "__fav__" ? [1] : setsFrom(words, dict, section);
    const tiles = sets.map((setNumber) => {
      const finished = isSetFinished(dict, section, setNumber);
      const title = dict === "__fav__" ? "Избранное" : (typeof setNumber === "number" ? `Сет ${setNumber}` : String(setNumber));
      return `
        <div class="setTile set-tile ${finished ? "selected" : ""}" role="button" tabindex="0" data-section="${escapeHtml(section)}" data-set="${escapeHtml(setNumber)}">
          <button class="setDone setTileCorner set-tile__corner" data-done="1" type="button" aria-label="Отметить как выучено">
            <svg viewBox="0 0 24 24" class="setCheck ${finished ? "active" : ""}">
              <rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke-width="1.7"></rect>
              <path d="M7 10.5 L11.5 16 L17 6.5" fill="none" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </button>
          <div class="setTileTitle">${escapeHtml(title)}</div>
        </div>`;
    }).join("");
    return `<div class="secBlock"><div class="secTitle">${escapeHtml(sectionTitle(section))}</div><div class="setsGrid">${tiles}</div></div>`;
  }).join("");

  context.root.innerHTML = panel({
    title: escapeHtml(dict === "__fav__" ? "Избранное" : dictTitle(dict)),
    headerExtra: dict === "__fav__" ? "" : `<button id="btnOpenDictContent" class="iconBtn" type="button" aria-label="Содержание словаря" title="Содержание словаря"><img src="assets/icons/words-search.svg" alt="" /></button>`,
    body: `<div id="sectionsList" class="stack">${body}</div>`,
  });

  context.root.querySelector("#btnOpenDictContent")?.addEventListener("click", () => context.router.navigate("learn.catalog-content"), { signal });
  context.root.querySelectorAll(".setTile").forEach((tile) => {
    const section = tile.dataset.section;
    const rawSet = tile.dataset.set;
    const setNumber = Number.isNaN(Number(rawSet)) ? rawSet : Number(rawSet);
    tile.querySelector("[data-done='1']")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const on = toggleSetFinished(dict, section, setNumber);
      tile.classList.toggle("selected", on);
      tile.querySelector(".setCheck")?.classList.toggle("active", on);
    }, { signal });

    const open = () => {
      learnState.currentSection = section;
      learnState.currentSet = setNumber;
      context.router.navigate("learn.set");
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
    headerExtra: `<input id="dictSearchInput" class="searchInput" type="text" placeholder="Поиск..." />`,
    body: `<div id="dictContentList" class="stack"></div>`,
  });

  const input = context.root.querySelector("#dictSearchInput");
  const list = context.root.querySelector("#dictContentList");
  const byId = new Map(words.map((word) => [word.id, word]));

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
        ${entries.map((word) => `
          <div class="dictWordRow">
            <div class="dictNum">${Number(word.dict_order)}.</div>
            <div><div class="w">${escapeHtml(word.word)}</div><div class="t">${escapeHtml(word.trans)}</div></div>
            ${renderStarButton(word.id, `data-word-id="${escapeHtml(word.id)}"`)}
          </div>`).join("")}
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
  }

  input.addEventListener("input", () => draw(input.value), { signal });
  draw();
}

export function renderSetMenu(context, words, signal) {
  const { currentDict, currentSection, currentSet } = learnState;
  if (!currentDict) {
    context.router.replace("learn.catalog", {}, { force: true });
    return;
  }

  learnState.menuHidden = getHiddenSet(currentDict, currentSection, currentSet);
  const allWords = () => currentDict === "__fav__"
    ? words.filter((word) => wordFavorites.has(word.id))
    : wordsForSet(words, currentDict, currentSection, currentSet);

  const title = currentDict === "__fav__" ? "⭐ Избранное" : (typeof currentSet === "number" ? `Сет ${currentSet}` : String(currentSet));
  context.root.innerHTML = panel({
    title: escapeHtml(title),
    body: `
      <div class="hintText" id="setMenuInfo"></div>
      <div class="row"><button id="btnModeKb" class="btn primary" type="button">АЛАН → РУС</button><button id="btnModeRu" class="btn primary" type="button">РУС → АЛАН</button></div>
      <div class="row"><button id="btnSetShowAll" class="btn" type="button">Показать все</button><button id="btnSetHideAll" class="btn" type="button">Скрыть все</button></div>
      <div id="setWordsList" class="list"></div>`,
  });

  const info = context.root.querySelector("#setMenuInfo");
  const list = context.root.querySelector("#setWordsList");

  function updateInfo() {
    const all = allWords();
    const active = all.filter((word) => !learnState.menuHidden.has(word.id));
    info.textContent = `Слов в сете: ${all.length} • В сессии: ${active.length}`;
  }

  function draw() {
    const all = allWords();
    list.innerHTML = all.map((word) => `
      <div class="item" data-id="${escapeHtml(word.id)}">
        <input class="checkbox" type="checkbox" ${learnState.menuHidden.has(word.id) ? "" : "checked"} />
        <div><div class="w">${escapeHtml(word.word)}</div><div class="t">${escapeHtml(word.trans)}</div></div>
        ${renderStarButton(word.id, `data-word-id="${escapeHtml(word.id)}"`)}
      </div>`).join("");

    list.querySelectorAll(".item").forEach((row) => {
      const id = row.dataset.id;
      row.querySelector(".checkbox").addEventListener("change", (event) => {
        if (event.target.checked) learnState.menuHidden.delete(id);
        else learnState.menuHidden.add(id);
        setHiddenSet(currentDict, currentSection, currentSet, learnState.menuHidden);
        updateInfo();
      }, { signal });
    });

    wireStars(list, new Map(all.map((word) => [word.id, word])), (_word, on) => {
      if (currentDict === "__fav__" && !on) draw();
      updateInfo();
    });
  }

  context.root.querySelector("#btnSetShowAll").addEventListener("click", () => {
    learnState.menuHidden = new Set();
    setHiddenSet(currentDict, currentSection, currentSet, learnState.menuHidden);
    draw();
    updateInfo();
  }, { signal });

  context.root.querySelector("#btnSetHideAll").addEventListener("click", () => {
    learnState.menuHidden = new Set(allWords().map((word) => word.id));
    setHiddenSet(currentDict, currentSection, currentSet, learnState.menuHidden);
    draw();
    updateInfo();
  }, { signal });

  context.root.querySelector("#btnModeKb").addEventListener("click", () => context.router.navigate("learn.study", { mode: "kb" }), { signal });
  context.root.querySelector("#btnModeRu").addEventListener("click", () => context.router.navigate("learn.study", { mode: "ru" }), { signal });
  draw();
  updateInfo();
}
