import { toSlug } from "../../shared/domain/slugs.js?v=13.8.1";

export function buildPlaylistRoutes(playlists) {
  const occupied = new Set(["favorites"]);
  return (Array.isArray(playlists) ? playlists : []).map((playlist) => {
    const base = toSlug(playlist.title || playlist.id, "playlist");
    let slug = base;
    let suffix = 2;
    while (occupied.has(slug)) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    occupied.add(slug);
    return { playlist, slug };
  });
}

export function resolvePlaylistBySlug(playlists, slug) {
  return buildPlaylistRoutes(playlists).find((entry) => entry.slug === String(slug || "").toLowerCase())?.playlist || null;
}

export function slugForPlaylist(playlists, playlistId) {
  return buildPlaylistRoutes(playlists).find((entry) => entry.playlist.id === playlistId)?.slug || "";
}
