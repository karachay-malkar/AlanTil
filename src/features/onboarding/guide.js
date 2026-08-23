import { PATH_CONFIG } from "../../config/path.js?v=13.15.10.5";
import { readScopedJson, writeScopedJson } from "../../shared/progress/storage-scope.js?v=13.15.10.5";
import { learnState } from "../learn/state.js?v=13.15.10.5";

const GUIDE_STATE_KEY = "alantil_guided_help_v1";
const GUIDE_STYLE_ID = "alantil-guided-help-style";
const STORY_SEQUENCE = ["oblivion", "roots", "ascent", "pathways"];
const STORY_GUIDE = Object.freeze({
  oblivion: {
    title: "На пороге забвения — лёгкий уровень",
    body: `
      <p>Здесь собрана самая простая и базовая лексика, которую знает большинство носителей языка.</p>
      <p>Этот раздел предназначен прежде всего для тех, кто начинает изучать язык с нуля или пока знает совсем немного слов.</p>`,
  },
  roots: {
    title: "Возвращение к истокам — средний уровень",
    body: `
      <p><strong>Это главный раздел приложения.</strong> Каждый, кому небезразлична судьба языка, должен овладеть этим словарём.</p>
      <p>Здесь собраны слова, которые употребляются всё реже и которые сегодня знает далеко не каждый. Именно владение такими словами отличает хорошее знание языка от знания только самой простой, базовой лексики.</p>
      <p><strong>Если мы сможем вернуть эту лексику в родную речь и снова сделать её частью повседневной жизни, наш язык будет жить.</strong></p>`,
  },
  ascent: {
    title: "На вершине — сложный уровень",
    body: `
      <p>Здесь собраны редкие, старые и более сложные слова, которые сегодня употребляются значительно реже.</p>
      <p>Этот раздел предназначен для тех, кто уже хорошо знает язык и хочет углубить свои знания.</p>`,
  },
  pathways: {
    title: "Тропы — тематические наборы",
    body: `
      <p>Здесь слова распределены не по уровню сложности, а по темам: животные, растения, материалы и другие области жизни.</p>
      <p>Выбирай интересующие темы и отдельно расширяй свой словарный запас.</p>`,
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
body.alantilGuideGeneral .alantilGuideTrigger{opacity:0;pointer-events:none}
body.alantilGuideGeneral .storySteleOverlay{visibility:hidden!important;opacity:0!important;pointer-events:none!important}
.alantilGuideOverlay{position:fixed;z-index:calc(var(--z-modal) + 24);inset:0;pointer-events:none}
.alantilGuideShade,.alantilGuideFullShade{position:fixed;background:rgba(20,19,17,.68);-webkit-backdrop-filter:brightness(.82);backdrop-filter:brightness(.82)}
.alantilGuideOverlay.isBlocking .alantilGuideShade,.alantilGuideOverlay.isBlocking .alantilGuideFullShade{pointer-events:auto}
.alantilGuideFullShade{inset:0}
.alantilGuideTargetBlocker{position:fixed;background:transparent;pointer-events:auto}
.alantilGuideBubble{
  position:fixed;z-index:4;width:min(390px,calc(100vw - 24px));max-height:min(56dvh,470px);overflow:auto;padding:14px 14px 13px;
  border:1px solid color-mix(in srgb,var(--line) 88%,transparent);border-radius:18px;background:color-mix(in srgb,var(--surface-0) 94%,transparent);
  color:var(--text-1);box-shadow:0 16px 48px rgba(24,22,19,.28);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);pointer-events:auto;
}
.alantilGuideBubble.isCentered{left:50%!important;top:50%!important;transform:translate(-50%,-50%)}
.alantilGuideMeta{display:flex;align-items:center;justify-content:flex-end;min-height:20px;margin-bottom:3px}
.alantilGuideSkip{appearance:none;padding:2px 0;border:0;background:transparent;color:var(--text-3);font:700 10px/1.2 var(--font-terminal);cursor:pointer}
.alantilGuideTitle{margin:0;color:var(--text-1);font-size:17px;font-weight:900;line-height:1.18;text-wrap:balance}
.alantilGuideBody{margin-top:8px;color:var(--text-2);font-size:13px;line-height:1.48}
.alantilGuideBody p{margin:0}.alantilGuideBody p+p{margin-top:8px}.alantilGuideBody strong{color:var(--text-1);font-weight:850}
.alantilGuideFooter{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
.alantilGuideNext{appearance:none;min-height:36px;padding:8px 14px;border:1px solid color-mix(in srgb,var(--text-1) 22%,transparent);border-radius:999px;background:var(--text-1);color:var(--surface-0);font:800 11px/1 var(--font-terminal);cursor:pointer}
.alantilGuideHighlighted{outline:2px solid color-mix(in srgb,var(--accent-strong) 82%,white);outline-offset:5px;filter:drop-shadow(0 0 10px color-mix(in srgb,var(--accent-strong) 24%,transparent))}
.alantilGuideGesture{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:9px;color:var(--text-1);font:800 11px/1.2 var(--font-terminal)}
.alantilGuideGesture span{display:flex;align-items:center;gap:5px}.alantilGuideGesture b{font-size:17px}
@media(max-width:390px){.alantilGuideTrigger{left:9px;width:34px;height:34px}.alantilGuideBubble{padding:12px;border-radius:16px}.alantilGuideTitle{font-size:16px}.alantilGuideBody{font-size:12.5px}}
@media(prefers-reduced-motion:reduce){.alantilGuideTrigger,.alantilGuideBubble{transition:none!important}}
`;

let activeOverlay = null;
let observer = null;
let scanQueued = false;
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

function targetRect(target, padding = 7) {
  if (!target?.isConnected) return null;
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    left: clamp(rect.left - padding, 0, window.innerWidth),
    top: clamp(rect.top - padding, 0, window.innerHeight),
    right: clamp(rect.right + padding, 0, window.innerWidth),
    bottom: clamp(rect.bottom + padding, 0, window.innerHeight),
  };
}

function applyRect(element, { left, top, right, bottom }) {
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  element.style.width = `${Math.max(0, right - left)}px`;
  element.style.height = `${Math.max(0, bottom - top)}px`;
}

function positionBubble(bubble, rect, placement = "auto") {
  if (!rect) {
    bubble.classList.add("isCentered");
    bubble.style.left = "50%";
    bubble.style.top = "50%";
    return;
  }
  bubble.classList.remove("isCentered");
  const margin = 12;
  const gap = 14;
  const width = Math.min(390, window.innerWidth - margin * 2);
  bubble.style.width = `${width}px`;
  bubble.style.left = `${clamp((rect.left + rect.right - width) / 2, margin, window.innerWidth - width - margin)}px`;
  bubble.style.top = `${margin}px`;
  const bubbleRect = bubble.getBoundingClientRect();
  const above = rect.top - gap - bubbleRect.height;
  const below = rect.bottom + gap;
  let top;
  if (placement === "top") top = above;
  else if (placement === "bottom") top = below;
  else if (below + bubbleRect.height <= window.innerHeight - margin) top = below;
  else if (above >= margin) top = above;
  else top = clamp(window.innerHeight - bubbleRect.height - margin, margin, window.innerHeight - bubbleRect.height - margin);
  bubble.style.top = `${clamp(top, margin, Math.max(margin, window.innerHeight - bubbleRect.height - margin))}px`;
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
  placement = "auto",
} = {}) {
  destroyOverlay();
  const modalRoot = document.getElementById("modalRoot") || document.body;
  const overlay = document.createElement("div");
  overlay.className = `alantilGuideOverlay${blocking ? " isBlocking" : ""}`;
  overlay.innerHTML = target
    ? `<div class="alantilGuideShade" data-shade="top"></div><div class="alantilGuideShade" data-shade="bottom"></div><div class="alantilGuideShade" data-shade="left"></div><div class="alantilGuideShade" data-shade="right"></div>${blockTarget ? '<div class="alantilGuideTargetBlocker" data-target-blocker></div>' : ""}`
    : `<div class="alantilGuideFullShade"></div>`;
  const bubble = document.createElement("section");
  bubble.className = "alantilGuideBubble";
  bubble.setAttribute("role", "dialog");
  bubble.setAttribute("aria-modal", blocking ? "true" : "false");
  bubble.innerHTML = `
    <div class="alantilGuideMeta">${showSkip ? '<button class="alantilGuideSkip" type="button" data-guide-skip>Пропустить</button>' : ""}</div>
    <h2 class="alantilGuideTitle">${title}</h2>
    <div class="alantilGuideBody">${body}</div>
    ${nextLabel ? `<div class="alantilGuideFooter"><button class="alantilGuideNext" type="button" data-guide-next>${nextLabel}</button></div>` : ""}`;
  overlay.appendChild(bubble);
  modalRoot.appendChild(overlay);
  target?.classList.add("alantilGuideHighlighted");

  let resizeFrame = 0;
  const reposition = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      const rect = targetRect(target);
      const shades = overlay.querySelectorAll("[data-shade]");
      if (rect && shades.length === 4) {
        applyRect(shades[0], { left: 0, top: 0, right: window.innerWidth, bottom: rect.top });
        applyRect(shades[1], { left: 0, top: rect.bottom, right: window.innerWidth, bottom: window.innerHeight });
        applyRect(shades[2], { left: 0, top: rect.top, right: rect.left, bottom: rect.bottom });
        applyRect(shades[3], { left: rect.right, top: rect.top, right: window.innerWidth, bottom: rect.bottom });
        const blocker = overlay.querySelector("[data-target-blocker]");
        if (blocker) applyRect(blocker, rect);
      }
      positionBubble(bubble, rect, placement);
    });
  };

  const cleanup = () => {
    window.removeEventListener("resize", reposition);
    window.removeEventListener("scroll", reposition, true);
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    target?.classList.remove("alantilGuideHighlighted");
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
  overlay.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !showSkip) return;
    event.preventDefault();
    finishAction(onSkip);
  });
  window.addEventListener("resize", reposition, { passive: true });
  window.addEventListener("scroll", reposition, { capture: true, passive: true });
  requestAnimationFrame(() => {
    reposition();
    bubble.focus?.({ preventScroll: true });
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
      <p>Это приложение создано для изучения аланской (карачаево-балкарской) лексики и расширения словарного запаса.</p>
      <p>Здесь ты сможешь узнавать новые слова, вспоминать забытые и постепенно возвращать их в свою речь.</p>
      <p>Главное — не просто выучить слова в приложении, а начать использовать их в повседневной жизни. Только так они снова станут частью живого языка и будут передаваться дальше.</p>`,
    onNext: showStoriesIntro,
    onSkip: skipGeneralGuide,
  });
}

