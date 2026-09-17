import {formatRating} from '../../../packages/alantil-core/social.js';
import {socialMessage} from '../../../packages/alantil-core/social-i18n.js';
import {createAshykOnlineAdapter} from '../../../packages/ashyk-game/online.js';
import {getInterfaceLanguage} from '../../shared/i18n/index.js?v=13.15.12';
import {escapeHtml} from '../../shared/ui/html.js?v=13.9.0';
import {hasActivityAccess} from '../../shared/admin/admin-access.js?v=16.7.0';
import {setPendingAshykInvite} from '../../shared/social/ashyk-handoff.js';
import {acceptFriendRequest,blockUser,declineFriendRequest,fetchFriendsSnapshot,fetchSocialLeaderboard,getSocialClient,getSocialSession,removeFriend,searchSocialUsers,sendFriendRequest,unblockUser} from '../../shared/social/social-service.js';

let controller=null,refreshTimer=0,realtime=null,searchTimer=0;
const esc=(v)=>escapeHtml(String(v??''));
function t(key,params){return socialMessage(getInterfaceLanguage(),key,params);}

function iconButton(label,kind,data,svg){return `<button class="iconAction ${kind}" type="button" aria-label="${esc(label)}" title="${esc(label)}" ${Object.entries(data||{}).map(([k,v])=>`data-${k}="${esc(v)}"`).join(' ')}>${svg}</button>`;}
const ICON={
  add:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="4"/><path d="M2.5 20.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M18 8v6M15 11h6"/></svg>',
  accept:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6"/></svg>',
  decline:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  pending:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2.2"/></svg>',
  friend:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M7.5 12.5 10.3 15.5 16.5 9"/></svg>',
  remove:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="4"/><path d="M2.5 20.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M15 11h6"/></svg>',
  block:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/></svg>',
  unblock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>',
  search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
};
function genderIcon(gender){const cls=gender==='female'?'female':'male';return `<span class="genderIcon ${cls}" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4.2"/><path d="M6 20a6 6 0 0 1 12 0"/></svg></span>`;}
function medalIcon(rank){if(rank<1||rank>3)return '';return `<svg class="rankMedal medal${rank}" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h4l1 5-4.4 3.1L4 2h3Z"/><path d="M13 2h4l3 8.1L15.6 7 13 2Z"/><circle cx="12" cy="15" r="5.2"/></svg>`;}

function relationActions(user){
  if(user.relation==='accepted')return iconButton(t('friends'),'neutral disabled',{},ICON.friend);
  if(user.relation==='outgoing')return iconButton(t('requested'),'neutral disabled',{},ICON.pending);
  if(user.relation==='incoming')return user.friendship_id?`${iconButton(t('accept'),'primary',{'friend-accept':user.friendship_id},ICON.accept)}${iconButton(t('decline'),'ghost',{'friend-decline':user.friendship_id},ICON.decline)}`:'';
  return iconButton(t('add'),'primary',{'social-add':user.user_id},ICON.add);
}
function compactRow({rank=0,nickname,gender,rightValue='',secondary='',actions=''}){
  return `<div class="socialRow">${rank?`<span class="socialRank">${medalIcon(rank)||`#${rank}`}</span>`:''}<div class="socialRowBody"><div class="socialRowName">${genderIcon(gender)}<strong>${esc(nickname||'—')}</strong></div>${secondary?`<span class="socialRowMeta">${secondary}</span>`:''}</div>${rightValue?`<span class="socialRowValue">${rightValue}</span>`:''}<div class="socialRowActions">${actions}</div></div>`;
}
function section(title,body){return body?`<section class="socialSection"><h2>${esc(title)}</h2>${body}</section>`:'';}
function searchToggleHtml(){return `<button class="iconAction ghost socialSearchToggle" type="button" data-social-search-toggle aria-label="${esc(t('search'))}" title="${esc(t('search'))}">${ICON.search}</button>`;}
function searchFieldHtml(query=''){return `<div class="socialSearchField" data-social-search-field><input type="search" value="${esc(query)}" placeholder="${esc(t('searchPlaceholder'))}" data-social-search autocomplete="off"/></div>`;}

