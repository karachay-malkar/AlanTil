import { PATH_CONFIG } from "../../config/path.js?v=13.15.10.7";
import { readScopedJson, writeScopedJson } from "../../shared/progress/storage-scope.js?v=13.15.10.7";
import { learnState } from "../learn/state.js?v=13.15.10.7";

const GUIDE_STATE_KEY = "alantil_guided_help_v1";
const GUIDE_STYLE_ID = "alantil-guided-help-style";
const STORY_SEQUENCE = ["oblivion", "roots", "ascent", "pathways"];
const STORY_GUIDE = Object.freeze({
  oblivion: {
    title: "На пороге забвения — лёгкий уровень",
    body: `
      <p>Это словарь для тех, кто только начинает изучать язык.</p>
      <p>Однако, зная только эти слова, твоя речь по-прежнему будет скудной. К сожалению, большая часть людей сегодня владеет лишь этой базовой лексикой. <strong>И потому наш язык постепенно исчезает.</strong></p>
      <p>Если хочешь действительно хорошо знать свой язык, следующий раздел — для тебя.</p>`,
  },
  roots: {
    title: "Возвращение к истокам — средний уровень",
    body: `
      <p><strong>Это главный раздел приложения.</strong></p>
      <p>Этот раздел соответствует хорошему уровню владения языком — уровню полноценного носителя. Здесь собраны слова, которыми сегодня, к сожалению, владеет уже меньшинство.</p>
      <p><strong>Проверь себя: знаешь ли ты эти слова?</strong></p>`,
  },
  ascent: {
    title: "На вершине — сложный уровень",
    body: `
      <p>Здесь собраны редкие, старые и сложные слова, которые сегодня знают немногие.</p>
      <p>Этот раздел — для тех, кто уже хорошо владеет языком и хочет углубить свои знания.</p>`,
  },
  pathways: {
    title: "Тропы — тематические наборы",
    body: `
      <p>Здесь слова собраны по темам: животные, растения, материалы и другие области жизни.</p>
      <p>Выбирай интересующую тему и отдельно расширяй свой словарный запас.</p>`,
  },
});

