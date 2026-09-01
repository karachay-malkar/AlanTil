import { getAllStationProgress } from "../progress/station-progress-store.js?v=13.13";
import { getWordProgressMap, wordProgressSummary } from "../progress/word-progress-store.js?v=13.9.0";
import { summarizeWordProgress } from "../../../packages/alantil-core/progress.js";
import { allRouteStoryProgress, routeStationStatus, uniqueRouteWords } from "../../../packages/alantil-core/route-progress.js";

export function createRouteProgressSnapshot() {
  return { progressMap: getWordProgressMap(), stationSummaries: new Map() };
}

export function stationWordProgress(station, snapshot = null) {
  if (!snapshot?.progressMap) return wordProgressSummary(station?.words || []);
  if (!snapshot.stationSummaries.has(station)) {
    snapshot.stationSummaries.set(station, summarizeWordProgress(station?.words || [], snapshot.progressMap));
  }
  return snapshot.stationSummaries.get(station);
}

export function storyProgress(route, storyType, snapshot = createRouteProgressSnapshot()) {
  return allRouteStoryProgress(route, snapshot.progressMap)[storyType] || {
    totalStations: 0,
    masteredStations: 0,
    percent: 0,
    totalWords: 0,
    masteredWords: 0,
    reviewWords: 0,
    totalSections: 0,
    completedSections: 0,
    totalCatalogs: 0,
    completedCatalogs: 0,
  };
}

export function allStoryProgress(route, snapshot = createRouteProgressSnapshot()) {
  return allRouteStoryProgress(route, snapshot.progressMap);
}

export function dictionaryPathProgress(route) {
  const snapshot = createRouteProgressSnapshot();
  const stories = allStoryProgress(route, snapshot);
  const words = uniqueRouteWords((route?.storyOrder || []).flatMap((type) => route.stories[type]?.stations || []));
  const summary = summarizeWordProgress(words, snapshot.progressMap);
  return { percent: summary.percent, rarePercent: 0, stories, totalWords: summary.total, masteredWords: summary.mastered };
}

export function computedStationStatus(route, station, snapshot = null) {
  const progressMap = snapshot?.progressMap || getWordProgressMap();
  return routeStationStatus(station, progressMap) === "review" ? "review_1_due" : routeStationStatus(station, progressMap);
}

export function stationsDueForReview(route) {
  return (route?.storyOrder || [])
    .flatMap((type) => route.stories[type]?.stations || [])
    .filter((station) => stationWordProgress(station).review > 0);
}

export function stationProgressRows() {
  return getAllStationProgress();
}
