import { panel } from "../../shared/ui/panel.js";
import { escapeHtml } from "../../shared/ui/word-renderers.js";
import { songsState } from "./state.js";

function searchText(song) {
  return [song.title, song.artist, song.info, song.metadata]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ru");
}

export function renderSongsCatalog(context, playlist, songs, signal) {
  if (!playlist) {
    context.root.innerHTML = panel({ title: "Песни", body: `<div class="errorState">Плейлист не найден.</div>`, classes: "songsPanel" });
    return;
  }

  if (songsState.selectedPlaylistId && songsState.selectedPlaylistId !== playlist.id) songsState.searchQuery = "";
  songsState.selectedPlaylistId = playlist.id;
  context.root.innerHTML = panel({
    title: escapeHtml(playlist.title),
    headerExtra: `<input id="songsSearchInput" class="searchInput" type="search" placeholder="Поиск..." autocomplete="off" />`,
    body: `<div id="songsCatalogList" class="songsCatalogList"></div>`,
    classes: "songsPanel",
  });

  const input = context.root.querySelector("#songsSearchInput");
  const list = context.root.querySelector("#songsCatalogList");
  input.value = songsState.searchQuery;

  function draw() {
    const query = songsState.searchQuery.trim().toLocaleLowerCase("ru");
    const filtered = songs.filter((song) => !query || searchText(song).includes(query));
    list.innerHTML = filtered.length
      ? filtered.map((song, index) => `
          <button class="songCatalogItem" type="button" data-song-id="${escapeHtml(song.id)}">
            <span class="songCatalogNumber">${index + 1}</span>
            <span class="songCatalogText">
              <span class="songCatalogTitle">${escapeHtml(song.title)}</span>
              ${song.artist ? `<span class="songCatalogArtist">${escapeHtml(song.artist)}</span>` : ""}
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

  input.addEventListener("input", () => {
    songsState.searchQuery = input.value;
    draw();
  }, { signal });
  draw();

  requestAnimationFrame(() => {
    const body = list.closest(".panel-body");
    if (body) body.scrollTop = songsState.scrollPositions[playlist.id] || 0;
  });
}
