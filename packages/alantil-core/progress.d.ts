export type CanonicalProgressStatus = 'not_started' | 'learning' | 'review' | 'mastered';

export type CoreStationDescriptor = {
  storyType?: string;
  storyId?: string;
  dictionaryId?: string;
  dictionary_id?: string;
  catalogId?: string;
  sectionId?: string;
  section_id?: string;
  groupId?: string;
  group_id?: string;
  setId?: string;
  set_id?: string;
};

export type CoreStationProgress = {
  dictionary_id: string;
  catalog_id: string;
  group_id: string;
  set_id: string;
  story_type: string;
  status: string;
  current_phase: string;
  study_sessions_total: number;
  test_attempts_total: number;
  best_accuracy: number;
  first_test_completed_at: string | null;
  review_1_due_at: string | null;
  review_1_completed_at: string | null;
  review_2_due_at: string | null;
  review_2_completed_at: string | null;
  mastered_at: string | null;
  updated_at: string;
  [key: string]: unknown;
};

export const CANONICAL_PROGRESS_STATUSES: readonly CanonicalProgressStatus[];
export function progressTime(value: unknown): number;
export function effectiveStationStatus(row: Partial<CoreStationProgress> | null | undefined, now?: number): string;
export function canonicalStationStatus(row: Partial<CoreStationProgress> | null | undefined, now?: number): CanonicalProgressStatus;
export function createStationProgressRow(station?: CoreStationDescriptor | null, now?: string): CoreStationProgress;
export function normalizeStationLifecycle(row?: Partial<CoreStationProgress>, fallback?: CoreStationDescriptor, now?: number): CoreStationProgress;
export function markStationStartedProgress(current: Partial<CoreStationProgress>, updatedAt?: string): CoreStationProgress;
export function markStationCardsCompletedProgress(current: Partial<CoreStationProgress>, updatedAt?: string): CoreStationProgress;
export function stationTestPhaseFromProgress(current?: Partial<CoreStationProgress> | null, now?: number): 'first_test' | 'review_1' | 'review_2' | 'practice';
export function recordStationTestProgress(current: Partial<CoreStationProgress>, options?: {
  accuracy?: number;
  passed?: boolean;
  phase?: string;
  completedAt?: string;
  review1DelayDays?: number;
  review2DelayDays?: number;
}): CoreStationProgress;
export function summarizeWordProgress<T extends { id?: unknown; word_id?: unknown }>(words: T[], progressById: Map<string, unknown> | Record<string, unknown>): {
  total: number;
  mastered: number;
  review: number;
  percent: number;
};
