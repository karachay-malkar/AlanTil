import { PATH_CONFIG } from "../../config/path.js?v=13.15.10.8";
import { readScopedJson, writeScopedJson } from "../../shared/progress/storage-scope.js?v=13.15.10.8";
import { learnState } from "../learn/state.js?v=13.15.10.8";

const GUIDE_STATE_KEY = "alantil_guided_help_v1";
const GUIDE_STYLE_ID = "alantil-guided-help-style";
const STORY_SEQUENCE = ["oblivion", "roots", "ascent", "pathways"];
const STORY_GUIDE = Object.freeze({
  oblivion: {
    title: "На пороге забвения — лёгкий уровень",
    body: `
      <p>Это базовая лексика для начинающих.</p>
      <p>Освоив её, ты достигнешь лишь начального уровня владения языком. Увы, большинство людей сегодня знают язык только на этом уровне.</p>
      <p>Именно поэтому наш язык находится на грани исчезновения.</p>
      <p>Чтобы действительно хорошо знать язык, двигайся дальше.</p>`,
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
.alantilGuideTrigger{
  appearance:none;position:absolute;z-index:calc(var(--z-path-controls) + 4);left:10px;top:80%;width:36px;height:36px;
  display:grid;place-items:center;padding:0;border:1px solid color-mix(in srgb,var(--text-1) 22%,transparent);border-radius:50%;
  transform:translateY(-50%);background:color-mix(in srgb,var(--surface-0) 72%,transparent);color:var(--text-1);
  -webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:var(--shadow-sm);cursor:pointer;
  font:850 17px/1 var(--font-terminal);transition:opacity var(--duration-fast),transform var(--duration-fast),background var(--duration-fast);
}
.alantilGuideTrigger:active{transform:translateY(calc(-50% + 1px)) scale(.97)}
.alantilGuideTrigger.isLearningGuideTrigger{position:fixed;left:10px;top:80%}
body.alantilGuideGeneral .alantilGuideTrigger,body.alantilGuideLearning .alantilGuideTrigger{opacity:0;pointer-events:none}
body.alantilGuideGeneral .storySteleOverlay{visibility:hidden!important;opacity:0!important;pointer-events:none!important}

.alantilGuideOverlay{
  position:fixed;z-index:calc(var(--z-modal) + 24);inset:0;pointer-events:none;isolation:isolate;color:var(--text-1);
  opacity:0;transition:opacity .18s var(--ease-standard);
}
.alantilGuideOverlay.isVisible{opacity:1}
.alantilGuideOverlay.isLeaving{opacity:0}
.alantilGuideSpotlight{position:fixed;z-index:0;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.alantilGuideSpotlightShade{fill:rgba(25,25,25,.54);pointer-events:none}
.alantilGuideHalo{
  position:fixed;z-index:1;pointer-events:none;
  box-shadow:0 0 0 1px rgba(255,255,255,.18),0 0 10px rgba(255,255,255,.06);
  transition:left .26s var(--ease-standard),top .26s var(--ease-standard),width .26s var(--ease-standard),height .26s var(--ease-standard),border-radius .26s var(--ease-standard),opacity .16s ease;
}
.alantilGuideHalo.isPrimary{
  box-shadow:0 0 0 1px rgba(255,255,255,.26),0 0 14px rgba(255,255,255,.09);
  animation:alantilGuidePulse 2.15s ease-in-out infinite;
}
@keyframes alantilGuidePulse{
  0%,100%{box-shadow:0 0 0 1px rgba(255,255,255,.22),0 0 10px rgba(255,255,255,.06)}
  50%{box-shadow:0 0 0 2px rgba(255,255,255,.34),0 0 22px rgba(255,255,255,.13)}
}
.alantilGuideInputBlocker{position:fixed;z-index:2;background:transparent;pointer-events:auto;touch-action:none}
.alantilGuideContent{
  position:fixed;z-index:4;left:50%;top:14px;width:min(360px,calc(100vw - 28px));max-height:calc(100vh - 28px);overflow:auto;
  margin:0;padding:15px 16px 13px;transform:translateX(-50%);text-align:left;pointer-events:auto;outline:none;
  border:1px solid color-mix(in srgb,var(--line) 88%,transparent);border-radius:var(--radius-lg);
  background:color-mix(in srgb,var(--surface-0) 94%,transparent);box-shadow:var(--shadow-sm);
  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);
  opacity:1;transition:top .24s var(--ease-standard),opacity .16s ease,transform .24s var(--ease-standard);
}
.alantilGuideContent.isSwapping{opacity:.72;transform:translateX(-50%) translateY(2px)}
.alantilGuideTitle{margin:0;color:var(--text-1);font:900 17px/1.24 var(--font-terminal);text-wrap:balance}
.alantilGuideBody{margin-top:9px;color:var(--text-2);font-size:13px;line-height:1.46;text-wrap:pretty}
.alantilGuideBody p{margin:0}.alantilGuideBody p+p{margin-top:8px}.alantilGuideBody strong{color:var(--text-1);font-weight:850}
.alantilGuideNav{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:13px;pointer-events:auto}
.alantilGuideSkip.btn,.alantilGuideNext.btn{min-width:104px;min-height:36px;padding:6px 12px;font:800 11px/1 var(--font-terminal)}
.alantilGuideNext.btn{margin-left:auto;box-shadow:none}
@media(max-width:390px){
  .alantilGuideTrigger{left:9px;width:34px;height:34px}
  .alantilGuideContent{width:calc(100vw - 28px);padding:14px 14px 12px}
  .alantilGuideTitle{font-size:16px}.alantilGuideBody{font-size:12.5px}
  .alantilGuideSkip.btn,.alantilGuideNext.btn{min-width:98px;min-height:35px;padding:6px 10px}
}
@media(prefers-reduced-motion:reduce){
  .alantilGuideTrigger,.alantilGuideOverlay,.alantilGuideContent,.alantilGuideHalo{transition:none!important}
  .alantilGuideHalo.isPrimary{animation:none!important}
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

function destroyOverlay({ smooth = true } = {}) {
  if (!activeOverlay) return;
  const overlay = activeOverlay;
  activeOverlay = null;
  overlay.destroy({ smooth });
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

function targetGeometry(target, {
  padding = 7,
  shape = "auto",
  minWidth = 0,
  minHeight = 0,
} = {}) {
  if (!target?.isConnected) return null;
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  let resolvedShape = shape;
  if (resolvedShape === "auto") {
    if (target.matches?.(".storyTab,.sessionStatus")) resolvedShape = "pill";
    else if (target.matches?.(".stationProgressRing,#btnFavAction")) resolvedShape = "circle";
    else resolvedShape = "rounded";
  }

  let width = Math.max(rect.width + padding * 2, minWidth);
  let height = Math.max(rect.height + padding * 2, minHeight);
  let left = rect.left + rect.width / 2 - width / 2;
  let top = rect.top + rect.height / 2 - height / 2;

  if (resolvedShape === "circle") {
    const side = Math.max(width, height);
    width = side;
    height = side;
    left = rect.left + rect.width / 2 - side / 2;
    top = rect.top + rect.height / 2 - side / 2;
  }

  left = clamp(left, 2, Math.max(2, window.innerWidth - width - 2));
  top = clamp(top, 2, Math.max(2, window.innerHeight - height - 2));
  width = Math.min(width, window.innerWidth - left - 2);
  height = Math.min(height, window.innerHeight - top - 2);

  const computed = getComputedStyle(target);
  let radius = numericRadius(computed.borderTopLeftRadius, width, height) + padding;
  if (resolvedShape === "circle" || resolvedShape === "pill") radius = Math.min(width, height) / 2;
  else radius = clamp(radius, 12, Math.min(width, height) / 2);

  return { left, top, right: left + width, bottom: top + height, width, height, radius, shape: resolvedShape };
}

function geometryUnion(geometries) {
  const list = geometries.filter(Boolean);
  if (!list.length) return null;
  const left = Math.min(...list.map((item) => item.left));
  const top = Math.min(...list.map((item) => item.top));
  const right = Math.max(...list.map((item) => item.right));
  const bottom = Math.max(...list.map((item) => item.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function elementViewportRect(element) {
  if (!element || element.hidden || !element.isConnected) return null;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return null;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
}

function expandRect(rect, amount) {
  if (!rect) return null;
  return { left: rect.left - amount, top: rect.top - amount, right: rect.right + amount, bottom: rect.bottom + amount };
}

function intersectionArea(left, right) {
  if (!left || !right) return 0;
  const width = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left));
  const height = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
  return width * height;
}

function uniqueNumbers(values) {
  const result = [];
  values.forEach((value) => {
    if (!Number.isFinite(value)) return;
    const rounded = Math.round(value * 10) / 10;
    if (!result.some((item) => Math.abs(item - rounded) < 1)) result.push(rounded);
  });
  return result;
}

function positionGuideContent(content, geometries, {
  preference = "auto",
  avoidHeader = true,
  avoidBottomNav = true,
  avoidElements = [],
} = {}) {
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const edge = viewportWidth <= 390 ? 14 : 18;
  const gap = viewportWidth <= 390 ? 14 : 18;

  content.style.top = `${edge}px`;
  const measured = content.getBoundingClientRect();
  const height = measured.height;
  const maxTop = Math.max(edge, viewportHeight - height - edge);
  const union = geometryUnion(geometries);
  const targetCenter = union ? union.top + union.height / 2 : viewportHeight / 2;

  const protectedRects = geometries.filter(Boolean).map((geometry) => expandRect(geometry, gap));
  avoidElements.forEach((element) => {
    const rect = elementViewportRect(element);
    if (rect) protectedRects.push(expandRect(rect, gap));
  });
  const header = avoidHeader ? elementViewportRect(document.getElementById("appHeader")) : null;
  const bottomNav = avoidBottomNav ? elementViewportRect(document.getElementById("bottomNav")) : null;

  const opposite = !union
    ? (viewportHeight - height) / 2
    : targetCenter <= viewportHeight / 2
      ? Math.max(union.bottom + gap, viewportHeight * .61 - height / 2)
      : Math.min(union.top - gap - height, viewportHeight * .27 - height / 2);
  const above = union ? union.top - gap - height : edge;
  const below = union ? union.bottom + gap : maxTop;
  const center = (viewportHeight - height) / 2;
  const topZone = viewportHeight * .24 - height / 2;
  const bottomZone = viewportHeight * .72 - height / 2;

  let candidates;
  if (preference === "top") candidates = [above, topZone, opposite, below, center, edge, maxTop];
  else if (preference === "bottom") candidates = [below, bottomZone, opposite, above, center, maxTop, edge];
  else candidates = [opposite, above, below, center, topZone, bottomZone, edge, maxTop];

  const tops = uniqueNumbers(candidates.map((top) => clamp(top, edge, maxTop)));
  let best = null;
  for (let index = 0; index < tops.length; index += 1) {
    content.style.top = `${tops[index]}px`;
    const actual = content.getBoundingClientRect();
    const targetOverlap = protectedRects.reduce((sum, rect) => sum + intersectionArea(actual, rect), 0);
    const chromeOverlap = intersectionArea(actual, header) + intersectionArea(actual, bottomNav);
    const penalty = targetOverlap * 100000 + chromeOverlap * 50000 + index;
    const candidate = { top: tops[index], penalty, targetOverlap, chromeOverlap };
    if (!best || candidate.penalty < best.penalty) best = candidate;
    if (targetOverlap === 0 && chromeOverlap === 0) {
      best = candidate;
      break;
    }
  }

  content.style.top = `${best?.top ?? clamp(center, edge, maxTop)}px`;
  return content.getBoundingClientRect();
}

function svgElement(name) {
  return document.createElementNS("http://www.w3.org/2000/svg", name);
}

function updateMask(svg, holesGroup, shade, geometries) {
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

  while (holesGroup.children.length > geometries.length) holesGroup.lastElementChild?.remove();
  geometries.forEach((geometry, index) => {
    if (!geometry) return;
    let hole = holesGroup.children[index];
    if (!hole) {
      hole = svgElement("rect");
      hole.setAttribute("fill", "black");
      holesGroup.appendChild(hole);
    }
    hole.setAttribute("x", String(geometry.left));
    hole.setAttribute("y", String(geometry.top));
    hole.setAttribute("width", String(geometry.width));
    hole.setAttribute("height", String(geometry.height));
    hole.setAttribute("rx", String(geometry.radius));
    hole.setAttribute("ry", String(geometry.radius));
  });
}

function updateHalos(root, geometries, primaryIndex) {
  while (root.children.length > geometries.length) root.lastElementChild?.remove();
  geometries.forEach((geometry, index) => {
    if (!geometry) return;
    let halo = root.children[index];
    if (!halo) {
      halo = document.createElement("div");
      halo.className = "alantilGuideHalo";
      root.appendChild(halo);
    }
    halo.classList.toggle("isPrimary", index === primaryIndex);
    halo.style.left = `${geometry.left}px`;
    halo.style.top = `${geometry.top}px`;
    halo.style.width = `${geometry.width}px`;
    halo.style.height = `${geometry.height}px`;
    halo.style.borderRadius = `${geometry.radius}px`;
  });
}

function applyRect(element, rect) {
  if (!element || !rect) return;
  element.style.left = `${rect.left}px`;
  element.style.top = `${rect.top}px`;
  element.style.width = `${Math.max(0, rect.right - rect.left)}px`;
  element.style.height = `${Math.max(0, rect.bottom - rect.top)}px`;
}

function pointInsideRect(x, y, rect) {
  return Boolean(rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
}

function createInputBlockers(overlay, interactiveGeometries) {
  overlay.querySelectorAll("[data-guide-blocker]").forEach((node) => node.remove());
  if (!overlay.classList.contains("isBlocking")) return;
  const holes = interactiveGeometries.filter(Boolean);
  const makeBlocker = (rect) => {
    if (rect.right <= rect.left || rect.bottom <= rect.top) return;
    const blocker = document.createElement("div");
    blocker.className = "alantilGuideInputBlocker";
    blocker.dataset.guideBlocker = "";
    applyRect(blocker, rect);
    overlay.appendChild(blocker);
  };
  if (!holes.length) {
    makeBlocker({ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight });
    return;
  }

  const xs = [0, window.innerWidth];
  const ys = [0, window.innerHeight];
  holes.forEach((geometry) => {
    xs.push(clamp(geometry.left, 0, window.innerWidth), clamp(geometry.right, 0, window.innerWidth));
    ys.push(clamp(geometry.top, 0, window.innerHeight), clamp(geometry.bottom, 0, window.innerHeight));
  });
  const uniqueXs = uniqueNumbers(xs.sort((a, b) => a - b));
  const uniqueYs = uniqueNumbers(ys.sort((a, b) => a - b));
  for (let xi = 0; xi < uniqueXs.length - 1; xi += 1) {
    for (let yi = 0; yi < uniqueYs.length - 1; yi += 1) {
      const left = uniqueXs[xi];
      const right = uniqueXs[xi + 1];
      const top = uniqueYs[yi];
      const bottom = uniqueYs[yi + 1];
      const centerX = (left + right) / 2;
      const centerY = (top + bottom) / 2;
      if (holes.some((geometry) => pointInsideRect(centerX, centerY, geometry))) continue;
      makeBlocker({ left, top, right, bottom });
    }
  }
}

function normalizedTargets({
  target,
  targets,
  spotlightShape,
  spotlightPadding,
  interactiveTarget,
  minSpotlightWidth,
  minSpotlightHeight,
} = {}) {
  if (Array.isArray(targets) && targets.length) {
    return targets.filter((item) => item?.element?.isConnected).map((item) => ({
      element: item.element,
      shape: item.shape || "auto",
      padding: Number.isFinite(item.padding) ? item.padding : 7,
      minWidth: Number.isFinite(item.minWidth) ? item.minWidth : 0,
      minHeight: Number.isFinite(item.minHeight) ? item.minHeight : 0,
      interactive: Boolean(item.interactive),
    }));
  }
  if (!target?.isConnected) return [];
  return [{
    element: target,
    shape: spotlightShape || "auto",
    padding: Number.isFinite(spotlightPadding) ? spotlightPadding : 7,
    minWidth: Number.isFinite(minSpotlightWidth) ? minSpotlightWidth : 0,
    minHeight: Number.isFinite(minSpotlightHeight) ? minSpotlightHeight : 0,
    interactive: Boolean(interactiveTarget),
  }];
}

function createOverlay() {
  const modalRoot = document.getElementById("modalRoot") || document.body;
  const overlay = document.createElement("div");
  overlay.className = "alantilGuideOverlay";
  const maskId = `alantil-guide-mask-${++overlayCounter}`;
  overlay.innerHTML = `
    <svg class="alantilGuideSpotlight" aria-hidden="true">
      <defs>
        <mask id="${maskId}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
          <rect data-mask-base x="0" y="0" width="0" height="0" fill="white"></rect>
          <g data-mask-holes></g>
        </mask>
      </defs>
      <rect class="alantilGuideSpotlightShade" data-mask-shade x="0" y="0" width="0" height="0" mask="url(#${maskId})"></rect>
    </svg>
    <div data-guide-halos></div>
    <section class="alantilGuideContent" role="dialog" aria-modal="true"></section>`;
  modalRoot.appendChild(overlay);

  const svg = overlay.querySelector(".alantilGuideSpotlight");
  const holesGroup = overlay.querySelector("[data-mask-holes]");
  const shade = overlay.querySelector("[data-mask-shade]");
  const halosRoot = overlay.querySelector("[data-guide-halos]");
  const content = overlay.querySelector(".alantilGuideContent");
  let descriptors = [];
  let allowedElements = [];
  let avoidElements = [];
  let primaryIndex = 0;
  let preference = "auto";
  let avoidHeader = true;
  let avoidBottomNav = true;
  let resizeFrame = 0;
  let motionFrame = 0;
  let resizeObserver = null;
  let removeTimer = 0;
  let isDestroyed = false;
  let currentStepKey = "";

  const reposition = () => {
    if (isDestroyed || resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      const pairs = descriptors.map((descriptor, index) => ({
        descriptor,
        descriptorIndex: index,
        geometry: targetGeometry(descriptor.element, descriptor),
      })).filter((item) => item.geometry);
      const geometries = pairs.map((item) => item.geometry);
      const requestedPrimary = pairs.findIndex((item) => item.descriptorIndex === primaryIndex);
      const safePrimaryIndex = requestedPrimary >= 0 ? requestedPrimary : 0;
      updateMask(svg, holesGroup, shade, geometries);
      updateHalos(halosRoot, geometries, safePrimaryIndex);
      const interactiveGeometries = pairs.filter((item) => item.descriptor.interactive).map((item) => item.geometry);
      createInputBlockers(overlay, interactiveGeometries);
      positionGuideContent(content, geometries, { preference, avoidHeader, avoidBottomNav, avoidElements });
    });
  };

  const trackMotion = (duration = 720) => {
    const until = performance.now() + duration;
    if (motionFrame) cancelAnimationFrame(motionFrame);
    const tick = (now) => {
      reposition();
      if (now < until && !isDestroyed) motionFrame = requestAnimationFrame(tick);
      else motionFrame = 0;
    };
    motionFrame = requestAnimationFrame(tick);
  };

  const eventAllowed = (event) => {
    if (!overlay.classList.contains("isBlocking") || event.isTrusted === false) return true;
    const node = event.target;
    if (!(node instanceof Element)) return false;
    if (content.contains(node)) return true;
    if (allowedElements.some((element) => element?.isConnected && (element === node || element.contains(node)))) return true;
    for (const descriptor of descriptors) {
      if (!descriptor.interactive || !descriptor.element?.contains(node)) continue;
      const nestedControl = node.closest("button,a,input,select,textarea,[role='button'],[contenteditable='true']");
      if (nestedControl && nestedControl !== descriptor.element
        && !allowedElements.some((element) => element === nestedControl || element?.contains(nestedControl))) return false;
      return true;
    }
    return false;
  };

  const inputGuard = (event) => {
    if (eventAllowed(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  const interactionMotionGuard = (event) => {
    if (!eventAllowed(event)) return;
    const node = event.target;
    if (node instanceof Element && !content.contains(node)) trackMotion();
  };

  const focusGuard = (event) => {
    if (eventAllowed(event)) return;
    event.stopPropagation();
    const fallback = content.querySelector("[data-guide-next],[data-guide-skip]");
    fallback?.focus?.({ preventScroll: true });
  };

  const observeTargets = () => {
    resizeObserver?.disconnect();
    if (!("ResizeObserver" in globalThis)) return;
    resizeObserver = new ResizeObserver(reposition);
    [...descriptors.map((item) => item.element), ...avoidElements, content].filter(Boolean).forEach((element) => {
      if (element?.isConnected) resizeObserver.observe(element);
    });
  };

  const cleanup = () => {
    if (isDestroyed) return;
    isDestroyed = true;
    window.removeEventListener("resize", reposition);
    window.removeEventListener("orientationchange", reposition);
    window.removeEventListener("scroll", reposition, true);
    window.removeEventListener("pointermove", reposition, true);
    window.removeEventListener("touchmove", reposition, true);
    document.removeEventListener("pointerdown", inputGuard, true);
    document.removeEventListener("click", inputGuard, true);
    document.removeEventListener("touchstart", inputGuard, true);
    document.removeEventListener("click", interactionMotionGuard, false);
    document.removeEventListener("touchend", interactionMotionGuard, false);
    document.removeEventListener("focusin", focusGuard, true);
    resizeObserver?.disconnect();
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    if (motionFrame) cancelAnimationFrame(motionFrame);
    if (removeTimer) clearTimeout(removeTimer);
    overlay.remove();
  };

  const api = {
    overlay,
    get stepKey() { return currentStepKey; },
    hasDisconnectedTargets() { return descriptors.some((item) => !item.element?.isConnected); },
    reposition,
    update(config = {}) {
      currentStepKey = String(config.stepKey || "");
      descriptors = normalizedTargets(config);
      allowedElements = (config.allowedElements || []).filter((element) => element?.isConnected);
      avoidElements = (config.avoidElements || []).filter((element) => element?.isConnected);
      primaryIndex = Number.isFinite(config.primaryTargetIndex) ? config.primaryTargetIndex : 0;
      preference = config.contentPreference || "auto";
      avoidHeader = config.avoidHeader !== false;
      avoidBottomNav = config.avoidBottomNav !== false;
      overlay.classList.toggle("isBlocking", config.blocking !== false);
      content.setAttribute("aria-modal", config.blocking === false ? "false" : "true");
      content.classList.add("isSwapping");
      content.innerHTML = `
        <h2 class="alantilGuideTitle">${config.title || ""}</h2>
        <div class="alantilGuideBody">${config.body || ""}</div>
        ${(config.showSkip !== false || config.nextLabel) ? `<nav class="alantilGuideNav" aria-label="Навигация по подсказке">
          ${config.showSkip !== false ? '<button class="btn actionText alantilGuideSkip" type="button" data-guide-skip>Пропустить</button>' : ""}
          ${config.nextLabel ? `<button class="btn actionPrimary alantilGuideNext" type="button" data-guide-next>${config.nextLabel}</button>` : ""}
        </nav>` : ""}`;
      content.querySelector("[data-guide-next]")?.addEventListener("click", () => config.onNext?.());
      content.querySelector("[data-guide-skip]")?.addEventListener("click", () => config.onSkip?.());
      observeTargets();
      reposition();
      requestAnimationFrame(() => requestAnimationFrame(() => content.classList.remove("isSwapping")));
    },
    destroy({ smooth = true } = {}) {
      if (isDestroyed) return;
      if (!smooth || globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
        cleanup();
        return;
      }
      overlay.classList.add("isLeaving");
      removeTimer = globalThis.setTimeout(cleanup, 190);
    },
  };

  window.addEventListener("resize", reposition, { passive: true });
  window.addEventListener("orientationchange", reposition, { passive: true });
  window.addEventListener("scroll", reposition, { capture: true, passive: true });
  window.addEventListener("pointermove", reposition, { capture: true, passive: true });
  window.addEventListener("touchmove", reposition, { capture: true, passive: true });
  document.addEventListener("pointerdown", inputGuard, true);
  document.addEventListener("click", inputGuard, true);
  document.addEventListener("touchstart", inputGuard, true);
  document.addEventListener("click", interactionMotionGuard, false);
  document.addEventListener("touchend", interactionMotionGuard, false);
  document.addEventListener("focusin", focusGuard, true);
  requestAnimationFrame(() => overlay.classList.add("isVisible"));
  return api;
}

function showStep(config = {}) {
  if (!activeOverlay) activeOverlay = createOverlay();
  activeOverlay.update({
    showSkip: true,
    blocking: true,
    interactiveTarget: false,
    spotlightShape: "auto",
    spotlightPadding: 7,
    minSpotlightWidth: 0,
    minSpotlightHeight: 0,
    contentPreference: "auto",
    avoidHeader: true,
    avoidBottomNav: true,
    nextLabel: "Далее",
    ...config,
  });
  return activeOverlay;
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
    stepKey: "general:intro",
    title: "Ассаламу алейкум, алан!",
    body: `
      <p>Это приложение создано для изучения аланских (карачаево-балкарских) слов и расширения словарного запаса.</p>
      <p>Учи новые слова, а затем старайся использовать их в повседневной жизни. <strong>Только тогда твоя речь действительно станет богаче, и ты увидишь свой прогресс.</strong></p>`,
    onNext: showStoriesIntro,
    onSkip: skipGeneralGuide,
    contentPreference: "auto",
  });
}

function storyPanelTarget() {
  return document.querySelector(".pathStickyControls") || document.querySelector(".storyTabs");
}

function showStoriesIntro() {
  generalGuide.phase = "stories-intro";
  const target = storyPanelTarget();
  if (!target) { scheduleScan(); return; }
  showStep({
    stepKey: "general:stories-intro",
    target,
    title: "Истории",
    body: `<p>Здесь слова разделены по сложности и назначению.</p><p>Сейчас коротко познакомимся с каждым разделом.</p>`,
    onNext: () => showStory(0),
    onSkip: skipGeneralGuide,
    spotlightShape: "rounded",
    spotlightPadding: 6,
    contentPreference: "bottom",
  });
}

function requestStory(storyId) {
  const active = document.querySelector(".storyTab.active")?.dataset.storyTab || "";
  if (active === storyId) return true;
  const button = document.querySelector(`[data-story-tab="${storyId}"]`);
  if (!button) return false;
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
    stepKey: `general:story:${storyId}`,
    target,
    title: copy.title,
    body: copy.body,
    onNext: () => safeIndex < STORY_SEQUENCE.length - 1 ? showStory(safeIndex + 1) : showStorySummary(),
    onSkip: skipGeneralGuide,
    spotlightShape: "pill",
    spotlightPadding: 7,
    contentPreference: "bottom",
    avoidElements: [storyPanelTarget()].filter(Boolean),
  });
}

function showStorySummary() {
  generalGuide.phase = "summary";
  if (!requestStory("roots")) return;
  closeOpenStele();
  const target = storyPanelTarget();
  if (!target) { scheduleScan(); return; }
  showStep({
    stepKey: "general:summary",
    target,
    title: "Выбери свой путь",
    body: `<p>Начни с подходящего тебе уровня и переключайся между историями в любое время.</p><p><strong>Основной путь приложения — «Возвращение к истокам».</strong></p>`,
    onNext: showStages,
    onSkip: skipGeneralGuide,
    spotlightShape: "rounded",
    spotlightPadding: 6,
    contentPreference: "bottom",
  });
}

function visibleStationTarget() {
  const viewport = document.querySelector(".pathMapViewport");
  const viewportRect = viewport?.getBoundingClientRect();
  if (viewport?.classList.contains("isPositioning")) return null;
  const stations = Array.from(document.querySelectorAll("[data-station-key]"));
  if (!viewportRect || !stations.length) {
    const station = stations.at(-1) || stations[0] || null;
    return station ? { station, target: station.querySelector(".stationProgressRing") || station, preference: "top" } : null;
  }

  const viewportHeight = viewportRect.height;
  const centerY = viewportRect.top + viewportHeight / 2;
  const hardTop = viewportRect.top + viewportHeight * .28;
  const preferredTop = viewportRect.top + viewportHeight * .40;
  const preferredBottom = viewportRect.top + viewportHeight * .65;
  const visible = stations.map((station, index) => {
    const rect = station.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const intersects = rect.bottom > viewportRect.top && rect.top < viewportRect.bottom;
    return { station, index, rect, center, intersects };
  }).filter((item) => item.intersects && item.center >= hardTop && item.center <= viewportRect.bottom - 8);

  if (!visible.length) {
    const fallback = stations.map((station, index) => {
      const rect = station.getBoundingClientRect();
      return { station, index, rect, center: rect.top + rect.height / 2 };
    }).filter((item) => item.center >= hardTop).sort((a, b) => Math.abs(a.center - centerY) - Math.abs(b.center - centerY))[0];
    if (!fallback) return null;
    return {
      station: fallback.station,
      target: fallback.station.querySelector(".stationProgressRing") || fallback.station,
      preference: fallback.center >= centerY ? "top" : "bottom",
    };
  }

  const comfortable = visible.filter((item) => item.center >= preferredTop && item.center <= preferredBottom);
  const pool = comfortable.length ? comfortable : visible;
  pool.sort((a, b) => {
    const aDistance = Math.abs(a.center - centerY);
    const bDistance = Math.abs(b.center - centerY);
    if (Math.abs(aDistance - bDistance) > 12) return aDistance - bDistance;
    return b.index - a.index;
  });
  const selected = pool[0];
  return {
    station: selected.station,
    target: selected.station.querySelector(".stationProgressRing") || selected.station,
    preference: selected.center >= centerY ? "top" : "bottom",
  };
}

function showStages() {
  generalGuide.phase = "stages";
  const selection = visibleStationTarget();
  if (!selection?.target) { scheduleScan(); return; }
  showStep({
    stepKey: `general:stages:${selection.station.dataset.stationKey || "visible"}`,
    target: selection.target,
    title: "Проходи этапы",
    body: `<p>В каждом этапе сначала изучи новые слова, а затем проверь себя в тесте.</p>`,
    nextLabel: "Понятно",
    onNext: () => {
      generalGuide.phase = "await-station";
      destroyOverlay();
      scheduleScan();
    },
    onSkip: skipGeneralGuide,
    spotlightShape: selection.target.matches?.(".stationProgressRing") ? "circle" : "rounded",
    spotlightPadding: 10,
    contentPreference: selection.preference,
    avoidElements: [selection.station],
  });
}

function showStationStudy() {
  generalGuide.phase = "station-study";
  const target = document.querySelector("[data-station-study]");
  if (!target) { scheduleScan(); return; }
  showStep({
    stepKey: "general:station-study",
    target,
    title: "Учить слова",
    body: `<p>Запоминай новые слова с помощью флеш-карточек.</p>`,
    onNext: showStationTest,
    onSkip: skipGeneralGuide,
    spotlightShape: "rounded",
    spotlightPadding: 9,
  });
}

function showStationTest() {
  generalGuide.phase = "station-test";
  const target = document.querySelector("[data-station-test]");
  if (!target) { scheduleScan(); return; }
  showStep({
    stepKey: "general:station-test",
    target,
    title: "Тест",
    body: `<p>Проверь свои знания и заверши этап.</p><p>Для прохождения нужно набрать <strong>не менее ${PATH_CONFIG.stationRequiredAccuracy}%</strong>.</p>`,
    nextLabel: "Понятно",
    onNext: finishGeneralGuide,
    onSkip: skipGeneralGuide,
    spotlightShape: "rounded",
    spotlightPadding: 9,
  });
}

function startGeneralGuide() {
  closeOpenStele();
  destroyOverlay({ smooth: false });
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
  document.body.classList.remove("alantilGuideLearning");
  updateGuideState({ learning_completed: true });
  destroyOverlay();
  scheduleScan();
}

function skipLearningGuide() {
  finishLearningGuide();
}

function waitForRealFlip(binding, callback) {
  const card = binding?.card;
  const inner = card?.querySelector(".cardInner");
  if (!card?.isConnected || !inner) return;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    inner.removeEventListener("transitionend", onEnd);
    clearTimeout(timer);
    if (card.classList.contains("flipped")) callback();
    else learningFlow.phase = "card";
  };
  const onEnd = (event) => {
    if (event.target !== inner || event.propertyName !== "transform") return;
    finish();
  };
  const timer = globalThis.setTimeout(finish, 540);
  inner.addEventListener("transitionend", onEnd);
}

function advanceLearningCard(binding) {
  if (!learningFlow.active || learningFlow.phase !== "card" || !binding?.card?.isConnected) return;
  learningFlow.phase = "card-wait";
  waitForRealFlip(binding, () => {
    if (!learningFlow.active || learningFlow.phase !== "card-wait") return;
    learningFlow.phase = "card";
    showLearningTranslation(binding);
  });
  if (!binding.card.classList.contains("flipped")) binding.card.click();
}

function startLearningGuide(binding = learningBinding) {
  if (!binding?.session?.isConnected || !binding.card?.isConnected || learnState.totalPlanned <= 0) return;
  destroyOverlay({ smooth: false });
  learningFlow = { active: false, phase: "", decisionWordId: "" };

  const launch = () => {
    if (!binding.session.isConnected || !binding.card.isConnected) return;
    showLearningCardStep(binding);
  };

  if (!binding.card.classList.contains("flipped")) {
    launch();
    return;
  }

  const inner = binding.card.querySelector(".cardInner");
  if (!inner) {
    binding.card.click();
    globalThis.setTimeout(launch, 0);
    return;
  }

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    inner.removeEventListener("transitionend", onEnd);
    clearTimeout(timer);
    launch();
  };
  const onEnd = (event) => {
    if (event.target !== inner || event.propertyName !== "transform") return;
    finish();
  };
  const timer = globalThis.setTimeout(finish, 540);
  inner.addEventListener("transitionend", onEnd);
  binding.card.click();
}

function mountLearningHelpTrigger(binding) {
  const session = binding?.session;
  if (!session?.isConnected || session.querySelector("[data-alantil-learning-guide-trigger]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "alantilGuideTrigger isLearningGuideTrigger";
  button.dataset.alantilLearningGuideTrigger = "";
  button.setAttribute("aria-label", "Подсказки по изучению слов");
  button.title = "Подсказки по изучению слов";
  button.textContent = "?";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    startLearningGuide(binding);
  });
  session.appendChild(button);
}

function showLearningCardStep(binding) {
  if (!binding?.card?.isConnected || learnState.totalPlanned <= 0) return;
  learningFlow = { active: true, phase: "card", decisionWordId: "" };
  document.body.classList.add("alantilGuideLearning");
  showStep({
    stepKey: "learning:card",
    target: binding.card,
    title: "Вспомни перевод",
    body: `<p>Попробуй вспомнить значение слова.</p><p>Нажми на карточку, чтобы увидеть перевод.</p>`,
    onNext: () => advanceLearningCard(binding),
    onSkip: skipLearningGuide,
    blocking: true,
    interactiveTarget: true,
    spotlightShape: "rounded",
    spotlightPadding: 7,
    contentPreference: "top",
    avoidHeader: false,
    avoidBottomNav: true,
  });
}

function showLearningTranslation(binding) {
  if (!learningFlow.active || learningFlow.phase !== "card") return;
  learningFlow.phase = "translation";
  showStep({
    stepKey: "learning:translation",
    target: binding.card,
    title: "Проверь себя",
    body: `<p>На обратной стороне находится перевод слова.</p>`,
    onNext: () => showLearningDecision(binding),
    onSkip: skipLearningGuide,
    blocking: true,
    spotlightShape: "rounded",
    spotlightPadding: 7,
    contentPreference: "top",
    avoidHeader: false,
    avoidBottomNav: true,
  });
}

function showLearningDecision(binding) {
  if (!learningFlow.active) return;
  learningFlow.phase = "decision";
  const decision = binding.session.querySelector(".learnDecisionGroup");
  const yes = binding.session.querySelector("#btnYes");
  const no = binding.session.querySelector("#btnNo");
  if (!decision || !yes || !no) { scheduleScan(); return; }
  showStep({
    stepKey: "learning:decision",
    targets: [
      { element: binding.card, shape: "rounded", padding: 7, interactive: true },
      { element: decision, shape: "rounded", padding: 10, minWidth: 178, minHeight: 84, interactive: true },
    ],
    allowedElements: [yes, no],
    primaryTargetIndex: 1,
    title: "Знаешь слово?",
    body: `
      <p>Если знаешь — свайпай вправо или нажми «Знаю».</p>
      <p>Если не знаешь — свайпай влево или нажми «Не знаю».</p>
      <p>Незнакомое слово вернётся позже.</p>`,
    onNext: () => showLearningCounter(binding),
    onSkip: skipLearningGuide,
    blocking: true,
    contentPreference: "auto",
    avoidHeader: false,
    avoidBottomNav: true,
  });
}

function visibleCounterTarget() {
  const status = document.getElementById("sessionStatus");
  if (elementViewportRect(status)) return status;
  const counter = document.getElementById("counter");
  return elementViewportRect(counter) ? counter : null;
}

function showLearningCounter(binding) {
  if (!learningFlow.active) return;
  learningFlow.phase = "counter";
  const target = visibleCounterTarget();
  if (!target) { scheduleScan(); return; }
  showStep({
    stepKey: "learning:counter",
    target,
    title: "Прогресс",
    body: `<p>Здесь видно, сколько слов осталось пройти.</p>`,
    onNext: () => showLearningFavorite(binding),
    onSkip: skipLearningGuide,
    blocking: true,
    spotlightShape: "pill",
    spotlightPadding: 14,
    minSpotlightWidth: 90,
    minSpotlightHeight: 44,
    contentPreference: "bottom",
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
    stepKey: "learning:favorite",
    target,
    allowedElements: [target],
    title: "Избранное",
    body: `<p>Сохраняй нужные слова, чтобы вернуться к ним позже.</p>`,
    nextLabel: "Готово",
    onNext: finishLearningGuide,
    onSkip: skipLearningGuide,
    blocking: true,
    interactiveTarget: true,
    spotlightShape: "circle",
    spotlightPadding: 14,
    minSpotlightWidth: 64,
    minSpotlightHeight: 64,
    contentPreference: "bottom",
    avoidHeader: false,
    avoidBottomNav: true,
  });
}

function registerLearningDecision(binding) {
  if (!learningFlow.active || learningFlow.phase !== "decision") return;
  learningFlow.phase = "decision-wait";
  learningFlow.decisionWordId = String(learnState.currentStudyId || "");
  globalThis.setTimeout(() => {
    if (!binding.session.isConnected || !learningFlow.active || learningFlow.phase !== "decision-wait") return;
    showLearningCounter(binding);
  }, 620);
}

function dismissRepeatHint() {
  updateGuideState({ repeat_hint_shown: true });
  destroyOverlay();
  scheduleScan();
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
    stepKey: "learning:repeat",
    target: binding.card,
    title: "Слово вернулось",
    body: `<p>Ты отметил его как незнакомое. Повтори его ещё раз.</p>`,
    nextLabel: "Понятно",
    blocking: true,
    interactiveTarget: true,
    spotlightShape: "rounded",
    spotlightPadding: 7,
    contentPreference: "top",
    avoidHeader: false,
    avoidBottomNav: true,
    onNext: dismissRepeatHint,
    onSkip: dismissRepeatHint,
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
  mountLearningHelpTrigger(binding);

  card.addEventListener("click", () => {
    if (!learningFlow.active || learningFlow.phase !== "card") return;
    learningFlow.phase = "card-wait";
    waitForRealFlip(binding, () => {
      if (!learningFlow.active || learningFlow.phase !== "card-wait" || !card.isConnected) return;
      learningFlow.phase = "card";
      showLearningTranslation(binding);
    });
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
      document.body.classList.remove("alantilGuideLearning");
      destroyOverlay({ smooth: false });
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
  mountLearningHelpTrigger(learningBinding);
  if (!learningFlow.active) showRepeatHint(learningBinding);
}

function overlayNeeds(stepKey) {
  return !activeOverlay || activeOverlay.stepKey !== stepKey || activeOverlay.hasDisconnectedTargets();
}

function scanGeneral() {
  if (!generalGuide.active) return;
  closeOpenStele();
  if (generalGuide.phase === "stories-intro" && overlayNeeds("general:stories-intro")) showStoriesIntro();
  else if (generalGuide.phase === "story") {
    const storyId = STORY_SEQUENCE[generalGuide.storyIndex];
    if (overlayNeeds(`general:story:${storyId}`)) showStory(generalGuide.storyIndex);
  } else if (generalGuide.phase === "summary" && overlayNeeds("general:summary")) showStorySummary();
  else if (generalGuide.phase === "stages"
    && (!activeOverlay || !activeOverlay.stepKey.startsWith("general:stages:") || activeOverlay.hasDisconnectedTargets())) showStages();
  else if (generalGuide.phase === "await-station" && document.querySelector("[data-station-study]")) showStationStudy();
  else if (generalGuide.phase === "station-study" && overlayNeeds("general:station-study")) showStationStudy();
  else if (generalGuide.phase === "station-test" && overlayNeeds("general:station-test")) showStationTest();
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