export const STORAGE_SCOPE_PREFIX = 'alantil_scope_v1';
export const GUEST_STORAGE_SCOPE = 'guest';

export function storageScopeForUser(userId) {
  const id = String(userId || '').trim();
  return id ? `user:${id}` : GUEST_STORAGE_SCOPE;
}

export function storageScopeUserId(scope = GUEST_STORAGE_SCOPE) {
  const value = String(scope || '');
  return value.startsWith('user:') ? value.slice(5) : '';
}

export function isGuestStorageScope(scope = GUEST_STORAGE_SCOPE) {
  return String(scope || GUEST_STORAGE_SCOPE) === GUEST_STORAGE_SCOPE;
}

export function scopedStorageKey(baseKey, scope = GUEST_STORAGE_SCOPE) {
  return `${STORAGE_SCOPE_PREFIX}:${String(scope || GUEST_STORAGE_SCOPE)}:${String(baseKey || '')}`;
}