const STYLE_TEXT = `
/* Story controls: keep the existing layout, add only vertical breathing room. */
.pathView{grid-template-rows:68px minmax(0,1fr)!important}
.pathStickyControls{height:68px!important;padding-top:10px!important}

.alantilGuideTrigger{
  appearance:none;position:absolute;z-index:calc(var(--z-path-controls) + 4);left:10px;top:80%;width:36px;height:36px;
  display:grid;place-items:center;padding:0;border:1px solid color-mix(in srgb,var(--text-1) 22%,transparent);border-radius:50%;
  transform:translateY(-50%);background:color-mix(in srgb,var(--surface-0) 72%,transparent);color:var(--text-1);
  -webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:var(--shadow-sm);cursor:pointer;
  font:850 17px/1 var(--font-terminal);transition:opacity var(--duration-fast),transform var(--duration-fast),background var(--duration-fast);
}
.alantilGuideTrigger:active{transform:translateY(calc(-50% + 1px)) scale(.97)}
body.alantilGuideGeneral .alantilGuideTrigger{opacity:0;pointer-events:none}
body.alantilGuideGeneral .storySteleOverlay{visibility:hidden!important;opacity:0!important;pointer-events:none!important}

.alantilGuideOverlay{
  position:fixed;z-index:calc(var(--z-modal) + 24);inset:0;pointer-events:none;isolation:isolate;color:#fff;
}
.alantilGuideSpotlight{position:fixed;z-index:0;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.alantilGuideSpotlightShade{fill:rgba(15,14,12,.67)}
.alantilGuideHalo{
  position:fixed;z-index:1;pointer-events:none;
  box-shadow:0 0 0 1px rgba(255,255,255,.16),0 0 14px rgba(255,255,255,.07);
  transition:left .16s ease,top .16s ease,width .16s ease,height .16s ease,border-radius .16s ease;
}
.alantilGuideInputBlocker{position:fixed;z-index:2;background:transparent;pointer-events:auto}

.alantilGuideContent{
  position:fixed;z-index:4;left:50%;top:0;width:min(440px,calc(100vw - 32px));margin:0;
  transform:translateX(-50%);text-align:center;pointer-events:none;outline:none;
}
.alantilGuideTitle{
  margin:0;color:rgba(255,255,255,.98);font:900 19px/1.2 var(--font-terminal);text-wrap:balance;
  text-shadow:0 2px 18px rgba(0,0,0,.66);
}
.alantilGuideBody{
  margin-top:11px;color:rgba(255,255,255,.90);font-size:14px;line-height:1.48;text-wrap:pretty;
  text-shadow:0 2px 16px rgba(0,0,0,.68);
}
.alantilGuideBody p{margin:0}
.alantilGuideBody p+p{margin-top:9px}
.alantilGuideBody strong{color:#fff;font-weight:850}
.alantilGuideGesture{
  display:flex;align-items:center;justify-content:center;gap:28px;margin:0 0 8px;color:#fff;
  font:850 12px/1.2 var(--font-terminal);
}
.alantilGuideGesture span{display:flex;align-items:center;gap:6px}
.alantilGuideGesture b{font-size:18px}

.alantilGuideNav{
  display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px;pointer-events:none;
}
.alantilGuideSkip,.alantilGuideNext{
  appearance:none;min-width:112px;min-height:38px;padding:8px 17px;border-radius:999px;
  font:800 11px/1 var(--font-terminal);cursor:pointer;pointer-events:auto;
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
}
.alantilGuideSkip{
  border:1px solid rgba(255,255,255,.48);background:rgba(20,19,17,.10);color:rgba(255,255,255,.90);
}
.alantilGuideNext{
  border:1px solid rgba(248,246,240,.92);background:rgba(248,246,240,.96);color:#24211d;
  box-shadow:0 4px 18px rgba(0,0,0,.16);
}
.alantilGuideSkip:active,.alantilGuideNext:active{transform:translateY(1px);opacity:.82}

@media(max-width:390px){
  .pathView{grid-template-rows:66px minmax(0,1fr)!important}
  .pathStickyControls{height:66px!important;padding-top:8px!important}
  .alantilGuideTrigger{left:9px;width:34px;height:34px}
  .alantilGuideContent{width:calc(100vw - 28px)}
  .alantilGuideTitle{font-size:17px}
  .alantilGuideBody{font-size:13px}
  .alantilGuideSkip,.alantilGuideNext{min-width:104px;min-height:36px;padding:7px 14px}
}
@media(prefers-reduced-motion:reduce){
  .alantilGuideTrigger,.alantilGuideHalo{transition:none!important}
}
`;

let activeOverlay = null;
let observer = null;
let scanQueued = false;
let overlayCounter = 0;
let generalGuide = { active: false, phase: "", storyIndex: 0 };
let learningBinding = null;
let learningFlow = { active: false, phase: "", decisionWordId: "" };

