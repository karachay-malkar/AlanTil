import { msg } from "../../shared/i18n/index.js?v=16.8.0.1";
import { getCurrentAuthState } from "../../shared/auth/auth-service.js?v=16.8.0.1";
import { getWords } from "../../shared/data/word-repository.js?v=16.8.0.1";
import { buildLearningRoute } from "../../shared/domain/learning-route.js?v=16.8.0.1";
import { dictionaryPathProgress } from "../../shared/domain/route-progress.js?v=16.8.0.1";
import { getProfile } from "../../shared/profile/profile-service.js?v=16.8.0.1";
import { activitySummary } from "../../shared/progress/activity-history-store.js?v=16.8.0.1";
import { allWordMasterySummary, problemWordRows } from "../../shared/progress/word-progress-store.js?v=16.8.0.1";
import { escapeHtml } from "../../shared/ui/html.js?v=16.8.0.1";
import { uiIcon } from "../../shared/ui/icons.js?v=16.8.0.1";
import { bindProfileNavigation, renderProfileNavigation } from "../../shared/ui/profile-navigation.js?v=16.8.0.1";
import { renderSegmentedProgress } from "../../shared/ui/segmented-progress.js?v=16.8.0.1";

let controller = null;

function profileNavigation(active = "profile") {
  return renderProfileNavigation(active);
}

function durationLabel(seconds) {
  const minutes = Math.round(Math.max(0, Number(seconds || 0)) / 60);
  if (minutes < 60) return msg("profile.min", { minutes });
  return msg("profile.ch_min", { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

function bindAccountNavigation(context, signal) {
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
        ${renderSegmentedProgress({ value: value.percent, segments: 10, label: msg("profile.progress", { label }), className: "profileStoryProgress" })}
      </button>`;
    }).join("")}
  </div>`;
}

async function loadStoryProgress() {
  try {
    const words = await getWords();
    const route = buildLearningRoute(words);
    return { route, path: dictionaryPathProgress(route) };
  } catch (error) {
    console.warn("profile: story progress is temporarily unavailable", error);
    return null;
  }
}

function unavailableStoryProgress() {
  return `<div class="profileFutureNote" role="status">
    ${msg("profile.progress_vremenno_nedostupen")}
  </div>`;
}

function lockedProfile() {
  return `<div class="profileLockedState">
    <div class="profileIdentityBar profileIdentityBarLocked">
      <div class="profileIdentityCopy">
        <span class="profileIdentityCaption">${msg("profile.status_label")}</span>
        <strong>${msg("profile.profil_nedostupen")}</strong>
      </div>
      <button class="iconAction profileAccountButton" type="button" data-profile-account aria-label="${msg("profile.voyti_v_akkaunt")}">${uiIcon("account")}</button>
    </div>
    <span>${msg("profile.voydite_chtoby_otkryt_profil")}</span>
    <button class="btn actionPrimary profileLoginButton" type="button" data-profile-account>${msg("profile.voyti")}</button>
  </div>`;
}

async function renderProfileHome(context, auth, profile) {
  const primaryNavigation = profileNavigation("profile");
  let body = "";
  if (!auth.user) {
    body = lockedProfile();
  } else if (!profile) {
    body = `<div class="profileLockedState"><strong>${msg("profile.zavershite_nastroyku_akkaunta")}</strong><span>${msg("profile.sozdayte_nikneym_chtoby_otkryt_profil")}</span><button class="btn actionPrimary profileLoginButton" type="button" data-profile-account>${msg("profile.prodolzhit")}</button></div>`;
  } else {
    const progress = await loadStoryProgress();
    body = `<div class="profileStatusContent">
      <div class="profileIdentityBar">
        <div class="profileIdentityCopy">
          <span class="profileIdentityCaption">${msg("profile.status_label")}</span>
          <div class="profileNickname">${escapeHtml(profile.nickname)}</div>
        </div>
        <button class="iconAction profileAccountButton" type="button" data-profile-account aria-label="${msg("profile.otkryt_akkaunt")}">${uiIcon("account")}</button>
      </div>
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
    <div class="profileScroll">${body}</div>
  </section>`;
}

async function renderStatistics(context) {
  const primaryNavigation = profileNavigation("statistics");
  let body = "";
  try {
    const words = await getWords();
    const route = buildLearningRoute(words);
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

function renderProfileLoading(context) {
  context.root.innerHTML = `<section class="view screen profileView">
    ${profileNavigation("profile")}
    <div class="profileScroll"><div class="loadingState">${msg("common.otkryvaem")}</div></div>
  </section>`;
}

function bindProfileActions(context, auth, signal) {
  bindProfileNavigation(context, signal);
  bindAccountNavigation(context, signal);
  context.root.querySelectorAll("[data-profile-story]").forEach((button) => {
    button.addEventListener("click", () => context.router.navigate("path.home", { storyType: button.dataset.profileStory }), { signal });
  });

}

export async function mount(context, params = {}) {
  controller = new AbortController();
  const signal = controller.signal;
  const auth = getCurrentAuthState();
  const screen = params.screen || "home";

  if (screen === "skills") {
    context.router.replace("profile.home", {}, { force: true });
    return;
  }

  if (screen === "statistics") {
    await renderStatistics(context);
    if (!signal.aborted) bindProfileNavigation(context, signal);
    return;
  }

  if (!auth.user) {
    await renderProfileHome(context, auth, null);
    if (!signal.aborted) bindProfileActions(context, auth, signal);
    return;
  }

  renderProfileLoading(context);
  bindProfileNavigation(context, signal);
  bindAccountNavigation(context, signal);
  void loadProfile(auth).then(async (profile) => {
    if (signal.aborted) return;
    await renderProfileHome(context, auth, profile);
    if (signal.aborted) return;
    bindProfileActions(context, auth, signal);
  });
}

export function unmount() {
  controller?.abort();
  controller = null;
}
