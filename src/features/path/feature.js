import { getInterfaceLanguage, msg } from "../../shared/i18n/index.js?v=13.9.0";
import { supabasePublishableKey, supabaseUrl } from "../../config/supabase.js?v=13.10.3";
import { getCompleteDictionaryWords } from "../../shared/data/word-repository.js?v=16.7.0.17";
import { buildLearningRoute, resolveStationFromParams, stationPathParams } from "../../shared/domain/learning-route.js?v=13.13";
import { allStoryProgress, computedStationStatus, createRouteProgressSnapshot, stationWordProgress } from "../../shared/domain/route-progress.js?v=13.13";
import { getRouteSettings, updateRouteSettings } from "../../shared/progress/route-settings-store.js?v=13.9.0";
import { awardWordMilestones } from "../../shared/progress/word-progress-store.js?v=13.9.0";
import { wordFavorites } from "../../shared/state/word-favorites.js?v=13.9.0";
import { escapeHtml } from "../../shared/ui/html.js?v=13.9.0";
import { bindResultRows, renderResultRow, renderResultScreen } from "../../shared/ui/result-list.js?v=13.10.12";
import { createRouteScale } from "../../shared/ui/route-scale.js?v=13.9.0";
import { renderSegmentedProgress } from "../../shared/ui/segmented-progress.js?v=13.9.0";
import { renderStarButton } from "../../shared/ui/word-renderers.js?v=13.9.0";
import { getHiddenSet, learnState } from "../learn/state.js?v=13.13";
import { renderResults as renderLearnResults } from "../learn/results.js?v=13.9.0";
import { finalizeLearnSession, renderStudy } from "../learn/study.js?v=13.13";
import { createStationTestSession, renderStationTest } from "./station-test.js?v=13.13";
import { renderStationView } from "./station-view.js?v=13.13";
import { hasSeenStoryStele, mountStoryStele } from "./story-stele.js?v=13.15.1";
import { readScopedJson } from "../../shared/progress/storage-scope.js?v=13.15.10.8";
import { renderStoryWordList } from "./story-word-list.js?v=13.15.12.1";

let controller = null;
let activeStudy = false;
const pendingSelections = new Map();
let routeCache = { words: null, route: null };
function mark(name){try{globalThis.performance?.mark?.(name);}catch{}}
const LEVEL_DICTIONARIES = new Set(["beginner", "intermediate", "advanced"]);
const BEGINNER_METADATA_CACHE_KEY = "alantil_beginner_set_metadata_v1";
const BEGINNER_SET_PATTERN = /^beginner-(0[1-9]|[12]\d|30)$/;
const BEGINNER_ICON_PATTERN = /^(0[1-9]|[12]\d|30)_[a-z0-9_]+\.webp$/;
const SET_ICON_ASSET_VERSION = "16.7.0.19";
let beginnerSetMetadata = new Map();

function normalizeBeginnerMetadataRows(rows = []) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const entityId = String(row?.entity_id || "").trim();
    const iconName = String(row?.icon_name || "").trim();
    if (!BEGINNER_SET_PATTERN.test(entityId) || !BEGINNER_ICON_PATTERN.test(iconName)) continue;
    map.set(entityId, {
      entity_id: entityId,
      icon_name: iconName,
      name_ru: String(row?.name_ru || "").trim(),
      name_en: String(row?.name_en || "").trim(),
      name_tr: String(row?.name_tr || "").trim(),
    });
  }
  return map;
}

function hasCompleteBeginnerMetadata(map) {
  return map.size === 30 && Array.from(map.values()).every((entry) => (
    BEGINNER_ICON_PATTERN.test(entry.icon_name)
    && entry.name_ru
    && entry.name_en
    && entry.name_tr
  ));
}

function readBeginnerMetadataCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(BEGINNER_METADATA_CACHE_KEY) || "[]");
    return normalizeBeginnerMetadataRows(cached);
  } catch {
    return new Map();
  }
}

