import { getAllStationProgress } from "../progress/station-progress-store.js?v=13.9.0";
import { getWordProgress, wordProgressSummary } from "../progress/word-progress-store.js?v=13.9.0";

function percent(done, total) {
  return total ? Math.round((done / total) * 100) : 0;
}

function uniqueWords(stations = []) {
  const map = new Map();
  stations.forEach((station) => (station.words || []).forEach((word) => map.set(String(word.id), word)));
  return Array.from(map.values());
}

export function stationWordProgress(station) {
  return wordProgressSummary(station?.words || []);
}

export function storyProgress(route, storyType) {
  const story = route?.stories?.[storyType] || { stations: [], groups: [], catalogs: [] };
  const words = uniqueWords(story.stations);
  const summary = wordProgressSummary(words);
  const completedStations = story.stations.filter((station) => stationWordProgress(station).percent === 100);
  const completedGroups = story.groups.filter((group) => group.stations.every((station) => stationWordProgress(station).percent === 100));
  const completedCatalogs = story.catalogs.filter((catalog) => catalog.groups.every((group) => group.stations.every((station) => stationWordProgress(station).percent === 100)));
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

export function allStoryProgress(route) {
  return Object.fromEntries((route?.storyOrder || []).map((type) => [type, storyProgress(route, type)]));
}

export function dictionaryPathProgress(route) {
  const stories = allStoryProgress(route);
  const words = uniqueWords((route?.storyOrder || []).flatMap((type) => route.stories[type]?.stations || []));
  const summary = wordProgressSummary(words);
  return { percent: summary.percent, rarePercent: 0, stories, totalWords: summary.total, masteredWords: summary.mastered };
}

export function computedStationStatus(route, station) {
  const summary = stationWordProgress(station);
  if (summary.percent === 100) return summary.review ? "review_1_due" : "mastered";
  if (summary.mastered > 0 || summary.review > 0) return "studying";
  const hasActivity = (station?.words || []).some((word) => {
    const progress = getWordProgress(word.id);
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
