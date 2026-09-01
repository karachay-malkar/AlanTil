export type FavoriteMutation = { ids: string[]; active: boolean; changed: boolean };
export function normalizeFavoriteId(value: unknown): string;
export function normalizeFavoriteIds(values: unknown, normalizeId?: (value: unknown) => string): string[];
export function setFavoriteActive(values: unknown, id: unknown, active: boolean, normalizeId?: (value: unknown) => string): FavoriteMutation;
export function toggleFavorite(values: unknown, id: unknown, normalizeId?: (value: unknown) => string): FavoriteMutation;
export function filterFavoriteItems<T>(items: T[], favoriteIds: unknown, getId?: (item: T) => unknown): T[];
export function mergeFavoriteStates(localRows?: Record<string, unknown>[], remoteRows?: Record<string, unknown>[]): string[];
