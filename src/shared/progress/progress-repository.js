import { getCurrentAuthState } from "../auth/auth-service.js?v=13.1";
import { getSupabaseClient } from "../auth/supabase-client.js?v=13.1";

function currentUserId() {
  return String(getCurrentAuthState().user?.id || "").trim();
}

function requireUserId() {
  const userId = currentUserId();
  if (!userId) throw new Error("Progress sync requires an authenticated user.");
  return userId;
}

function withUser(payload = {}) {
  return { ...payload, user_id: requireUserId() };
}

async function throwIfError(result) {
  if (result?.error) throw result.error;
  return result?.data;
}

function withoutNestedWords(payload = {}) {
  const { words, ...row } = payload;
  return row;
}

export async function executeProgressEntry(entry) {
  const client = await getSupabaseClient();
  const payload = entry?.payload || {};

  if (entry.type === "learn_session") return throwIfError(await client.rpc("save_learn_session", { payload }));
  if (entry.type === "test_session") return throwIfError(await client.rpc("save_test_session", { payload }));
  if (entry.type === "match_session") return throwIfError(await client.rpc("save_match_session", { payload }));
  if (entry.type === "station_test_session") return throwIfError(await client.rpc("save_station_test_session", { payload }));
  if (entry.type === "word_favorite") return throwIfError(await client.from("user_word_favorites").upsert(withUser(payload), { onConflict: "user_id,word_id" }));
  if (entry.type === "song_favorite") return throwIfError(await client.from("user_song_favorites").upsert(withUser(payload), { onConflict: "user_id,song_id" }));
  if (entry.type === "hidden_word") {
    return throwIfError(await client.from("user_hidden_words").upsert(withUser(payload), {
      onConflict: "user_id,dictionary_id,section_id,set_id,word_id",
    }));
  }
  if (entry.type === "set_progress") {
    return throwIfError(await client.from("user_set_progress").upsert(withUser(payload), {
      onConflict: "user_id,dictionary_id,section_id,set_id",
    }));
  }
  if (entry.type === "station_progress") {
    return throwIfError(await client.from("user_station_progress").upsert(withUser(payload), {
      onConflict: "user_id,dictionary_id,catalog_id,group_id,set_id",
    }));
  }
  if (entry.type === "user_reward") {
    return throwIfError(await client.from("user_rewards").upsert(withUser(payload), {
      onConflict: "user_id,reward_id",
      ignoreDuplicates: true,
    }));
  }
  if (entry.type === "route_settings") {
    return throwIfError(await client.from("user_route_settings").upsert(withUser(payload), { onConflict: "user_id" }));
  }
  if (entry.type === "user_settings") return throwIfError(await client.from("user_settings").upsert(withUser(payload), { onConflict: "user_id" }));
  throw new Error(`Unsupported progress operation: ${String(entry?.type || "unknown")}`);
}

function missingRelation(error) {
  return ["42P01", "PGRST205", "PGRST204"].includes(error?.code);
}

async function optionalResult(promise, fallback) {
  const result = await promise;
  if (!result?.error) return result.data ?? fallback;
  if (missingRelation(result.error)) return fallback;
  throw result.error;
}

export async function fetchCloudProgressState() {
  requireUserId();
  const client = await getSupabaseClient();
  const [wordFavorites, songFavorites, hiddenWords, setProgress, userSettings, stationProgress, rewards, routeSettings] = await Promise.all([
    optionalResult(client.from("user_word_favorites").select("word_id,is_active,updated_at"), []),
    optionalResult(client.from("user_song_favorites").select("song_id,is_active,updated_at"), []),
    optionalResult(client.from("user_hidden_words").select("dictionary_id,section_id,set_id,word_id,is_hidden,updated_at"), []),
    optionalResult(client.from("user_set_progress").select("dictionary_id,section_id,set_id,launches_total,completed_total,is_finished,last_started_at,last_completed_at,updated_at"), []),
    optionalResult(client.from("user_settings").select("interface_language_code,translation_language_code,updated_at").maybeSingle(), null),
    optionalResult(client.from("user_station_progress").select("dictionary_id,catalog_id,group_id,set_id,story_type,status,current_phase,study_sessions_total,test_attempts_total,best_accuracy,first_test_completed_at,review_1_due_at,review_1_completed_at,review_2_due_at,review_2_completed_at,mastered_at,updated_at"), []),
    optionalResult(client.from("user_rewards").select("reward_id,set_id,group_id,catalog_id,acquired_at"), []),
    optionalResult(client.from("user_route_settings").select("selected_dictionary_id,active_story,selected_background_route,updated_at").maybeSingle(), null),
  ]);

  return {
    wordFavorites,
    songFavorites,
    hiddenWords,
    setProgress,
    userSettings,
    stationProgress,
    rewards,
    routeSettings,
  };
}
