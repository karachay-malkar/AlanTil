import { readScopedJson, writeScopedJson } from "../../shared/progress/storage-scope.js?v=13.15.1";
import { escapeHtml } from "../../shared/ui/html.js?v=13.9.0";

export const STORY_STELE_SEEN_KEY = "alantil_story_intro_seen_v1";
const ASSET_URL = "/assets/path/story-stele.avif?v=13.15.4";
const STYLE_CLASSES = ["storySteleStyleBronze"];
const CLOSE_DELAY_MS = 220;
const AUTO_SCROLL_START_DELAY_MS = 1600;
const AUTO_SCROLL_RESUME_DELAY_MS = 2600;
const AUTO_SCROLL_PX_PER_SECOND = 7;
const MIN_BODY_FONT_SIZE_PX = 12.5;
const MIN_BODY_LINE_HEIGHT = 1.32;
const MIN_BODY_GAP_PX = 4;

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

function bodyOverflows(body) {
  return Boolean(body && body.scrollHeight > body.clientHeight + 2);
}

function fitTypography(card, title, body) {
  if (!card || !title || !body) return false;
  const width = card.getBoundingClientRect().width;
  if (!width) return false;

  let titleSize = Math.min(44, Math.max(19, width * 0.068));
  title.style.fontSize = `${titleSize}px`;
  for (let index = 0; index < 48 && title.scrollWidth > title.clientWidth + 1; index += 1) {
    if (titleSize <= 18) break;
    titleSize -= 0.5;
    title.style.fontSize = `${titleSize}px`;
  }

  let fontSize = Math.min(21, Math.max(13.5, width * 0.038));
  let lineHeight = 1.42;
  let gap = Math.min(12, Math.max(6, width * 0.018));
  body.style.fontSize = `${fontSize}px`;
  body.style.lineHeight = String(lineHeight);
  body.style.gap = `${gap}px`;
  body.scrollTop = 0;

  for (let index = 0; index < 140 && bodyOverflows(body); index += 1) {
    if (fontSize > MIN_BODY_FONT_SIZE_PX) fontSize = Math.max(MIN_BODY_FONT_SIZE_PX, fontSize - 0.2);
    else if (gap > MIN_BODY_GAP_PX) gap = Math.max(MIN_BODY_GAP_PX, gap - 0.25);
    else if (lineHeight > MIN_BODY_LINE_HEIGHT) lineHeight = Math.max(MIN_BODY_LINE_HEIGHT, lineHeight - 0.01);
    else break;
    body.style.fontSize = `${fontSize}px`;
    body.style.lineHeight = String(lineHeight);
    body.style.gap = `${gap}px`;
  }

  body.scrollTop = 0;
  return bodyOverflows(body);
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
      <div class="storySteleCard">
        <img class="storySteleArtwork" src="${ASSET_URL}" alt="" aria-hidden="true">
        <div class="storySteleContent" data-stele-content>
          <h2 class="storySteleTitle" id="storySteleTitle-${escapeHtml(storyId)}">${escapeHtml(storyName)}</h2>
          <div class="storySteleBody" data-stele-scroll>${renderParagraphs(storyIntro)}</div>
        </div>
      </div>
    </section>`;
  modalRoot.appendChild(overlay);

  const backdrop = overlay.querySelector(".storySteleBackdrop");
  const dialog = overlay.querySelector(".storySteleDialog");
  const card = overlay.querySelector(".storySteleCard");
  const title = overlay.querySelector(".storySteleTitle");
  const body = overlay.querySelector(".storySteleBody");
  let closeTimer = 0;
  let resizeFrame = 0;
  let autoScrollTimer = 0;
  let autoScrollFrame = 0;
  let autoScrollLastTime = 0;
  let open = false;

  function clearCloseTimer() {
    if (!closeTimer) return;
    globalThis.clearTimeout(closeTimer);
    closeTimer = 0;
  }

  function clearAutoScroll() {
    if (autoScrollTimer) globalThis.clearTimeout(autoScrollTimer);
    if (autoScrollFrame) cancelAnimationFrame(autoScrollFrame);
    autoScrollTimer = 0;
    autoScrollFrame = 0;
    autoScrollLastTime = 0;
  }

  function reducedMotionRequested() {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  }

  function canAutoScroll() {
    return open && !signal?.aborted && !reducedMotionRequested() && bodyOverflows(body);
  }

  function autoScrollTick(timestamp) {
    if (!canAutoScroll()) {
      clearAutoScroll();
      return;
    }
    if (!autoScrollLastTime) autoScrollLastTime = timestamp;
    const elapsed = Math.min(64, timestamp - autoScrollLastTime);
    autoScrollLastTime = timestamp;
    const maxScroll = Math.max(0, body.scrollHeight - body.clientHeight);
    const next = Math.min(maxScroll, body.scrollTop + (AUTO_SCROLL_PX_PER_SECOND * elapsed) / 1000);
    body.scrollTop = next;
    if (next >= maxScroll - 0.5) {
      clearAutoScroll();
      return;
    }
    autoScrollFrame = requestAnimationFrame(autoScrollTick);
  }

  function startAutoScroll() {
    clearAutoScroll();
    if (!canAutoScroll()) return;
    autoScrollFrame = requestAnimationFrame(autoScrollTick);
  }

  function scheduleAutoScroll(delay = AUTO_SCROLL_START_DELAY_MS) {
    clearAutoScroll();
    if (!canAutoScroll()) return;
    autoScrollTimer = globalThis.setTimeout(() => {
      autoScrollTimer = 0;
      startAutoScroll();
    }, delay);
  }

  function pauseForManualScroll() {
    if (!open) return;
    clearAutoScroll();
    if (!bodyOverflows(body)) return;
    autoScrollTimer = globalThis.setTimeout(() => {
      autoScrollTimer = 0;
      startAutoScroll();
    }, AUTO_SCROLL_RESUME_DELAY_MS);
  }

  function syncTypography({ resetScroll = false } = {}) {
    if (!open) return;
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      const previousScroll = resetScroll ? 0 : body.scrollTop;
      const overflow = fitTypography(card, title, body);
      if (!resetScroll) body.scrollTop = Math.min(previousScroll, Math.max(0, body.scrollHeight - body.clientHeight));
      clearAutoScroll();
      if (overflow) scheduleAutoScroll();
    });
  }

  function openStele({ markSeen = true } = {}) {
    if (open || signal?.aborted) return;
    clearCloseTimer();
    clearAutoScroll();
    open = true;
    overlay.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    trigger.classList.add("isHiddenWhileOpen");
    document.body.classList.add("story-stele-open");
    if (markSeen) markStorySteleSeen(storyId);
    nextTwoFrames(() => {
      if (!open || signal?.aborted) return;
      overlay.classList.add("isOpen");
      const overflow = fitTypography(card, title, body);
      if (overflow) scheduleAutoScroll();
      dialog?.focus({ preventScroll: true });
    });
  }

  function closeStele({ restoreFocus = true, immediate = false } = {}) {
    if (!open && overlay.hidden) return;
    clearCloseTimer();
    clearAutoScroll();
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
  backdrop?.addEventListener("click", () => closeStele(), { signal });
  card?.addEventListener("click", (event) => {
    if (event.target.closest("[data-stele-content]")) return;
    closeStele();
  }, { signal });
  overlay.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeStele();
  }, { signal });
  body?.addEventListener("pointerdown", pauseForManualScroll, { signal, passive: true });
  body?.addEventListener("touchstart", pauseForManualScroll, { signal, passive: true });
  body?.addEventListener("wheel", pauseForManualScroll, { signal, passive: true });
  globalThis.addEventListener("resize", () => syncTypography(), { signal, passive: true });

  signal?.addEventListener("abort", () => {
    clearCloseTimer();
    clearAutoScroll();
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
