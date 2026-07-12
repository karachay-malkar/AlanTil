import { panel } from "../../shared/ui/panel.js";
import { openInfoModal } from "../../shared/ui/info-modal.js";
import { openWordCard } from "../../shared/ui/word-card.js";
import { escapeHtml } from "../../shared/ui/word-renderers.js";
import { mountPlayer } from "./player.js";
import { songsState } from "./state.js";

function normalizeToken(value) {
  return String(value || "")
    .normalize("NFC")
    .toLocaleLowerCase("ru")
    .replace(/[’‘`]/g, "'")
    .replace(/^[-'’]+|[-'’]+$/g, "")
    .trim();
}

function wordForms(word) {
  const forms = new Set();
  String(word?.word || "")
    .split(/\s*[\/|]\s*/g)
    .map(normalizeToken)
    .filter(Boolean)
    .forEach((form) => forms.add(form));
  return forms;
}

function buildWordIndex(words) {
  const index = new Map();
  words.forEach((word) => {
    wordForms(word).forEach((form) => {
      if (!index.has(form)) index.set(form, word);
    });
  });
  return index;
}

function renderInteractiveText(text, words) {
  const raw = String(text || "");
  if (!raw) return `<div class="songsEmptyLyrics">Текст песни пока не добавлен.</div>`;
  const index = buildWordIndex(words);
  const tokens = raw.match(/[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*|[^\p{L}\p{M}]+/gu) || [];
  return tokens.map((token) => {
    const word = index.get(normalizeToken(token));
    if (!word) return escapeHtml(token);
    return `<button class="songWord" type="button" data-word-id="${escapeHtml(word.id)}">${escapeHtml(token)}</button>`;
  }).join("");
}

function songInformation(song) {
  const blocks = [];
  if (song.artist) blocks.push(`<div><strong>Исполнитель:</strong> ${escapeHtml(song.artist)}</div>`);
  if (song.playlistTitle) blocks.push(`<div><strong>Плейлист:</strong> ${escapeHtml(song.playlistTitle)}</div>`);
  if (song.info) blocks.push(`<div class="songInfoText">${escapeHtml(song.info).replaceAll("\n", "<br>")}</div>`);
  return blocks.join("") || `<div class="smallNote">Дополнительная информация не добавлена.</div>`;
}

export function renderSongView(context, song, words, signal) {
  if (!song) {
    context.root.innerHTML = panel({ title: "Песня", body: `<div class="errorState">Песня не найдена.</div>`, classes: "songsPanel" });
    return;
  }

  songsState.selectedPlaylistId = song.playlistId;
  songsState.selectedSongId = song.id;
  context.root.innerHTML = panel({
    title: escapeHtml(song.title),
    headerExtra: `<button id="songInfoButton" class="iconBtn songInfoButton" type="button" aria-label="Информация о песне" title="Информация о песне">i</button>`,
    body: `
      ${song.artist ? `<div class="songArtist">${escapeHtml(song.artist)}</div>` : ""}
      <div id="songPlayerRoot"></div>
      <article class="songLyricsCard">
        <div class="songSectionTitle">Текст песни</div>
        <div class="songLyrics" id="songLyrics">${renderInteractiveText(song.lyrics, words)}</div>
      </article>
      ${song.translation ? `<article class="songTranslationCard"><div class="songSectionTitle">Перевод</div><div class="songTranslation">${escapeHtml(song.translation).replaceAll("\n", "<br>")}</div></article>` : ""}
      <div class="smallNote songWordsHint">Нажмите на выделенное слово, чтобы открыть его словарную карточку.</div>`,
    classes: "songsPanel songViewPanel",
  });

  mountPlayer(context.root.querySelector("#songPlayerRoot"), song, {
    onStateChange(playerState) {
      songsState.player = { ...playerState };
    },
  });

  context.root.querySelector("#songInfoButton")?.addEventListener("click", () => {
    openInfoModal(context.shell.modalRoot, {
      title: song.title,
      content: `<div class="songInfoModalContent">${songInformation(song)}</div>`,
      closeText: "Закрыть",
    });
  }, { signal });

  const wordsById = new Map(words.map((word) => [word.id, word]));
  context.root.querySelectorAll("[data-word-id]").forEach((button) => {
    button.addEventListener("click", () => openWordCard(context, wordsById.get(button.dataset.wordId)), { signal });
  });
}
