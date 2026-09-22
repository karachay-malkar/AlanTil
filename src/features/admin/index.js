import { msg, getInterfaceLanguage, getInterfaceLocale } from "../../shared/i18n/index.js?v=13.15.10";
import { getUserSettings } from "../../shared/settings/user-settings-store.js?v=13.15.9";
import { escapeHtml } from "../../shared/ui/html.js?v=13.9.0";
import { renderSegmentedProgress } from "../../shared/ui/segmented-progress.js?v=13.9.0";
import { renderExpandableSearch } from "../../shared/ui/search-control.js?v=13.9.0";
import { renderBracketTabs } from "../../shared/ui/profile-navigation.js?v=16.7.0";
import { socialMessage } from "../../../packages/alantil-core/social-i18n.js?v=16.7.0.3";
import { getCurrentAuthState } from "../../shared/auth/auth-service.js?v=13.10.12";
import {
  blockUserAccount,
  fetchStationTestDetail,
  fetchGuestAnalytics,
  fetchUserActivityDetail,
  fetchUserActivityList,
  fetchUserFavorites,
  fetchUserTestHistory,
  unblockUserAccount,
} from "../../shared/admin/admin-activity-service.js?v=16.7.0.3";

const STORY_ORDER = Object.freeze(["understanding", "roots", "ascent", "pathways"]);
const STORY_KEYS = Object.freeze({
  understanding: "admin.story_understanding",
  roots: "admin.story_roots",
  ascent: "admin.story_ascent",
  pathways: "admin.story_pathways",
});

let controller = null;
let activeModalClose = null;
let usersSearchOpen = false;
let usersSearchQuery = "";
let embeddedStatsMode = "users";
let guestAnalyticsPeriod = 30;

