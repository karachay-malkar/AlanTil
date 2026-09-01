import { escapeHtml } from "../../shared/ui/word-renderers.js?v=13.9.0";
import { buildSongLyricsModel, parseLyricsBlocks } from "../../../packages/alantil-core/songs.js";

export { parseLyricsBlocks };

function renderInteractiveTokens(tokens) {
  return tokens.map(({ token, word }) => {
    if (!word) return escapeHtml(token);
    return `<button class="songWord" type="button" data-word-id="${escapeHtml(word.id)}">${escapeHtml(token)}</button>`;
  }).join("");
}

function renderModelBlock(block) {
  if (!block.translationLines.length) {
    return block.originalLines.map((line) => `
      <div class="songLinePair">
        <div class="songOriginalLine">${renderInteractiveTokens(line.tokens)}</div>
      </div>`).join("");
  }

  if (block.paired) {
    return block.originalLines.map((line, index) => `
      <div class="songLinePair">
        <div class="songOriginalLine">${renderInteractiveTokens(line.tokens)}</div>
        <div class="songTranslatedLine">${escapeHtml(block.translationLines[index])}</div>
      </div>`).join("");
  }

  return `
    <div class="songOriginalStanza">
      ${block.originalLines.map((line) => `<div class="songOriginalLine">${renderInteractiveTokens(line.tokens)}</div>`).join("")}
    </div>
    <div class="songTranslationStanza">
      ${block.translationLines.map((line) => `<div class="songTranslatedLine">${escapeHtml(line)}</div>`).join("")}
    </div>`;
}

export function renderSongLyrics(lyrics, translation, words) {
  const model = buildSongLyricsModel(lyrics, translation, words);
  return model.map((block) => `
      <section class="songStanza${block.type === "chorus" ? " songStanzaChorus" : ""}">
        ${renderModelBlock(block)}
      </section>`).join("");
}
