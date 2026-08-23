import { getSupabaseClient } from "../auth/supabase-client.js?v=13.15.9";
import { logSupabaseError, normalizeSupabaseError } from "../errors/supabase-error.js?v=13.9.0";

async function runAdminRpc(name, parameters = {}) {
  const client = await getSupabaseClient();
  const { data, error } = await client.rpc(name, parameters);
  if (error) {
    logSupabaseError(name, error);
    throw normalizeSupabaseError(error, { operation: name });
  }
  return data;
}

export async function fetchUserActivityList() {
  const data = await runAdminRpc("admin_user_activity_list");
  return Array.isArray(data) ? data : [];
}

export async function fetchUserActivityDetail(userId) {
  const id = String(userId || "").trim();
  if (!id) return null;
  return runAdminRpc("admin_user_activity_detail", { p_user_id: id });
}

export async function fetchUserTestHistory(userId) {
  const id = String(userId || "").trim();
  if (!id) return [];
  const data = await runAdminRpc("admin_user_test_history", { p_user_id: id });
  return Array.isArray(data) ? data : [];
}

export async function fetchUserFavorites(userId) {
  const id = String(userId || "").trim();
  if (!id) return [];
  const data = await runAdminRpc("admin_user_favorites", { p_user_id: id });
  return Array.isArray(data) ? data : [];
}

export async function fetchStationTestDetail(sessionId) {
  const id = String(sessionId || "").trim();
  if (!id) return null;
  return runAdminRpc("admin_station_test_detail", { p_session_id: id });
}
