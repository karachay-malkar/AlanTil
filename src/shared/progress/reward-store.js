import { enqueueProgress } from "./progress-queue.js?v=13.8";
import { readScopedJson, writeScopedJson } from "./storage-scope.js?v=13.8";

export const USER_REWARDS_KEY = "alantil_user_rewards_v13_1";

export function getUserRewards() {
  const rows = readScopedJson(USER_REWARDS_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export function awardReward({ rewardId, setId = null, groupId = null, catalogId = null }) {
  const reward_id = String(rewardId || "").trim();
  if (!reward_id) return null;
  const rows = getUserRewards();
  const existing = rows.find((row) => row.reward_id === reward_id);
  if (existing) return existing;
  const row = {
    reward_id,
    set_id: setId,
    group_id: groupId,
    catalog_id: catalogId,
    acquired_at: new Date().toISOString(),
  };
  rows.push(row);
  writeScopedJson(USER_REWARDS_KEY, rows);
  enqueueProgress("user_reward", row, { id: `user_reward:${reward_id}`, replace: false });
  return row;
}

export function replaceUserRewards(rows = []) {
  const unique = Array.from(new Map((Array.isArray(rows) ? rows : []).map((row) => [row.reward_id, row])).values());
  writeScopedJson(USER_REWARDS_KEY, unique);
  return unique;
}
