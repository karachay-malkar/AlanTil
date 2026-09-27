export const supabaseUrl = "https://pybrzgedqjmosbmilcea.supabase.co";
export const supabasePublishableKey = "sb_publishable_11TY-fBEAogA9JKnAku3vg_hjRxTa_a";

export function getAuthRedirectUrl(flow = "") {
  const url = new URL("/auth/callback", window.location.origin);
  const normalized = String(flow || "").trim();
  if (normalized) url.searchParams.set("auth_flow", normalized);
  return url.toString();
}
