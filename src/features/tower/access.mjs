/** Tower UI visibility. Supabase independently enforces access. */
export const TOWER_ACCESS_USER_ID='dfcf124e-735b-4caa-81d2-99eb5f02218d';
export function mayOpenTower(userId){return typeof userId==='string'&&userId===TOWER_ACCESS_USER_ID;}
