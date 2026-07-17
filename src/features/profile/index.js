import { msg } from "../../shared/i18n/index.js?v=13.9.0";
import { getCurrentAuthState } from "../../shared/auth/auth-service.js?v=13.9.0";
import { getWords } from "../../shared/data/word-repository.js?v=13.9.0";
import { buildLearningRoute } from "../../shared/domain/learning-route.js?v=13.9.0";
import { dictionaryPathProgress } from "../../shared/domain/route-progress.js?v=13.9.0";
import { getProfile, setAvatarGender } from "../../shared/profile/profile-service.js?v=13.9.0";
import { activitySummary } from "../../shared/progress/activity-history-store.js?v=13.9.0";
import { allWordMasterySummary, problemWordRows } from "../../shared/progress/word-progress-store.js?v=13.9.0";
import { getStationSize } from "../../shared/settings/user-settings-store.js?v=13.9.0";
import { escapeHtml } from "../../shared/ui/html.js?v=13.9.0";
import { uiIcon } from "../../shared/ui/icons.js?v=13.9.0";
import { bindProfileNavigation, renderProfileNavigation } from "../../shared/ui/profile-navigation.js?v=13.9.0";
import { renderSegmentedProgress } from "../../shared/ui/segmented-progress.js?v=13.9.0";

let controller = null;

function setProfileHeaderNavigation(context, active = "profile") {
  context.shell.setHeaderContent?.({ title: "Alan Til!" });
  return renderProfileNavigation(active);
}