function guest(context){context.root.innerHTML=`<section class="view screen socialView"><div class="socialGuest"><h1>${esc(t('friends'))}</h1><p>${esc(t('signIn'))}</p><button class="btn actionPrimary" type="button" data-route="account.home">${esc(t('signInAction'))}</button></div></section>`;}
function shellHtml(showStats){return `<section class="view screen socialView"><header class="socialHeader"><h1>${esc(t('friends'))}</h1><div class="settingsSegments socialTabs" role="tablist"><button type="button" data-social-tab="rating" class="active">${esc(t('rating'))}</button><button type="button" data-social-tab="friends">${esc(t('friends'))}</button>${showStats?`<button type="button" data-social-tab="stats">${esc(t('extendedStats'))}</button>`:''}</div></header><div class="socialBody" data-social-body></div></section>`;}
function setBody(context,html){const body=context.root.querySelector('[data-social-body]');if(body)body.innerHTML=html;}

async function renderFriends(context){
  setBody(context,`<div class="screenState">${esc(t('loading'))}</div>`);
  const snapshot=await fetchFriendsSnapshot();
  let html='';
  if(snapshot.ashyk_invites.length)html+=section(t('invites'),snapshot.ashyk_invites.map((u)=>compactRow({nickname:u.nickname,gender:u.avatar_gender,actions:`${iconButton(t('accept'),'primary',{'ashyk-accept':u.invite_id},ICON.accept)}${iconButton(t('decline'),'ghost',{'ashyk-decline':u.invite_id},ICON.decline)}`})).join(''));
  if(snapshot.incoming.length)html+=section(t('requests'),snapshot.incoming.map((u)=>compactRow({nickname:u.nickname,gender:u.avatar_gender,actions:`${iconButton(t('accept'),'primary',{'friend-accept':u.friendship_id},ICON.accept)}${iconButton(t('decline'),'ghost',{'friend-decline':u.friendship_id},ICON.decline)}`})).join(''));
  html+=section(t('friends'),snapshot.friends.length?snapshot.friends.map((u)=>compactRow({nickname:u.nickname,gender:u.avatar_gender,secondary:esc(t('streak',{count:Number(u.streak_days)||0})),actions:`${iconButton(t('remove'),'ghost',{'friend-remove':u.user_id},ICON.remove)}${iconButton(t('block'),'ghost',{'friend-block':u.user_id},ICON.block)}`})).join(''):`<p class="socialEmpty">${esc(t('emptyFriends'))}</p>`);
  if(snapshot.blocked.length)html+=section(t('blocked'),snapshot.blocked.map((u)=>compactRow({nickname:u.nickname,gender:u.avatar_gender,actions:iconButton(t('unblock'),'ghost',{'friend-unblock':u.user_id},ICON.unblock)})).join(''));
  setBody(context,html);
}
function bindSearchInput(context){
  const input=context.root.querySelector('[data-social-search]');
  if(!input)return;
  const caret=input.value.length;
  input.focus();
  try{input.setSelectionRange(caret,caret);}catch{}
  input.addEventListener('input',()=>{
    const value=input.value;
    context.root.dataset.socialQuery=value;
    clearTimeout(searchTimer);
    searchTimer=setTimeout(()=>void renderRating(context,value),280);
  },{signal:controller.signal});
}
async function renderRating(context,query=''){
  const activeQuery=String(query||'').trim(),showField=context.root.dataset.socialSearchOpen==='true';
  setBody(context,`<div class="socialSearchBar">${searchToggleHtml()}${showField?searchFieldHtml(query):''}</div><div data-social-rating-body><div class="screenState">${esc(t('loading'))}</div></div>`);
  if(showField)bindSearchInput(context);
  const target=()=>context.root.querySelector('[data-social-rating-body]');
  if(activeQuery){
    const rows=await searchSocialUsers(activeQuery);
    if(target())target().innerHTML=section(t('rating'),rows.length?rows.map((u)=>compactRow({nickname:u.nickname,gender:u.avatar_gender,rightValue:esc(formatRating(u.rating_score)),actions:u.user_id===context.selfId?'':relationActions(u)})).join(''):`<p class="socialEmpty">${esc(t('emptySearch'))}</p>`);
    return;
  }
  const rows=await fetchSocialLeaderboard();
  if(target())target().innerHTML=section(t('rating'),rows.map((u,index)=>compactRow({rank:Number(u.rank)||index+1,nickname:u.nickname,gender:u.avatar_gender,rightValue:esc(formatRating(u.rating_score)),actions:u.user_id===context.selfId?'':relationActions(u)})).join(''));
}
async function renderStats(context){
  await context.router.navigate('admin.users');
}
async function mutate(context,fn,mode){try{await fn();await renderMode(context,mode);}catch(error){setBody(context,`<div class="errorState">${esc(error?.message||t('error'))}</div>`);}}
async function renderMode(context,mode){
  if(mode==='stats')return renderStats(context);
  context.root.querySelectorAll('[data-social-tab]').forEach((b)=>b.classList.toggle('active',b.dataset.socialTab===mode));
  context.root.dataset.socialMode=mode;
  if(mode==='rating')return renderRating(context,context.root.dataset.socialQuery||'');
  return renderFriends(context);
}
function bind(context){
  context.root.addEventListener('click',async(event)=>{
    const tab=event.target.closest('[data-social-tab]');
    if(tab){const mode=tab.dataset.socialTab;if(mode==='stats'){await renderStats(context);return;}context.root.dataset.socialSearchOpen='false';context.root.dataset.socialQuery='';await renderMode(context,mode);return;}
    const searchToggle=event.target.closest('[data-social-search-toggle]');
    if(searchToggle){
      const open=context.root.dataset.socialSearchOpen==='true';
      context.root.dataset.socialSearchOpen=String(!open);
      if(open)context.root.dataset.socialQuery='';
      await renderRating(context,context.root.dataset.socialQuery||'');
      return;
    }
    const node=event.target.closest('button');
    if(!node)return;
    const mode=context.root.dataset.socialMode||'rating';
    if(node.dataset.socialAdd)await mutate(context,()=>sendFriendRequest(node.dataset.socialAdd),mode);
    else if(node.dataset.friendAccept)await mutate(context,()=>acceptFriendRequest(node.dataset.friendAccept),mode);
    else if(node.dataset.friendDecline)await mutate(context,()=>declineFriendRequest(node.dataset.friendDecline),mode);
    else if(node.dataset.friendRemove)await mutate(context,()=>removeFriend(node.dataset.friendRemove),mode);
    else if(node.dataset.friendBlock)await mutate(context,()=>blockUser(node.dataset.friendBlock),mode);
    else if(node.dataset.friendUnblock)await mutate(context,()=>unblockUser(node.dataset.friendUnblock),mode);
    else if(node.dataset.ashykAccept){try{const client=await getSocialClient(),online=createAshykOnlineAdapter(client),result=await online.acceptInvite(node.dataset.ashykAccept);if(result?.room){setPendingAshykInvite(result);await context.router.navigate('practice.ashyk');}}catch(error){setBody(context,`<div class="errorState">${esc(error?.message||t('error'))}</div>`);}}
    else if(node.dataset.ashykDecline){const client=await getSocialClient(),online=createAshykOnlineAdapter(client);await mutate(context,()=>online.declineInvite(node.dataset.ashykDecline),mode);}
  },{signal:controller.signal});
}
export async function mount(context){
  controller=new AbortController();
  context.shell.setHeaderContent?.({title:'Alan Til!'});
  const session=await getSocialSession().catch(()=>null);
  if(!session?.user){guest(context);return;}
  context.selfId=session.user.id;
  context.root.innerHTML=shellHtml(hasActivityAccess());
  context.root.dataset.socialMode='rating';
  context.root.dataset.socialSearchOpen='false';
  context.root.dataset.socialQuery='';
  bind(context);
  await renderRating(context,'');
  const client=await getSocialClient();
  realtime=client.channel(`friends-view:${session.user.id}:${Date.now()}`).on('postgres_changes',{event:'*',schema:'public',table:'friendships'},()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>void renderMode(context,context.root.dataset.socialMode||'rating'),100);}).on('postgres_changes',{event:'*',schema:'public',table:'ashyk_invites'},()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>void renderMode(context,context.root.dataset.socialMode||'rating'),100);}).subscribe();
}
export function unmount(){controller?.abort();controller=null;clearTimeout(refreshTimer);refreshTimer=0;clearTimeout(searchTimer);searchTimer=0;if(realtime){try{realtime.unsubscribe();}catch{}realtime=null;}}