function writeBeginnerMetadataCache(map) {
  try {
    localStorage.setItem(BEGINNER_METADATA_CACHE_KEY, JSON.stringify(Array.from(map.values())));
    localStorage.removeItem("alantil_beginner_set_icons_v1");
    localStorage.removeItem("alantil_beginner_set_icons_v2");
  } catch {}
}

async function fetchBeginnerSetMetadata({ signal } = {}) {
  const url = new URL("/rest/v1/content_structure", supabaseUrl);
  url.searchParams.set("select", "entity_id,icon_name,name_ru,name_en,name_tr");
  url.searchParams.set("entity_type", "eq.set");
  url.searchParams.set("entity_id", "like.beginner-*");
  url.searchParams.set("order", "entity_id.asc");
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    signal,
    headers: { apikey: supabasePublishableKey, Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Beginner set metadata failed: " + response.status);
  const map = normalizeBeginnerMetadataRows(await response.json());
  if (!hasCompleteBeginnerMetadata(map)) throw new Error("Beginner set metadata is incomplete");
  writeBeginnerMetadataCache(map);
  return map;
}

async function loadBeginnerSetMetadata({ signal } = {}) {
  const cached = readBeginnerMetadataCache();
  if (hasCompleteBeginnerMetadata(cached)) {
    void fetchBeginnerSetMetadata({ signal }).then((fresh) => {
      beginnerSetMetadata = fresh;
    }).catch((error) => {
      if (error?.name !== "AbortError") console.warn("Beginner set metadata refresh failed", error);
    });
    return cached;
  }
  try {
    return await fetchBeginnerSetMetadata({ signal });
  } catch (error) {
    if (error?.name !== "AbortError") console.warn("Beginner set metadata unavailable", error);
    return cached;
  }
}

function beginnerSetMetadataEntry(station) {
  if (String(station?.dictionaryId || "") !== "beginner") return null;
  return beginnerSetMetadata.get(String(station?.setId || "")) || null;
}

function beginnerSetIconName(station) {
  const iconName = String(beginnerSetMetadataEntry(station)?.icon_name || "");
  return BEGINNER_ICON_PATTERN.test(iconName) ? iconName : "";
}

function localizedBeginnerSetName(entry, fallback = "") {
  const language = getInterfaceLanguage();
  const key = language === "en" ? "name_en" : language === "tr" ? "name_tr" : "name_ru";
  return String(entry?.[key] || entry?.name_ru || fallback || "").trim();
}

function applyBeginnerSetMetadataToRoute(route) {
  const visited = new Set();
  Object.values(route?.stories || {}).forEach((story) => {
    const stations = [
      ...(Array.isArray(story?.stations) ? story.stations : []),
      ...(Array.isArray(story?.catalogs) ? story.catalogs.flatMap((catalog) => (
        Array.isArray(catalog?.sections) ? catalog.sections.flatMap((section) => section?.stations || []) : []
      )) : []),
    ];
    stations.forEach((station) => {
      if (!station || visited.has(station) || String(station.dictionaryId || "") !== "beginner") return;
      visited.add(station);
      const entry = beginnerSetMetadataEntry(station);
      station.name = localizedBeginnerSetName(entry, station.name);
    });
  });
}

function bindBeginnerDioramaFallbacks(root, signal) {
  root.querySelectorAll("[data-beginner-diorama-image]").forEach((image) => {
    const sync = () => {
      const button = image.closest(".beginnerDioramaNode");
      if (!button) return;
      button.classList.toggle("beginnerDioramaError", image.complete && image.naturalWidth === 0);
    };
    image.addEventListener("load", sync, { signal });
    image.addEventListener("error", sync, { signal });
    if (image.complete) sync();
  });
}

function stationNodeClass(station, status) {
  const beginnerDiorama = Boolean(beginnerSetIconName(station));
  return ["choiceControl", "stationNode", status, beginnerDiorama ? "beginnerDioramaNode" : ""].filter(Boolean).join(" ");
}

function activeStoryType(route, value) {
  const key = String(value || "").trim();
  return route.stories[key] ? key : route.defaultStoryType;
}

function routeParams(station, route) { return stationPathParams(route, station); }
function routeScrollKey(story) { return `route_scroll_v3_${story}`; }

function stationMilestones(summary) {
  const count = Math.floor(summary.mastered / 20);
  if (!count) return "";
  return `<span class="stationMilestones" aria-label="${msg("path.marshrutnyh_otmetok", { count })}">${Array.from({ length: Math.min(4, count) }, () => "⌃").join("")}</span>`;
}

function stationButton(station, index, progressSnapshot) {
  const status = computedStationStatus(null, station, progressSnapshot);
  const progress = stationWordProgress(station, progressSnapshot);
  const ordinal = String(index + 1).padStart(2, "0");
  const iconName = beginnerSetIconName(station);
  const className = stationNodeClass(station, status);
  const stationName = String(station.name || ordinal);
  if (iconName) {
    const iconSrc = `/assets/icons/sets/${encodeURIComponent(iconName)}?v=${SET_ICON_ASSET_VERSION}`;
    return `<button id="station-${escapeHtml(station.key)}" class="${className}" style="--station-progress:${progress.percent * 3.6}deg" type="button" data-station-key="${escapeHtml(station.key)}" aria-label="${msg("path.osvoeno_iz_slov", { label: escapeHtml(stationName), mastered: progress.mastered, total: progress.total })}"><span class="beginnerDioramaFrame" aria-hidden="true"><img class="beginnerDioramaImage" data-beginner-diorama-image src="${iconSrc}" alt="" loading="lazy" decoding="async"></span><span class="stationProgressRing beginnerDioramaFallback" aria-hidden="true"><span class="millstoneFace"><span class="stationOrdinal">${ordinal}</span></span></span><span class="stationLabel beginnerDioramaLabel">${escapeHtml(stationName)}</span><span class="stationWordCount beginnerDioramaFallbackCount">${progress.mastered}/${progress.total}</span></button>`;
  }
  const dictionaryId = String(station.dictionaryId || "");
  const label = dictionaryId === "beginner" || !LEVEL_DICTIONARIES.has(dictionaryId)
    ? `<span class="stationLabel">${escapeHtml(stationName)}</span>`
    : "";
  return `<button id="station-${escapeHtml(station.key)}" class="${className}" style="--station-progress:${progress.percent * 3.6}deg" type="button" data-station-key="${escapeHtml(station.key)}" aria-label="${msg("path.osvoeno_iz_slov", { label: escapeHtml(stationName), mastered: progress.mastered, total: progress.total })}"><span class="stationProgressRing" aria-hidden="true"><span class="millstoneFace"><span class="stationOrdinal">${ordinal}</span></span></span>${label}<span class="stationWordCount">${progress.mastered}/${progress.total}</span>${stationMilestones(progress)}</button>`;
}
function routeSection(section, stationIndex, catalogId, progressSnapshot) { const reversedStations=[...section.stations].reverse(); return `<section class="routeSection" data-route-section="${escapeHtml(`${catalogId}::${section.sectionId}`)}"><div class="routeSectionStations">${reversedStations.map((station)=>stationButton(station,stationIndex.get(station.key),progressSnapshot)).join("")}</div>${section.name?`<h3 class="routeSectionHeading">${escapeHtml(section.name)}</h3>`:""}</section>`; }
function routeCatalogSection(catalog, stationIndex, progressSnapshot) { const reversedSections=[...catalog.sections].reverse(); return `<section class="routeCatalog" data-route-catalog="${escapeHtml(catalog.catalogId)}"><span class="routeCatalogEnd" data-catalog-end="${escapeHtml(catalog.catalogId)}" aria-hidden="true"></span><div class="routeCatalogGroups">${reversedSections.map((section)=>routeSection(section,stationIndex,catalog.catalogId,progressSnapshot)).join("")}</div><h2 class="routeCatalogHeading">${escapeHtml(catalog.name)}</h2></section>`; }
function nextLayoutFrame(){return new Promise((resolve)=>requestAnimationFrame(resolve));}
async function restoreMapPosition(viewport){if(!viewport)return;viewport.classList.add("isPositioning");const previousBehavior=viewport.style.scrollBehavior;viewport.style.scrollBehavior="auto";try{await nextLayoutFrame();const position=()=>{viewport.scrollTop=Math.max(0,viewport.scrollHeight-viewport.clientHeight);};position();await nextLayoutFrame();const maxScroll=Math.max(0,viewport.scrollHeight-viewport.clientHeight);if(Math.abs(viewport.scrollTop-maxScroll)>1)viewport.scrollTop=maxScroll;mark("alantil:path:positioned");}finally{viewport.style.scrollBehavior=previousBehavior;viewport.classList.remove("isPositioning");}}
function localizedStoryIntro(words,storyId,fallback=""){const key=String(storyId||"").trim();const entry=(Array.isArray(words)?words:[]).find((word)=>String(word?.story_id||word?.story_type||"").trim()===key&&String(word?.story_intro||"").trim());return String(entry?.story_intro||fallback||"").trim();}
function syncStoryTabEdges(shell,scroller){const max=Math.max(0,scroller.scrollWidth-scroller.clientWidth);const scrollable=max>3;shell.classList.toggle("isScrollable",scrollable);shell.classList.toggle("canScrollStart",scrollable&&scroller.scrollLeft>3);shell.classList.toggle("canScrollEnd",scrollable&&scroller.scrollLeft<max-3);}
function refreshRouteProgressInPlace(context,route,activeStory){
  const story=route.stories[activeStory];if(!story)return;
  const snapshot=createRouteProgressSnapshot(),progress=allStoryProgress(route,snapshot)[activeStory];
  const progressRoot=context.root.querySelector(".storyProgress");
  if(progressRoot)progressRoot.innerHTML=`${renderSegmentedProgress({value:progress.percent,segments:10,label:msg("path.osvoeno_slov_istorii",{percent:progress.percent,name:route.storyLabels[activeStory]})})}<span class="pathProgressPercent">${progress.percent}%</span><span class="pathProgressCount">${progress.masteredWords}/${progress.totalWords}</span>`;
  story.stations.forEach((station)=>{
    const button=context.root.querySelector('[data-station-key="'+CSS.escape(station.key)+'"]');if(!button)return;
    const status=computedStationStatus(null,station,snapshot),wordProgress=stationWordProgress(station,snapshot);
    const beginnerImageError=button.classList.contains("beginnerDioramaError");
    button.className=stationNodeClass(station,status);
    if(beginnerImageError)button.classList.add("beginnerDioramaError");
    button.style.setProperty("--station-progress",(wordProgress.percent*3.6)+"deg");
    button.setAttribute("aria-label",msg("path.osvoeno_iz_slov",{label:station.name,mastered:wordProgress.mastered,total:wordProgress.total}));
    const beginnerDiorama=button.classList.contains("beginnerDioramaNode");
    const count=button.querySelector(".stationWordCount");if(count)count.textContent=wordProgress.mastered+"/"+wordProgress.total;
    button.querySelector(".stationMilestones")?.remove();
    const milestone=stationMilestones(wordProgress);if(!beginnerDiorama&&milestone)button.insertAdjacentHTML("beforeend",milestone);
  });
}

function bindStoryTabs(root,signal){const shell=root.querySelector(".storyTabsShell");const scroller=shell?.querySelector(".storyTabs");if(!shell||!scroller)return;let frame=0;const schedule=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;syncStoryTabEdges(shell,scroller);});};const active=scroller.querySelector(".storyTab.active");requestAnimationFrame(()=>{active?.scrollIntoView({behavior:"auto",block:"nearest",inline:"center"});syncStoryTabEdges(shell,scroller);});scroller.addEventListener("scroll",schedule,{signal,passive:true});if(typeof ResizeObserver==="function"){const observer=new ResizeObserver(schedule);observer.observe(scroller);signal.addEventListener("abort",()=>observer.disconnect(),{once:true});}signal.addEventListener("abort",()=>{if(frame)cancelAnimationFrame(frame);},{once:true});}

