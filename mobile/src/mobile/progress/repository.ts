import { supabase } from '@/src/lib/supabase';
import { loadGuestWordProgress, type WordProgress } from '@/src/mobile/progress/guest';

export async function loadWordProgress(userId?: string | null): Promise<WordProgress[]> {
  if (!userId) return loadGuestWordProgress();
  const { data, error } = await supabase.from('user_word_progress').select('*').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    word_id: String(row.word_id ?? ''),
    mastery_status: ['not_started', 'learning', 'mastered', 'review'].includes(String(row.mastery_status)) ? row.mastery_status : 'not_started',
    study_shown_count: Number(row.study_shown_count || 0),
    known_count: Number(row.known_count || 0),
    unknown_count: Number(row.unknown_count || 0),
    test_correct_count: Number(row.test_correct_count || 0),
    test_wrong_count: Number(row.test_wrong_count || 0),
    last_mode: row.last_mode ?? null,
    last_result: row.last_result ?? null,
    last_seen_at: row.last_seen_at ?? null,
    last_studied_at: row.last_studied_at ?? null,
    last_tested_at: row.last_tested_at ?? null,
    mastered_at: row.mastered_at ?? null,
  })) as WordProgress[];
}

export async function loadSetProgress(userId?: string | null) {
  if (!userId) return [] as Record<string, unknown>[];
  const { data, error } = await supabase.from('user_set_progress').select('*').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

export async function loadStationProgress(userId?: string | null) {
  if (!userId) return [] as Record<string, unknown>[];
  const { data, error } = await supabase.from('user_station_progress').select('*').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

export async function markSetStarted(userId: string | null | undefined, dictionaryId: string, sectionId: string, setId: string) {
  if (!userId) return;
  const now = new Date().toISOString();
  const { data } = await supabase.from('user_set_progress').select('*').eq('user_id', userId).eq('dictionary_id', dictionaryId).eq('section_id', sectionId).eq('set_id', setId).maybeSingle();
  const { error } = await supabase.from('user_set_progress').upsert({
    user_id: userId,
    dictionary_id: dictionaryId,
    section_id: sectionId,
    set_id: setId,
    launches_total: Number(data?.launches_total || 0) + 1,
    completed_total: Number(data?.completed_total || 0),
    is_finished: Boolean(data?.is_finished),
    last_started_at: now,
    last_completed_at: data?.last_completed_at ?? null,
    updated_at: now,
  }, { onConflict: 'user_id,dictionary_id,section_id,set_id' });
  if (error) throw error;
}

export async function markSetCompleted(userId: string | null | undefined, dictionaryId: string, sectionId: string, setId: string) {
  if (!userId) return;
  const now = new Date().toISOString();
  const { data } = await supabase.from('user_set_progress').select('*').eq('user_id', userId).eq('dictionary_id', dictionaryId).eq('section_id', sectionId).eq('set_id', setId).maybeSingle();
  const { error } = await supabase.from('user_set_progress').upsert({
    user_id: userId,
    dictionary_id: dictionaryId,
    section_id: sectionId,
    set_id: setId,
    launches_total: Math.max(1, Number(data?.launches_total || 0)),
    completed_total: Number(data?.completed_total || 0) + 1,
    is_finished: true,
    last_started_at: data?.last_started_at ?? now,
    last_completed_at: now,
    updated_at: now,
  }, { onConflict: 'user_id,dictionary_id,section_id,set_id' });
  if (error) throw error;
}
