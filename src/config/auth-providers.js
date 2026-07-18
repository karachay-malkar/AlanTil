export const AUTH_PROVIDERS = Object.freeze([
  Object.freeze({
    id: "google",
    enabled: true,
    labelKey: "account.voyti_cherez_google",
    icon: "/assets/icons/auth/google.svg",
    identityButton: false,
  }),
  Object.freeze({
    id: "apple",
    enabled: false,
    labelKey: "account.voyti_cherez_apple",
    icon: "/assets/icons/auth/apple.svg",
    identityButton: false,
  }),
]);

export function getEnabledAuthProviders() {
  return AUTH_PROVIDERS.filter((provider) => provider.enabled);
}