function renderRoute(context,route,activeStory,progressSnapshot,storyIntro){
  const story=route.stories[activeStory];const progress=allStoryProgress(route,progressSnapshot)[activeStory];const stationIndex=new Map(story.stations.map((station,index)=>[station.key,index]));const reversedCatalogs=[...story.catalogs].reverse();
  context.shell.setCounter("");context.shell.setHeaderContent?.({title:msg("common.alan_til_2")});
  context.root.innerHTML=`<section class="pathView"><div class="pathStickyControls"><div class="storyTabsShell"><nav class="storyTabs" aria-label="${msg("path.istoriya_puti")}">${route.storyOrder.map((type)=>`<button class="tabAction storyTab ${type===activeStory?"active":""}" type="button" data-story-tab="${escapeHtml(type)}" ${type===activeStory?'aria-current="page"':""}>[ ${escapeHtml(route.storyLabels[type])} ]</button>`).join("")}</nav></div><div class="storyProgress">${renderSegmentedProgress({value:progress.percent,segments:10,label:msg("path.osvoeno_slov_istorii",{percent:progress.percent,name:route.storyLabels[activeStory]})})}<span class="pathProgressPercent">${progress.percent}%</span><span class="pathProgressCount">${progress.masteredWords}/${progress.totalWords}</span></div></div><div class="pathMapViewport isPositioning"><div class="routeBackdrop" aria-hidden="true"></div><div class="routeMap" data-story-map="${escapeHtml(activeStory)}">${reversedCatalogs.map((catalog)=>routeCatalogSection(catalog,stationIndex,progressSnapshot)).join("")}</div></div><button class="storyWordsTrigger" type="button" data-story-words aria-label="Список слов" title="Список слов"><img src="/assets/icons/ui/lucide/list-checks.svg" alt="" aria-hidden="true"></button><nav class="routeScale" aria-label="${msg("path.rubezhi_marshruta")}"></nav></section>`;
  mark("alantil:path:rendered");
  bindStoryTabs(context.root,controller.signal);
  bindBeginnerDioramaFallbacks(context.root,controller.signal);
  const mountStele=()=>mountStoryStele({root:context.root,modalRoot:context.shell.modalRoot,story:{id:activeStory,name:route.storyLabels[activeStory],intro:storyIntro},autoOpen:true,signal:controller.signal});const guideCompleted=Boolean(readScopedJson("alantil_guided_help_v1",{})?.general_completed);if(guideCompleted)mountStele();else window.addEventListener("alantil:general-guide-completed",()=>{if(!hasSeenStoryStele(activeStory))mountStele();},{signal:controller.signal,once:true});
  context.root.querySelector("[data-story-words]")?.addEventListener("click",()=>context.router.navigate("path.story-words",{storyType:activeStory}),{signal:controller.signal});
  context.root.querySelectorAll("[data-story-tab]").forEach((button)=>{button.addEventListener("click",()=>{const type=button.dataset.storyTab;const next=activeStoryType(route,type);if(next===activeStory)return;const viewport=context.root.querySelector(".pathMapViewport");updateRouteSettings({[routeScrollKey(activeStory)]:viewport?.scrollTop||0},{queue:false});updateRouteSettings({active_story:next});context.router.navigate("path.home",{storyType:next});},{signal:controller.signal});});
  context.root.querySelectorAll("[data-station-key]").forEach((button)=>{button.addEventListener("click",()=>{const station=route.byKey.get(button.dataset.stationKey);if(!station)return;const viewport=context.root.querySelector(".pathMapViewport");updateRouteSettings({[routeScrollKey(activeStory)]:viewport?.scrollTop||0},{queue:false});context.router.navigate("path.station",routeParams(station,route));},{signal:controller.signal});});
  const viewport=context.root.querySelector(".pathMapViewport");createRouteScale({root:context.root,viewport,catalogs:reversedCatalogs,signal:controller.signal});window.addEventListener("alantil:scope-ready",()=>refreshRouteProgressInPlace(context,route,activeStory),{signal:controller.signal});let mapPositionReady=false;void restoreMapPosition(viewport).then(()=>{mapPositionReady=true;});let saveFrame=0;viewport?.addEventListener("scroll",()=>{if(!mapPositionReady||saveFrame)return;saveFrame=requestAnimationFrame(()=>{saveFrame=0;updateRouteSettings({[routeScrollKey(activeStory)]:viewport.scrollTop},{queue:false});});},{signal:controller.signal,passive:true});
}
function selectedWordsForStation(station){const pending=pendingSelections.get(station.key);if(Array.isArray(pending)&&pending.length)return pending;const hidden=getHiddenSet(station.dictionaryId,station.sectionId,station.setId);const active=station.words.filter((word)=>!hidden.has(word.id));return active.length?active:station.words;}
function renderStation(context,route,station){renderStationView(context,station,{signal:controller.signal,onStartStudy(mode,words){pendingSelections.set(station.key,words);context.router.navigate("path.study",{...routeParams(station,route),mode});},onStartTest(mode){context.router.navigate("path.test",{...routeParams(station,route),mode});}});}
function masteryLabel(level){if(level===3)return msg("path.iii_znak_vershiny");if(level===2)return msg("path.ii_marshrutnyy_znak");if(level===1)return msg("path.i_marshrutnyy_znak");return msg("path.test_ne_sdan");}
function renderResult(context,route,station,result,allWords){if(result.passed)awardWordMilestones(allWords);const message=result.passed?masteryLabel(result.masteryLevel):msg("path.nuzhno_ne_menee",{required:result.required});const wordsById=new Map(allWords.map((word)=>[String(word.id),word]));const alanToTranslation=result.payload.direction!=="ru_to_alan";const rows=(result.payload.words||[]).map((answer)=>{const word=wordsById.get(String(answer.word_id));if(!word)return"";const wrongWord=wordsById.get(String(answer.wrong_word_id||""));const correct=answer.result==="correct"||answer.is_correct===true;const correctAnswer=alanToTranslation?word.trans:word.word;const selectedAnswer=wrongWord?(alanToTranslation?wrongWord.trans:wrongWord.word):correctAnswer;return renderResultRow({id:word.id,status:correct?"ok":"bad",primary:alanToTranslation?word.word:word.trans,details:correct?[{label:msg("test.pravilno"),value:correctAnswer,tone:"correct"}]:[{label:msg("test.otvet"),value:selectedAnswer||"—",tone:"wrong"},{label:msg("test.pravilno"),value:correctAnswer,tone:"correct"}],trailingHtml:renderStarButton(word.id,`data-word-id="${escapeHtml(word.id)}"`)});}).join("");context.shell.setHeaderContent?.({title:msg("path.rezultat_testa"),subtitle:station.name,logo:true,brand:false});context.root.innerHTML=renderResultScreen({className:"stationResultView",summaryClass:"modeResultSummary",summaryHtml:`<span class="modeResultMark" aria-hidden="true">${result.masteryLevel?"⌃".repeat(result.masteryLevel):"—"}</span><strong>${result.payload.accuracy}%</strong><span>${escapeHtml(message)} · ${result.payload.correct_total}/${result.payload.questions_total}</span>`,contentHtml:rows,emptyHtml:`<div class="hintText">${msg("test.net_rezultatov")}</div>`,footerHtml:`<div class="stationActions"><button class="btn actionText" type="button" data-result-return>${msg("path.k_etapu")}</button>${result.passed?"":`<button class="btn actionPrimary" type="button" data-result-repeat>${msg("path.povtorit")}</button>`}</div>`});bindResultRows(context.root,{signal:controller.signal});context.root.querySelectorAll(".starBtn[data-word-id]").forEach((button)=>{button.addEventListener("click",()=>button.classList.toggle("on",wordFavorites.toggle(button.dataset.wordId)),{signal:controller.signal});});context.root.querySelector("[data-result-return]")?.addEventListener("click",()=>context.router.replace("path.station",routeParams(station,route),{force:true}),{signal:controller.signal});context.root.querySelector("[data-result-repeat]")?.addEventListener("click",()=>{const mode=result.payload.direction==="ru_to_alan"?"ru":"kb";const session=createStationTestSession(station,allWords,mode);renderStationTest(context,session,{onComplete:(next)=>renderResult(context,route,station,next,allWords)});},{signal:controller.signal});}

