import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/src/lib/supabase';
import { GUEST_STATION_PROGRESS_KEY, GUEST_WORD_PROGRESS_KEY } from '@/src/mobile/progress/guest';

const WORD_FAV_GUEST = 'fc_favorites_v1:guest';
const SONG_FAV_GUEST = 'alantil_song_favorites_v1:guest';
const DONE_PREFIX = 'alantil_guest_migration_v14_1_6';

function readArray(raw: string | null) {
  if (!raw) return [] as unknown[];
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

export async function migrateGuestData(userId: string) {
  const doneKey = `${DONE_PREFIX}:${userId}`;
  if (await AsyncStorage.getItem(doneKey)) return;

  const [wordFavRaw, songFavRaw, progressRaw, stationRaw] = await Promise.all([
    AsyncStorage.getItem(WORD_FAV_GUEST),
    AsyncStorage.getItem(SONG_FAV_GUEST),
    AsyncStorage.getItem(GUEST_WORD_PROGRESS_KEY),
    AsyncStorage.getItem(GUEST_STATION_PROGRESS_KEY),
  ]);
  const now = new Date().toISOString();

  const wordIds = readArray(wordFavRaw).map((value) => String(value ?? '').trim()).filter(Boolean);
  if (wordIds.length) {
    const { error } = await supabase.from('user_word_favorites').upsert(wordIds.map((word_id) => ({ user_id: userId, word_id, is_active: true, updated_at: now })), { onConflict: 'user_id,word_id' });
    if (error) throw error;
  }

  const songIds = readArray(songFavRaw).map((value) => String(value ?? '').trim()).filter(Boolean);
  if (songIds.length) {
    const { error } = await supabase.from('user_song_favorites').upsert(songIds.map((song_id) => ({ user_id: userId, song_id, is_active: true, updated_at: now })), { onConflict: 'user_id,song_id' });
    if (error) throw error;
  }

  const progressRows = readArray(progressRaw) as Record<string, unknown>[];
  if (progressRows.length) {
    const { data: cloud, error: readError } = await supabase.from('user_word_progress').select('*').eq('user_id', userId);
    if (readError) throw readError;
    const cloudMap = new Map((cloud ?? []).map((row) => [String(row.word_id), row]));
    for (const guest of progressRows) {
      const wordId = String(guest.word_id ?? '').trim();
      if (!wordId) continue;
      const existing = cloudMap.get(wordId);
      if (existing) continue;
      const { error } = await supabase.from('user_word_progress').insert({
        user_id: userId,
        word_id: wordId,
        sessions_total: 0,
        learn_sessions_total: 0,
        learn_unfinished_total: 0,
        test_answers_total: 0,
        match_sessions_total: 0,
        match_success_total: 0,
        match_errors_total: 0,
        study_shown_count: Number(guest.study_shown_count || 0),
        known_count: Number(guest.known_count || 0),
        unknown_count: Number(guest.unknown_count || 0),
        test_correct_count: Number(guest.test_correct_count || 0),
        test_wrong_count: Number(guest.test_wrong_count || 0),
        mastery_status: String(guest.mastery_status || 'not_started'),
        last_mode: guest.last_mode ?? null,
        last_result: guest.last_result ?? null,
        last_seen_at: guest.last_seen_at ?? null,
        last_studied_at: guest.last_studied_at ?? null,
        last_tested_at: guest.last_tested_at ?? null,
        mastered_at: guest.mastered_at ?? null,
      });
      if (error) throw error;
    }
  }

  if (stationRaw) {
    try {
      const map = JSON.parse(stationRaw) as Record<string, Record<string, unknown>>;
      const rows = Object.values(map).map((row) => ({ user_id: userId, ...row }));
      if (rows.length) {
        const { error } = await supabase.from('user_station_progress').upsert(rows, { onConflict: 'user_id,dictionary_id,catalog_id,group_id,set_id' });
        if (error) throw error;
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        // Ignore corrupt guest-only cache; cloud data must remain untouched.
      } else throw error;
    }
  }

  await AsyncStorage.setItem(doneKey, now);
}
