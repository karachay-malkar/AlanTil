import { renderSectionMenu } from "../../shared/ui/list.js";
import { panel } from "../../shared/ui/panel.js";

const FAVORITES_PLAYLIST_ID = "__fav__";

export function renderPlaylists(context, playlists, signal) {
  const items = [
    { id: FAVORITES_PLAYLIST_ID, title: "Избранные песни", favorite: true },
    ...playlists.map((playlist) => ({ id: playlist.id, title: playlist.title })),
  ];

  context.root.innerHTML = panel({
    title: "Песни",
    body: playlists.length
      ? renderSectionMenu(items, { dataName: "playlist-id" })
      : `${renderSectionMenu(items.slice(0, 1), { dataName: "playlist-id" })}<div class="emptyState"><div class="emptyStateTitle">Песни пока не добавлены</div></div>`,
  });

  context.root.querySelectorAll("[data-playlist-id]").forEach((button) => {
    button.addEventListener("click", () => {
      context.router.navigate("songs.catalog", { playlistId: button.dataset.playlistId });
    }, { signal });
  });
}
