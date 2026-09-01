export type AuthQuerySource = URLSearchParams | Record<string, unknown> | null | undefined;

export type AuthCallback = {
  code: string;
  error: string;
  errorCode: string;
  flowId: string;
  present: boolean;
};

export declare const AUTH_CALLBACK_KEYS: readonly string[];
export declare const OAUTH_PROVIDERS: readonly ["google", "apple"];
export declare function readAuthCallback(source: AuthQuerySource): AuthCallback;
export declare function normalizeOAuthProvider(provider: unknown): "google" | "apple" | "";
export declare function sameAuthUser(left: any, right: any): boolean;
export declare function sameAuthSession(left: any, right: any): boolean;
export declare function sameAuthState(left: any, right: any): boolean;
export declare function authProviderCode(user: any): "google" | "apple" | "";