function storyLabel(type) {
  return msg(STORY_KEYS[type] || "admin.user");
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function storyProgress(value = {}) {
  return {
    passed: Math.max(0, numberValue(value.passed)),
    total: Math.max(0, numberValue(value.total)),
  };
}

function localDayStamp(value) {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shiftDate(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatLastVisit(value) {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) return msg("admin.no_data");
  const now = new Date();
  const stamp = localDayStamp(date);
  if (stamp === localDayStamp(now)) return msg("admin.today");
  if (stamp === localDayStamp(shiftDate(now, -1))) return msg("admin.yesterday");
  return new Intl.DateTimeFormat(getInterfaceLocale(), { day: "2-digit", month: "2-digit", year: "2-digit" }).format(date);
}

function formatDateTime(value) {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) return msg("admin.no_data");
  return new Intl.DateTimeFormat(getInterfaceLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTestDate(value) {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) return msg("admin.no_data");
  return new Intl.DateTimeFormat(getInterfaceLocale(), { day: "2-digit", month: "2-digit" }).format(date);
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(numberValue(seconds)));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function formatAccuracy(value) {
  return `${Math.round(numberValue(value))}%`;
}

function stationCode(test = {}) {
  const story = Math.max(0, numberValue(test.story_number));
  const station = Math.max(0, numberValue(test.station_number));
  if (!story || !station) return msg("admin.no_data");
  return `${story}.${String(station).padStart(2, "0")}`;
}

function setNumber(test = {}) {
  const station = Math.max(0, numberValue(test.station_number));
  return station ? String(station) : msg("admin.no_data");
}

function currentAlanWord(row = {}, prefix = "") {
  const settings = getUserSettings();
  const key = settings.alan_script_code === "turkic"
    ? `${prefix}word_alan_turkic`
    : `${prefix}word_alan_cyrillic`;
  return String(row[key] || row[`${prefix}word_alan_cyrillic`] || row[`${prefix}word_alan_turkic`] || "");
}

function currentTranslation(row = {}, prefix = "") {
  const language = getInterfaceLanguage();
  return String(row[`${prefix}translation_${language}`] || row[`${prefix}translation_ru`] || row[`${prefix}translation_en`] || row[`${prefix}translation_tr`] || "");
}

function deniedError(error) {
  return /42501|activity access denied|permission denied/i.test(String(error?.code || "") + " " + String(error?.message || error || ""));
}

function failureMessage(error) {
  return deniedError(error) ? msg("admin.activity_access_denied") : msg("admin.data_unavailable");
}

function renderFailure(context, error) {
  context.root.innerHTML = `<section class="view screen adminStateView"><div class="adminStateMessage">${escapeHtml(failureMessage(error))}</div></section>`;
}

function blockToggleIcon(blocked) {
  if (blocked) return `<svg class="adminBlockIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 7.5-2"></path></svg>`;
  return `<svg class="adminBlockIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>`;
}
function medalIcon(rank) {
  if (rank < 1 || rank > 3) return "";
  return `<svg class="adminRankMedal" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M7 2h4l1 5-4.4 3.1L4 2h3Z"></path>
    <path d="M13 2h4l3 8.1L15.6 7 13 2Z"></path>
    <circle cx="12" cy="15" r="5.2"></circle>
    <circle class="adminRankMedalInner" cx="12" cy="15" r="2.7"></circle>
  </svg>`;
}

function usersTableRows(rows = []) {
  return rows.map((row, index) => {
    const rank = Math.max(1, Math.round(numberValue(row.rank) || index + 1));
    const stories = row.stories || {};
    const storyCells = STORY_ORDER.map((type) => {
      const value = storyProgress(stories[type]);
      return `<td class="adminTableNumber">${value.passed} / ${value.total}</td>`;
    }).join("");
    const rankClass = rank <= 3 ? ` adminRankRow adminRank${rank}` : "";
    return `<tr class="${rankClass.trim()}">
      <th class="adminUserStickyCell" scope="row">
        <div class="adminUserIdentity">
          <span class="adminRankLabel">№${rank}</span>
          ${medalIcon(rank)}
          <button class="adminUserLink" type="button" data-admin-user-id="${escapeHtml(row.user_id)}">${escapeHtml(row.nickname)}</button>
        </div>
      </th>
      <td>${escapeHtml(formatLastVisit(row.last_seen_at))}</td>
      <td class="adminTableNumber">${escapeHtml(msg("admin.days_short", { count: Math.max(0, numberValue(row.streak_days)) }))}</td>
      ${storyCells}
      <td class="adminTableNumber">${Math.max(0, numberValue(row.mastered_words))}</td>
    </tr>`;
  }).join("");
}

async function renderUsers(context, signal, { host = context.root, embedded = false } = {}) {
  const search = renderExpandableSearch({ idPrefix: "adminUsersSearch", open: usersSearchOpen, placeholder: msg("admin.users") });
  if (embedded) {
    host.innerHTML = `<div class="adminUsersToolbar">${search.toggle}</div>
      <div class="adminUsersScroll" role="region" aria-label="${escapeHtml(msg("admin.users"))}" tabindex="0">
        ${search.bar}
        <div class="loadingState">${msg("common.otkryvaem")}</div>
      </div>`;
  } else {
    context.shell.setHeaderContent?.({ title: msg("admin.users") });
    context.shell.setHeaderAction?.(search.toggle);
    host.innerHTML = `<section class="view screen adminUsersView">
      <div class="adminUsersScroll" role="region" aria-label="${escapeHtml(msg("admin.users"))}" tabindex="0">
        ${search.bar}
        <div class="loadingState">${msg("common.otkryvaem")}</div>
      </div>
    </section>`;
  }

  try {
    const rows = await fetchUserActivityList();
    if (signal.aborted) return;
    const scroll = host.querySelector(".adminUsersScroll");
    if (!scroll) return;
    const loading = scroll.querySelector(".loadingState");
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "adminUsersEmpty emptyState";
      empty.textContent = msg("admin.no_data");
      if (loading) loading.replaceWith(empty); else scroll.appendChild(empty);
      return;
    }
    loading?.remove();
    const table = document.createElement("table");
    table.className = "adminUsersTable";
    table.innerHTML = `<thead><tr>
        <th class="adminUserStickyCell adminUserStickyHead" scope="col">${msg("admin.user")}</th>
        <th scope="col">${msg("admin.last_visit")}</th>
        <th scope="col">${msg("admin.streak")}</th>
        ${STORY_ORDER.map((type) => `<th class="adminStoryHead" scope="col">${escapeHtml(storyLabel(type))}</th>`).join("")}
        <th scope="col">${msg("admin.mastered_words")}</th>
      </tr></thead>
      <tbody></tbody>`;
    scroll.appendChild(table);
    const tbody = table.querySelector("tbody");

    const bindRows = () => {
      tbody.querySelectorAll("[data-admin-user-id]").forEach((button) => {
        button.addEventListener("click", () => {
          context.router.navigate("admin.user", { userId: button.dataset.adminUserId });
        }, { signal });
      });
    };
    const draw = () => {
      const q = usersSearchQuery.trim().toLowerCase();
      const filtered = q ? rows.filter((row) => String(row.nickname || "").toLowerCase().includes(q)) : rows;
      tbody.innerHTML = usersTableRows(filtered);
      bindRows();
    };
    draw();

    const toggle = embedded ? host.querySelector("#adminUsersSearchToggle") : context.shell.headerActionSlot?.querySelector("#adminUsersSearchToggle");
    const bar = host.querySelector("#adminUsersSearchBar");
    const input = host.querySelector("#adminUsersSearchInput");
    if (input) input.value = usersSearchQuery;
    const setOpen = (open) => {
      usersSearchOpen = open;
      bar?.classList.toggle("hidden", !open);
      toggle?.classList.toggle("active", open);
      toggle?.setAttribute("aria-expanded", String(open));
      if (open) requestAnimationFrame(() => input?.focus());
      else { usersSearchQuery = ""; if (input) input.value = ""; draw(); }
    };
    toggle?.addEventListener("click", () => setOpen(!usersSearchOpen), { signal });
    input?.addEventListener("input", () => { usersSearchQuery = input.value; draw(); }, { signal });
  } catch (error) {
    if (signal.aborted) return;
    const scroll = host.querySelector(".adminUsersScroll");
    const loading = scroll?.querySelector(".loadingState");
    if (!scroll) {
      if (!embedded) return renderFailure(context, error);
      host.innerHTML = `<div class="adminUsersError emptyState">${escapeHtml(failureMessage(error))}</div>`;
      return;
    }
    const failure = document.createElement("div");
    failure.className = "adminUsersError emptyState";
    failure.textContent = failureMessage(error);
    if (loading) loading.replaceWith(failure); else scroll.replaceChildren(failure);
  }
}


function guestText(key,params={}) {
  return socialMessage(getInterfaceLanguage(),key,params);
}

function guestNumber(value) {
  return new Intl.NumberFormat(getInterfaceLocale()).format(Math.max(0,numberValue(value)));
}

function guestDateLabel(value) {
  const date=new Date(`${String(value||"")}T00:00:00Z`);
  if(!Number.isFinite(date.getTime()))return String(value||"");
  return new Intl.DateTimeFormat(getInterfaceLocale(),{day:"2-digit",month:"2-digit"}).format(date);
}

function guestBreakdown(title,rows=[]){
  const safe=Array.isArray(rows)?rows:[];
  return `<section class="adminGuestBreakdown"><h3>${escapeHtml(title)}</h3><div class="adminGuestRows">${safe.length?safe.map((row)=>`<div class="adminGuestRow"><span>${escapeHtml(row.label==="direct/unknown"?guestText("guestDirectUnknown"):row.label||"—")}</span><small>${escapeHtml(guestNumber(row.unique_visitors))} · ${escapeHtml(guestNumber(row.sessions))}</small></div>`).join(""):`<div class="adminGuestEmpty">${escapeHtml(msg("admin.no_data"))}</div>`}</div></section>`;
}

function guestChart(data){
  const rows=Array.isArray(data?.timeline)?data.timeline:[];
  if(!rows.length)return `<div class="adminGuestEmpty">${escapeHtml(msg("admin.no_data"))}</div>`;
  const width=720,height=220,left=38,right=12,top=18,bottom=34,innerW=width-left-right,innerH=height-top-bottom;
  const max=Math.max(1,...rows.flatMap((row)=>[numberValue(row.unique_visitors),numberValue(row.sessions)]));
  const point=(row,index,key)=>{const x=left+(rows.length===1?innerW/2:(index*innerW/(rows.length-1))),y=top+innerH-(numberValue(row[key])/max*innerH);return{x,y};};
  const points=(key)=>rows.map((row,index)=>{const p=point(row,index,key);return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;}).join(" ");
  const circles=(key,klass)=>rows.map((row,index)=>{const p=point(row,index,key),title=`${guestDateLabel(row.date)} · ${guestText(key==="unique_visitors"?"guestUniqueVisitors":"guestSessions")}: ${guestNumber(row[key])}`;return `<circle class="${klass}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" tabindex="0"><title>${escapeHtml(title)}</title></circle>`;}).join("");
  const labels=[rows[0],rows[Math.floor((rows.length-1)/2)],rows[rows.length-1]].filter((row,index,list)=>row&&list.indexOf(row)===index);
  return `<div class="adminGuestChart">
    <div class="adminGuestLegend"><span class="unique">${escapeHtml(guestText("guestUniqueVisitors"))}</span><span class="sessions">${escapeHtml(guestText("guestSessions"))}</span></div>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(guestText("statsGuests"))}">
      <line class="grid" x1="${left}" y1="${top+innerH}" x2="${width-right}" y2="${top+innerH}"/>
      <line class="grid" x1="${left}" y1="${top+innerH/2}" x2="${width-right}" y2="${top+innerH/2}"/>
      <line class="grid" x1="${left}" y1="${top}" x2="${width-right}" y2="${top}"/>
      <text class="axis" x="4" y="${top+4}">${max}</text><text class="axis" x="4" y="${top+innerH+4}">0</text>
      <polyline class="line unique" points="${points("unique_visitors")}"/><polyline class="line sessions" points="${points("sessions")}"/>
      ${circles("unique_visitors","point unique")}${circles("sessions","point sessions")}
      ${labels.map((row)=>{const index=rows.indexOf(row),p=point(row,index,"sessions");return `<text class="axis date" x="${p.x.toFixed(1)}" y="${height-8}" text-anchor="middle">${escapeHtml(guestDateLabel(row.date))}</text>`;}).join("")}
    </svg>
  </div>`;
}

async function renderGuestAnalytics(context,signal,host){
  if(!host||signal?.aborted)return;
  host.classList.add("isGuest");
  host.innerHTML=`<div class="adminGuestLoading loadingState">${escapeHtml(msg("common.otkryvaem"))}</div>`;
  try{
    const data=await fetchGuestAnalytics(guestAnalyticsPeriod);
    if(signal?.aborted||!host.isConnected)return;
    const summary=data?.summary||{},conversion=data?.conversion||{},rate=conversion.rate==null?"—":`${numberValue(conversion.rate).toFixed(1)}%`;
    const periods=renderBracketTabs({
      items:[
        {id:"7",value:"7",label:guestText("guestPeriod7")},
        {id:"30",value:"30",label:guestText("guestPeriod30")},
        {id:"90",value:"90",label:guestText("guestPeriod90")},
        {id:"0",value:"0",label:guestText("guestPeriodAll")},
      ],
      active:String(guestAnalyticsPeriod),
      ariaLabel:guestText("statsGuests"),
      dataAttribute:"admin-guest-period",
    });
    host.innerHTML=`<div class="adminGuestScroll">
      <div class="adminGuestPeriodTabs">${periods}</div>
      <div class="adminGuestMetrics">
        <div><strong>${guestNumber(summary.unique_visitors)}</strong><span>${escapeHtml(guestText("guestUniqueVisitors"))}</span></div>
        <div><strong>${guestNumber(summary.sessions)}</strong><span>${escapeHtml(guestText("guestSessions"))}</span></div>
        <div><strong>${guestNumber(summary.pageviews)}</strong><span>${escapeHtml(guestText("guestPageviews"))}</span></div>
        <div><strong>${numberValue(summary.avg_pages_per_session).toFixed(2)}</strong><span>${escapeHtml(guestText("guestAvgPages"))}</span></div>
        <div><strong>${guestNumber(summary.repeat_visitors)}</strong><span>${escapeHtml(guestText("guestRepeatVisitors"))}</span></div>
        <div><strong>${guestNumber(conversion.converted_visitors)}</strong><span>${escapeHtml(guestText("guestConverted"))} · ${escapeHtml(rate)}</span></div>
      </div>
      ${guestChart(data)}
      <div class="adminGuestSecondaryMetrics">
        <span>${escapeHtml(guestText("guestNewVisitors"))}: <strong>${guestNumber(summary.new_visitors)}</strong></span>
        <span>${escapeHtml(guestText("guestReturningVisitors"))}: <strong>${guestNumber(summary.returning_visitors)}</strong></span>
        <span>${escapeHtml(guestText("guestConversion"))}: <strong>${escapeHtml(rate)}</strong></span>
      </div>
      <div class="adminGuestBreakdownGrid">
        ${guestBreakdown(guestText("guestSources"),data?.sources)}
        ${guestBreakdown(guestText("guestPlatforms"),data?.platforms)}
        ${guestBreakdown(guestText("guestEntryPaths"),data?.entry_paths)}
        ${guestBreakdown(guestText("guestVersions"),data?.versions)}
        ${guestBreakdown(guestText("guestLanguages"),data?.languages)}
      </div>
      <p class="adminGuestLegacyNote">${escapeHtml(guestText("guestLegacyNote"))}</p>
    </div>`;
    host.querySelectorAll("[data-admin-guest-period]").forEach((button)=>button.addEventListener("click",()=>{
      const value=Number(button.dataset.adminGuestPeriod);
      guestAnalyticsPeriod=Number.isFinite(value)?value:30;
      void renderGuestAnalytics(context,signal,host);
    },{signal}));
  }catch(error){
    if(!signal?.aborted)host.innerHTML=`<div class="adminUsersError emptyState">${escapeHtml(failureMessage(error))}</div>`;
  }
}

export async function renderAdminUsersEmbedded(context, signal, host) {
  if (!host || signal?.aborted) return;
  const tabs=renderBracketTabs({
    items:[
      {id:"users",label:guestText("statsUsers")},
      {id:"guests",label:guestText("statsGuests")},
    ],
    active:embeddedStatsMode,
    ariaLabel:guestText("extendedStats"),
    dataAttribute:"admin-stats-mode",
  });
  host.innerHTML=`<div class="adminStatsModeTabs">${tabs}</div><div class="adminStatsPane" data-admin-stats-pane></div>`;
  host.querySelectorAll("[data-admin-stats-mode]").forEach((button)=>button.addEventListener("click",()=>{
    embeddedStatsMode=button.dataset.adminStatsMode==="guests"?"guests":"users";
    void renderAdminUsersEmbedded(context,signal,host);
  },{signal}));
  const pane=host.querySelector("[data-admin-stats-pane]");
  if(embeddedStatsMode==="guests")return renderGuestAnalytics(context,signal,pane);
  return renderUsers(context,signal,{host:pane,embedded:true});
}

function storyProgressSection(stories = []) {
  const byType = new Map((Array.isArray(stories) ? stories : []).map((row) => [row.story_type, row]));
  return `<section class="adminDetailSection">
    <h2>${msg("admin.profile_progress")}</h2>
    <div class="adminStoryRows">
      ${STORY_ORDER.map((type) => {
        const progress = storyProgress(byType.get(type));
        const percent = progress.total ? Math.round((progress.passed / progress.total) * 100) : 0;
        return `<div class="adminStoryRow">
          <div class="adminStoryRowHead"><strong>${escapeHtml(storyLabel(type))}</strong><span>${progress.passed} / ${progress.total}</span></div>
          ${renderSegmentedProgress({ value: percent, segments: 10, label: `${storyLabel(type)} ${progress.passed}/${progress.total}`, className: "adminStoryProgress" })}
        </div>`;
      }).join("")}
    </div>
  </section>`;
}

function testHistory(tests = []) {
  if (!tests.length) return `<div class="adminEmpty">${msg("admin.no_tests")}</div>`;
  return `<div class="adminTestRows">${tests.map((test) => `<button class="adminTestRow" type="button" data-admin-test-id="${escapeHtml(test.session_id)}">
    <span class="adminTestDate">${escapeHtml(formatTestDate(test.ended_at || test.started_at))}</span>
    <span class="adminTestStory">${escapeHtml(storyLabel(test.story_type))}</span>
    <strong class="adminTestSet">${escapeHtml(setNumber(test))}</strong>
    <span class="adminTestResult">${escapeHtml(formatAccuracy(test.accuracy))}</span>
  </button>`).join("")}</div>`;
}

function wordTiles(rows = []) {
  if (!rows.length) return `<div class="adminEmpty">${msg("admin.no_favorites")}</div>`;
  return `<div class="adminWordTiles">${rows.map((row) => `<div class="adminWordTile"><strong>${escapeHtml(currentAlanWord(row))}</strong></div>`).join("")}</div>`;
}

function problemWords(rows = []) {
  if (!rows.length) return `<div class="adminEmpty">${msg("admin.no_problem_words")}</div>`;
  return `<div class="adminProblemRows">${rows.map((row) => `<div class="adminProblemRow">
    <strong>${escapeHtml(currentAlanWord(row))}</strong>
    <small class="adminProblemCounts">${escapeHtml(msg("admin.test_errors_short", { count: Math.max(0, numberValue(row.test_wrong_count)) }))}<br>${escapeHtml(msg("admin.unknown_short", { count: Math.max(0, numberValue(row.unknown_count)) }))}</small>
  </div>`).join("")}</div>`;
}

function bindTestLinks(scope, context, userId, signal, { closeModal = false } = {}) {
  scope?.querySelectorAll("[data-admin-test-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (closeModal) context.modal.close();
      context.router.navigate("admin.test", {
        userId,
        sessionId: button.dataset.adminTestId,
      });
    }, { signal });
  });
}

