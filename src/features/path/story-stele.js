import { readScopedJson, writeScopedJson } from "../../shared/progress/storage-scope.js?v=13.15.1";
import { escapeHtml } from "../../shared/ui/html.js?v=13.9.0";

export const STORY_STELE_SEEN_KEY = "alantil_story_intro_seen_v1";
const ASSET_URL = "/assets/path/story-stele.png?v=13.15.1";
const STYLE_CLASSES = ["storySteleStyleBronze"];
const CLOSE_DELAY_MS = 220;

function normalizedStoryId(value) {
  return String(value || "").trim();
}

function storySeenState() {
  const value = readScopedJson(STORY_STELE_SEEN_KEY, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function hasSeenStoryStele(storyId) {
  const key = normalizedStoryId(storyId);
  return Boolean(key && storySeenState()[key]);
}

export function markStorySteleSeen(storyId) {
  const key = normalizedStoryId(storyId);
  if (!key) return false;
  const state = storySeenState();
  if (state[key]) return true;
  return writeScopedJson(STORY_STELE_SEEN_KEY, { ...state, [key]: true });
}

function introParagraphs(value) {
  const source = String(value || "").replace(/\r\n?/g, "\n").trim();
  if (!source) return [];
  return source
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.replace(/[\t ]*\n[\t ]*/g, " ").trim())
    .filter(Boolean);
}

function renderParagraphs(value) {
  return introParagraphs(value).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
}

function nextTwoFrames(callback) {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

function fitTypography(card, title, body) {
  if (!card || !title || !body) return;
  const width = card.getBoundingClientRect().width;
  if (!width) return;

  let titleSize = Math.min(50, Math.max(18, width * 0.072));
  title.style.fontSize = `${titleSize}px`;
  for (let index = 0; index < 42 && (title.scrollWidth > title.clientWidth || title.scrollHeight > title.clientHeight + 2); index += 1) {
    titleSize -= 0.75;
    title.style.fontSize = `${titleSize}px`;
  }

  let fontSize = Math.min(22.5, Math.max(10, width * 0.0248));
  let lineHeight = 1.44;
  let gap = Math.min(14, Math.max(6, width * 0.0125));
  body.style.fontSize = `${fontSize}px`;
  body.style.lineHeight = String(lineHeight);
  body.style.gap = `${gap}px`;

  for (let index = 0; index < 160 && body.scrollHeight > body.clientHeight; index += 1) {
    if (fontSize > 9.2) fontSize -= 0.22;
    else if (gap > 4.2) gap -= 0.28;
    else if (lineHeight > 1.28) lineHeight -= 0.012;
    else break;
    body.style.fontSize = `${fontSize}px`;
    body.style.lineHeight = String(lineHeight);
    body.style.gap = `${gap}px`;
  }
  body.scrollTop = 0;
}

export function mountStoryStele({ root, modalRoot, story, autoOpen = false, signal } = {}) {
  const storyId = normalizedStoryId(story?.id || story?.type);
  const storyName = String(story?.name || story?.label || "").trim();
  const storyIntro = String(story?.intro || "").trim();
  const pathView = root?.querySelector?.(".pathView");
  if (!pathView || !modalRoot || !storyId || !storyIntro) return null;

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "storySteleTrigger";
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-label", storyName || storyId);
  trigger.title = storyName || storyId;
  trigger.innerHTML = `<span class="storySteleTriggerGlyph" aria-hidden="true"><img src="${ASSET_URL}" alt=""><span>✦</span></span>`;
  pathView.appendChild(trigger);

  const overlay = document.createElement("div");
  overlay.className = `storySteleOverlay ${STYLE_CLASSES.join(" ")}`;
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="storySteleBackdrop" aria-hidden="true"></div>
    <section class="storySteleDialog" role="dialog" aria-modal="true" aria-labelledby="storySteleTitle-${escapeHtml(storyId)}" tabindex="-1">
      <div class="storySteleCard" data-stele-close-surface>
        <img class="storySteleArtwork" src="${ASSET_URL}" alt="" aria-hidden="true">
        <div class="storySteleContent" data-stele-content>
          <h2 class="storySteleTitle" id="storySteleTitle-${escapeHtml(storyId)}">${escapeHtml(storyName)}</h2>
          <div class="storySteleBody" data-stele-scroll>${renderParagraphs(storyIntro)}</div>
        </div>
      </div>
    </section>`;
  modalRoot.appendChild(overlay);

  const dialog = overlay.querySelector(".storySteleDialog");
  const card = overlay.querySelector(".storySteleCard");
  const title = overlay.querySelector(".storySteleTitle");
  const body = overlay.querySelector(".storySteleBody");
  let closeTimer = 0;
  let resizeFrame = 0;
  let open = false;

  function clearCloseTimer() {
    if (!closeTimer) return;
    globalThis.clearTimeout(closeTimer);
    closeTimer = 0;
  }

  function syncTypography() {
    if (!open) return;
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      fitTypography(card, title, body);
    });
  }

  function openStele({ markSeen = true } = {}) {
    if (open || signal?.aborted) return;
    clearCloseTimer();
    open = true;
    overlay.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    trigger.classList.add("isHiddenWhileOpen");
    document.body.classList.add("story-stele-open");
    if (markSeen) markStorySteleSeen(storyId);
    nextTwoFrames(() => {
      if (!open || signal?.aborted) return;
      overlay.classList.add("isOpen");
      fitTypography(card, title, body);
      dialog?.focus({ preventScroll: true });
    });
  }

  function closeStele({ restoreFocus = true, immediate = false } = {}) {
    if (!open && overlay.hidden) return;
    clearCloseTimer();
    open = false;
    overlay.classList.remove("isOpen");
    trigger.setAttribute("aria-expanded", "false");
    trigger.classList.remove("isHiddenWhileOpen");
    document.body.classList.remove("story-stele-open");
    const finish = () => {
      overlay.hidden = true;
      if (restoreFocus && !signal?.aborted) trigger.focus({ preventScroll: true });
    };
    if (immediate) finish();
    else closeTimer = globalThis.setTimeout(finish, CLOSE_DELAY_MS);
  }

  trigger.addEventListener("click", () => openStele(), { signal });
  card?.addEventListener("click", (event) => {
    if (event.target.closest("[data-stele-content]")) return;
    closeStele();
  }, { signal });
  overlay.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeStele();
  }, { signal });
  globalThis.addEventListener("resize", syncTypography, { signal, passive: true });

  signal?.addEventListener("abort", () => {
    clearCloseTimer();
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    document.body.classList.remove("story-stele-open");
    overlay.remove();
    trigger.remove();
  }, { once: true });

  if (autoOpen && !hasSeenStoryStele(storyId)) nextTwoFrames(() => openStele());

  return Object.freeze({
    open: () => openStele(),
    close: () => closeStele(),
    isOpen: () => open,
  });
}
