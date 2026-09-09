// Supabase Auth API codes: network errors and throttling must retain local state.
export function isTerminalRefreshError(error){
 return ['refresh_token_not_found','refresh_token_already_used','session_not_found','session_expired','user_not_found','user_banned'].includes(error?.code);
}
