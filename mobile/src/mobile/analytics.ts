import { sanitizeAnalyticsParameters } from '../../../packages/alantil-core/analytics.js';
import { readScopedJson, STORAGE_KEYS, updateScopedJson, writeScopedJson } from '@/src/mobile/storage';

export type AnalyticsPreference = { enabled: boolean | null; updated_at: string | null };
export type MobileAnalyticsEvent = {
  id: string;
  name: string;
  parameters: Record<string, string | number | boolean>;
  created_at: string;
};

const DEFAULT_PREFERENCE: AnalyticsPreference = { enabled: null, updated_at: null };
const preferenceCache = new Map<string, AnalyticsPreference>();

function cacheKey(userId?: string | null) {
  return String(userId ?? '') || 'guest';
}

export async function readAnalyticsPreference(userId?: string | null) {
  const key = cacheKey(userId);
  const cached = preferenceCache.get(key);
  if (cached) return cached;
  const stored = await readScopedJson<Partial<AnalyticsPreference>>(STORAGE_KEYS.analyticsPreference, DEFAULT_PREFERENCE, userId);
  const preference = {
    enabled: typeof stored.enabled === 'boolean' ? stored.enabled : null,
    updated_at: stored.updated_at ? String(stored.updated_at) : null,
  } satisfies AnalyticsPreference;
  preferenceCache.set(key, preference);
  return preference;
}

export async function saveAnalyticsPreference(enabled: boolean, userId?: string | null) {
  const preference = { enabled: Boolean(enabled), updated_at: new Date().toISOString() } satisfies AnalyticsPreference;
  preferenceCache.set(cacheKey(userId), preference);
  await writeScopedJson(STORAGE_KEYS.analyticsPreference, preference, userId);
  if (!preference.enabled) await writeScopedJson(STORAGE_KEYS.analyticsEvents, [], userId);
  return preference;
}

export async function trackMobileEvent(name: string, parameters: Record<string, unknown> = {}, userId?: string | null) {
  const preference = await readAnalyticsPreference(userId);
  if (preference.enabled !== true || !name.trim()) return false;
  const createdAt = new Date().toISOString();
  const event: MobileAnalyticsEvent = {
    id: `${createdAt}:${Math.random().toString(36).slice(2, 10)}`,
    name: name.trim().slice(0, 64),
    parameters: sanitizeAnalyticsParameters(parameters, {
      maxEntries: 32,
      keyMaxLength: 40,
      stringMaxLength: 100,
      normalizeKeys: true,
    }),
    created_at: createdAt,
  };
  await updateScopedJson<MobileAnalyticsEvent[]>(STORAGE_KEYS.analyticsEvents, [], (current) => [...current.slice(-499), event], userId);
  return true;
}