function showStoriesIntro() {
  generalGuide.phase = "stories-intro";
  const target = document.querySelector(".storyTabsShell") || document.querySelector(".storyTabs");
  if (!target) { scheduleScan(); return; }
  showStep({
    target,
    title: "Истории",
    body: `<p>Здесь находятся разделы слов разной сложности и назначения.</p><p>Сейчас мы коротко познакомимся с каждым из них.</p>`,
    onNext: () => showStory(0),
    onSkip: skipGeneralGuide,
    blockTarget: true,
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
    title: "Выбери свою историю",
    body: `<p>Ты можешь свободно переключаться между историями и выбирать подходящий уровень.</p><p>Основной путь приложения — <strong>«Возвращение к истокам»</strong>.</p>`,
    onNext: showStages,
    onSkip: skipGeneralGuide,
    blockTarget: true,
  });
}

function visibleStationTarget() {
  const viewport = document.querySelector(".pathMapViewport");
  const viewportRect = viewport?.getBoundingClientRect();
  const stations = Array.from(document.querySelectorAll("[data-station-key]"));
  if (!viewportRect) return stations[0] || document.querySelector(".routeMap");
  return stations.find((station) => {
    const rect = station.getBoundingClientRect();
    return rect.bottom > viewportRect.top + 20 && rect.top < viewportRect.bottom - 20;
  }) || stations.at(-1) || document.querySelector(".routeMap");
}

