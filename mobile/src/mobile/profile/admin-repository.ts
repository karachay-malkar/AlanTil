import { supabase } from '@/src/lib/supabase';

const ADMIN_TIMEOUT_MS = 12_000;

export type StoryProgress = { passed: number; total: number };
export type AdminUserRow = {
  rank: number;
  user_id: string;
  nickname: string;
  last_seen_at: string | null;
  streak_days: number;
  mastered_words: number;
  stories: Record<string, StoryProgress>;
};

export type AdminTestRow = {
  session_id: string;
  story_type: string;
  story_number: number;
  station_number: number;
  phase?: string;
  started_at: string | null;
  ended_at: string | null;
  duration_sec?: number;
  active_duration_sec?: number;
  questions_total?: number;
  correct_total?: number;
  wrong_total?: number;
  accuracy: number;
};

export type AdminWordRow = {
  word_id: string;
  word_alan_cyrillic?: string;
  word_alan_turkic?: string;
  translation_ru?: string;
  translation_en?: string;
  translation_tr?: string;
  test_wrong_count?: number;
  unknown_count?: number;
  result?: string;
  wrong_word_alan_cyrillic?: string;
  wrong_word_alan_turkic?: string;
  wrong_translation_ru?: string;
  wrong_translation_en?: string;
  wrong_translation_tr?: string;
};

export type AdminUserDetail = {
  user_id: string;
  nickname: string;
  last_seen_at: string | null;
  streak_days: number;
  mastered_words: number;
  favorite_words: number;
  test_sessions: number;
  stories: ({ story_type: string; story_number: number } & StoryProgress)[];
  tests: AdminTestRow[];
  favorites: AdminWordRow[];
  problem_words: AdminWordRow[];
};

export type AdminTestDetail = AdminTestRow & {
  nickname: string;
  words: AdminWordRow[];
};

async function withTimeout<T>(operation: PromiseLike<T>) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<T>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('admin_timeout')), ADMIN_TIMEOUT_MS); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function adminRpc(name: string, parameters: Record<string, string> = {}) {
  const { data, error } = await withTimeout(supabase.rpc(name, parameters));
  if (error) throw error;
  return data;
}

export async function fetchAdminUsers() {
  const data = await adminRpc('admin_user_activity_list');
  return (Array.isArray(data) ? data : []) as AdminUserRow[];
}

export async function fetchAdminUser(userId: string) {
  const data = await adminRpc('admin_user_activity_detail', { p_user_id: userId });
  return data ? data as AdminUserDetail : null;
}

export async function fetchAdminUserTests(userId: string) {
  const data = await adminRpc('admin_user_test_history', { p_user_id: userId });
  return (Array.isArray(data) ? data : []) as AdminTestRow[];
}

export async function fetchAdminUserFavorites(userId: string) {
  const data = await adminRpc('admin_user_favorites', { p_user_id: userId });
  return (Array.isArray(data) ? data : []) as AdminWordRow[];
}

export async function fetchAdminTest(sessionId: string) {
  const data = await adminRpc('admin_station_test_detail', { p_session_id: sessionId });
  return data ? data as AdminTestDetail : null;
}

export function isActivityAccessDenied(error: unknown) {
  const value = error as { code?: string; message?: string } | null;
  return /42501|activity access denied|permission denied/i.test(`${value?.code ?? ''} ${value?.message ?? String(error ?? '')}`);
}
