import { trackEvent } from "../../shared/analytics/analytics.js";
import { ACTIVITY_TYPES, CANCEL_REASONS, EVENTS, WORD_RESULTS, WORD_SOURCES, directionFromMode } from "../../shared/analytics/events.js";
import { createActivityTracker } from "../../shared/analytics/session-tracker.js";
import { shuffle, wordsForSet } from "../../shared/domain/word-selection.js";
import {
  createSessionRuntime,
  finalizeSessionRuntime,
  persistSessionRuntime,
} from "../../shared/progress/session-builders.js";
import { wordFavorites } from "../../shared/state/word-favorites.js";
import { uiIcon } from "../../shared/ui/icons.js";
import { renderCombinedGroups, renderRuAlanFront, renderRuTitle } from "../../shared/ui/word-renderers.js";
import { getHiddenSet, getLearnItemsCompleted, learnState } from "./state.js";
import { captureLearnActionSnapshot, cloneLearnValue, restoreLearnActionSnapshot } from "./action-history.js";

function currentQueue() {
  return learnState.round === "main" ? learnState.mainQueue : learnState.repeatQueue;
}

function setRoundIfNeeded() {
  if (learnState.round === "main" && learnState.mainQueue.length === 0) learnState.round = "repeat";
}

function updateCounter(shell) {
  const known = Math.max(0, learnState.totalPlanned - (learnState.mainQueue.length + learnState.repeatQueue.length));
  shell.setCounter(`знаю ${known}/${learnState.totalPlanned} слов`);
}

function ensureWordStats(item) {
  const id = String(item?.id || "").trim();
  if (!id) return null;
  if (!learnState.studySession.wordStats[id]) {
    learnState.studySession.wordStats[id] = {
      word_id: id,
      show_count: 0,
      left_swipe_count: 0,
      final_result: "unfinished",
      first_position: Object.keys(learnState.studySession.wordStats).length + 1,
    };
  }
  return learnState.studySession.wordStats[id];
}

function sessionWords() {
  return Object.values(learnState.studySession.wordStats || {})
    .filter((entry) => entry?.word_id && entry.show_count > 0)
    .sort((left, right) => left.first_position - right.first_position)
    .map((entry) => ({
      word_id: entry.word_id,
      show_count: Math.max(0, Number(entry.show_count) || 0),
      left_swipe_count: Math.max(0, Number(entry.left_swipe_count) || 0),
      final_result: entry.final_result === "known" ? "known" : "unfinished",
      first_position: Math.max(1, Number(entry.first_position) || 1),
    }));
}

function learnSessionPayload() {
  const words = sessionWords();
  return {
    words_planned: learnState.totalPlanned,
    unique_words_shown: words.length,
    card_shows_total: words.reduce((sum, word) => sum + word.show_count, 0),
    left_swipes_total: words.reduce((sum, word) => sum + word.left_swipe_count, 0),
    known_words_total: words.filter((word) => word.final_result === "known").length,
    unfinished_words_total: words.filter((word) => word.final_result !== "known").length,
    words,
  };
}

function persistLearnSession() {
  persistSessionRuntime(learnState.studySession.runtime, learnSessionPayload());
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
  const result = finalizeSessionRuntime(session.runtime, {
    status,
    exitReason,
    payload: learnSessionPayload(),
  });
  session.inProgress = false;
  session.completed = status === "completed";
  return result;
}

