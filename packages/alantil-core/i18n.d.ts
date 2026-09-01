export type InterfaceLanguage = 'ru' | 'en' | 'tr';
export type MessageCatalog = Record<string, Partial<Record<InterfaceLanguage, string>>>;

export const SUPPORTED_INTERFACE_LANGUAGES: readonly InterfaceLanguage[];
export const INTERFACE_LOCALES: Readonly<Record<InterfaceLanguage, string>>;
export function normalizeInterfaceLanguage(value: unknown): InterfaceLanguage;
export function interfaceLocale(language: unknown): string;
export function interpolateMessage(template: unknown, params?: Record<string, unknown>): string;
export function messageFromCatalog(catalog: MessageCatalog, language: unknown, key: string, params?: Record<string, unknown>, fallbackLanguage?: InterfaceLanguage): string;
export function hasCompleteCatalog(catalog: MessageCatalog, language: unknown): boolean;
