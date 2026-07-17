export const supabaseUrl = "https://pybrzgedqjmosbmilcea.supabase.co";
export const supabasePublishableKey = "sb_publishable_11TY-fBEAogA9JKnAku3vg_hjRxTa_a";
export const googleClientIdEndpoint = `${supabaseUrl}/functions/v1/google-client-id`;

export function getAuthRedirectUrl() {
  return new URL("/auth/callback", window.location.origin).toString();
}