export function initializeStudy(words, mode, options = {}) {
  const previousProgress = learnState.studySession.progressData || {};
  if (learnState.studySession.runtime && !learnState.studySession.runtime.finalized) {
    finalizeLearnSession("interrupted", CANCEL_REASONS.NEW_SESSION);
  }
  learnState.studySession.tracker?.abandon?.(CANCEL_REASONS.NEW_SESSION, {
    items_total: previousProgress.totalPlanned || learnState.totalPlanned,
    items_completed: getLearnItemsCompleted(),
    known_count: previousProgress.known || 0,
    unknown_count: previousProgress.unknown || 0,
  });

  learnState.currentStudyMode = mode === "ru" ? "ru" : "kb";
  const all = learnState.currentDict === "__fav__"
    ? words.filter((word) => wordFavorites.has(word.id))
    : wordsForSet(words, learnState.currentDict, learnState.currentSection, learnState.currentSet);
  const hidden = getHiddenSet(learnState.currentDict, learnState.currentSection, learnState.currentSet);
  const active = all.filter((word) => !hidden.has(word.id));

  learnState.mainQueue = shuffle(active.slice());
  learnState.repeatQueue = [];
  learnState.round = "main";
  learnState.totalPlanned = active.length;
  learnState.currentStudyId = "";
  learnState.swipeHistory = [];
  learnState.analyticsActions = [];
  learnState.analyticsFlushed = false;
  learnState.sessionFailMap = {};
  learnState.studySession.inProgress = true;
  learnState.studySession.completed = false;
  learnState.studySession.wordsPool = active.slice();
  learnState.studySession.progressData = { totalPlanned: active.length, known: 0, unknown: 0, undo: 0 };
  learnState.studySession.wordStats = {};
  learnState.studySession.metadata = {
    dictionaryId: learnState.currentDict,
    sectionId: learnState.currentSection,
    setId: String(learnState.currentSet),
    stationContext: options.stationContext || null,
  };
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
    initializeStudy(words, params.mode || learnState.currentStudyMode, { stationContext: params.stationContext });
  }

  context.root.innerHTML = `
    <section id="viewStudy" class="view study">
      <div id="card" class="card big" aria-label="Карточка">
        <div class="cardInner">
          <div class="cardFace cardFront"><div class="word" id="word">слово</div><div class="hint">Нажмите на слово, чтобы увидеть перевод</div></div>
          <div class="cardFace cardBack"><div class="trans" id="trans">перевод</div><div id="exampleBox" class="example"></div></div>
        </div>
      </div>
      <div class="studyBottomPanel">
        <div class="buttons"><button id="btnNo" class="btn secondary" type="button"><span class="btnIcon">${uiIcon("wrong")}</span><span class="btnLabel">Не знаю</span></button><button id="btnYes" class="btn primary" type="button"><span class="btnIcon">${uiIcon("correct")}</span><span class="btnLabel">Знаю</span></button></div>
        <div class="buttons subActions">
          <button id="btnUndo" class="btn neutral" type="button" aria-label="Назад"><span class="btnIcon">${uiIcon("undo2")}</span><span class="btnLabel">Назад</span></button>
          <button id="btnFavAction" class="btn neutral favAction" type="button" aria-label="Отметить слово"><span class="btnIcon">${uiIcon("starLine")}</span><span class="btnLabel" id="favActionLabel">Отметить слово</span></button>
        </div>
      </div>
    </section>`;

  const card = context.root.querySelector("#card");
  const wordElement = context.root.querySelector("#word");
  const translationElement = context.root.querySelector("#trans");
  const undoButton = context.root.querySelector("#btnUndo");
  const favoriteButton = context.root.querySelector("#btnFavAction");
  const favoriteLabel = context.root.querySelector("#favActionLabel");

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
    favoriteButton.classList.toggle("active", on);
    favoriteLabel.textContent = on ? "В избранном" : "Отметить слово";
    favoriteButton.setAttribute("aria-label", on ? "Убрать из избранного" : "Отметить слово");
  }

  function updateUndo() {
    undoButton.disabled = learnState.swipeHistory.length === 0 || learnState.isAnimating;
  }

  function finish() {
    const progress = learnState.studySession.progressData || {};
    finalizeLearnSession("completed", null);
    learnState.studySession.tracker?.complete({
      items_total: learnState.totalPlanned,
      items_completed: learnState.totalPlanned,
      known_count: progress.known || 0,
      unknown_count: progress.unknown || 0,
      repeated_count: progress.unknown || 0,
      undo_count: progress.undo || 0,
    });
    context.shell.setCounter("");
    if (typeof params.onComplete === "function") {
      params.onComplete({ words: sessionWords(), progress: cloneLearnValue(progress) });
      return;
    }
    context.router.replace("learn.results", {}, { force: true });
  }

  function draw({ countShow = true } = {}) {
    resetFlipInstant();
    setRoundIfNeeded();
    const queue = currentQueue();

    if (learnState.totalPlanned === 0) {
      wordElement.textContent = "Пусто 🤷‍♂️";
      translationElement.textContent = "В этом сете все слова скрыты. Верни их в меню сета.";
      favoriteButton.classList.add("hidden");
      undoButton.classList.add("hidden");
      context.shell.setCounter("знаю 0/0 слов");
      return;
    }
    if (!queue.length) {
      finish();
      return;
    }

    const item = queue[0];
    learnState.currentStudyId = item.id;
    const stats = ensureWordStats(item);
    if (stats && countShow) stats.show_count += 1;
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
    setRoundIfNeeded();
    const queue = currentQueue();
    if (!queue.length) return;
    const snapshot = captureLearnActionSnapshot(learnState);
    const fromRound = learnState.round;
    const item = queue.shift();
    const stats = ensureWordStats(item);

    if (!known) {
      learnState.sessionFailMap[item.id] = (learnState.sessionFailMap[item.id] || 0) + 1;
      learnState.repeatQueue.push(item);
      learnState.studySession.progressData.unknown = (learnState.studySession.progressData.unknown || 0) + 1;
      if (stats) stats.left_swipe_count += 1;
    } else {
      learnState.studySession.progressData.known = (learnState.studySession.progressData.known || 0) + 1;
      if (stats) stats.final_result = "known";
    }
    learnState.analyticsActions.push({
      word_id: item.id,
      source: WORD_SOURCES.LEARN,
      result: known ? WORD_RESULTS.KNOWN : WORD_RESULTS.UNKNOWN,
      dictionary_id: item.dict || learnState.currentDict,
      section_id: item.section || learnState.currentSection,
      set_id: String(item.set || learnState.currentSet),
      direction: directionFromMode(learnState.currentStudyMode),
    });
    if (learnState.round === "main" && learnState.mainQueue.length === 0) learnState.round = "repeat";
    learnState.swipeHistory.push({ snapshot, itemId: item.id, known, fromRound });
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
    const action = learnState.swipeHistory.pop();
    const totalUndo = Number(learnState.studySession.progressData?.undo || 0) + 1;
    restoreLearnActionSnapshot(learnState, action.snapshot);
    learnState.studySession.progressData.undo = totalUndo;
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
