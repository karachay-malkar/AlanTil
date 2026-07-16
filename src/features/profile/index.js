import { getCurrentAuthState } from "../../shared/auth/auth-service.js?v=13.6.2";
import { getWords } from "../../shared/data/word-repository.js";
import { buildLearningRoute } from "../../shared/domain/learning-route.js";
import { dictionaryPathProgress } from "../../shared/domain/route-progress.js";
import { getProfile, setAvatarGender } from "../../shared/profile/profile-service.js?v=13.6.2";
import { activitySummary } from "../../shared/progress/activity-history-store.js";
import { allWordMasterySummary, problemWordRows } from "../../shared/progress/word-progress-store.js";
import { getStationSize } from "../../shared/settings/user-settings-store.js";
import { renderBracketHeading } from "../../shared/ui/bracket-heading.js";
import { escapeHtml } from "../../shared/ui/html.js";
import { uiIcon } from "../../shared/ui/icons.js";
import { renderSegmentedProgress } from "../../shared/ui/segmented-progress.js";

let controller = null;

function setProfileHeaderNavigation(context, active = "profile") {
  const routes = {
    profile: "profile.home",
    statistics: "profile.statistics",
    settings: "settings.home",
  };
  context.shell.setHeaderTabs?.({
    items: [
      { id: "profile", label: "Профиль" },
      { id: "statistics", label: "Статистика" },
      { id: "settings", label: "Настройки" },
    ],
    active,
    ariaLabel: "Разделы профиля",
    onSelect(id) {
      const route = routes[id];
      if (route) context.router.navigate(route);
    },
  });
}

function durationLabel(seconds) {
  const minutes = Math.round(Math.max(0, Number(seconds || 0)) / 60);
  if (minutes < 60) return `${minutes} мин`;
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
}

function avatarFigure(gender = "") {
  return `<svg class="profileAvatarSvg" viewBox="0 0 180 230" aria-hidden="true" focusable="false">
    <circle cx="90" cy="64" r="44" />
    <path d="M25 217c2-69 25-108 65-108s63 39 65 108z" />
    ${gender === "female" ? '<path class="profileAvatarDetail" d="M44 71c1-38 18-57 46-57s45 19 46 57c-12-14-27-23-46-23S56 57 44 71z" />' : '<path class="profileAvatarDetail" d="M55 31c10-13 22-19 36-19 17 0 30 8 39 23-22-8-47-9-75-4z" />'}
  </svg>`;
}

function subNavigation(active = "status") {
  return `<nav class="profileSubNav" aria-label="Содержимое профиля">
    <button class="profileSubTab ${active === "status" ? "active" : ""}" type="button" data-profile-subroute="profile.home">[ Статус ]</button>
    <button class="profileSubTab ${active === "skills" ? "active" : ""}" type="button" data-profile-subroute="profile.skills">[ Навыки ]</button>
  </nav>`;
}

function bindLocalNavigation(context, signal) {
  context.root.querySelectorAll("[data-profile-subroute]").forEach((button) => {
    button.addEventListener("click", () => context.router.navigate(button.dataset.profileSubroute), { signal });
  });
  context.root.querySelectorAll("[data-profile-account]").forEach((button) => {
    button.addEventListener("click", () => context.router.navigate("account.home"), { signal });
  });
}

function storyProgressRows(route, path) {
  return `<div class="profileStoryRows">
    ${route.storyOrder.map((type) => {
      const value = path.stories[type];
      const label = route.storyLabels[type];
      return `<button class="profileStoryRow" type="button" data-profile-story="${escapeHtml(type)}">
        <span class="profileStoryHead"><strong>${escapeHtml(label)}</strong><span>${value.percent}%</span></span>
        ${renderSegmentedProgress({ value: value.percent, segments: 10, label: `Прогресс ${label}`, className: "profileStoryProgress" })}
      </button>`;
    }).join("")}
  </div>`;
}

async function loadStoryProgress() {
  try {
    const words = await getWords();
    const route = buildLearningRoute(words, { stationSize: getStationSize() });
    return { route, path: dictionaryPathProgress(route) };
  } catch (error) {
    console.warn("profile: story progress is temporarily unavailable", error);
    return null;
  }
}

