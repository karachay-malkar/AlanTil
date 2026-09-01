export type ProgressRow = Record<string, unknown> & { word_id?: unknown };

export type RetryableEntry = {
  id: string;
  revision?: string;
  attempts?: number;
  next_attempt_at?: string;
};

export declare function normalizedId(value: unknown): string;
export declare function timestamp(value: unknown): number;
export declare function stationProgressKey(row?: Record<string, unknown>): string;
export declare function setProgressKey(row?: Record<string, unknown>): string;
export declare function hiddenWordKey(row?: Record<string, unknown>): string;
export declare function mergeFavoriteIds(...collections: unknown[][]): string[];
export declare function mergeHiddenWordMaps(...maps: Array<Record<string, unknown> | null | undefined>): Record<string, string[]>;
export declare function buildActiveHiddenWordMap(rows?: Record<string, unknown>[]): Record<string, string[]>;
export declare function mergeActivityHistoryRows(...collections: Record<string, unknown>[][]): Record<string, unknown>[];
export declare function mergeWordProgressRows(...collections: ProgressRow[][]): ProgressRow[];
export declare function mergeLatestRows(
  collections: Record<string, unknown>[][],
  keyFor: (row: Record<string, unknown>) => string,
): Record<string, unknown>[];
export declare function preferredSettingsSource(
  account: Record<string, unknown> | null | undefined,
  guest: Record<string, unknown> | null | undefined,
): 'account' | 'guest' | 'none';
export declare function remoteSupersedes(
  local: Record<string, unknown>,
  remote: Record<string, unknown> | null | undefined,
): boolean;
export declare function claimableRows(
  localRows: Record<string, unknown>[],
  remoteRows: Record<string, unknown>[],
  keyFor: (row: Record<string, unknown>) => string,
): Record<string, unknown>[];
export declare function claimableFavoriteIds(
  localIds: unknown[],
  remoteRows: Record<string, unknown>[],
  idField: string,
): string[];
export declare function claimableHiddenWordMap(
  localMap: Record<string, unknown> | null | undefined,
  remoteRows: Record<string, unknown>[],
): Record<string, string[]>;
export declare function retryDelayMs(attempts: number): number;
export declare function entryRevision(entry: RetryableEntry): string;
export declare function nextReadyEntry<T extends RetryableEntry>(
  entries: T[],
  attemptedRevisions: ReadonlySet<string>,
  now?: number,
  force?: boolean,
): T | undefined;
