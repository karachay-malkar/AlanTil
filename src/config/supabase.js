export const supabaseUrl = "https://pybrzgedqjmosbmilcea.supabase.co";
export const supabasePublishableKey = "sb_publishable_11TY-fBEAogA9JKnAku3vg_hjRxTa_a";

export function getAuthRedirectUrl() {
  return new URL("/account", window.location.origin).toString();
}
