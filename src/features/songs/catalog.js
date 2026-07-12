import { panel } from "../../shared/ui/panel.js";
import { escapeHtml } from "../../shared/ui/word-renderers.js";
import { songsState } from "./state.js";

const SEARCH_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M9.5 3a6.5 6.5 0 1 0 3.98 11.64L19.85 21 21 19.85l-6.36-6.37A6.5 6.5 0 0 0 9.5 3Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"></path>
  </svg>`;

function normalizeSearchValue(value) {
  return String(value || "")
    .normalize("NFC")
    .toLocaleLowerCase("ru")
    .replace(/\s+/g, " ")
    .trim();
}

function valueForMode(song, mode) {
  if (mode === "artist") return song.artist;
  if (mode === "lyrics") return song.lyrics;
  return song.title;
}

function artistPills(artist) {
  const artists = String(artist || "")
    .split(/\s*\/\s*/g)
    .map((value) => value.trim())
    .filter(Boolean);
  if (!artists.length) return "";
  return `<span class="songArtistPills">${artists.map((value) => `<span class="songArtistPill">${escapeHtml(value)}</span>`).join("")}</span>`;
}

function searchModesMarkup() {
  const modes = [
    ["title", "По названию"],
    ["artist", "По исполнителю"],
    ["lyrics", "По тексту"],
  ];
  return modes.map(([value, label]) => `
    <label class="songsSearchMode ${songsState.searchMode === value ? "active" : ""}">
      <input type="radio" name="songsSearchMode" value="${value}" ${songsState.searchMode === value ? "checked" : ""} />
      <span class="songsSearchModeDot" aria-hidden="true"></span>
      <span>${label}</span>
    </label>`).join("");
}

export function renderSongsCatalog(context, playlist, songs, signal) {
  if (!playlist) {
    context.root.innerHTML = panel({ title: "Песни", body: `<div class="errorState">Плейлист не найден.</div>`, classes: "songsPanel" });
    return;
  }

  if (songsState.selectedPlaylistId && songsState.selectedPlaylistId !== playlist.id) {
    songsState.searchQuery = "";
    songsState.searchOpen = false;
  }
  songsState.selectedPlaylistId = playlist.id;

  context.root.innerHTML = panel({
    title: escapeHtml(playlist.title),
    headerExtra: `
      <div class="songsSearchControl ${songsState.searchOpen ? "open" : ""}">
        <input id="songsSearchInput" class="songsSearchInput" type="search" placeholder="Поиск..." autocomplete="off" aria-label="Поиск песен" />
        <button id="songsSearchToggle" class="songsSearchToggle" type="button" aria-label="Открыть поиск" aria-expanded="${songsState.searchOpen}">${SEARCH_ICON}</button>
      </div>`,
    body: `
      <div id="songsSearchModes" class="songsSearchModes ${songsState.searchOpen ? "" : "hidden"}" role="radiogroup" aria-label="Область поиска">
        ${searchModesMarkup()}
      </div>
      <div id="songsCatalogList" class="songsCatalogList"></div>`,
    classes: "songsPanel songsCatalogPanel",
  });

  const input = context.root.querySelector("#songsSearchInput");
  const toggle = context.root.querySelector("#songsSearchToggle");
  const control = context.root.querySelector(".songsSearchControl");
  const modes = context.root.querySelector("#songsSearchModes");
  const list = context.root.querySelector("#songsCatalogList");
  input.value = songsState.searchQuery;

  function draw() {
    const query = normalizeSearchValue(songsState.searchQuery);
    const filtered = songs.filter((song) => {
      if (!query) return true;
      return normalizeSearchValue(valueForMode(song, songsState.searchMode)).includes(query);
    });

    list.innerHTML = filtered.length
      ? filtered.map((song) => `
          <button class="songCatalogItem" type="button" data-song-id="${escapeHtml(song.id)}">
            <span class="songCatalogText">
              <span class="songCatalogTitle">${escapeHtml(song.title)}</span>
              ${artistPills(song.artist)}
            </span>
            <span class="songsChevron" aria-hidden="true">›</span>
          </button>`).join("")
      : `<div class="songsEmptyState"><div class="songsEmptyTitle">Ничего не найдено</div></div>`;

    list.querySelectorAll("[data-song-id]").forEach((button) => {
      button.addEventListener("click", () => {
        songsState.scrollPositions[playlist.id] = list.closest(".panel-body")?.scrollTop || 0;
        context.router.navigate("songs.song", { playlistId: playlist.id, songId: button.dataset.songId });
      }, { signal });
    });
  }

  function setSearchOpen(open) {
    songsState.searchOpen = open;
    control.classList.toggle("open", open);
    modes.classList.toggle("hidden", !open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Закрыть поиск" : "Открыть поиск");
    if (open) {
      requestAnimationFrame(() => input.focus());
    } else {
      songsState.searchQuery = "";
      input.value = "";
      draw();
    }
  }

  toggle.addEventListener("click", () => setSearchOpen(!songsState.searchOpen), { signal });
  input.addEventListener("input", () => {
    songsState.searchQuery = input.value;
    draw();
  }, { signal });
  context.root.querySelectorAll('input[name="songsSearchMode"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      songsState.searchMode = radio.value;
      context.root.querySelectorAll(".songsSearchMode").forEach((label) => {
        label.classList.toggle("active", label.contains(radio));
      });
      draw();
      input.focus();
    }, { signal });
  });

  draw();

  requestAnimationFrame(() => {
    const body = list.closest(".panel-body");
    if (body) body.scrollTop = songsState.scrollPositions[playlist.id] || 0;
  });
}