function unavailableStoryProgress() {
  return `<div class="profileFutureNote" role="status">
    Прогресс временно недоступен. Аватар и остальные разделы профиля продолжают работать.
  </div>`;
}

function lockedStatus() {
  return `<div class="profileLockedState">
    <div class="profileAvatarFrame isLocked">
      <div class="profileAvatarFigure">${avatarFigure()}</div>
      <span class="profileAvatarLock">${uiIcon("locked")}</span>
      <button class="profileAccountButton" type="button" data-profile-account aria-label="Войти в аккаунт">${uiIcon("account")}</button>
    </div>
    <strong>Профиль недоступен</strong>
    <span>Войдите, чтобы открыть аватар и связанную с ним историю.</span>
    <button class="btn neutral profileLoginButton" type="button" data-profile-account>Войти</button>
  </div>`;
}

function genderSelection(error = "") {
  return `<section class="profileGenderSetup">
    ${error ? `<div class="profileInlineError" role="alert">${escapeHtml(error)}</div>` : ""}
    <strong>Выберите пол аватара</strong>
    <span>Выбор выполняется один раз и позже не изменяется.</span>
    <div class="profileGenderChoices">
      <button type="button" data-profile-gender="male"><span>${avatarFigure("male")}</span><strong>Мужской</strong></button>
      <button type="button" data-profile-gender="female"><span>${avatarFigure("female")}</span><strong>Женский</strong></button>
    </div>
  </section>`;
}

async function renderStatus(context, auth, profile) {
  setProfileHeaderNavigation(context, "profile");
  let body = "";
  if (!auth.user) {
    body = lockedStatus();
  } else if (!profile) {
    body = `<div class="profileLockedState"><strong>Завершите настройку аккаунта</strong><span>Создайте никнейм, чтобы открыть профиль.</span><button class="btn neutral profileLoginButton" type="button" data-profile-account>Продолжить</button></div>`;
  } else if (!profile.avatar_gender) {
    body = genderSelection();
  } else {
    const progress = await loadStoryProgress();
    body = `<div class="profileStatusContent">
      <div class="profileAvatarFrame" data-avatar-gender="${escapeHtml(profile.avatar_gender)}">
        <div class="profileAvatarFigure">${avatarFigure(profile.avatar_gender)}</div>
        <button class="profileAccountButton" type="button" data-profile-account aria-label="Открыть аккаунт">${uiIcon("account")}</button>
      </div>
      <div class="profileNickname">${escapeHtml(profile.nickname)}</div>
      <section class="profileStatusSection profileStorySection">
        ${renderBracketHeading("Прогресс по историям", { className: "profileSectionTitle" })}
        ${progress ? storyProgressRows(progress.route, progress.path) : unavailableStoryProgress()}
      </section>
      <section class="profileStatusSection profileFutureSection">
        ${renderBracketHeading("Артефакты", { className: "profileSectionTitle" })}
        <div class="profileFutureNote">Заработанные вещи появятся здесь позже.</div>
      </section>
      <section class="profileStatusSection profileFutureSection">
        ${renderBracketHeading("Достижения", { className: "profileSectionTitle" })}
        <div class="profileFutureNote">Раздел будет добавлен позже.</div>
      </section>
    </div>`;
  }

  context.root.innerHTML = `<section class="view screen profileView">
    ${subNavigation("status")}
    <div class="profileScroll">${body}</div>
  </section>`;
}

function renderSkills(context, auth, profile) {
  setProfileHeaderNavigation(context, "profile");
  const locked = !auth.user || !profile?.avatar_gender;
  // TODO(avatar-skills): replace this placeholder with a multilingual table that maps
  // skill names to parts of speech or set_id values. Do not hardcode skill taxonomy here.
  const body = locked
    ? `<div class="profileLockedState profileSkillsLocked"><span class="profileLockedIcon">${uiIcon("locked")}</span><strong>Навыки недоступны</strong><span>Сначала войдите и настройте аватар.</span></div>`
    : `<div class="profileFutureFeature"><strong>[ Навыки ]</strong><span>Позже этот раздел будет подключён из отдельной мультиязычной таблицы.</span></div>`;
  context.root.innerHTML = `<section class="view screen profileView">
    ${subNavigation("skills")}
    <div class="profileScroll">${body}</div>
  </section>`;
}