export async function mount(context,params={}){controller=new AbortController();const [words,metadata]=await Promise.all([getCompleteDictionaryWords({signal:controller.signal}),loadBeginnerSetMetadata({signal:controller.signal})]);beginnerSetMetadata=metadata;mark("alantil:path:dictionary-ready");if(routeCache.words!==words){routeCache={words,route:buildLearningRoute(words)};mark("alantil:path:route-built");}const route=routeCache.route;applyBeginnerSetMetadataToRoute(route);const screen=params.screen||"home";const activeStory=activeStoryType(route,params.storyType||getRouteSettings().active_story);const storyIntro=localizedStoryIntro(words,activeStory,route.stories[activeStory]?.intro);updateRouteSettings({active_story:activeStory},{queue:false});if(screen==="story-words"){renderStoryWordList({context,route,storyType:activeStory,signal:controller.signal});return;}if(screen==="home"){const progressSnapshot=createRouteProgressSnapshot();if(String(params.storyType||"")!==activeStory)context.router.canonicalize?.("path.home",{storyType:activeStory});renderRoute(context,route,activeStory,progressSnapshot,storyIntro);return;}const station=resolveStationFromParams(route,{...params,storyType:activeStory});if(!station){context.router.canonicalize?.("path.home",{storyType:activeStory});renderRoute(context,route,activeStory,createRouteProgressSnapshot(),storyIntro);return;}if(screen==="station"){renderStation(context,route,station);return;}if(screen==="study"){activeStudy=true;const selectedWords=selectedWordsForStation(station);learnState.currentDict=station.dictionaryId;learnState.currentSection=station.sectionId;learnState.currentSet=station.setId;context.shell.setHeaderContent?.({title:msg("path.uchit_slova"),subtitle:station.name,logo:true,brand:false});renderStudy(context,words,controller.signal,{mode:params.mode||learnState.currentStudyMode||"kb",wordsOverride:selectedWords,stationContext:{key:station.key,wordIds:selectedWords.map((word)=>word.id),sectionId:station.sectionId,...routeParams(station,route)},onComplete(){activeStudy=false;pendingSelections.delete(station.key);renderLearnResults(context,words,controller.signal,{onDone:()=>context.router.replace("path.station",routeParams(station,route),{force:true})});}});return;}if(screen==="test"){const allWords=route.storyOrder.flatMap((type)=>route.stories[type].stations).flatMap((item)=>item.words);const session=createStationTestSession(station,allWords,params.mode||"kb");renderStationTest(context,session,{onComplete:(result)=>renderResult(context,route,station,result,allWords)});}}
export function canLeave(){return !activeStudy||!learnState.studySession.inProgress;}export function onLeave(reason="route_change"){if(activeStudy&&learnState.studySession.inProgress)finalizeLearnSession("interrupted",reason);activeStudy=false;}export function unmount(){controller?.abort();controller=null;}