function ensureStyles() {
  if (document.getElementById(GUIDE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = GUIDE_STYLE_ID;
  style.textContent = STYLE_TEXT;
  document.head.appendChild(style);
}

function storedGuideState() {
  const value = readScopedJson(GUIDE_STATE_KEY, {});
  return {
    learning_completed: Boolean(value?.learning_completed),
    repeat_hint_shown: Boolean(value?.repeat_hint_shown),
  };
}

function updateGuideState(updates = {}) {
  const next = { ...storedGuideState(), ...updates };
  writeScopedJson(GUIDE_STATE_KEY, next);
  return next;
}

function scheduleScan() {
  if (scanQueued) return;
  scanQueued = true;
  requestAnimationFrame(() => {
    scanQueued = false;
    scan();
  });
}

function closeOpenStele() {
  const openStele = document.querySelector(".storySteleOverlay.isOpen .storySteleBackdrop");
  openStele?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function destroyOverlay() {
  if (!activeOverlay) return;
  activeOverlay.destroy();
  activeOverlay = null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function numericRadius(value, width, height) {
  const text = String(value || "").trim();
  if (text.includes("%")) return Math.min(width, height) / 2;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : 14;
}

function targetGeometry(target, { padding = 6, shape = "auto" } = {}) {
  if (!target?.isConnected) return null;
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  let resolvedShape = shape;
  if (resolvedShape === "auto") {
    if (target.matches?.(".storyTab,.sessionStatus")) resolvedShape = "pill";
    else if (target.matches?.(".stationProgressRing")) resolvedShape = "circle";
    else resolvedShape = "rounded";
  }

  let left = rect.left - padding;
  let top = rect.top - padding;
  let width = rect.width + padding * 2;
  let height = rect.height + padding * 2;

  if (resolvedShape === "circle") {
    const side = Math.max(rect.width, rect.height) + padding * 2;
    left = rect.left + rect.width / 2 - side / 2;
    top = rect.top + rect.height / 2 - side / 2;
    width = side;
    height = side;
  }

  left = clamp(left, 2, Math.max(2, window.innerWidth - width - 2));
  top = clamp(top, 2, Math.max(2, window.innerHeight - height - 2));
  width = Math.min(width, window.innerWidth - left - 2);
  height = Math.min(height, window.innerHeight - top - 2);

  const computed = getComputedStyle(target);
  let radius = numericRadius(computed.borderTopLeftRadius, width, height) + padding;
  if (resolvedShape === "circle" || resolvedShape === "pill") radius = Math.min(width, height) / 2;
  else radius = clamp(radius, 12, Math.min(width, height) / 2);

  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    radius,
  };
}

function applyRect(element, rect) {
  if (!element || !rect) return;
  element.style.left = `${rect.left}px`;
  element.style.top = `${rect.top}px`;
  element.style.width = `${Math.max(0, rect.right - rect.left)}px`;
  element.style.height = `${Math.max(0, rect.bottom - rect.top)}px`;
}

function updateSpotlight(svg, hole, shade, halo, geometry) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  shade.setAttribute("width", String(width));
  shade.setAttribute("height", String(height));
  const base = svg.querySelector("[data-mask-base]");
  base?.setAttribute("width", String(width));
  base?.setAttribute("height", String(height));

  if (!geometry) {
    hole.setAttribute("width", "0");
    hole.setAttribute("height", "0");
    halo.hidden = true;
    return;
  }

  hole.setAttribute("x", String(geometry.left));
  hole.setAttribute("y", String(geometry.top));
  hole.setAttribute("width", String(geometry.width));
  hole.setAttribute("height", String(geometry.height));
  hole.setAttribute("rx", String(geometry.radius));
  hole.setAttribute("ry", String(geometry.radius));
  halo.hidden = false;
  halo.style.left = `${geometry.left}px`;
  halo.style.top = `${geometry.top}px`;
  halo.style.width = `${geometry.width}px`;
  halo.style.height = `${geometry.height}px`;
  halo.style.borderRadius = `${geometry.radius}px`;
}

function elementViewportRect(element) {
  if (!element || element.hidden || !element.isConnected) return null;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return null;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function expandRect(rect, amount) {
  if (!rect) return null;
  return {
    left: rect.left - amount,
    top: rect.top - amount,
    right: rect.right + amount,
    bottom: rect.bottom + amount,
  };
}

function intersectionArea(left, right) {
  if (!left || !right) return 0;
  const width = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left));
  const height = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
  return width * height;
}

function contentRectFor(top, width, height) {
  const left = (window.innerWidth - width) / 2;
  return { left, top, right: left + width, bottom: top + height, width, height };
}

function uniqueNumbers(values) {
  const result = [];
  values.forEach((value) => {
    const rounded = Math.round(value * 10) / 10;
    if (!result.some((item) => Math.abs(item - rounded) < 1)) result.push(rounded);
  });
  return result;
}

function positionGuideContent(content, geometry, {
  preference = "center",
  avoidHeader = true,
  avoidBottomNav = true,
} = {}) {
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const edge = viewportWidth <= 390 ? 14 : 18;
  const gap = viewportWidth <= 390 ? 16 : 20;

  content.style.top = `${edge}px`;
  const measured = content.getBoundingClientRect();
  const width = measured.width;
  const height = measured.height;
  const maxTop = Math.max(edge, viewportHeight - height - edge);

  const header = avoidHeader ? elementViewportRect(document.getElementById("appHeader")) : null;
  const bottomNav = avoidBottomNav ? elementViewportRect(document.getElementById("bottomNav")) : null;
  const targetAvoid = expandRect(geometry, gap);

  const candidates = [
    (viewportHeight - height) / 2,
    geometry ? geometry.top - gap - height : NaN,
    geometry ? geometry.bottom + gap : NaN,
    edge,
    maxTop,
    viewportHeight * 0.33 - height / 2,
    viewportHeight * 0.67 - height / 2,
  ].filter(Number.isFinite).map((top) => clamp(top, edge, maxTop));

  const tops = uniqueNumbers(candidates);
  const evaluated = tops.map((top) => {
    const rect = contentRectFor(top, width, height);
    const targetOverlap = intersectionArea(rect, targetAvoid);
    const headerOverlap = intersectionArea(rect, header);
    const navOverlap = intersectionArea(rect, bottomNav);
    const centerDistance = Math.abs((top + height / 2) - viewportHeight / 2);
    const preferenceCost = preference === "top"
      ? top
      : preference === "bottom"
        ? Math.abs((top + height) - viewportHeight)
        : centerDistance;
    const penalty = targetOverlap * 100000 + headerOverlap * 50000 + navOverlap * 50000;
    return { top, penalty, preferenceCost, centerDistance };
  });

  evaluated.sort((a, b) =>
    (a.penalty - b.penalty)
    || (a.preferenceCost - b.preferenceCost)
    || (a.centerDistance - b.centerDistance)
  );

  content.style.top = `${evaluated[0]?.top ?? clamp((viewportHeight - height) / 2, edge, maxTop)}px`;
}

function createInputBlockers(overlay, geometry, blockTarget) {
  overlay.querySelectorAll("[data-guide-blocker]").forEach((node) => node.remove());
  if (!overlay.classList.contains("isBlocking")) return;

  const makeBlocker = (rect) => {
    if (rect.right <= rect.left || rect.bottom <= rect.top) return;
    const blocker = document.createElement("div");
    blocker.className = "alantilGuideInputBlocker";
    blocker.dataset.guideBlocker = "";
    applyRect(blocker, rect);
    overlay.appendChild(blocker);
  };

  if (!geometry || blockTarget) {
    makeBlocker({ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight });
    return;
  }

  makeBlocker({ left: 0, top: 0, right: window.innerWidth, bottom: geometry.top });
  makeBlocker({ left: 0, top: geometry.bottom, right: window.innerWidth, bottom: window.innerHeight });
  makeBlocker({ left: 0, top: geometry.top, right: geometry.left, bottom: geometry.bottom });
  makeBlocker({ left: geometry.right, top: geometry.top, right: window.innerWidth, bottom: geometry.bottom });
}

function showStep({
  target = null,
  title,
  body,
  nextLabel = "Далее",
  onNext = null,
  onSkip = null,
  showSkip = true,
  blocking = true,
  blockTarget = false,
  spotlightShape = "auto",
  spotlightPadding = 6,
  contentPreference = "center",
  avoidHeader = true,
  avoidBottomNav = true,
} = {}) {
  destroyOverlay();
  const modalRoot = document.getElementById("modalRoot") || document.body;
  const overlay = document.createElement("div");
  overlay.className = `alantilGuideOverlay${blocking ? " isBlocking" : ""}`;

  const maskId = `alantil-guide-mask-${++overlayCounter}`;
  overlay.innerHTML = `
    <svg class="alantilGuideSpotlight" aria-hidden="true">
      <defs>
        <mask id="${maskId}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
          <rect data-mask-base x="0" y="0" width="0" height="0" fill="white"></rect>
          <rect data-mask-hole x="0" y="0" width="0" height="0" rx="0" ry="0" fill="black"></rect>
        </mask>
      </defs>
      <rect class="alantilGuideSpotlightShade" data-mask-shade x="0" y="0" width="0" height="0" mask="url(#${maskId})"></rect>
    </svg>
    <div class="alantilGuideHalo" data-guide-halo hidden></div>`;

  const content = document.createElement("section");
  content.className = "alantilGuideContent";
  content.setAttribute("role", "dialog");
  content.setAttribute("aria-modal", blocking ? "true" : "false");
  content.tabIndex = -1;
  content.innerHTML = `
    <h2 class="alantilGuideTitle">${title}</h2>
    <div class="alantilGuideBody">${body}</div>
    ${(showSkip || nextLabel) ? `<nav class="alantilGuideNav" aria-label="Навигация по подсказке">
      ${showSkip ? '<button class="alantilGuideSkip" type="button" data-guide-skip>Пропустить</button>' : ""}
      ${nextLabel ? `<button class="alantilGuideNext" type="button" data-guide-next>${nextLabel}</button>` : ""}
    </nav>` : ""}`;
  overlay.appendChild(content);
  modalRoot.appendChild(overlay);

  const svg = overlay.querySelector(".alantilGuideSpotlight");
  const hole = overlay.querySelector("[data-mask-hole]");
  const shade = overlay.querySelector("[data-mask-shade]");
  const halo = overlay.querySelector("[data-guide-halo]");

  let resizeFrame = 0;
  const reposition = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      const geometry = targetGeometry(target, { padding: spotlightPadding, shape: spotlightShape });
      updateSpotlight(svg, hole, shade, halo, geometry);
      createInputBlockers(overlay, geometry, blockTarget);
      positionGuideContent(content, geometry, {
        preference: contentPreference,
        avoidHeader,
        avoidBottomNav,
      });
    });
  };

  const cleanup = () => {
    window.removeEventListener("resize", reposition);
    window.removeEventListener("orientationchange", reposition);
    window.removeEventListener("scroll", reposition, true);
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    overlay.remove();
  };

  const api = { destroy: cleanup, overlay };
  activeOverlay = api;

  const finishAction = (callback) => {
    if (activeOverlay === api) activeOverlay = null;
    cleanup();
    callback?.();
  };

  overlay.querySelector("[data-guide-next]")?.addEventListener("click", () => finishAction(onNext));
  overlay.querySelector("[data-guide-skip]")?.addEventListener("click", () => finishAction(onSkip));
  content.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !showSkip) return;
    event.preventDefault();
    finishAction(onSkip);
  });

  window.addEventListener("resize", reposition, { passive: true });
  window.addEventListener("orientationchange", reposition, { passive: true });
  window.addEventListener("scroll", reposition, { capture: true, passive: true });

  requestAnimationFrame(() => {
    reposition();
    content.focus({ preventScroll: true });
  });

  return api;
}