function showStages() {
  generalGuide.phase = "stages";
  const target = visibleStationTarget();
  if (!target) { scheduleScan(); return; }
  showStep({
    target,
    title: "Проходи этапы",
    body: `<p>Каждая история состоит из этапов. В каждом этапе ты изучаешь новую группу слов, а затем проверяешь свои знания в тесте.</p><p>После подсказки открой любой этап.</p>`,
    nextLabel: "Понятно",
    onNext: () => {
      generalGuide.phase = "await-station";
      scheduleScan();
    },
    onSkip: skipGeneralGuide,
    blockTarget: true,
  });
}

function showStationStudy() {
  generalGuide.phase = "station-study";
  const target = document.querySelector("[data-station-study]");
  if (!target) { scheduleScan(); return; }
  showStep({
    target,
    title: "Учить слова",
    body: `<p>Сначала изучи слова этого этапа с помощью флеш-карточек.</p>`,
    onNext: showStationTest,
    onSkip: skipGeneralGuide,
    blockTarget: true,
    placement: "top",
  });
}

function showStationTest() {
  generalGuide.phase = "station-test";
  const target = document.querySelector("[data-station-test]");
  if (!target) { scheduleScan(); return; }
  showStep({
    target,
    title: "Тест",
    body: `<p>После обучения проверь, насколько хорошо ты усвоил слова. Чтобы завершить этап, нужно набрать не менее <strong>${PATH_CONFIG.stationRequiredAccuracy}% правильных ответов</strong>.</p>`,
    nextLabel: "Понятно",
    onNext: finishGeneralGuide,
    onSkip: skipGeneralGuide,
    blockTarget: true,
    placement: "top",
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
    title: "Вспомни значение",
    body: `<p>Сначала попробуй вспомнить перевод слова самостоятельно.</p><p>Нажми на карточку, чтобы перевернуть её.</p>`,
    nextLabel: "",
    onSkip: skipLearningGuide,
    blocking: false,
    placement: "auto",
  });
}

