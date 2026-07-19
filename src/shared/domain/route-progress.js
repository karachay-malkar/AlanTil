import { getAllStationProgress } from "../progress/station-progress-store.js?v=13.9.0";
import { getWordProgress, getWordProgressMap, wordProgressSummary } from "../progress/word-progress-store.js?v=13.9.0";

function percent(done, total) {
  return total ? Math.round((done / total) * 100) : 0;
}

function uniqueWords(stations = []) {
  const map = new Map();
  stations.forEach((station) => (station.words || []).forEach((word) => map.set(String(word.id), word)));
  return Array.from(map.values());
}

function summaryFromMap(words = [], progressMap) {
  const ids = (Array.isArray(words) ? words : []).map((word) => String(word?.id || word || "").trim()).filter(Boolean);
  let mastered = 0;
  let review = 0;
  ids.forEach((id) => {
    const status = progressMap.get(id)?.mastery_status;
    if (status === "mastered" || status === "review") mastered += 1;
    if (status === "review") review += 1;
  });
  return {
    total: ids.length,
    mastered,
    review,
    percent: ids.length ? Math.round((mastered / ids.length) * 100) : 0,
  };
}

export function createRouteProgressSnapshot() {
  return { progressMap: getWordProgressMap(), stationSummaries: new Map() };
}

export function stationWordProgress(station, snapshot = null) {
  if (!snapshot?.progressMap) return wordProgressSummary(station?.words || []);
  if (!snapshot.stationSummaries.has(station)) {
    snapshot.stationSummaries.set(station, summaryFromMap(station?.words || [], snapshot.progressMap));
  }
  return snapshot.stationSummaries.get(station);
}

export function storyProgress(route, storyType, snapshot = createRouteProgressSnapshot()) {
  const story = route?.stories?.[storyType] || { stations: [], groups: [], catalogs: [] };
  const words = uniqueWords(story.stations);
  const summary = summaryFromMap(words, snapshot.progressMap);
  const completedStations = story.stations.filter((station) => stationWordProgress(station, snapshot).percent === 100);
  const completedGroups = story.groups.filter((group) => group.stations.every((station) => stationWordProgress(station, snapshot).percent === 100));
  const completedCatalogs = story.catalogs.filter((catalog) => catalog.groups.every((group) => group.stations.every((station) => stationWordProgress(station, snapshot).percent === 100)));
  return {
    totalStations: story.stations.length,
    masteredStations: completedStations.length,
    percent: summary.percent,
    totalWords: summary.total,
    masteredWords: summary.mastered,
    reviewWords: summary.review,
    totalGroups: story.groups.length,
    completedGroups: completedGroups.length,
    totalCatalogs: story.catalogs.length,
    completedCatalogs: completedCatalogs.length,
  };
}

export function allStoryProgress(route, snapshot = createRouteProgressSnapshot()) {
  return Object.fromEntries((route?.storyOrder || []).map((type) => [type, storyProgress(route, type, snapshot)]));
}

export function dictionaryPathProgress(route) {
  const snapshot = createRouteProgressSnapshot();
  const stories = allStoryProgress(route, snapshot);
  const words = uniqueWords((route?.storyOrder || []).flatMap((type) => route.stories[type]?.stations || []));
  const summary = summaryFromMap(words, snapshot.progressMap);
  return { percent: summary.percent, rarePercent: 0, stories, totalWords: summary.total, masteredWords: summary.mastered };
}

export function computedStationStatus(route, station, snapshot = null) {
  const summary = stationWordProgress(station, snapshot);
  if (summary.percent === 100) return summary.review ? "review_1_due" : "mastered";
  if (summary.mastered > 0 || summary.review > 0) return "studying";
  const hasActivity = (station?.words || []).some((word) => {
    const progress = snapshot?.progressMap?.get(String(word.id)) || getWordProgress(word.id);
    return progress.study_shown_count > 0 || progress.test_correct_count > 0 || progress.test_wrong_count > 0;
  });
  return hasActivity ? "studying" : "available";
}

export function stationsDueForReview(route) {
  return (route?.storyOrder || [])
    .flatMap((type) => route.stories[type]?.stations || [])
    .filter((station) => stationWordProgress(station).review > 0);
}

export function stationProgressRows() {
  return getAllStationProgress();
}