async function renderStatistics(context) {
  setProfileHeaderNavigation(context, "statistics");
  let body = "";
  try {
    const words = await getWords();
    const route = buildLearningRoute(words, { stationSize: getStationSize() });
    const path = dictionaryPathProgress(route);
    const mastery = allWordMasterySummary(words);
    const activity = activitySummary();
    const difficult = problemWordRows(words, 12);
    const completedDictionaries = route.storyOrder.reduce((sum, type) => sum + Number(path.stories[type]?.completedCatalogs || 0), 0);
    body = `<section class="profileStatusSection">
      ${renderBracketHeading("Сводка эффективности", { className: "profileSectionTitle" })}
      <div class="profileGrid">
        <div class="profileStat"><strong>${mastery.mastered}</strong><span>освоенных слов</span></div>
        <div class="profileStat"><strong>${completedDictionaries}</strong><span>завершённых словарей</span></div>
        <div class="profileStat"><strong>${durationLabel(activity.activeSeconds)}</strong><span>активного времени</span></div>
        <div class="profileStat"><strong>${activity.learnSessions}</strong><span>учебных сессий</span></div>
        <div class="profileStat"><strong>${activity.accuracy}%</strong><span>точность тестов</span></div>
        <div class="profileStat"><strong>${mastery.review}</strong><span>слов к повторению</span></div>
      </div>
    </section>
    <section class="profileStatusSection">
      ${renderBracketHeading("Проблемные слова", { className: "profileSectionTitle" })}
      <div class="problemWords">${difficult.length ? difficult.map(({ word, unknownRate }) => `<span class="problemWord"><strong>${escapeHtml(word.word)}</strong><small>${unknownRate}%</small></span>`).join("") : `<span class="profileFutureNote">Пока недостаточно данных.</span>`}</div>
    </section>`;
  } catch (error) {
    console.warn("profile: statistics are temporarily unavailable", error);
    body = `<div class="profileLockedState">
      <strong>Статистика временно недоступна</strong>
      <span>Профиль продолжает работать. Попробуйте открыть статистику позже.</span>
    </div>`;
  }

  context.root.innerHTML = `<section class="view screen profileView profileStatisticsView">
    <div class="profileScroll">${body}</div>
  </section>`;
}

async function loadProfile(auth) {
  if (!auth.user?.id) return null;
  try {
    return await getProfile(auth.user.id);
  } catch (error) {
    console.warn("profile: profile load failed", error);
    return null;
  }
}

export async function mount(context, params = {}) {
  controller = new AbortController();
  const auth = getCurrentAuthState();
  const profile = await loadProfile(auth);
  const screen = params.screen || "home";

  if (screen === "statistics") await renderStatistics(context);
  else if (screen === "skills") renderSkills(context, auth, profile);
  else await renderStatus(context, auth, profile);

  const signal = controller.signal;
  bindLocalNavigation(context, signal);
  context.root.querySelectorAll("[data-profile-story]").forEach((button) => {
    button.addEventListener("click", () => context.router.navigate("path.home", { storyType: button.dataset.profileStory }), { signal });
  });
  context.root.querySelectorAll("[data-profile-gender]").forEach((button) => {
    button.addEventListener("click", async () => {
      const gender = button.dataset.profileGender;
      const label = gender === "female" ? "женский" : "мужской";
      const confirmed = await context.modal.confirm({ message: `Выбрать ${label} образ?<br>После сохранения изменить выбор будет нельзя.` });
      if (!confirmed) return;
      const choices = Array.from(context.root.querySelectorAll("[data-profile-gender]"));
      choices.forEach((choice) => { choice.disabled = true; });
      try {
        await setAvatarGender(auth.user.id, gender);
        await context.router.replace("profile.home", {}, { force: true });
      } catch (error) {
        const setup = context.root.querySelector(".profileGenderSetup");
        if (setup) setup.insertAdjacentHTML("afterbegin", `<div class="profileInlineError" role="alert">${escapeHtml(error.message)}</div>`);
        choices.forEach((choice) => { if (choice.isConnected) choice.disabled = false; });
      }
    }, { signal });
  });
}

export function unmount() {
  controller?.abort();
  controller = null;
}