async function openHistoryModal(context, signal, userId) {
  activeModalClose?.();
  const panel = context.modal.openContent({
    title: escapeHtml(msg("admin.station_tests")),
    className: "adminActivityModal adminHistoryModal",
    contentHtml: `<div class="adminModalState">${msg("common.otkryvaem")}</div>`,
  });
  const closeCurrent = () => {
    if (panel.element?.isConnected) panel.close();
    if (activeModalClose === closeCurrent) activeModalClose = null;
  };
  activeModalClose = closeCurrent;
  try {
    const rows = await fetchUserTestHistory(userId);
    if (signal.aborted || !panel.body?.isConnected) return;
    panel.body.innerHTML = testHistory(rows);
    bindTestLinks(panel.body, context, userId, signal, { closeModal: true });
  } catch (error) {
    if (!signal.aborted && panel.body?.isConnected) {
      panel.body.innerHTML = `<div class="adminModalState">${escapeHtml(failureMessage(error))}</div>`;
    }
  }
}

async function openFavoritesModal(context, signal, userId) {
  activeModalClose?.();
  const panel = context.modal.openContent({
    title: escapeHtml(msg("admin.favorite_words")),
    className: "adminActivityModal adminFavoritesModal",
    contentHtml: `<div class="adminModalState">${msg("common.otkryvaem")}</div>`,
  });
  const closeCurrent = () => {
    if (panel.element?.isConnected) panel.close();
    if (activeModalClose === closeCurrent) activeModalClose = null;
  };
  activeModalClose = closeCurrent;
  try {
    const rows = await fetchUserFavorites(userId);
    if (signal.aborted || !panel.body?.isConnected) return;
    panel.body.innerHTML = wordTiles(rows);
  } catch (error) {
    if (!signal.aborted && panel.body?.isConnected) {
      panel.body.innerHTML = `<div class="adminModalState">${escapeHtml(failureMessage(error))}</div>`;
    }
  }
}

