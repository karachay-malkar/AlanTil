import { msg } from "../../shared/i18n/index.js?v=13.9.0";
import { trackEvent } from "../../shared/analytics/analytics.js?v=13.9.0";
import { EVENTS } from "../../shared/analytics/events.js?v=13.9.0";
import { getWords } from "../../shared/data/word-repository.js?v=13.9.0";
import { songFavorites } from "../../shared/state/song-favorites.js?v=13.9.0";
import { closeInfoModal } from "../../shared/ui/info-modal.js?v=13.9.0";
import { renderSongsCatalog } from "./catalog.js?v=13.9.0";
import { disposePlayer } from "./player.js?v=13.9.0";
import { getPlaylists, getSongById, getSongs, getSongsByPlaylist } from "./repository.js?v=13.9.0";
import { resolvePlaylistBySlug, slugForPlaylist } from "./routes.js?v=13.9.0";
import { renderPlaylists } from "./playlists.js?v=13.9.0";
import { renderSongView } from "./song-view.js?v=13.9.0";
import { songsState } from "./state.js?v=13.9.0";

let controller = null;
let activeContext = null;

export async function mount(context, params = {}) {
  activeContext = context;
  controller = new AbortController();
  const screen = params.screen || "playlists";
  songsState.currentScreen = screen;

  if (screen === "playlists") {
    const playlists = await getPlaylists();
    renderPlaylists(context, playlists, controller.signal);
    trackEvent(EVENTS.SONGS_OPEN, { playlist_count: playlists.length });
    return;
  }

  if (screen === "catalog") {
    const playlistSlug = String(params.playlistSlug || "");
    if (playlistSlug === "favorites") {
      const songs = await getSongs();
      songFavorites.reload();
      const favoriteCount = songs.filter((song) => songFavorites.has(song.id)).length;
      renderSongsCatalog(context, { id: "__fav__", title: msg("songs.izbrannye_pesni"), slug: "favorites" }, songs, controller.signal);
      trackEvent(EVENTS.PLAYLIST_OPEN, { playlist_id: "__fav__", song_count: favoriteCount });
      return;
    }

    const playlists = await getPlaylists();
    const playlist = params.playlistId
      ? playlists.find((item) => item.id === String(params.playlistId)) || null
      : resolvePlaylistBySlug(playlists, playlistSlug);
    const songs = playlist ? await getSongsByPlaylist(playlist.id) : [];
    renderSongsCatalog(context, playlist ? { ...playlist, slug: slugForPlaylist(playlists, playlist.id) } : null, songs, controller.signal);
    if (playlist) trackEvent(EVENTS.PLAYLIST_OPEN, { playlist_id: playlist.id, song_count: songs.length });
    return;
  }

  if (screen === "song") {
    const songId = String(params.songId || songsState.selectedSongId || "");
    const [song, words] = await Promise.all([getSongById(songId), getWords()]);
    renderSongView(context, song, words, controller.signal);
    return;
  }

  context.root.innerHTML = `<section class="view screen"><div class="panel"><div class="errorState">${msg("songs.neizvestnyy_ekran_pesen")}</div></div></section>`;
}

export function unmount() {
  controller?.abort();
  controller = null;
  closeInfoModal();
  disposePlayer();
  activeContext?.shell.setCounter("");
  activeContext = null;
}

export function canLeave() {
  return true;
}
