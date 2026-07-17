import { trackEvent } from "../../shared/analytics/analytics.js?v=13.8";
import { EVENTS, SEARCH_AREAS } from "../../shared/analytics/events.js?v=13.8";
import { songFavorites } from "../../shared/state/song-favorites.js?v=13.8";
import { renderFavoriteButton } from "../../shared/ui/favorite-button.js?v=13.8";
import { renderContentListRow } from "../../shared/ui/list.js?v=13.8";
import { panel } from "../../shared/ui/panel.js?v=13.8";
import { renderExpandableSearch } from "../../shared/ui/search-control.js?v=13.8";
import { escapeHtml } from "../../shared/ui/html.js?v=13.8";
import { songsState } from "./state.js?v=13.8";

const FAVORITES_PLAYLIST_ID = "__fav__";
const SEARCH_MODES = [
  { value: "title", label: "Название" },
  { value: "artist", label: "Исполнитель" },
  { value: "lyrics", label: "Текст" },
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
    context.shell.setHeaderContent?.({ title: "Песни" });
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
  context.shell.setHeaderContent?.({ title: playlist.title });

  const search = renderExpandableSearch({
    idPrefix: "songsSearch",
    open: songsState.searchOpen,
    modes: SEARCH_MODES,
    selectedMode: songsState.searchMode,
  });
  context.shell.setHeaderAction?.(search.toggle);

  context.root.innerHTML = panel({
    title: playlist.title,
    body: `${search.bar}<div id="songsCatalogList" class="contentList"></div>`,
    classes: "songsCatalogPanel",
  });

  const input = context.root.querySelector("#songsSearchInput");
  const toggle = context.shell.headerActionSlot?.querySelector("#songsSearchToggle");
  const searchBar = context.root.querySelector("#songsSearchBar");
  const list = context.root.querySelector("#songsCatalogList");
  input.value = songsState.searchQuery;
  let searchEventTimer = 0;
  let searchOpenTracked = false;

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
        context.router.navigate("songs.song", { playlistId: playlist.id, playlistSlug: playlist.slug || "favorites", songId: button.dataset.songOpen });
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
    return filtered.length;
  }

  function scheduleSearchEvent(resultCount) {
    window.clearTimeout(searchEventTimer);
    const queryLength = songsState.searchQuery.trim().length;
    if (!queryLength) return;
    searchEventTimer = window.setTimeout(() => {
      trackEvent(resultCount ? EVENTS.SEARCH_RESULT : EVENTS.SEARCH_EMPTY, {
        search_area: SEARCH_AREAS.SONGS,
        search_mode: songsState.searchMode,
        query_length: queryLength,
        result_count: resultCount,
      });
    }, 600);
  }

  function setSearchOpen(open) {
    songsState.searchOpen = open;
    searchBar.classList.toggle("hidden", !open);
    toggle.classList.toggle("active", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Закрыть поиск" : "Открыть поиск");
    if (open) {
      if (!searchOpenTracked) {
        searchOpenTracked = true;
        trackEvent(EVENTS.SEARCH_OPEN, { search_area: SEARCH_AREAS.SONGS, search_mode: songsState.searchMode });
      }
      requestAnimationFrame(() => input.focus());
    } else {
      songsState.searchQuery = "";
      input.value = "";
      draw();
    }
  }

  toggle?.addEventListener("click", () => setSearchOpen(!songsState.searchOpen), { signal });
  input.addEventListener("input", () => {
    songsState.searchQuery = input.value;
    scheduleSearchEvent(draw());
  }, { signal });

  context.root.querySelectorAll('input[name="songsSearchMode"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      songsState.searchMode = radio.value;
      context.root.querySelectorAll(".searchModeItem").forEach((label) => {
        label.classList.toggle("active", label.contains(radio));
      });
      scheduleSearchEvent(draw());
      input.focus();
    }, { signal });
  });

  draw();
  signal.addEventListener("abort", () => window.clearTimeout(searchEventTimer), { once: true });

  requestAnimationFrame(() => {
    const body = list.closest(".panel-body");
    if (body) body.scrollTop = songsState.scrollPositions[playlist.id] || 0;
  });
}