async function renderUserDetail(context, signal, userId) {
  context.shell.setHeaderContent?.({ title: msg("admin.user") });
  context.root.innerHTML = `<section class="view screen adminDetailView"><div class="adminDetailScroll"><div class="loadingState">${msg("common.otkryvaem")}</div></div></section>`;
  try {
    const detail = await fetchUserActivityDetail(userId);
    if (signal.aborted) return;
    if (!detail) throw new Error("User not found");
    context.shell.setHeaderContent?.({ title: detail.nickname || msg("admin.user") });
    const scroll = context.root.querySelector(".adminDetailScroll");
    if (!scroll) return;
    const tests = Array.isArray(detail.tests) ? detail.tests : [];
    const favorites = Array.isArray(detail.favorites) ? detail.favorites : [];
    const actorId = String(getCurrentAuthState()?.user?.id || "");
    const isSelf = actorId && actorId === String(detail.user_id || "");
    const blocked = detail.account_blocked === true;
    scroll.innerHTML = `<div class="adminDetailContent">
      ${isSelf ? "" : `<div class="adminBlockBar">
        ${blocked ? `<span class="adminBlockedTag">${escapeHtml(msg("admin.account_blocked_status"))}</span>` : ""}
        <button class="adminBlockButton ${blocked ? "isBlocked" : ""}" type="button" data-admin-block-toggle title="${escapeHtml(msg(blocked ? "admin.unblock_account" : "admin.block_account"))}" aria-label="${escapeHtml(msg(blocked ? "admin.unblock_account" : "admin.block_account"))}">${blockToggleIcon(blocked)}</button>
      </div>`}
      <section class="adminSummaryGrid">
        <div><span>${msg("admin.last_visit")}</span><strong>${escapeHtml(formatLastVisit(detail.last_seen_at))}</strong></div>
        <div><span>${msg("admin.streak")}</span><strong>${escapeHtml(msg("admin.days_short", { count: Math.max(0, numberValue(detail.streak_days)) }))}</strong></div>
        <div><span>${msg("admin.mastered_words")}</span><strong>${Math.max(0, numberValue(detail.mastered_words))}</strong></div>
        <div><span>${msg("admin.favorite_words")}</span><strong>${Math.max(0, numberValue(detail.favorite_words))}</strong></div>
      </section>
      ${storyProgressSection(detail.stories)}
      <section class="adminDetailSection">
        <div class="adminSectionHead">
          <h2>${msg("admin.station_tests")}</h2>
          ${Math.max(0, numberValue(detail.test_sessions)) ? `<button class="adminInlineAction" type="button" data-admin-tests-all>${msg("admin.all_history")}</button>` : ""}
        </div>
        ${testHistory(tests)}
      </section>
      <section class="adminDetailSection">
        <div class="adminSectionHead">
          <h2>${msg("admin.favorite_words")}</h2>
          ${Math.max(0, numberValue(detail.favorite_words)) ? `<button class="adminInlineAction" type="button" data-admin-favorites-all>${msg("admin.all_words")}</button>` : ""}
        </div>
        ${wordTiles(favorites)}
      </section>
      <section class="adminDetailSection">
        <h2>${msg("admin.problem_words")}</h2>
        ${problemWords(Array.isArray(detail.problem_words) ? detail.problem_words : [])}
      </section>
    </div>`;

    bindTestLinks(scroll, context, userId, signal);
    scroll.querySelector("[data-admin-block-toggle]")?.addEventListener("click", async () => {
      const confirmed = await context.modal.confirm({
        message: msg(blocked ? "admin.unblock_account_confirm" : "admin.block_account_confirm", { nickname: detail.nickname || msg("admin.user") }),
        confirmText: msg(blocked ? "admin.unblock_account" : "admin.block_account"),
      });
      if (!confirmed || signal.aborted) return;
      try {
        if (blocked) await unblockUserAccount(userId); else await blockUserAccount(userId);
        if (!signal.aborted) await renderUserDetail(context, signal, userId);
      } catch (error) {
        if (!signal.aborted) scroll.insertAdjacentHTML("afterbegin", `<div class="errorState">${escapeHtml(error?.message || msg("admin.block_account_failed"))}</div>`);
      }
    }, { signal });
    scroll.querySelector("[data-admin-tests-all]")?.addEventListener("click", () => {
      void openHistoryModal(context, signal, userId);
    }, { signal });
    scroll.querySelector("[data-admin-favorites-all]")?.addEventListener("click", () => {
      void openFavoritesModal(context, signal, userId);
    }, { signal });
  } catch (error) {
    if (!signal.aborted) renderFailure(context, error);
  }
}

