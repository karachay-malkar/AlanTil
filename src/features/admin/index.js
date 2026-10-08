import { msg, getInterfaceLanguage, getInterfaceLocale } from "../../shared/i18n/index.js?v=16.8.0.3";
import { getUserSettings } from "../../shared/settings/user-settings-store.js?v=16.8.0.3";
import { escapeHtml } from "../../shared/ui/html.js?v=16.8.0.3";
import { renderSegmentedProgress } from "../../shared/ui/segmented-progress.js?v=16.8.0.3";
import { renderExpandableSearch } from "../../shared/ui/search-control.js?v=16.8.0.3";
import { renderBracketTabs } from "../../shared/ui/profile-navigation.js?v=16.8.0.3";
import { socialMessage } from "../../../packages/alantil-core/social-i18n.js?v=16.8.0.3";
import { getCurrentAuthState } from "../../shared/auth/auth-service.js?v=16.8.0.3";
import {
  blockUserAccount,
  fetchStationTestDetail,
  fetchExtendedAnalytics,
  fetchUserActivityDetail,
  fetchUserActivityList,
  fetchUserFavorites,
  fetchUserTestHistory,
  unblockUserAccount,
} from "../../shared/admin/admin-activity-service.js?v=16.8.0.3";

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
let guestAnalyticsPeriod = 30;
let usageAnalyticsMonth = "";

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
  return new Intl.DateTimeFormat(getInterfaceLocale(),{day:"2-digit",month:"2-digit",timeZone:"UTC"}).format(date);
}

function guestFullDateLabel(value) {
  const date=new Date(`${String(value||"")}T00:00:00Z`);
  if(!Number.isFinite(date.getTime()))return String(value||"");
  return new Intl.DateTimeFormat(getInterfaceLocale(),{day:"numeric",month:"long",timeZone:"UTC"}).format(date);
}

function guestMonthLabel(value) {
  const date=new Date(`${String(value||"")}-01T00:00:00Z`);
  if(!Number.isFinite(date.getTime()))return String(value||"");
  return new Intl.DateTimeFormat(getInterfaceLocale(),{month:"short",year:"2-digit"}).format(date);
}

