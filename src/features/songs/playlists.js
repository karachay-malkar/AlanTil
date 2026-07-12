import { panel } from "../../shared/ui/panel.js";
import { escapeHtml } from "../../shared/ui/word-renderers.js";

export function renderPlaylists(context, playlists, signal) {
  const body = playlists.length
    ? `<div class="songsPlaylistGrid">${playlists.map((playlist) => `
        <button class="songsPlaylistCard" type="button" data-playlist-id="${escapeHtml(playlist.id)}">
          <span class="songsPlaylistIcon" aria-hidden="true">♫</span>
          <span class="songsPlaylistText">
            <span class="songsPlaylistTitle">${escapeHtml(playlist.title)}</span>
            ${playlist.description ? `<span class="songsPlaylistDescription">${escapeHtml(playlist.description)}</span>` : ""}
            <span class="songsPlaylistCount">${playlist.count} ${playlist.count === 1 ? "песня" : (playlist.count >= 2 && playlist.count <= 4 ? "песни" : "песен")}</span>
          </span>
          <span class="songsChevron" aria-hidden="true">›</span>
        </button>`).join("")}</div>`
    : `<div class="songsEmptyState"><div class="songsEmptyIcon">♫</div><div class="songsEmptyTitle">Песни пока не добавлены</div><div class="smallNote">Подключите таблицу песен в <code>src/config/songs.js</code>.</div></div>`;

  context.root.innerHTML = panel({ title: "Песни", body, classes: "songsPanel" });
  context.root.querySelectorAll("[data-playlist-id]").forEach((button) => {
    button.addEventListener("click", () => {
      context.router.navigate("songs.catalog", { playlistId: button.dataset.playlistId });
    }, { signal });
  });
}