function finishGeneralGuide() {
  generalGuide = { active: false, phase: "", storyIndex: 0 };
  document.body.classList.remove("alantilGuideGeneral");
  destroyOverlay();
  scheduleScan();
}

function skipGeneralGuide() {
  finishGeneralGuide();
}

function showGeneralIntro() {
  generalGuide.phase = "intro";
  showStep({
    title: "Ассаламу алейкум, алан!",
    body: `
      <p>Это приложение создано для изучения аланских (карачаево-балкарских) слов и расширения словарного запаса.</p>
      <p>Учи новые слова, а затем старайся использовать их в повседневной жизни. <strong>Только тогда твоя речь действительно станет богаче, и ты увидишь свой прогресс.</strong></p>`,
    onNext: showStoriesIntro,
    onSkip: skipGeneralGuide,
    contentPreference: "center",
  });
}

function showStoriesIntro() {
  generalGuide.phase = "stories-intro";
  const target = document.querySelector(".storyTabsShell") || document.querySelector(".storyTabs");
  if (!target) { scheduleScan(); return; }
  showStep({
    target,
    title: "Истории",
    body: `<p>Здесь слова разделены по сложности и назначению.</p><p>Сейчас коротко познакомимся с каждым разделом.</p>`,
    onNext: () => showStory(0),
    onSkip: skipGeneralGuide,
    blockTarget: true,
    spotlightShape: "rounded",
    spotlightPadding: 6,
    contentPreference: "center",
  });
}