function durationLabel(seconds) {
  const minutes = Math.round(Math.max(0, Number(seconds || 0)) / 60);
  if (minutes < 60) return msg("profile.min", { minutes: minutes });
  return msg("profile.ch_min", { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

function avatarFigure(gender = "") {
  return `<svg class="profileAvatarSvg" viewBox="0 0 180 230" aria-hidden="true" focusable="false">
    <circle cx="90" cy="64" r="44" />
    <path d="M25 217c2-69 25-108 65-108s63 39 65 108z" />
    ${gender === "female" ? '<path class="profileAvatarDetail" d="M44 71c1-38 18-57 46-57s45 19 46 57c-12-14-27-23-46-23S56 57 44 71z" />' : '<path class="profileAvatarDetail" d="M55 31c10-13 22-19 36-19 17 0 30 8 39 23-22-8-47-9-75-4z" />'}
  </svg>`;
}

function subNavigation(active = "status") {
  return `<nav class="profileSubNav" aria-label="${msg("profile.soderzhimoe_profilya")}">
    <button class="tabAction profileSubTab ${active === "status" ? "active" : ""}" type="button" data-profile-subroute="profile.home">${msg("profile.status")}</button>
    <button class="tabAction profileSubTab ${active === "skills" ? "active" : ""}" type="button" data-profile-subroute="profile.skills">${msg("profile.navyki")}</button>
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
        ${renderSegmentedProgress({ value: value.percent, segments: 10, label: msg("profile.progress", { label: label }), className: "profileStoryProgress" })}
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
    ${msg("profile.progress_vremenno_nedostupen_avatar_i_ostalnye_razdely")}
  </div>`;
}

function lockedStatus() {
  return `<div class="profileLockedState">
    <div class="profileAvatarFrame isLocked" data-status-label="${msg("profile.status_label")}">
      <div class="profileAvatarFigure">${avatarFigure()}</div>
      <span class="profileAvatarLock">${uiIcon("locked")}</span>
      <button class="iconAction profileAccountButton" type="button" data-profile-account aria-label="${msg("profile.voyti_v_akkaunt")}">${uiIcon("account")}</button>
    </div>
    <strong>${msg("profile.profil_nedostupen")}</strong>
    <span>${msg("profile.voydite_chtoby_otkryt_avatar_i_svyazannuyu_s")}</span>
    <button class="btn actionPrimary profileLoginButton" type="button" data-profile-account>${msg("profile.voyti")}</button>
  </div>`;
}

function genderSelection(error = "") {
  return `<section class="profileGenderSetup">
    ${error ? `<div class="profileInlineError" role="alert">${escapeHtml(error)}</div>` : ""}
    <strong>${msg("profile.vyberite_pol_avatara")}</strong>
    <span>${msg("profile.vybor_vypolnyaetsya_odin_raz_i_pozzhe_ne")}</span>
    <div class="profileGenderChoices">
      <button class="choiceControl" type="button" data-profile-gender="male"><span>${avatarFigure("male")}</span><strong>${msg("profile.muzhskoy")}</strong></button>
      <button class="choiceControl" type="button" data-profile-gender="female"><span>${avatarFigure("female")}</span><strong>${msg("profile.zhenskiy")}</strong></button>
    </div>
  </section>`;
}

async function renderStatus(context, auth, profile) {
  const primaryNavigation = setProfileHeaderNavigation(context, "profile");
  let body = "";
  if (!auth.user) {
    body = lockedStatus();
  } else if (!profile) {
    body = `<div class="profileLockedState"><strong>${msg("profile.zavershite_nastroyku_akkaunta")}</strong><span>${msg("profile.sozdayte_nikneym_chtoby_otkryt_profil")}</span><button class="btn actionPrimary profileLoginButton" type="button" data-profile-account>${msg("profile.prodolzhit")}</button></div>`;
  } else if (!profile.avatar_gender) {
    body = genderSelection();
  } else {
    const progress = await loadStoryProgress();
    body = `<div class="profileStatusContent">
      <div class="profileAvatarFrame" data-avatar-gender="${escapeHtml(profile.avatar_gender)}" data-status-label="${msg("profile.status_label")}">
        <div class="profileAvatarFigure">${avatarFigure(profile.avatar_gender)}</div>
        <button class="iconAction profileAccountButton" type="button" data-profile-account aria-label="${msg("profile.otkryt_akkaunt")}">${uiIcon("account")}</button>
      </div>
      <div class="profileNickname">${escapeHtml(profile.nickname)}</div>
      <section class="profileStatusSection profileStorySection">
        <h2 class="profileSectionTitle">${msg("profile.progress_po_istoriyam")}</h2>
        ${progress ? storyProgressRows(progress.route, progress.path) : unavailableStoryProgress()}
      </section>
      <section class="profileStatusSection profileFutureSection">
        <h2 class="profileSectionTitle">${msg("profile.artefakty")}</h2>
        <div class="profileFutureNote">${msg("profile.zarabotannye_veschi_poyavyatsya_zdes_pozzhe")}</div>
      </section>
      <section class="profileStatusSection profileFutureSection">
        <h2 class="profileSectionTitle">${msg("profile.dostizheniya")}</h2>
        <div class="profileFutureNote">${msg("profile.razdel_budet_dobavlen_pozzhe")}</div>
      </section>
    </div>`;
  }

  context.root.innerHTML = `<section class="view screen profileView">
    ${primaryNavigation}
    ${subNavigation("status")}
    <div class="profileScroll">${body}</div>
  </section>`;
}

function renderSkills(context, auth, profile) {
  const primaryNavigation = setProfileHeaderNavigation(context, "profile");
  const locked = !auth.user || !profile?.avatar_gender;
  // TODO(avatar-skills): replace this placeholder with a multilingual table that maps
  // skill names to parts of speech or set_id values. Do not hardcode skill taxonomy here.
  const body = locked
    ? `<div class="profileLockedState profileSkillsLocked"><span class="profileLockedIcon">${uiIcon("locked")}</span><strong>${msg("profile.navyki_nedostupny")}</strong><span>${msg("profile.snachala_voydite_i_nastroyte_avatar")}</span></div>`
    : `<div class="profileFutureFeature"><strong>${msg("profile.navyki_2")}</strong><span>${msg("profile.pozzhe_etot_razdel_budet_podklyuchen_iz_otdelnoy")}</span></div>`;
  context.root.innerHTML = `<section class="view screen profileView">
    ${primaryNavigation}
    ${subNavigation("skills")}
    <div class="profileScroll">${body}</div>
  </section>`;
}

async function renderStatistics(context) {
  const primaryNavigation = setProfileHeaderNavigation(context, "statistics");
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
      <h2 class="profileSectionTitle">${msg("statistics.svodka_effektivnosti")}</h2>
      <div class="profileGrid">
        <div class="profileStat"><strong>${mastery.mastered}</strong><span>${msg("statistics.osvoennyh_slov")}</span></div>
        <div class="profileStat"><strong>${completedDictionaries}</strong><span>${msg("statistics.zavershennyh_slovarey")}</span></div>
        <div class="profileStat"><strong>${durationLabel(activity.activeSeconds)}</strong><span>${msg("statistics.aktivnogo_vremeni")}</span></div>
        <div class="profileStat"><strong>${activity.learnSessions}</strong><span>${msg("statistics.uchebnyh_sessiy")}</span></div>
        <div class="profileStat"><strong>${activity.accuracy}%</strong><span>${msg("statistics.tochnost_testov")}</span></div>
        <div class="profileStat"><strong>${mastery.review}</strong><span>${msg("statistics.slov_k_povtoreniyu")}</span></div>
      </div>
    </section>
    <section class="profileStatusSection">
      <h2 class="profileSectionTitle">${msg("statistics.problemnye_slova")}</h2>
      <div class="problemWords">${difficult.length ? difficult.map(({ word, unknownRate }) => `<span class="problemWord"><strong>${escapeHtml(word.word)}</strong><small>${unknownRate}%</small></span>`).join("") : `<span class="profileFutureNote">${msg("statistics.poka_nedostatochno_dannyh")}</span>`}</div>
    </section>`;
  } catch (error) {
    console.warn("profile: statistics are temporarily unavailable", error);
    body = `<div class="profileLockedState">
      <strong>${msg("statistics.statistika_vremenno_nedostupna")}</strong>
      <span>${msg("statistics.profil_prodolzhaet_rabotat_poprobuyte_otkryt_statistiku_po")}</span>
    </div>`;
  }

  context.root.innerHTML = `<section class="view screen profileView profileStatisticsView">
    ${primaryNavigation}
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
  bindProfileNavigation(context, signal);
  bindLocalNavigation(context, signal);
  context.root.querySelectorAll("[data-profile-story]").forEach((button) => {
    button.addEventListener("click", () => context.router.navigate("path.home", { storyType: button.dataset.profileStory }), { signal });
  });
  context.root.querySelectorAll("[data-profile-gender]").forEach((button) => {
    button.addEventListener("click", async () => {
      const gender = button.dataset.profileGender;
      const label = gender === "female" ? msg("profile.zhenskiy_2") : msg("profile.muzhskoy_2");
      const confirmed = await context.modal.confirm({
        message: msg("profile.vybrat_obraz_posle_sohraneniya_izmenit_vybor_budet", { label }).replace("\n", "<br>"),
      });
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
