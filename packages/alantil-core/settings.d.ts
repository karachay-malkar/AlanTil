export type InterfaceLanguage = 'ru' | 'en' | 'tr';
export type AlanScript = 'cyrillic' | 'turkic';
export type AlanDialect = 'canonical' | 'karachay' | 'balkar';
export type TextSize = 'small' | 'medium' | 'large';
export type OnboardingStep = 'setup' | 'access' | 'guide' | 'done';
export type OnboardingAccessMode = 'guest' | 'account' | null;

export type UserSettings = {
  interface_language_code: InterfaceLanguage;
  translation_language_code: InterfaceLanguage;
  alan_script_code: AlanScript;
  alan_dialect_code: AlanDialect;
  text_size_code: TextSize;
  onboarding_step: OnboardingStep;
  onboarding_access_mode: OnboardingAccessMode;
  learning_setup_completed_at: string | null;
  updated_at: string | null;
};

export const INTERFACE_LANGUAGE_CODES: readonly InterfaceLanguage[];
export const ALAN_SCRIPT_CODES: readonly AlanScript[];
export const ALAN_DIALECT_CODES: readonly AlanDialect[];
export const TEXT_SIZE_CODES: readonly TextSize[];
export const ONBOARDING_STEPS: readonly OnboardingStep[];
export const ONBOARDING_ACCESS_MODES: readonly Exclude<OnboardingAccessMode, null>[];
export const DEFAULT_USER_SETTINGS: Readonly<UserSettings>;

export function normalizeLanguageCode(value: unknown, fallback?: string): string;
export function normalizeInterfaceLanguageCode(value: unknown): InterfaceLanguage;
export function normalizeTranslationLanguageCode(value: unknown, fallback?: InterfaceLanguage): InterfaceLanguage;
export function normalizeAlanScriptCode(value: unknown): AlanScript;
export function normalizeAlanDialectCode(value: unknown): AlanDialect;
export function normalizeTextSizeCode(value: unknown): TextSize;
export function normalizeTimestamp(value: unknown): string | null;
export function normalizeOnboardingStep(value: unknown, learningSetupCompletedAt?: unknown): OnboardingStep;
export function normalizeOnboardingAccessMode(value: unknown): OnboardingAccessMode;
export function normalizeUserSettings(raw?: Partial<UserSettings> | null): UserSettings;
export function settingsCloudPayload(settings: Partial<UserSettings>, userId?: string): {
  user_id: string;
  interface_language_code: InterfaceLanguage;
  translation_language_code: InterfaceLanguage;
  alan_script_code: AlanScript;
  alan_dialect_code: AlanDialect;
  text_size_code: TextSize;
  learning_setup_completed_at: string | null;
  updated_at: string | null;
};
export function completeLearningSetupSettings(settings: Partial<UserSettings>, completedAt?: string): UserSettings;