function requestStory(storyId) {
  const active = document.querySelector(".storyTab.active")?.dataset.storyTab || "";
  if (active === storyId) return true;
  const button = document.querySelector(`[data-story-tab="${storyId}"]`);
  if (!button) return false;
  destroyOverlay();
  button.click();
  scheduleScan();
  return false;
}

function showStory(index) {
  const safeIndex = clamp(index, 0, STORY_SEQUENCE.length - 1);
  generalGuide.phase = "story";
  generalGuide.storyIndex = safeIndex;
  const storyId = STORY_SEQUENCE[safeIndex];
  if (!requestStory(storyId)) return;
  closeOpenStele();
  const target = document.querySelector(`[data-story-tab="${storyId}"]`);
  const copy = STORY_GUIDE[storyId];
  if (!target || !copy) { scheduleScan(); return; }
  showStep({
    target,
    title: copy.title,
    body: copy.body,
    onNext: () => {
      if (safeIndex < STORY_SEQUENCE.length - 1) showStory(safeIndex + 1);
      else showStorySummary();
    },
    onSkip: skipGeneralGuide,
    blockTarget: true,
    spotlightShape: "pill",
    spotlightPadding: 6,
    contentPreference: "center",
  });
}

function showStorySummary() {
  generalGuide.phase = "summary";
  if (!requestStory("roots")) return;
  closeOpenStele();
  const target = document.querySelector(".storyTabsShell") || document.querySelector(".storyTabs");
  if (!target) { scheduleScan(); return; }
  showStep({
    target,
    title: "Выбери свой путь",
    body: `<p>Начни с подходящего тебе уровня и переключайся между историями в любое время.</p><p><strong>Основной путь приложения — «Возвращение к истокам».</strong></p>`,
    onNext: showStages,
    onSkip: skipGeneralGuide,
    blockTarget: true,
    spotlightShape: "rounded",
    spotlightPadding: 6,
    contentPreference: "center",
  });
}

