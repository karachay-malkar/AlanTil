export declare const EVENTS: Readonly<Record<string, string>>;
export declare const ACTIVITY_TYPES: Readonly<Record<string, string>>;
export declare const DIRECTIONS: Readonly<Record<string, string>>;
export declare const CANCEL_REASONS: Readonly<Record<string, string>>;
export declare const WORD_SOURCES: Readonly<Record<string, string>>;
export declare const WORD_RESULTS: Readonly<Record<string, string>>;
export declare const SEARCH_AREAS: Readonly<Record<string, string>>;
export declare const SEARCH_MODES: Readonly<Record<string, string>>;
export declare const FORBIDDEN_ANALYTICS_PARAMETER_NAMES: readonly string[];
export declare function directionFromMode(mode: unknown): string;
export declare function sanitizeAnalyticsParameters(
  parameters?: Record<string, unknown>,
  options?: { maxEntries?: number; keyMaxLength?: number; stringMaxLength?: number; normalizeKeys?: boolean },
): Record<string, string | number | boolean>;
