import { msg } from "../../shared/i18n/index.js?v=13.9.0";
import { trackEvent } from "../../shared/analytics/analytics.js?v=13.9.0";
import { ACTIVITY_TYPES, CANCEL_REASONS, EVENTS, WORD_RESULTS, WORD_SOURCES, directionFromMode } from "../../shared/analytics/events.js?v=13.9.0";
import { createActivityTracker } from "../../shared/analytics/session-tracker.js?v=13.9.0";
import {
  createSessionRuntime,
  finalizeSessionRuntime,
  persistSessionRuntime,
} from "../../shared/progress/session-builders.js?v=13.13";
import { wordFavorites } from "../../shared/state/word-favorites.js?v=13.9.0";
import { recordLearnWordResults } from "../../shared/progress/word-progress-store.js?v=13.9.0";
import { renderFavoriteButton } from "../../shared/ui/favorite-button.js?v=13.9.0";
import { uiIcon } from "../../shared/ui/icons.js?v=13.9.0";
import { renderCombinedGroups, renderRuAlanFront, renderRuTitle } from "../../shared/ui/word-renderers.js?v=13.9.0";
import { getHiddenSet, learnState } from "./state.js?v=13.13";
import {
  cloneLearnValue,
  decideLearnCard,
  exposeCurrentLearnCard,
  initializeLearnState,
  learnAbandonSummary,
  learnCompletionSummary,
  learnSessionPayload,
  learnSessionWords,
  selectLearnSourceWords,
  undoLearnDecision,
} from "../../../packages/alantil-core/learning.js";

function updateCounter(shell) {
  const known = Math.max(0, learnState.totalPlanned - (learnState.mainQueue.length + learnState.repeatQueue.length));
  shell.setCounter(`${known}/${learnState.totalPlanned}`);
}

function persistLearnSession() {
  persistSessionRuntime(learnState.studySession.runtime, learnSessionPayload(learnState));
}

function flushLearningAnalytics() {
  if (learnState.analyticsFlushed) return;
  learnState.analyticsFlushed = true;
  learnState.analyticsActions.forEach((payload) => trackEvent(EVENTS.WORD_RESULT, payload));
}

export function finalizeLearnSession(status = "interrupted", exitReason = "route_change") {
  const session = learnState.studySession;
  if (!session.runtime || session.runtime.finalized) return false;
  flushLearningAnalytics();
  const payload = learnSessionPayload(learnState);
  const result = finalizeSessionRuntime(session.runtime, {
    status,
    exitReason,
    payload,
  });
  if (result?.id) recordLearnWordResults(result.id, payload.words, result.ended_at || new Date().toISOString());
  session.inProgress = false;
  session.completed = status === "completed";
  return result;
}

export function initializeStudy(words, mode, options = {}) {
  const previousProgress = learnState.studySession.progressData || {};
  if (learnState.studySession.runtime && !learnState.studySession.runtime.finalized) {
    finalizeLearnSession("interrupted", CANCEL_REASONS.NEW_SESSION);
  }
  learnState.studySession.tracker?.abandon?.(CANCEL_REASONS.NEW_SESSION, learnAbandonSummary(learnState, previousProgress));

  const hidden = getHiddenSet(learnState.currentDict, learnState.currentSection, learnState.currentSet);
  const favoriteIds = new Set(words.filter((word) => wordFavorites.has(word.id)).map((word) => word.id));
  const active = selectLearnSourceWords(words, {
    wordsOverride: options.wordsOverride,
    favoritesMode: learnState.currentDict === "__fav__",
    favoriteIds,
    dictionaryId: learnState.currentDict,
    sectionId: learnState.currentSection,
    setId: learnState.currentSet,
    hiddenIds: hidden,
  });

  initializeLearnState(learnState, active, mode, {
    dictionaryId: learnState.currentDict,
    sectionId: learnState.currentSection,
    setId: learnState.currentSet,
    stationContext: options.stationContext || null,
  });
  learnState.studySession.runtime = active.length ? createSessionRuntime("learn", {
    dictionary_id: learnState.currentDict,
    section_id: learnState.currentSection,
    set_id: String(learnState.currentSet),
    direction: directionFromMode(learnState.currentStudyMode),
  }) : null;
  learnState.studySession.tracker = active.length ? createActivityTracker(ACTIVITY_TYPES.LEARN) : null;
  learnState.studySession.tracker?.start({
    direction: directionFromMode(learnState.currentStudyMode),
    dictionary_id: learnState.currentDict,
    section_id: learnState.currentSection,
    set_id: String(learnState.currentSet),
    limit: active.length,
    items_total: active.length,
    items_completed: 0,
  });
  persistLearnSession();
}

