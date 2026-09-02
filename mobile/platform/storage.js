import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeUserSettings } from '../../packages/alantil-core/settings.js';

const KEYS = Object.freeze({
  settings: 'alantil:16.1:settings',
  favorites: 'alantil:16.1:favorites',
  songFavorites: 'alantil:16.1:song-favorites',
  onboarding: 'alantil:16.1:onboarding-complete',
});

async function readJson(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function loadNativeSettings() {
  return normalizeUserSettings(await readJson(KEYS.settings, {}));
}

export async function saveNativeSettings(settings) {
  const normalized = normalizeUserSettings(settings);
  await writeJson(KEYS.settings, normalized);
  return normalized;
}

export async function loadNativeFavorites() {
  const value = await readJson(KEYS.favorites, []);
  return new Set(Array.isArray(value) ? value.map(String) : []);
}

export async function saveNativeFavorites(ids) {
  const values = Array.from(ids instanceof Set ? ids : new Set(ids || [])).map(String);
  await writeJson(KEYS.favorites, values);
  return new Set(values);
}

export async function loadNativeSongFavorites() {
  const value = await readJson(KEYS.songFavorites, []);
  return new Set(Array.isArray(value) ? value.map(String) : []);
}

export async function saveNativeSongFavorites(ids) {
  const values = Array.from(ids instanceof Set ? ids : new Set(ids || [])).map(String);
  await writeJson(KEYS.songFavorites, values);
  return new Set(values);
}

export async function hasCompletedNativeOnboarding() {
  return (await AsyncStorage.getItem(KEYS.onboarding)) === '1';
}

export async function markNativeOnboardingComplete() {
  await AsyncStorage.setItem(KEYS.onboarding, '1');
}