function visibleStationTarget() {
  const viewport = document.querySelector(".pathMapViewport");
  const viewportRect = viewport?.getBoundingClientRect();
  const stations = Array.from(document.querySelectorAll("[data-station-key]"));
  let station = null;
  if (!viewportRect) station = stations[0] || null;
  else {
    station = stations.find((item) => {
      const rect = item.getBoundingClientRect();
      return rect.bottom > viewportRect.top + 20 && rect.top < viewportRect.bottom - 20;
    }) || stations.at(-1) || null;
  }
  return station?.querySelector(".stationProgressRing") || station || document.querySelector(".routeMap");
}

function showStages() {
  generalGuide.phase = "stages";
  const target = visibleStationTarget();
  if (!target) { scheduleScan(); return; }
  showStep({
    target,
    title: "Проходи этапы",
    body: `<p>В каждом этапе сначала изучи новые слова, а затем проверь себя в тесте.</p>`,
    nextLabel: "Понятно",
    onNext: () => {
      generalGuide.phase = "await-station";
      scheduleScan();
    },
    onSkip: skipGeneralGuide,
    blockTarget: true,
    spotlightShape: target.matches?.(".stationProgressRing") ? "circle" : "rounded",
    spotlightPadding: 8,
    contentPreference: "center",
  });
}

function showStationStudy() {
  generalGuide.phase = "station-study";
  const target = document.querySelector("[data-station-study]");
  if (!target) { scheduleScan(); return; }
  showStep({
    target,
    title: "Учить слова",
    body: `<p>Запоминай новые слова с помощью флеш-карточек.</p>`,
    onNext: showStationTest,
    onSkip: skipGeneralGuide,
    blockTarget: true,
    spotlightShape: "rounded",
    spotlightPadding: 6,
    contentPreference: "center",
  });
}

function showStationTest() {
  generalGuide.phase = "station-test";
  const target = document.querySelector("[data-station-test]");
  if (!target) { scheduleScan(); return; }
  showStep({
    target,
    title: "Тест",
    body: `<p>Проверь свои знания и заверши этап.</p><p>Для прохождения нужно набрать <strong>не менее ${PATH_CONFIG.stationRequiredAccuracy}%</strong>.</p>`,
    nextLabel: "Понятно",
    onNext: finishGeneralGuide,
    onSkip: skipGeneralGuide,
    blockTarget: true,
    spotlightShape: "rounded",
    spotlightPadding: 6,
    contentPreference: "center",
  });
}

function startGeneralGuide() {
  closeOpenStele();
  destroyOverlay();
  generalGuide = { active: true, phase: "intro", storyIndex: 0 };
  document.body.classList.add("alantilGuideGeneral");
  showGeneralIntro();
}

