import { getCurrentAuthState } from "../../shared/auth/auth-service.js?v=13.2";
import { getWords } from "../../shared/data/word-repository.js";
import { buildLearningRoute } from "../../shared/domain/learning-route.js";
import { dictionaryPathProgress, stationsDueForReview } from "../../shared/domain/route-progress.js";
import { getProfile } from "../../shared/profile/profile-service.js?v=13.2";
import { activitySummary } from "../../shared/progress/activity-history-store.js";
import { getUserRewards } from "../../shared/progress/reward-store.js";
import { getAllStationProgress } from "../../shared/progress/station-progress-store.js";
import { escapeHtml } from "../../shared/ui/html.js";
import { uiIcon } from "../../shared/ui/icons.js";

let controller = null;

function durationLabel(seconds) {
  const minutes = Math.round(Math.max(0, Number(seconds || 0)) / 60);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ч ${minutes % 60} мин`;
}

function rewardLabel(reward) {
  const id = String(reward.reward_id || "");
  if (id.includes(":group:")) return { icon: "milestone", title: "Освоенный рубеж" };
  if (id.includes("artifact")) return { icon: "artifact", title: "Национальный артефакт" };
  if (id.includes("place")) return { icon: "station", title: "Место" };
  if (id.includes("quote")) return { icon: "review", title: "Цитата" };
  return { icon: "mastered", title: "Достижение" };
}

export async function mount(context) {
  controller = new AbortController();
  const [words] = await Promise.all([getWords()]);
  const route = buildLearningRoute(words);
  const path = dictionaryPathProgress(route);
  const activity = activitySummary();
  const stationRows = getAllStationProgress();
  const mastered = stationRows.filter((row) => row.status === "mastered").length;
  const due = stationsDueForReview(route).length;
  const rewards = getUserRewards();
  const auth = getCurrentAuthState();
  let nickname = auth.user?.user_metadata?.name || auth.user?.email?.split("@")[0] || "Гость";
  if (auth.user?.id) {
    try { nickname = (await getProfile(auth.user.id))?.nickname || nickname; } catch { /* Profile remains usable offline. */ }
  }
  const byId = new Map(words.map((word) => [String(word.id), word]));
  const problemWords = activity.problemWordIds.map((id) => byId.get(id)).filter(Boolean);
  const stories = [
    ["ascent", "Восхождение"],
    ["summit", "На вершине"],
    ["trails", "Тропы"],
  ];

  context.root.innerHTML = `
    <section class="view screen profileView">
      <div class="profileHero">
        <div class="profileNickname">${escapeHtml(nickname)}</div>
        <div class="profilePathLabel">[ СЛОВАРНЫЙ ПУТЬ ]</div>
        <div class="profilePathValue">${path.percent}%</div>
        ${path.rarePercent ? `<div class="smallNote">Редкие слова: +${path.rarePercent}% отдельного уровня</div>` : ""}
      </div>
      <div class="profileGrid">
        <div class="profileStat"><strong>${mastered}</strong><span>освоенных станций</span></div>
        <div class="profileStat"><strong>${path.stories.ascent.completedGroups + path.stories.summit.completedGroups + path.stories.trails.completedGroups}</strong><span>завершённых рубежей</span></div>
        <div class="profileStat"><strong>${durationLabel(activity.activeSeconds)}</strong><span>активного времени</span></div>
        <div class="profileStat"><strong>${activity.sessionsTotal}</strong><span>учебных сессий</span></div>
        <div class="profileStat"><strong>${activity.accuracy}%</strong><span>точность тестов</span></div>
        <div class="profileStat"><strong>${due}</strong><span>повторений ожидают</span></div>
      </div>
      <section class="profileSection">
        <h2 class="profileSectionTitle">Истории</h2>
        <div class="storyRows">
          ${stories.map(([type, label]) => {
            const value = path.stories[type];
            return `<button class="storyRow" type="button" data-profile-story="${type}"><span class="storyRowHead"><span>${escapeHtml(label)}</span><span>${value.percent}%</span></span><span class="storyMiniBar"><span style="width:${value.percent}%"></span></span></button>`;
          }).join("")}
        </div>
      </section>
      <section class="profileSection">
        <h2 class="profileSectionTitle">Проблемные слова</h2>
        <div class="problemWords">${problemWords.length ? problemWords.map((word) => `<span class="problemWord">${escapeHtml(word.word)}</span>`).join("") : `<span class="smallNote">Пока недостаточно данных.</span>`}</div>
      </section>
      <section class="profileSection">
        <h2 class="profileSectionTitle">Коллекция</h2>
        <div class="rewardGrid">${rewards.length ? rewards.slice(0, 12).map((reward) => { const item = rewardLabel(reward); return `<div class="rewardCard"><span class="rewardIcon">${uiIcon(item.icon)}</span><span>${escapeHtml(item.title)}</span></div>`; }).join("") : `<div class="smallNote">Награды появятся после завершения рубежей и тематических троп.</div>`}</div>
      </section>
      <section class="profileSection">
        <h2 class="profileSectionTitle">Профиль и приложение</h2>
        <div class="profileLinks">
          <button class="profileLink" type="button" data-profile-route="account.home">Аккаунт</button>
          <button class="profileLink" type="button" data-profile-route="settings.home">Настройки</button>
        </div>
      </section>
    </section>`;

  context.root.querySelectorAll("[data-profile-story]").forEach((button) => {
    button.addEventListener("click", () => context.router.navigate("path.home", { storyType: button.dataset.profileStory }), { signal: controller.signal });
  });
  context.root.querySelectorAll("[data-profile-route]").forEach((button) => {
    button.addEventListener("click", () => context.router.navigate(button.dataset.profileRoute), { signal: controller.signal });
  });
}

export function unmount() {
  controller?.abort();
  controller = null;
}
