export type GuideStep = {
  id: string;
  titleKey: string;
  bodyKey: string;
  symbol?: string;
  params?: Readonly<Record<string, string | number>>;
};
export declare const GUIDE_STORY_SEQUENCE: readonly string[];
export declare const GENERAL_GUIDE_STEPS: readonly GuideStep[];
export declare const LEARNING_GUIDE_STEPS: readonly GuideStep[];
export declare const LEARNING_REPEAT_HINT: Readonly<GuideStep>;
export declare const GUIDE_MESSAGES: Readonly<Record<string, Readonly<Record<'ru' | 'en' | 'tr', string>>>>;
export declare function normalizeGuideLanguage(value: unknown): 'ru' | 'en' | 'tr';
export declare function stripGuideMarkup(value: unknown): string;
export declare function guideMessage(language: unknown, key: string, params?: Record<string, unknown>, options?: { plain?: boolean }): string;
