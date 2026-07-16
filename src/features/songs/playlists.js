import { renderSectionMenu } from "../../shared/ui/list.js";
import { panel } from "../../shared/ui/panel.js?v=13.6.2";
import { buildPlaylistRoutes } from "./routes.js";

const FAVORITES_PLAYLIST_ID = "__fav__";

export function renderPlaylists(context, playlists, signal) {
  context.shell.setHeaderContent?.({ title: "Песни" });
  const items = [
    { id: "favorites", title: "Избранные песни", favorite: true },
    ...buildPlaylistRoutes(playlists).map(({ playlist, slug }) => ({ id: slug, title: playlist.title, playlistId: playlist.id })),
  ];

  context.root.innerHTML = panel({
    title: "Песни",
    body: playlists.length
      ? renderSectionMenu(items, { dataName: "playlist-slug" })
      : `${renderSectionMenu(items.slice(0, 1), { dataName: "playlist-slug" })}<div class="emptyState"><div class="emptyStateTitle">Песни пока не добавлены</div></div>`,
  });

  const routes = buildPlaylistRoutes(playlists);
  context.root.querySelectorAll("[data-playlist-slug]").forEach((button) => {
    button.addEventListener("click", () => {
      const playlistSlug = button.dataset.playlistSlug;
      const playlistId = playlistSlug === "favorites"
        ? FAVORITES_PLAYLIST_ID
        : routes.find((entry) => entry.slug === playlistSlug)?.playlist.id || "";
      context.router.navigate("songs.catalog", { playlistSlug, playlistId, songId: null });
    }, { signal });
  });
}
