import { trackEvent } from "../../shared/analytics/analytics.js";
import { DIRECTIONS, EVENTS, WORD_RESULTS, WORD_SOURCES } from "../../shared/analytics/events.js";
import { panel } from "../../shared/ui/panel.js?v=13.6.2";
import { openInfoModal } from "../../shared/ui/info-modal.js";
import { openWordCard } from "../../shared/ui/word-card.js";
import { escapeHtml } from "../../shared/ui/word-renderers.js";
import { renderSongLyrics } from "./lyrics-renderer.js";
import { mountPlayer } from "./player.js";
import { songsState } from "./state.js";

function songInformation(song) {
  const blocks = [];
  if (song.artist) blocks.push(`<div><strong>Исполнитель:</strong> ${escapeHtml(song.artist)}</div>`);
  if (song.playlistTitle) blocks.push(`<div><strong>Плейлист:</strong> ${escapeHtml(song.playlistTitle)}</div>`);
  if (song.info) blocks.push(`<div class="songInfoText">${escapeHtml(song.info).replaceAll("\n", "<br>")}</div>`);
  return blocks.join("");
}

export function renderSongView(context, song, words, signal) {
  if (!song) {
    context.shell.setHeaderContent?.({ title: "Песня" });
    context.root.innerHTML = panel({ title: "Песня", body: `<div class="errorState">Песня не найдена.</div>`, classes: "songsPanel" });
    return;
  }

  songsState.selectedPlaylistId = song.playlistId;
  songsState.selectedSongId = song.id;
  context.shell.setHeaderContent?.({ title: song.title, subtitle: song.artist || "" });
  const lyricsMarkup = renderSongLyrics(song.lyrics, song.translation, words);

  context.root.innerHTML = panel({
    title: escapeHtml(song.title),
    headerExtra: `<button id="songInfoButton" class="iconBtn songInfoButton" type="button" aria-label="Информация о песне" title="Информация о песне">i</button>`,
    body: `
      ${song.audioUrl ? `<div id="songPlayerRoot" class="songPlayerRoot"></div>` : ""}
      ${lyricsMarkup ? `<article class="songLyrics" id="songLyrics">${lyricsMarkup}</article>` : ""}`,
    classes: "songsPanel songViewPanel",
  });

  trackEvent(EVENTS.SONG_OPEN, {
    song_id: song.id,
    playlist_id: song.playlistId,
    has_audio: Boolean(song.audioUrl),
  });

  const playerRoot = context.root.querySelector("#songPlayerRoot");
  if (playerRoot) {
    mountPlayer(playerRoot, song, {
      onStateChange(playerState) {
        songsState.player = { ...playerState };
      },
    });
  }

  context.root.querySelector("#songInfoButton")?.addEventListener("click", () => {
    openInfoModal(context.shell.modalRoot, {
      title: song.title,
      content: `<div class="songInfoModalContent">${songInformation(song)}</div>`,
      closeText: "Закрыть",
    });
  }, { signal });

  const wordsById = new Map(words.map((word) => [word.id, word]));
  context.root.querySelectorAll("[data-word-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const word = wordsById.get(button.dataset.wordId);
      if (!word) return;
      trackEvent(EVENTS.WORD_RESULT, {
        word_id: word.id,
        source: WORD_SOURCES.SONG,
        result: WORD_RESULTS.OPENED,
        dictionary_id: word.dict,
        section_id: word.section,
        set_id: String(word.set),
        direction: DIRECTIONS.NONE,
      });
      openWordCard(context, word);
    }, { signal });
  });
}
