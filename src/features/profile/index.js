import { getCurrentAuthState } from "../../shared/auth/auth-service.js?v=13.5";
import { getWords } from "../../shared/data/word-repository.js";
import { buildLearningRoute } from "../../shared/domain/learning-route.js";
import { dictionaryPathProgress } from "../../shared/domain/route-progress.js";
import { getProfile } from "../../shared/profile/profile-service.js?v=13.5";
import { activitySummary } from "../../shared/progress/activity-history-store.js";
import { getUserRewards } from "../../shared/progress/reward-store.js";
import { allWordMasterySummary, problemWordRows } from "../../shared/progress/word-progress-store.js";
import { getStationSize } from "../../shared/settings/user-settings-store.js";
import { escapeHtml } from "../../shared/ui/html.js";
import { uiIcon } from "../../shared/ui/icons.js";
import { renderBracketHeading } from "../../shared/ui/bracket-heading.js";
import { renderSegmentedProgress } from "../../shared/ui/segmented-progress.js";

let controller = null;

function durationLabel(seconds) {
  const minutes = Math.round(Math.max(0, Number(seconds || 0)) / 60);
  if (minutes < 60) return `${minutes} мин`;
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
}

function rewardLabel(reward) {
  const id = String(reward.reward_id || "");
  if (id.includes("achievement:words:")) {
    const amount = id.split(":").pop();
    return { icon: "milestone", title: `${amount} освоенных слов` };
  }
  if (id.includes("artifact")) return { icon: "artifact", title: "Национальный артефакт" };
  if (id.includes("place")) return { icon: "station", title: "Место маршрута" };
  if (id.includes("quote")) return { icon: "review", title: "Цитата" };
  return { icon: "mastered", title: "Достижение" };
}

export async function mount(context) {
  controller = new AbortController();
  context.shell.setHeaderContent?.();
  const words = await getWords();
  const route = buildLearningRoute(words, { stationSize: getStationSize() });
  const path = dictionaryPathProgress(route);
  const mastery = allWordMasterySummary(words);
  const activity = activitySummary();
  const rewards = getUserRewards();
  const auth = getCurrentAuthState();
  let nickname = auth.user?.user_metadata?.name || auth.user?.email?.split("@")[0] || "Гость";
  if (auth.user?.id) {
    try { nickname = (await getProfile(auth.user.id))?.nickname || nickname; } catch { /* Offline profile fallback. */ }
  }
  const difficult = problemWordRows(words, 12);
  const completedDictionaries = route.storyOrder.reduce((sum, type) => sum + Number(path.stories[type]?.completedCatalogs || 0), 0);

  context.root.innerHTML = `<section class="view screen profileView">
    <div class="profileHero">
      <div class="profileNickname">${escapeHtml(nickname)}</div>
      <div class="profilePathLabel">[ СЛОВАРНЫЙ ПУТЬ ]</div>
      <div class="profilePathLine"><div class="profilePathValue">${path.percent}%</div>${renderSegmentedProgress({ value: path.percent, segments: 10, label: `Общий прогресс ${path.percent}%`, className: "profileMainProgress" })}</div>
      <div class="profilePathMeta">${mastery.mastered}/${mastery.total} слов</div>
    </div>

    <section class="profileSection profileSummarySection">
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

    <section class="profileSection">
      ${renderBracketHeading("Истории", { className: "profileSectionTitle" })}
      <div class="storyRows">
        ${route.storyOrder.map((type) => {
          const value = path.stories[type];
          const label = route.storyLabels[type];
          return `<button class="storyRow" type="button" data-profile-story="${escapeHtml(type)}">
            <span class="storyRowHead"><span>${escapeHtml(label)}</span><span>${value.percent}%</span></span>
            ${renderSegmentedProgress({ value: value.percent, segments: 10, label: `Прогресс ${label}`, className: "storySegmentedProgress" })}
            <span class="storyRowMeta">${value.masteredWords}/${value.totalWords} слов</span>
          </button>`;
        }).join("")}
      </div>
    </section>

    <section class="profileSection">
      ${renderBracketHeading("Проблемные слова", { className: "profileSectionTitle" })}
      <div class="problemWords">${difficult.length ? difficult.map(({ word, unknownRate }) => `<span class="problemWord"><strong>${escapeHtml(word.word)}</strong><small>${unknownRate}%</small></span>`).join("") : `<span class="smallNote">Пока недостаточно данных.</span>`}</div>
    </section>

    <section class="profileSection">
      ${renderBracketHeading("Коллекция", { className: "profileSectionTitle" })}
      <div class="rewardGrid">${rewards.length ? rewards.slice(0, 12).map((reward) => { const item = rewardLabel(reward); return `<div class="rewardCard"><span class="rewardIcon">${uiIcon(item.icon)}</span><span>${escapeHtml(item.title)}</span></div>`; }).join("") : `<div class="smallNote">Маршрутные знаки выдаются за каждые 20 освоенных слов.</div>`}</div>
    </section>

    <section class="profileSection">
      ${renderBracketHeading("Профиль и приложение", { className: "profileSectionTitle" })}
      <div class="profileLinks">
        <button class="profileLink" type="button" data-profile-route="account.home">Аккаунт</button>
        <button class="profileLink" type="button" data-profile-route="settings.home">Настройки</button>
      </div>
    </section>
  </section>`;

  context.root.querySelectorAll("[data-profile-story]").forEach((button) => button.addEventListener("click", () => context.router.navigate("path.home", { storyType: button.dataset.profileStory }), { signal: controller.signal }));
  context.root.querySelectorAll("[data-profile-route]").forEach((button) => button.addEventListener("click", () => context.router.navigate(button.dataset.profileRoute), { signal: controller.signal }));
}

export function unmount() { controller?.abort(); controller = null; }
