export const EMPTY_SOCIAL_SNAPSHOT=Object.freeze({friends:[],incoming:[],outgoing:[],blocked:[],ashyk_invites:[],ashyk_sent:[]});
const rows=(value)=>Array.isArray(value)?value:[];
const score=(value)=>Number(Number(value||0).toFixed(2));
export function normalizeSocialUser(row={}){return{...row,user_id:String(row?.user_id||''),nickname:String(row?.nickname||''),avatar_gender:row?.avatar_gender==='female'?'female':'male',rating_score:score(row?.rating_score),relation:String(row?.relation||'none')};}
export function normalizeSocialSnapshot(value={}){return{
  friends:rows(value?.friends).map(normalizeSocialUser),
  incoming:rows(value?.incoming).map(normalizeSocialUser),
  outgoing:rows(value?.outgoing).map(normalizeSocialUser),
  blocked:rows(value?.blocked).map(normalizeSocialUser),
  ashyk_invites:rows(value?.ashyk_invites).map(normalizeSocialUser),
  ashyk_sent:rows(value?.ashyk_sent).map(normalizeSocialUser),
};}
export function normalizeLeaderboard(value=[]){return rows(value).map((row)=>({...normalizeSocialUser(row),rank:Math.max(1,Number(row?.rank)||1)}));}
export function normalizeInboxCounts(value={}){const friend_requests=Math.max(0,Number(value?.friend_requests)||0),ashyk_invites=Math.max(0,Number(value?.ashyk_invites)||0);return{friend_requests,ashyk_invites,total:Math.max(0,Number(value?.total)||friend_requests+ashyk_invites)};}
export function formatRating(value){const number=score(value);return Number.isInteger(number)?String(number):String(number).replace(/0+$/,'').replace(/\.$/,'');}
