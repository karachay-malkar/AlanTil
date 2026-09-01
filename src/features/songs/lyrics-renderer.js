import { escapeHtml } from "../../shared/ui/word-renderers.js?v=13.9.0";
import { applyAlanCyrillicDialect } from "../../shared/domain/alan-display.js?v=13.9.0";
import {
  buildSongWordIndex,
  normalizeSongToken,
  parseLyricsBlocks,
  tokenizeSongLine,
} from "../../../packages/alantil-core/songs.js";

function wordForms(word) {
  const canonicalCyrillic = String(word?.wordAlanCyrillic || "");
  return [
    word?.word,
    canonicalCyrillic,
    applyAlanCyrillicDialect(canonicalCyrillic, "karachay"),
    applyAlanCyrillicDialect(canonicalCyrillic, "balkar"),
    word?.wordAlanTurkic,
  ]
    .flatMap((value) => String(value || "")
      .split(/\s*[\/|]\s*/g)
      .map(normalizeSongToken))
    .filter(Boolean);
}

function renderInteractiveLine(line, wordIndex) {
  return tokenizeSongLine(line).map((token) => {
    const word = token.wordLike ? wordIndex.get(token.normalized) : null;
    if (!word) return escapeHtml(token.text);
    return `<button class="songWord" type="button" data-word-id="${escapeHtml(word.id)}">${escapeHtml(token.text)}</button>`;
  }).join("");
}

function renderPairedLines(originalLines, translationLines, wordIndex) {
  if (!translationLines.length) {
    return originalLines.map((line) => `
      <div class="songLinePair">
        <div class="songOriginalLine">${renderInteractiveLine(line, wordIndex)}</div>
      </div>`).join("");
  }

  if (originalLines.length === translationLines.length) {
    return originalLines.map((line, index) => `
      <div class="songLinePair">
        <div class="songOriginalLine">${renderInteractiveLine(line, wordIndex)}</div>
        <div class="songTranslatedLine">${escapeHtml(translationLines[index])}</div>
      </div>`).join("");
  }

  return `
    <div class="songOriginalStanza">
      ${originalLines.map((line) => `<div class="songOriginalLine">${renderInteractiveLine(line, wordIndex)}</div>`).join("")}
    </div>
    <div class="songTranslationStanza">
      ${translationLines.map((line) => `<div class="songTranslatedLine">${escapeHtml(line)}</div>`).join("")}
    </div>`;
}

export { parseLyricsBlocks };

export function renderSongLyrics(lyrics, translation, words) {
  const originalBlocks = parseLyricsBlocks(lyrics);
  if (!originalBlocks.length) return "";

  const translationBlocks = parseLyricsBlocks(translation);
  const wordIndex = buildSongWordIndex(words, wordForms);

  return originalBlocks.map((block, index) => {
    const translatedBlock = translationBlocks[index] || null;
    const translationLines = translatedBlock?.lines || [];
    const isChorus = block.type === "chorus" || translatedBlock?.type === "chorus";
    return `
      <section class="songStanza${isChorus ? " songStanzaChorus" : ""}">
        ${renderPairedLines(block.lines, translationLines, wordIndex)}
      </section>`;
  }).join("");
}
