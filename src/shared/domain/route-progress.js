import { getAllStationProgress } from "../progress/station-progress-store.js?v=13.13";
import { getWordProgress, getWordProgressMap, wordProgressSummary } from "../progress/word-progress-store.js?v=13.9.0";
import { summarizeWordProgress } from "../../../packages/alantil-core/progress.js";

function uniqueWords(stations = []) {
  const map = new Map();
  stations.forEach((station) => (station.words || []).forEach((word) => map.set(String(word.id), word)));
  return Array.from(map.values());
}

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
  const story = route?.stories?.[storyType] || { stations: [], sections: [], catalogs: [] };
  const words = uniqueWords(story.stations);
  const summary = summarizeWordProgress(words, snapshot.progressMap);
  const completedStations = story.stations.filter((station) => stationWordProgress(station, snapshot).percent === 100);
  const completedSections = story.sections.filter((section) => section.stations.every((station) => stationWordProgress(station, snapshot).percent === 100));
  const completedCatalogs = story.catalogs.filter((catalog) => catalog.sections.every((section) => section.stations.every((station) => stationWordProgress(station, snapshot).percent === 100)));
  return {
    totalStations: story.stations.length,
    masteredStations: completedStations.length,
    percent: summary.percent,
    totalWords: summary.total,
    masteredWords: summary.mastered,
    reviewWords: summary.review,
    totalSections: story.sections.length,
    completedSections: completedSections.length,
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
  const summary = summarizeWordProgress(words, snapshot.progressMap);
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
