import { getCurrentAuthState } from "../auth/auth-service.js?v=12.4";
import { getSupabaseClient } from "../auth/supabase-client.js?v=12.4";

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

export async function executeProgressEntry(entry) {
  const client = await getSupabaseClient();
  const payload = entry?.payload || {};

  if (entry.type === "learn_session") {
    return throwIfError(await client.rpc("save_learn_session", { payload }));
  }
  if (entry.type === "test_session") {
    return throwIfError(await client.rpc("save_test_session", { payload }));
  }
  if (entry.type === "match_session") {
    return throwIfError(await client.rpc("save_match_session", { payload }));
  }
  if (entry.type === "word_favorite") {
    return throwIfError(await client.from("user_word_favorites").upsert(withUser(payload), { onConflict: "user_id,word_id" }));
  }
  if (entry.type === "song_favorite") {
    return throwIfError(await client.from("user_song_favorites").upsert(withUser(payload), { onConflict: "user_id,song_id" }));
  }
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
  if (entry.type === "user_settings") {
    return throwIfError(await client.from("user_settings").upsert(withUser(payload), { onConflict: "user_id" }));
  }
  throw new Error(`Unsupported progress operation: ${String(entry?.type || "unknown")}`);
}

export async function fetchCloudProgressState() {
  requireUserId();
  const client = await getSupabaseClient();
  const [wordFavorites, songFavorites, hiddenWords, setProgress, userSettings] = await Promise.all([
    client.from("user_word_favorites").select("word_id,is_active,updated_at"),
    client.from("user_song_favorites").select("song_id,is_active,updated_at"),
    client.from("user_hidden_words").select("dictionary_id,section_id,set_id,word_id,is_hidden,updated_at"),
    client.from("user_set_progress").select("dictionary_id,section_id,set_id,launches_total,completed_total,is_finished,last_started_at,last_completed_at,updated_at"),
    client.from("user_settings").select("interface_language_code,translation_language_code,updated_at").maybeSingle(),
  ]);

  [wordFavorites, songFavorites, hiddenWords, setProgress, userSettings].forEach((result) => {
    if (result.error) throw result.error;
  });

  return {
    wordFavorites: wordFavorites.data || [],
    songFavorites: songFavorites.data || [],
    hiddenWords: hiddenWords.data || [],
    setProgress: setProgress.data || [],
    userSettings: userSettings.data || null,
  };
}