function showLearningTranslation(binding) {
  if (!learningFlow.active || learningFlow.phase !== "card") return;
  learningFlow.phase = "translation";
  const target = binding.session.querySelector(".cardBack") || binding.card;
  showStep({
    target,
    title: "Проверь себя",
    body: `<p>На обратной стороне карточки находится перевод слова.</p>`,
    onNext: () => showLearningDecision(binding),
    onSkip: skipLearningGuide,
    blocking: true,
    blockTarget: true,
  });
}

function showLearningDecision(binding) {
  if (!learningFlow.active) return;
  learningFlow.phase = "decision";
  const target = binding.session.querySelector(".learnDecisionGroup") || binding.card;
  showStep({
    target,
    title: "Оцени слово",
    body: `<p>Свайпни <strong>вправо</strong>, если знаешь слово, и <strong>влево</strong>, если пока не знаешь.</p><p>Незнакомые слова будут возвращаться снова, пока ты их не запомнишь.</p><div class="alantilGuideGesture"><span><b>←</b> Не знаю</span><span>Знаю <b>→</b></span></div>`,
    nextLabel: "",
    onSkip: skipLearningGuide,
    blocking: false,
    placement: "top",
  });
}

function showLearningCounter(binding) {
  if (!learningFlow.active) return;
  learningFlow.phase = "counter";
  const target = document.getElementById("sessionStatus") || document.getElementById("counter");
  if (!target) { scheduleScan(); return; }
  showStep({
    target,
    title: "Следи за прогрессом",
    body: `<p>Здесь видно, сколько слов текущей сессии ты уже прошёл.</p>`,
    onNext: () => showLearningFavorite(binding),
    onSkip: skipLearningGuide,
    blocking: true,
    blockTarget: true,
    placement: "bottom",
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
    body: `<p>Добавляй сложные или важные слова в избранное, чтобы быстро вернуться к ним позже.</p>`,
    onNext: showLearningDone,
    onSkip: skipLearningGuide,
    blocking: true,
    blockTarget: true,
  });
}

function showLearningDone() {
  if (!learningFlow.active) return;
  learningFlow.phase = "done";
  showStep({
    title: "Всё готово",
    body: `<p>Продолжай учить слова. Когда будешь готов — вернись к этапу и пройди тест.</p>`,
    nextLabel: "Продолжить",
    onNext: finishLearningGuide,
    onSkip: finishLearningGuide,
    showSkip: false,
  });
}

function registerLearningDecision(binding, known) {
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
    body: `<p>Ты отметил его как незнакомое. Оно будет повторяться, пока ты его не запомнишь.</p>`,
    nextLabel: "Понятно",
    showSkip: false,
    blocking: false,
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
  yes.addEventListener("click", () => registerLearningDecision(binding, true), { signal });
  no.addEventListener("click", () => registerLearningDecision(binding, false), { signal });
  card.addEventListener("touchstart", (event) => {
    binding.touchStartX = event.touches?.[0]?.clientX || 0;
  }, { signal, passive: true });
  card.addEventListener("touchend", (event) => {
    if (!learningFlow.active || learningFlow.phase !== "decision") return;
    const endX = event.changedTouches?.[0]?.clientX ?? binding.touchStartX;
    const delta = endX - binding.touchStartX;
    const threshold = card.offsetWidth * 0.3;
    if (delta > threshold) registerLearningDecision(binding, true);
    else if (delta < -threshold) registerLearningDecision(binding, false);
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