export function renderStudy(context, words, signal, params = {}) {
  if (!learnState.studySession.inProgress || params.mode) {
    initializeStudy(words, params.mode || learnState.currentStudyMode, { stationContext: params.stationContext, wordsOverride: params.wordsOverride });
  }

  context.root.innerHTML = `
    <section class="learnSession">
      <div class="learnSessionMain">
        <article id="card" class="learnCard" aria-label="${msg("learn.kartochka")}">
          <div class="learnCardActions">
            <button id="btnUndo" class="iconAction learnCardAction" type="button" aria-label="${msg("learn.vernut_predyduschee_slovo")}">${uiIcon("undo2")}<span>${msg("learn.nazad")}</span></button>
            ${renderFavoriteButton({ attributes: 'id="btnFavAction"', label: msg("learn.dobavit_v_izbrannoe") })}
          </div>
          <div class="cardInner">
            <div class="cardFace cardFront"><div class="word" id="word">${msg("learn.slovo_2")}</div></div>
            <div class="cardFace cardBack"><div class="trans" id="trans">${msg("learn.perevod")}</div></div>
          </div>
        </article>
      </div>
      <div class="learnSessionActions">
        <div class="learnDecisionGroup">
          <button id="btnNo" class="choiceControl sessionDecision sessionDecisionUnknown" type="button"><span class="sessionDecisionIcon">${uiIcon("wrong")}</span><span>${msg("learn.ne_znayu")}</span></button>
          <button id="btnYes" class="choiceControl sessionDecision sessionDecisionKnown" type="button"><span class="sessionDecisionIcon">${uiIcon("correct")}</span><span>${msg("learn.znayu")}</span></button>
        </div>
      </div>
    </section>`;

  const card = context.root.querySelector("#card");
  const wordElement = context.root.querySelector("#word");
  const translationElement = context.root.querySelector("#trans");
  const undoButton = context.root.querySelector("#btnUndo");
  const favoriteButton = context.root.querySelector("#btnFavAction");

  function resetFlipInstant() {
    const inner = card.querySelector(".cardInner");
    const previous = inner.style.transition;
    inner.style.transition = "none";
    card.classList.remove("flipped");
    void inner.offsetWidth;
    inner.style.transition = previous || "";
  }

  function updateFavorite() {
    const on = wordFavorites.has(learnState.currentStudyId);
    favoriteButton.classList.toggle("on", on);
    favoriteButton.setAttribute("aria-label", on ? msg("learn.ubrat_iz_izbrannogo") : msg("learn.dobavit_v_izbrannoe"));
    favoriteButton.setAttribute("title", on ? msg("learn.ubrat_iz_izbrannogo") : msg("learn.dobavit_v_izbrannoe"));
  }

  function updateUndo() {
    undoButton.disabled = learnState.swipeHistory.length === 0 || learnState.isAnimating;
  }

  function finish() {
    const progress = learnState.studySession.progressData || {};
    finalizeLearnSession("completed", null);
    learnState.studySession.tracker?.complete(learnCompletionSummary(learnState));
    context.shell.setCounter("");
    if (typeof params.onComplete === "function") {
      params.onComplete({ words: learnSessionWords(learnState), progress: cloneLearnValue(progress) });
      return;
    }
    context.router.replace("learn.results", {}, { force: true });
  }

  function draw({ countShow = true } = {}) {
    resetFlipInstant();
    const exposed = exposeCurrentLearnCard(learnState, { countShow });

    if (exposed.empty) {
      wordElement.textContent = msg("learn.pusto");
      translationElement.textContent = msg("learn.v_etom_sete_vse_slova_skryty_verni");
      favoriteButton.classList.add("hidden");
      undoButton.classList.add("hidden");
      context.shell.setCounter("0/0");
      return;
    }
    if (exposed.finished) {
      finish();
      return;
    }

    const item = exposed.item;
    favoriteButton.classList.remove("hidden");
    undoButton.classList.remove("hidden");
    updateFavorite();
    updateUndo();

    if (learnState.currentStudyMode === "ru") {
      renderRuTitle(wordElement, item.trans);
      renderRuAlanFront(translationElement, item);
    } else {
      wordElement.textContent = item.word;
      renderCombinedGroups(translationElement, item.trans, item.example);
    }
    updateCounter(context.shell);
    persistLearnSession();
  }

  function decide(known) {
    resetFlipInstant();
    const queueItem = learnState.round === "main" ? learnState.mainQueue[0] : learnState.repeatQueue[0];
    if (!queueItem) return;
    const analyticsPayload = {
      word_id: queueItem.id,
      source: WORD_SOURCES.LEARN,
      result: known ? WORD_RESULTS.KNOWN : WORD_RESULTS.UNKNOWN,
      dictionary_id: queueItem.dictionary_id || learnState.currentDict,
      section_id: queueItem.section_id || learnState.currentSection,
      set_id: String(queueItem.set_id || learnState.currentSet),
      direction: directionFromMode(learnState.currentStudyMode),
    };
    const transition = decideLearnCard(learnState, known, analyticsPayload);
    if (!transition) return;
    persistLearnSession();
    draw({ countShow: true });
  }

  function animateSwipe(direction, known) {
    if (learnState.isAnimating) return;
    learnState.isAnimating = true;
    updateUndo();
    card.style.pointerEvents = "none";
    card.style.transition = "transform .5s ease, opacity .5s ease, box-shadow .5s ease";
    card.style.transform = `translateX(${direction * 520}px) rotate(${direction * 14}deg)`;
    card.style.opacity = "0";

    window.setTimeout(() => {
      decide(known);
      card.style.boxShadow = "";
      requestAnimationFrame(() => {
        card.style.transition = "none";
        card.style.transform = "translateY(-70px)";
        card.style.opacity = "0";
        requestAnimationFrame(() => {
          card.style.transition = "transform .5s ease, opacity .5s ease";
          card.style.transform = "translateY(0)";
          card.style.opacity = "1";
        });
      });
      card.style.pointerEvents = "";
      learnState.isAnimating = false;
      updateUndo();
    }, 500);
  }

  function undo() {
    if (!learnState.swipeHistory.length || learnState.isAnimating) return;
    if (!undoLearnDecision(learnState)) return;
    persistLearnSession();
    draw({ countShow: false });
  }

  card.addEventListener("click", () => card.classList.toggle("flipped"), { signal });
  context.root.querySelector("#btnYes").addEventListener("click", () => animateSwipe(1, true), { signal });
  context.root.querySelector("#btnNo").addEventListener("click", () => animateSwipe(-1, false), { signal });
  undoButton.addEventListener("click", (event) => { event.stopPropagation(); undo(); }, { signal });
  favoriteButton.addEventListener("click", (event) => { event.stopPropagation(); wordFavorites.toggle(learnState.currentStudyId); updateFavorite(); }, { signal });

  let startX = 0;
  let startY = 0;
  let dragging = false;
  card.addEventListener("touchstart", (event) => {
    if (!event.touches?.[0] || learnState.isAnimating) return;
    dragging = true;
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
    card.style.transition = "none";
    card.style.boxShadow = "";
  }, { signal, passive: true });

  card.addEventListener("touchmove", (event) => {
    if (!dragging || !event.touches?.[0] || learnState.isAnimating) return;
    const deltaX = event.touches[0].clientX - startX;
    const deltaY = event.touches[0].clientY - startY;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    const threshold = card.offsetWidth * 0.3;
    const progress = Math.min(Math.abs(deltaX) / threshold, 1);
    card.style.transform = `translateX(${deltaX}px) rotate(${deltaX / 22}deg)`;
    card.style.opacity = String(1 - Math.min(Math.abs(deltaX) / (threshold * 1.6), 0.6));
    const styles = getComputedStyle(document.documentElement);
    const brandRgb = styles.getPropertyValue("--swipe-brand-rgb").trim();
    const successRgb = styles.getPropertyValue("--swipe-success-rgb").trim();
    const dangerRgb = styles.getPropertyValue("--swipe-danger-rgb").trim();
    card.style.boxShadow = deltaX > 0
      ? `0 10px 30px rgba(${brandRgb},0.18), 28px 0 100px rgba(${successRgb},${progress})`
      : deltaX < 0
        ? `0 10px 30px rgba(${brandRgb},0.18), -28px 0 100px rgba(${dangerRgb},${progress})`
        : "";
  }, { signal, passive: true });

  card.addEventListener("touchend", (event) => {
    if (!dragging || learnState.isAnimating) return;
    dragging = false;
    const deltaX = (event.changedTouches?.[0]?.clientX ?? startX) - startX;
    const threshold = card.offsetWidth * 0.3;
    card.style.transition = "transform .18s ease, opacity .18s ease, box-shadow .18s ease";
    if (deltaX > threshold) animateSwipe(1, true);
    else if (deltaX < -threshold) animateSwipe(-1, false);
    else {
      card.style.transform = "";
      card.style.opacity = "";
      card.style.boxShadow = "";
    }
  }, { signal });

  draw({ countShow: true });
}
