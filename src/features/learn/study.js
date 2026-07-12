import { shuffle, wordsForSet } from "../../shared/domain/word-selection.js";
import { wordFavorites } from "../../shared/state/word-favorites.js";
import { STAR_ICON_SVG } from "../../shared/ui/icons.js";
import { renderCombinedGroups, renderRuAlanFront, renderRuTitle } from "../../shared/ui/word-renderers.js";
import { getHiddenSet, learnState } from "./state.js";

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

export function initializeStudy(words, mode) {
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
  learnState.sessionFailMap = {};
  learnState.studySession.inProgress = true;
  learnState.studySession.completed = false;
  learnState.studySession.wordsPool = active.slice();
  learnState.studySession.progressData = { totalPlanned: active.length, known: 0, unknown: 0 };
}

export function renderStudy(context, words, signal, params) {
  if (!learnState.studySession.inProgress || params.mode) initializeStudy(words, params.mode || learnState.currentStudyMode);

  context.root.innerHTML = `
    <section id="viewStudy" class="view study">
      <div id="card" class="card big" aria-label="Карточка">
        <div class="cardInner">
          <div class="cardFace cardFront"><div class="word" id="word">слово</div><div class="hint">Нажми на карточку, чтобы увидеть перевод</div></div>
          <div class="cardFace cardBack"><div class="trans" id="trans">перевод</div><div id="exampleBox" class="example"></div></div>
        </div>
      </div>
      <div class="studyBottomPanel">
        <div class="buttons"><button id="btnNo" class="btn secondary" type="button">❌ Не знаю</button><button id="btnYes" class="btn primary" type="button">✅ Знаю</button></div>
        <div class="buttons subActions">
          <button id="btnUndo" class="btn neutral" type="button" aria-label="Назад"><span class="btnIcon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V2L7 7l5 5V9c3.31 0 6 2.69 6 6a6 6 0 0 1-6 6H6v2h6a8 8 0 0 0 0-16z"></path></svg></span><span class="btnLabel">Назад</span></button>
          <button id="btnFavAction" class="btn neutral favAction" type="button" aria-label="Отметить слово"><span class="btnIcon">${STAR_ICON_SVG}</span><span class="btnLabel" id="favActionLabel">Отметить слово</span></button>
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
    learnState.studySession.inProgress = false;
    learnState.studySession.completed = true;
    context.shell.setCounter("");
    context.router.replace("learn.results", {}, { force: true });
  }

  function draw() {
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
  }

  function decide(known) {
    resetFlipInstant();
    setRoundIfNeeded();
    const queue = currentQueue();
    if (!queue.length) return;
    const fromRound = learnState.round;
    const item = queue.shift();

    if (!known) {
      learnState.sessionFailMap[item.id] = (learnState.sessionFailMap[item.id] || 0) + 1;
      learnState.repeatQueue.push(item);
      learnState.studySession.progressData.unknown = (learnState.studySession.progressData.unknown || 0) + 1;
    } else {
      learnState.studySession.progressData.known = (learnState.studySession.progressData.known || 0) + 1;
    }
    if (learnState.round === "main" && learnState.mainQueue.length === 0) learnState.round = "repeat";
    learnState.swipeHistory.push({ item, known, fromRound });
    draw();
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
    const { item, known, fromRound } = learnState.swipeHistory.pop();
    if (!known) {
      if (learnState.sessionFailMap[item.id]) {
        learnState.sessionFailMap[item.id] -= 1;
        if (learnState.sessionFailMap[item.id] <= 0) delete learnState.sessionFailMap[item.id];
      }
      for (let index = learnState.repeatQueue.length - 1; index >= 0; index -= 1) {
        if (learnState.repeatQueue[index]?.id === item.id) {
          learnState.repeatQueue.splice(index, 1);
          break;
        }
      }
    }
    if (fromRound === "main") learnState.mainQueue.unshift(item);
    else learnState.repeatQueue.unshift(item);
    learnState.round = fromRound;
    draw();
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

  draw();
}
