import { supabase } from '@/src/lib/supabase';
import { validateNickname } from '@/src/mobile/profile/policy';

export type ProfileRow = {
  user_id: string;
  nickname: string;
  avatar_gender: 'male' | 'female' | null;
  activity_access?: boolean;
  created_at?: string;
  updated_at?: string;
};

const PROFILE_TIMEOUT_MS = 12_000;

async function withTimeout<T>(operation: PromiseLike<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timeout`)), PROFILE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function loadProfile(userId?: string | null): Promise<ProfileRow | null> {
  if (!userId) return null;
  const { data, error } = await withTimeout(supabase
    .from('profiles')
    .select('user_id,nickname,avatar_gender,activity_access,created_at,updated_at')
    .eq('user_id', userId)
    .maybeSingle(), 'Profile load');
  if (error) throw error;
  return data as ProfileRow | null;
}

export async function checkNickname(value: string) {
  const validation = validateNickname(value);
  if (!validation.valid) return { ...validation, available: false };
  const { data, error } = await withTimeout(supabase.rpc('is_nickname_available', { candidate: validation.nickname }), 'Nickname check');
  if (error) throw error;
  return { ...validation, available: Boolean(data) };
}

export async function createProfile(userId: string, value: string) {
  const validation = validateNickname(value);
  if (!validation.valid) throw new Error(validation.reason ?? 'requirements');
  const { data, error } = await withTimeout(supabase
    .from('profiles')
    .insert({ user_id: userId, nickname: validation.nickname })
    .select('user_id,nickname,avatar_gender,activity_access,created_at,updated_at')
    .single(), 'Profile create');
  if (error) throw error;
  return data as ProfileRow;
}

export async function chooseAvatarGender(userId: string, gender: 'male' | 'female') {
  const { data, error } = await withTimeout(supabase
    .from('profiles')
    .update({ avatar_gender: gender })
    .eq('user_id', userId)
    .is('avatar_gender', null)
    .select('user_id,nickname,avatar_gender,activity_access,created_at,updated_at')
    .maybeSingle(), 'Avatar update');
  if (error) throw error;
  if (data) return data as ProfileRow;
  const current = await loadProfile(userId);
  if (current?.avatar_gender === gender) return current;
  throw new Error('avatar_already_selected');
}
