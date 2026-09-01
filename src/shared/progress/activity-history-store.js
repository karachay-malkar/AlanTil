import { readScopedJson, writeScopedJson } from "./storage-scope.js?v=13.9.0";
import {
  ACTIVITY_HISTORY_LIMIT,
  summarizeActivityHistory,
  upsertActivityHistory,
} from "../../../packages/alantil-core/statistics.js";

export const ACTIVITY_HISTORY_KEY = "alantil_activity_history_v13_1";

export function getActivityHistory() {
  const rows = readScopedJson(ACTIVITY_HISTORY_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export function recordActivitySession(type, payload) {
  const result = upsertActivityHistory(getActivityHistory(), type, payload, ACTIVITY_HISTORY_LIMIT);
  if (!result.entry) return null;
  writeScopedJson(ACTIVITY_HISTORY_KEY, result.rows);
  return result.entry;
}

export function activitySummary() {
  return summarizeActivityHistory(getActivityHistory());
}
