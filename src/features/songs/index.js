import { getWords } from "../../shared/data/word-repository.js";
import { closeInfoModal } from "../../shared/ui/info-modal.js";
import { renderSongsCatalog } from "./catalog.js";
import { disposePlayer } from "./player.js";
import { getPlaylists, getSongById, getSongsByPlaylist } from "./repository.js";
import { renderPlaylists } from "./playlists.js";
import { renderSongView } from "./song-view.js";
import { songsState } from "./state.js";

let controller = null;
let activeContext = null;

export async function mount(context, params = {}) {
  activeContext = context;
  context.ensureStyle("src/features/songs/songs.css", "songs-feature-style");
  context.ensureStyle("src/shared/styles/word-card.css", "word-card-style");
  controller = new AbortController();
  const screen = params.screen || "playlists";
  songsState.currentScreen = screen;

  if (screen === "playlists") {
    renderPlaylists(context, await getPlaylists(), controller.signal);
    return;
  }

  if (screen === "catalog") {
    const playlists = await getPlaylists();
    const playlistId = String(params.playlistId || songsState.selectedPlaylistId || "");
    const playlist = playlists.find((item) => item.id === playlistId) || null;
    renderSongsCatalog(context, playlist, await getSongsByPlaylist(playlistId), controller.signal);
    return;
  }

  if (screen === "song") {
    const songId = String(params.songId || songsState.selectedSongId || "");
    const [song, words] = await Promise.all([getSongById(songId), getWords()]);
    renderSongView(context, song, words, controller.signal);
    return;
  }

  context.root.innerHTML = `<section class="view screen"><div class="panel"><div class="errorState">Неизвестный экран песен.</div></div></section>`;
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
