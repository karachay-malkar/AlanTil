import { msg } from "../../shared/i18n/index.js?v=13.10.3";
import { trackEvent } from "../../shared/analytics/analytics.js?v=13.9.0";
import { EVENTS } from "../../shared/analytics/events.js?v=13.9.0";
import { getWords } from "../../shared/data/word-repository.js?v=13.10.3";
import { songFavorites } from "../../shared/state/song-favorites.js?v=13.9.0";
import { closeInfoModal } from "../../shared/ui/info-modal.js?v=13.9.0";
import { renderSongsCatalog } from "./catalog.js?v=13.9.0";
import { getPlaylists, getSongById, getSongs, getSongsByPlaylist } from "./repository.js?v=13.10.3";
import { resolvePlaylistBySlug, slugForPlaylist } from "./routes.js?v=13.9.0";
import { renderPlaylists } from "./playlists.js?v=13.9.0";
import { songsState } from "./state.js?v=13.9.0";

let controller = null;
let activeContext = null;
let disposeActivePlayer = null;

async function loadSongScreen() {
  const [view, player] = await Promise.all([
    import("./song-view.js?v=13.9.0"),
    import("./player.js?v=13.9.0"),
  ]);
  disposeActivePlayer = player.disposePlayer;
  return view.renderSongView;
}

function renderLoading(context) {
  context.root.innerHTML = `<section class="view screen"><div class="loadingState" role="status">${msg("common.otkryvaem")}</div></section>`;
}

function renderLoadError(context) {
  context.root.innerHTML = `<section class="view screen"><div class="panel"><div class="errorState">${msg("common.ne_udalos_otkryt_razdel")}</div></div></section>`;
}

async function renderRequestedScreen(context, params, signal) {
  const screen = params.screen || "playlists";

  if (screen === "playlists") {
    const playlists = await getPlaylists();
    if (signal.aborted) return;
    renderPlaylists(context, playlists, signal);
    trackEvent(EVENTS.SONGS_OPEN, { playlist_count: playlists.length });
    return;
  }

  if (screen === "catalog") {
    const playlistSlug = String(params.playlistSlug || "");
    if (playlistSlug === "favorites") {
      const songs = await getSongs();
      if (signal.aborted) return;
      songFavorites.reload();
      const favoriteCount = songs.filter((song) => songFavorites.has(song.id)).length;
      renderSongsCatalog(context, { id: "__fav__", title: msg("songs.izbrannye_pesni"), slug: "favorites" }, songs, signal);
      trackEvent(EVENTS.PLAYLIST_OPEN, { playlist_id: "__fav__", song_count: favoriteCount });
      return;
    }

    const playlists = await getPlaylists();
    if (signal.aborted) return;
    const playlist = params.playlistId
      ? playlists.find((item) => item.id === String(params.playlistId)) || null
      : resolvePlaylistBySlug(playlists, playlistSlug);
    const songs = playlist ? await getSongsByPlaylist(playlist.id) : [];
    if (signal.aborted) return;
    renderSongsCatalog(context, playlist ? { ...playlist, slug: slugForPlaylist(playlists, playlist.id) } : null, songs, signal);
    if (playlist) trackEvent(EVENTS.PLAYLIST_OPEN, { playlist_id: playlist.id, song_count: songs.length });
    return;
  }

  if (screen === "song") {
    const songId = String(params.songId || songsState.selectedSongId || "");
    const [renderSongView, song, words] = await Promise.all([
      loadSongScreen(),
      getSongById(songId),
      getWords(),
    ]);
    if (signal.aborted) return;
    renderSongView(context, song, words, signal);
    return;
  }

  context.root.innerHTML = `<section class="view screen"><div class="panel"><div class="errorState">${msg("songs.neizvestnyy_ekran_pesen")}</div></div></section>`;
}

export function mount(context, params = {}) {
  activeContext = context;
  controller = new AbortController();
  disposeActivePlayer = null;
  const screen = params.screen || "playlists";
  songsState.currentScreen = screen;
  renderLoading(context);
  void renderRequestedScreen(context, params, controller.signal).catch((error) => {
    if (controller?.signal.aborted) return;
    console.warn("songs: screen load failed", error);
    renderLoadError(context);
  });
}

export function unmount() {
  controller?.abort();
  controller = null;
  closeInfoModal();
  disposeActivePlayer?.();
  disposeActivePlayer = null;
  activeContext?.shell.setCounter("");
  activeContext = null;
}

export function canLeave() {
  return true;
}
