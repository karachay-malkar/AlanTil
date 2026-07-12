import { songFavorites } from "../../shared/state/song-favorites.js";
import { renderFavoriteButton } from "../../shared/ui/favorite-button.js";
import { renderContentListRow } from "../../shared/ui/list.js";
import { panel } from "../../shared/ui/panel.js";
import { renderExpandableSearch } from "../../shared/ui/search-control.js";
import { escapeHtml } from "../../shared/ui/html.js";
import { songsState } from "./state.js";

const FAVORITES_PLAYLIST_ID = "__fav__";
const SEARCH_MODES = [
  { value: "title", label: "По названию" },
  { value: "artist", label: "По исполнителю" },
  { value: "lyrics", label: "По тексту" },
];

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

function artistsFrom(value) {
  return String(value || "")
    .split(/\s*\/\s*/g)
    .map((artist) => artist.trim())
    .filter(Boolean);
}

export function renderSongsCatalog(context, playlist, songs, signal) {
  if (!playlist) {
    context.root.innerHTML = panel({ title: "Песни", body: `<div class="errorState">Плейлист не найден.</div>` });
    return;
  }

  const favoritesOnly = playlist.id === FAVORITES_PLAYLIST_ID;
  songFavorites.reload();

  if (songsState.selectedPlaylistId && songsState.selectedPlaylistId !== playlist.id) {
    songsState.searchQuery = "";
    songsState.searchOpen = false;
  }
  songsState.selectedPlaylistId = playlist.id;

  const search = renderExpandableSearch({
    idPrefix: "songsSearch",
    open: songsState.searchOpen,
    modes: SEARCH_MODES,
    selectedMode: songsState.searchMode,
  });

  context.root.innerHTML = panel({
    title: playlist.title,
    headerExtra: search.header,
    body: `${search.modes}<div id="songsCatalogList" class="contentList"></div>`,
    classes: "songsCatalogPanel",
  });

  const input = context.root.querySelector("#songsSearchInput");
  const toggle = context.root.querySelector("#songsSearchToggle");
  const control = context.root.querySelector("[data-search-control]");
  const modes = context.root.querySelector("#songsSearchModes");
  const list = context.root.querySelector("#songsCatalogList");
  input.value = songsState.searchQuery;

  function draw() {
    const query = normalizeSearchValue(songsState.searchQuery);
    const available = favoritesOnly ? songs.filter((song) => songFavorites.has(song.id)) : songs;
    const filtered = available.filter((song) => {
      if (!query) return true;
      return normalizeSearchValue(valueForMode(song, songsState.searchMode)).includes(query);
    });

    list.innerHTML = filtered.length
      ? filtered.map((song) => renderContentListRow({
          id: song.id,
          primary: song.title,
          pills: artistsFrom(song.artist),
          clickable: true,
          openAttributes: `data-song-open="${escapeHtml(song.id)}"`,
          trailingHtml: renderFavoriteButton({
            active: songFavorites.has(song.id),
            attributes: `data-song-favorite-id="${escapeHtml(song.id)}"`,
            label: songFavorites.has(song.id) ? "Удалить песню из избранного" : "Добавить песню в избранное",
          }),
        })).join("")
      : `<div class="emptyState"><div class="emptyStateTitle">${favoritesOnly && !query ? "Избранных песен пока нет" : "Ничего не найдено"}</div></div>`;

    list.querySelectorAll("[data-song-open]").forEach((button) => {
      button.addEventListener("click", () => {
        songsState.scrollPositions[playlist.id] = list.closest(".panel-body")?.scrollTop || 0;
        context.router.navigate("songs.song", { playlistId: playlist.id, songId: button.dataset.songOpen });
      }, { signal });
    });

    list.querySelectorAll("[data-song-favorite-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const active = songFavorites.toggle(button.dataset.songFavoriteId);
        button.classList.toggle("on", active);
        button.setAttribute("aria-label", active ? "Удалить песню из избранного" : "Добавить песню в избранное");
        button.setAttribute("title", active ? "Удалить песню из избранного" : "Добавить песню в избранное");
        if (favoritesOnly && !active) draw();
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
      context.root.querySelectorAll(".searchModeItem").forEach((label) => {
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