function mountHelpTrigger() {
  const pathView = document.querySelector(".pathView");
  if (!pathView || pathView.querySelector("[data-alantil-guide-trigger]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "alantilGuideTrigger";
  button.dataset.alantilGuideTrigger = "";
  button.setAttribute("aria-label", "Как пользоваться приложением");
  button.title = "Как пользоваться приложением";
  button.textContent = "?";
  button.addEventListener("click", startGeneralGuide);
  pathView.appendChild(button);
}

function finishLearningGuide() {
  learningFlow = { active: false, phase: "", decisionWordId: "" };
  updateGuideState({ learning_completed: true });
  destroyOverlay();
  scheduleScan();
}

function skipLearningGuide() {
  finishLearningGuide();
}

function showLearningCardStep(binding) {
  if (!binding?.card?.isConnected || learnState.totalPlanned <= 0) return;
  learningFlow = { active: true, phase: "card", decisionWordId: "" };
  showStep({
    target: binding.card,
    title: "Вспомни перевод",
    body: `<p>Попробуй вспомнить значение слова и нажми на карточку.</p>`,
    nextLabel: "",
    onSkip: skipLearningGuide,
    blocking: false,
    spotlightShape: "rounded",
    spotlightPadding: 5,
    contentPreference: "top",
    avoidHeader: false,
    avoidBottomNav: true,
  });
}

function showLearningTranslation(binding) {
  if (!learningFlow.active || learningFlow.phase !== "card") return;
  learningFlow.phase = "translation";
  showStep({
    target: binding.card,
    title: "Проверь себя",
    body: `<p>На обратной стороне находится перевод слова.</p>`,
    onNext: () => showLearningDecision(binding),
    onSkip: skipLearningGuide,
    blocking: true,
    blockTarget: true,
    spotlightShape: "rounded",
    spotlightPadding: 5,
    contentPreference: "top",
    avoidHeader: false,
    avoidBottomNav: true,
  });
}

function showLearningDecision(binding) {
  if (!learningFlow.active) return;
  learningFlow.phase = "decision";
  const target = binding.session.querySelector(".learnDecisionGroup") || binding.card;
  showStep({
    target,
    title: "Знаешь слово?",
    body: `<div class="alantilGuideGesture"><span><b>←</b> Не знаю</span><span>Знаю <b>→</b></span></div><p>Незнакомые слова будут возвращаться позже.</p>`,
    nextLabel: "",
    onSkip: skipLearningGuide,
    blocking: false,
    spotlightShape: "rounded",
    spotlightPadding: 6,
    contentPreference: "center",
    avoidHeader: false,
    avoidBottomNav: true,
  });
}

function showLearningCounter(binding) {
  if (!learningFlow.active) return;
  learningFlow.phase = "counter";
  const target = document.getElementById("sessionStatus") || document.getElementById("counter");
  if (!target) { scheduleScan(); return; }
  showStep({
    target,
    title: "Прогресс",
    body: `<p>Здесь видно, сколько слов осталось пройти.</p>`,
    onNext: () => showLearningFavorite(binding),
    onSkip: skipLearningGuide,
    blocking: true,
    blockTarget: true,
    spotlightShape: "pill",
    spotlightPadding: 6,
    contentPreference: "center",
    avoidHeader: false,
    avoidBottomNav: true,
  });
}

function showLearningFavorite(binding) {
  if (!learningFlow.active) return;
  learningFlow.phase = "favorite";
  const target = binding.session.querySelector("#btnFavAction");
  if (!target) { scheduleScan(); return; }
  showStep({
    target,
    title: "Избранное",
    body: `<p>Сохраняй нужные слова, чтобы вернуться к ним позже.</p>`,
    nextLabel: "Готово",
    onNext: finishLearningGuide,
    onSkip: skipLearningGuide,
    blocking: true,
    blockTarget: true,
    spotlightShape: "auto",
    spotlightPadding: 5,
    contentPreference: "center",
    avoidHeader: false,
    avoidBottomNav: true,
  });
}

function registerLearningDecision(binding) {
  if (!learningFlow.active || learningFlow.phase !== "decision") return;
  learningFlow.phase = "decision-wait";
  learningFlow.decisionWordId = String(learnState.currentStudyId || "");
  destroyOverlay();
  globalThis.setTimeout(() => {
    if (!binding.session.isConnected || !learningFlow.active || learningFlow.phase !== "decision-wait") return;
    showLearningCounter(binding);
  }, 620);
}

function showRepeatHint(binding) {
  const state = storedGuideState();
  if (!state.learning_completed || state.repeat_hint_shown || activeOverlay) return false;
  const id = String(learnState.currentStudyId || "");
  if (!id) return false;
  const stats = learnState.studySession?.wordStats?.[id];
  const failCount = Number(learnState.sessionFailMap?.[id] || 0);
  if (!stats || Number(stats.show_count || 0) < 2 || failCount < 1) return false;

  showStep({
    target: binding.card,
    title: "Слово вернулось",
    body: `<p>Ты отметил его как незнакомое. Повтори его ещё раз.</p>`,
    nextLabel: "Понятно",
    showSkip: false,
    blocking: false,
    spotlightShape: "rounded",
    spotlightPadding: 5,
    contentPreference: "top",
    avoidHeader: false,
    avoidBottomNav: true,
    onNext: () => {
      updateGuideState({ repeat_hint_shown: true });
      scheduleScan();
    },
  });
  return true;
}

function bindLearningSession(session) {
  learningBinding?.abort?.();
  const abortController = new AbortController();
  const { signal } = abortController;
  const card = session.querySelector("#card");
  const yes = session.querySelector("#btnYes");
  const no = session.querySelector("#btnNo");
  if (!card || !yes || !no) return;

  const binding = { session, card, abort: () => abortController.abort(), touchStartX: 0 };
  learningBinding = binding;

  card.addEventListener("click", () => {
    if (!learningFlow.active || learningFlow.phase !== "card") return;
    globalThis.setTimeout(() => {
      if (card.classList.contains("flipped")) showLearningTranslation(binding);
    }, 0);
  }, { signal });

  yes.addEventListener("click", () => registerLearningDecision(binding), { signal });
  no.addEventListener("click", () => registerLearningDecision(binding), { signal });

  card.addEventListener("touchstart", (event) => {
    binding.touchStartX = event.touches?.[0]?.clientX || 0;
  }, { signal, passive: true });

  card.addEventListener("touchend", (event) => {
    if (!learningFlow.active || learningFlow.phase !== "decision") return;
    const endX = event.changedTouches?.[0]?.clientX ?? binding.touchStartX;
    const delta = endX - binding.touchStartX;
    const threshold = card.offsetWidth * 0.3;
    if (delta > threshold || delta < -threshold) registerLearningDecision(binding);
  }, { signal, passive: true });

  signal.addEventListener("abort", () => {
    if (learningBinding === binding) learningBinding = null;
    if (learningFlow.active) {
      learningFlow = { active: false, phase: "", decisionWordId: "" };
      destroyOverlay();
    }
  }, { once: true });

  const state = storedGuideState();
  if (!state.learning_completed && learnState.totalPlanned > 0) showLearningCardStep(binding);
  else showRepeatHint(binding);
}

function scanLearning() {
  const session = document.querySelector(".learnSession");
  if (!session) {
    if (learningBinding && !learningBinding.session.isConnected) learningBinding.abort();
    return;
  }
  if (!learningBinding || learningBinding.session !== session) {
    bindLearningSession(session);
    return;
  }
  if (!learningFlow.active) showRepeatHint(learningBinding);
}

function scanGeneral() {
  if (!generalGuide.active) return;
  closeOpenStele();
  if (generalGuide.phase === "stories-intro" && !activeOverlay) showStoriesIntro();
  else if (generalGuide.phase === "story" && !activeOverlay) showStory(generalGuide.storyIndex);
  else if (generalGuide.phase === "summary" && !activeOverlay) showStorySummary();
  else if (generalGuide.phase === "stages" && !activeOverlay) showStages();
  else if (generalGuide.phase === "await-station" && document.querySelector("[data-station-study]")) showStationStudy();
  else if (generalGuide.phase === "station-study" && !activeOverlay) showStationStudy();
  else if (generalGuide.phase === "station-test" && !activeOverlay) showStationTest();
}

function scan() {
  mountHelpTrigger();
  scanGeneral();
  scanLearning();
}

export function installGuidedHelp() {
  if (globalThis.__ALANTIL_GUIDED_HELP_INSTALLED__) return;
  globalThis.__ALANTIL_GUIDED_HELP_INSTALLED__ = true;
  ensureStyles();
  observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener("popstate", scheduleScan, { passive: true });
  scheduleScan();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installGuidedHelp, { once: true });
} else {
  installGuidedHelp();
}