function analyticsChart(rows=[],series=[],{
  title="",
  xKey="date",
  formatLabel=(value)=>String(value||""),
  formatTooltip=null,
  className="",
}={}) {
  const safe=Array.isArray(rows)?rows:[];
  if(!safe.length)return `<div class="adminGuestEmpty">${escapeHtml(msg("admin.no_data"))}</div>`;
  const width=720,height=230,left=38,right=12,top=20,bottom=38,innerW=width-left-right,innerH=height-top-bottom;
  const max=Math.max(1,...safe.flatMap((row)=>series.map((item)=>numberValue(row[item.key]))));
  const point=(row,index,key)=>{
    const x=left+(safe.length===1?innerW/2:(index*innerW/(safe.length-1)));
    const y=top+innerH-(numberValue(row[key])/max*innerH);
    return{x,y};
  };
  const points=(key)=>safe.map((row,index)=>{
    const p=point(row,index,key);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ");
  const circles=(item,seriesIndex)=>safe.map((row,index)=>{
    const p=point(row,index,item.key);
    const label=formatLabel(row[xKey]);
    const tooltip=typeof formatTooltip==="function"
      ? formatTooltip(row,item)
      : `${label} · ${item.label}: ${guestNumber(row[item.key])}`;
    return `<circle class="point s${seriesIndex}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" tabindex="0" role="button" aria-label="${escapeHtml(tooltip)}" data-analytics-point data-tooltip="${escapeHtml(tooltip)}"><title>${escapeHtml(tooltip)}</title></circle>`;
  }).join("");
  const labelRows=[safe[0],safe[Math.floor((safe.length-1)/2)],safe[safe.length-1]]
    .filter((row,index,list)=>row&&list.indexOf(row)===index);
  return `<div class="adminGuestChart ${escapeHtml(className)}">
    <div class="adminGuestLegend">${series.map((item,index)=>`<span class="s${index}"><i></i>${escapeHtml(item.label)}</span>`).join("")}</div>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">
      <line class="grid" x1="${left}" y1="${top+innerH}" x2="${width-right}" y2="${top+innerH}"/>
      <line class="grid" x1="${left}" y1="${top+innerH/2}" x2="${width-right}" y2="${top+innerH/2}"/>
      <line class="grid" x1="${left}" y1="${top}" x2="${width-right}" y2="${top}"/>
      <text class="axis" x="4" y="${top+4}">${guestNumber(max)}</text>
      <text class="axis" x="4" y="${top+innerH+4}">0</text>
      ${series.map((item,index)=>`<polyline class="line s${index}" points="${points(item.key)}"/>`).join("")}
      ${series.map((item,index)=>circles(item,index)).join("")}
      ${labelRows.map((row)=>{
        const index=safe.indexOf(row),p=point(row,index,series[0].key);
        return `<text class="axis date" x="${p.x.toFixed(1)}" y="${height-8}" text-anchor="middle">${escapeHtml(formatLabel(row[xKey]))}</text>`;
      }).join("")}
    </svg>
    <div class="adminAnalyticsPointTooltip" data-analytics-tooltip aria-live="polite"></div>
  </div>`;
}

function bindAnalyticsPointTooltips(host,signal) {
  host?.querySelectorAll("[data-analytics-point]").forEach((point)=>{
    const show=()=>{
      const chart=point.closest(".adminGuestChart");
      const tooltip=chart?.querySelector("[data-analytics-tooltip]");
      if(!tooltip)return;
      tooltip.textContent=String(point.dataset.tooltip||"");
      tooltip.classList.toggle("isVisible",Boolean(tooltip.textContent));
    };
    point.addEventListener("click",show,{signal});
    point.addEventListener("focus",show,{signal});
  });
}

function dailyVisitorsChart(data) {
  return analyticsChart(data?.daily_visitors,[
    {key:"authorized",label:guestText("statsAuthorized")},
    {key:"guests",label:guestText("statsGuests")},
  ],{
    title:guestText("visitorDailyTitle"),
    xKey:"date",
    formatLabel:guestDateLabel,
    formatTooltip:(row,item)=>`${guestFullDateLabel(row.date)} · ${item.label}: ${guestNumber(row[item.key])}`,
    className:"adminDailyVisitorsChart",
  });
}

function monthlyAudienceRows(data,audience) {
  const rows=Array.isArray(data?.monthly_visitors)?data.monthly_visitors:[];
  return rows.map((row)=>({month:row.month,...(row?.[audience]||{})}));
}

function monthlyVisitorsChart(data,audience) {
  return analyticsChart(monthlyAudienceRows(data,audience),[
    {key:"d1",label:guestText("visitorDay1")},
    {key:"d3",label:guestText("visitorDay3")},
    {key:"d7",label:guestText("visitorDay7")},
    {key:"d14",label:guestText("visitorDay14")},
    {key:"d28",label:guestText("visitorDay28")},
  ],{
    title:`${guestText("visitorMonthlyTitle")} · ${guestText(audience==="authorized"?"statsAuthorized":"statsGuests")}`,
    xKey:"month",
    formatLabel:guestMonthLabel,
    className:"adminMonthlyVisitorsChart",
  });
}

function monthlyVisitorsCharts(data) {
  return `<div class="adminAudienceCharts">
    <div class="adminAudienceChart"><h3>${escapeHtml(guestText("statsAuthorized"))}</h3>${monthlyVisitorsChart(data,"authorized")}</div>
    <div class="adminAudienceChart"><h3>${escapeHtml(guestText("statsGuests"))}</h3>${monthlyVisitorsChart(data,"guests")}</div>
  </div>`;
}

function audienceSummary(data) {
  const summary=data?.summary||{};
  return `<div class="adminAudienceSummary">
    <div><span>${escapeHtml(guestText("statsAuthorized"))}</span><strong>${guestNumber(summary.authorized)}</strong></div>
    <div><span>${escapeHtml(guestText("statsGuests"))}</span><strong>${guestNumber(summary.guests)}</strong></div>
  </div>`;
}

function usageMetricRow(label,metric,actionLabel) {
  const authorized=metric?.authorized||{};
  const guests=metric?.guests||{};
  const value=(audienceLabel,item)=>`<div class="adminUsageAudienceValue"><span>${escapeHtml(audienceLabel)}</span><strong>${escapeHtml(guestNumber(item?.people))} ${escapeHtml(guestText("usagePeopleShort"))} · ${escapeHtml(guestNumber(item?.actions))} ${escapeHtml(actionLabel)}</strong></div>`;
  return `<div class="adminUsageMetric"><span>${escapeHtml(label)}</span><div class="adminUsageAudienceValues">
    ${value(guestText("statsAuthorized"),authorized)}
    ${value(guestText("statsGuests"),guests)}
  </div></div>`;
}

function usageBlock(title,rows) {
  return `<section class="adminUsageBlock"><h3>${escapeHtml(title)}</h3><div class="adminUsageRows">${rows.join("")}</div></section>`;
}

function renderUsageSections(data) {
  const months=Array.isArray(data?.usage_months)?data.usage_months:[];
  if(!months.length)return `<div class="adminGuestEmpty">${escapeHtml(msg("admin.no_data"))}</div>`;
  if(!usageAnalyticsMonth||!months.some((row)=>row.month===usageAnalyticsMonth)){
    usageAnalyticsMonth=months.at(-1)?.month||"";
  }
  const selected=months.find((row)=>row.month===usageAnalyticsMonth)||months.at(-1)||{};
  const tabs=renderBracketTabs({
    items:months.map((row)=>({id:row.month,value:row.month,label:guestMonthLabel(row.month)})),
    active:usageAnalyticsMonth,
    ariaLabel:guestText("usageTitle"),
    dataAttribute:"admin-usage-month",
  });
  return `<div class="adminUsage">
    <div class="adminUsageMonthTabs">${tabs}</div>
    ${usageBlock(guestText("usagePathUnderstanding"),[
      usageMetricRow(guestText("usageLearn"),selected.understanding_learn,guestText("usageSets")),
      usageMetricRow(guestText("usageTests"),selected.understanding_test,guestText("usageTestsCount")),
    ])}
    ${usageBlock(guestText("usagePathRoots"),[
      usageMetricRow(guestText("usageLearn"),selected.roots_learn,guestText("usageSets")),
      usageMetricRow(guestText("usageTests"),selected.roots_test,guestText("usageTestsCount")),
    ])}
    ${usageBlock(guestText("usageAshyk"),[
      usageMetricRow(guestText("usageAshykComputer"),selected.ashyk_computer,guestText("usageGames")),
      usageMetricRow(guestText("usageAshykOnline"),selected.ashyk_online,guestText("usageGames")),
    ])}
    ${usageBlock(guestText("usageSongs"),[
      usageMetricRow(guestText("usageLyrics"),selected.song_lyrics,guestText("usageOpens")),
    ])}
  </div>`;
}

async function renderGuestAnalytics(context,signal,host){
  if(!host||signal?.aborted)return;
  host.classList.add("isGuest");
  host.innerHTML=`<div class="adminGuestLoading loadingState">${escapeHtml(msg("common.otkryvaem"))}</div>`;
  try{
    const data=await fetchExtendedAnalytics(guestAnalyticsPeriod);
    if(signal?.aborted||!host.isConnected)return;
    const periods=renderBracketTabs({
      items:[
        {id:"7",value:"7",label:guestText("guestPeriod7")},
        {id:"30",value:"30",label:guestText("guestPeriod30")},
        {id:"90",value:"90",label:guestText("guestPeriod90")},
        {id:"0",value:"0",label:guestText("guestPeriodAll")},
      ],
      active:String(guestAnalyticsPeriod),
      ariaLabel:guestText("statsVisitors"),
      dataAttribute:"admin-guest-period",
    });
    host.innerHTML=`<div class="adminGuestScroll">
      <section class="adminAnalyticsSection adminAnalyticsDaily">
        <div class="adminAnalyticsSectionHead">
          <div><h2>${escapeHtml(guestText("visitorDailyTitle"))}</h2></div>
          <div class="adminGuestPeriodTabs">${periods}</div>
        </div>
        ${audienceSummary(data)}
        ${dailyVisitorsChart(data)}
      </section>
      <section class="adminAnalyticsSection">
        <div class="adminAnalyticsSectionHead"><div><h2>${escapeHtml(guestText("visitorMonthlyTitle"))}</h2></div></div>
        ${monthlyVisitorsCharts(data)}
      </section>
      <section class="adminAnalyticsSection adminUsageSection">
        <div class="adminAnalyticsSectionHead"><div><h2>${escapeHtml(guestText("usageTitle"))}</h2></div></div>
        ${renderUsageSections(data)}
      </section>
    </div>`;
    bindAnalyticsPointTooltips(host,signal);
    host.querySelectorAll("[data-admin-guest-period]").forEach((button)=>button.addEventListener("click",()=>{
      const value=Number(button.dataset.adminGuestPeriod);
      guestAnalyticsPeriod=Number.isFinite(value)?value:30;
      void renderGuestAnalytics(context,signal,host);
    },{signal}));
    host.querySelectorAll("[data-admin-usage-month]").forEach((button)=>button.addEventListener("click",()=>{
      usageAnalyticsMonth=String(button.dataset.adminUsageMonth||"");
      void renderGuestAnalytics(context,signal,host);
    },{signal}));
  }catch(error){
    if(!signal?.aborted)host.innerHTML=`<div class="adminUsersError emptyState">${escapeHtml(failureMessage(error))}</div>`;
  }
}

export async function renderAdminUsersEmbedded(context, signal, host) {
  if (!host || signal?.aborted) return;
  host.classList.add("isAnalyticsOnly");
  host.innerHTML=`<div class="adminStatsPane" data-admin-stats-pane></div>`;
  return renderGuestAnalytics(context,signal,host.querySelector("[data-admin-stats-pane]"));
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