function resultWordRows(words = []) {
  return words.map((row) => {
    const correct = String(row.result || "").toLowerCase() === "correct";
    const selectedWord = currentAlanWord(row, "wrong_");
    const selectedTranslation = currentTranslation(row, "wrong_");
    return `<div class="adminResultWord ${correct ? "isCorrect" : "isWrong"}">
      <div class="adminResultWordMain"><strong>${escapeHtml(currentAlanWord(row))}</strong><span>${escapeHtml(currentTranslation(row))}</span></div>
      <div class="adminResultWordStatus"><strong>${correct ? msg("admin.correct") : msg("admin.wrong")}</strong>${!correct && selectedWord ? `<small>${msg("admin.selected")}: ${escapeHtml(selectedWord)}${selectedTranslation ? ` — ${escapeHtml(selectedTranslation)}` : ""}</small>` : ""}</div>
    </div>`;
  }).join("");
}

async function renderTestDetail(context, signal, sessionId) {
  context.shell.setHeaderContent?.({ title: msg("admin.test_result") });
  context.root.innerHTML = `<section class="view screen adminTestDetailView"><div class="adminDetailScroll"><div class="loadingState">${msg("common.otkryvaem")}</div></div></section>`;
  try {
    const detail = await fetchStationTestDetail(sessionId);
    if (signal.aborted) return;
    if (!detail) throw new Error("Test not found");
    const scroll = context.root.querySelector(".adminDetailScroll");
    if (!scroll) return;
    const words = Array.isArray(detail.words) ? detail.words : [];
    scroll.innerHTML = `<div class="adminDetailContent">
      <header class="adminTestTitle"><span>${escapeHtml(detail.nickname || "")}</span><h1>${escapeHtml(storyLabel(detail.story_type))} · ${escapeHtml(stationCode(detail))}</h1></header>
      <dl class="adminTestFacts">
        <div><dt>${msg("admin.date")}</dt><dd>${escapeHtml(formatDateTime(detail.ended_at || detail.started_at))}</dd></div>
        <div><dt>${msg("admin.duration")}</dt><dd>${escapeHtml(formatDuration(detail.active_duration_sec || detail.duration_sec))}</dd></div>
        <div><dt>${msg("admin.questions")}</dt><dd>${Math.max(0, numberValue(detail.questions_total))}</dd></div>
        <div><dt>${msg("admin.correct_answers")}</dt><dd>${Math.max(0, numberValue(detail.correct_total))}</dd></div>
        <div><dt>${msg("admin.wrong_answers")}</dt><dd>${Math.max(0, numberValue(detail.wrong_total))}</dd></div>
        <div><dt>${msg("admin.accuracy")}</dt><dd>${escapeHtml(formatAccuracy(detail.accuracy))}</dd></div>
      </dl>
      <section class="adminDetailSection"><h2>${msg("admin.words")}</h2><div class="adminResultWords">${resultWordRows(words)}</div></section>
    </div>`;
  } catch (error) {
    if (!signal.aborted) renderFailure(context, error);
  }
}

export async function mount(context, params = {}) {
  controller = new AbortController();
  const signal = controller.signal;
  const screen = params.screen || "users";
  if (screen === "users") return context.router.replace("friends.home", { mode: "stats" }, { force: true });
  if (screen === "user") return renderUserDetail(context, signal, params.userId);
  if (screen === "test") return renderTestDetail(context, signal, params.sessionId);
  return context.router.replace("friends.home", { mode: "stats" }, { force: true });
}

export function unmount() {
  activeModalClose?.();
  activeModalClose = null;
  controller?.abort();
  controller = null;
}
