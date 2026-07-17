import { msg } from "../../shared/i18n/index.js?v=13.9.0";
import { trackEvent } from "../../shared/analytics/analytics.js?v=13.9.0";
import { DIRECTIONS, EVENTS, WORD_RESULTS, WORD_SOURCES } from "../../shared/analytics/events.js?v=13.9.0";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";
import { openInfoModal } from "../../shared/ui/info-modal.js?v=13.9.0";
import { openWordCard } from "../../shared/ui/word-card.js?v=13.9.0";
import { escapeHtml } from "../../shared/ui/word-renderers.js?v=13.9.0";
import { renderSongLyrics } from "./lyrics-renderer.js?v=13.9.0";
import { mountPlayer } from "./player.js?v=13.9.0";
import { songsState } from "./state.js?v=13.9.0";

function songInformation(song) {
  const blocks = [];
  if (song.artist) blocks.push(`<div><strong>${msg("songs.ispolnitel_3")}</strong> ${escapeHtml(song.artist)}</div>`);
  if (song.playlistTitle) blocks.push(`<div><strong>${msg("songs.pleylist_2")}</strong> ${escapeHtml(song.playlistTitle)}</div>`);
  if (song.info) blocks.push(`<div class="songInfoText">${escapeHtml(song.info).replaceAll("\n", "<br>")}</div>`);
  return blocks.join("");
}

export function renderSongView(context, song, words, signal) {
  context.shell.setHeaderAction?.();
  if (!song) {
    context.shell.setHeaderContent?.({ title: msg("songs.pesnya_2") });
    context.root.innerHTML = panel({ title: msg("songs.pesnya_2"), body: `<div class="errorState">${msg("songs.pesnya_ne_naydena")}</div>`, classes: "songsPanel" });
    return;
  }

  songsState.selectedPlaylistId = song.playlistId;
  songsState.selectedSongId = song.id;
  context.shell.setHeaderContent?.({ title: song.title, subtitle: song.artist || "" });
  context.shell.setHeaderAction?.(`<button id="songInfoButton" class="iconAction appHeaderTextAction songInfoButton" type="button" aria-label="${msg("songs.informatsiya_o_pesne")}" title="${msg("songs.informatsiya_o_pesne")}">Info</button>`);
  const lyricsMarkup = renderSongLyrics(song.lyrics, song.translation, words);

  context.root.innerHTML = panel({
    title: escapeHtml(song.title),
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

  context.shell.headerActionSlot?.querySelector("#songInfoButton")?.addEventListener("click", () => {
    openInfoModal(context.shell.modalRoot, {
      title: song.title,
      content: `<div class="songInfoModalContent">${songInformation(song)}</div>`,
      closeText: msg("songs.zakryt"),
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
