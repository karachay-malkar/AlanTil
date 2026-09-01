export type ProgressRow = Record<string, unknown> & { word_id?: unknown };

export type RetryableEntry = {
  id: string;
  revision?: string;
  attempts?: number;
  next_attempt_at?: string;
};

export declare function normalizedId(value: unknown): string;
export declare function timestamp(value: unknown): number;
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
export declare function retryDelayMs(attempts: number): number;
export declare function entryRevision(entry: RetryableEntry): string;
export declare function nextReadyEntry<T extends RetryableEntry>(
  entries: T[],
  attemptedRevisions: ReadonlySet<string>,
  now?: number,
  force?: boolean,
): T | undefined;
