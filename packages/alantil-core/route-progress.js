import { summarizeWordProgress } from './progress.js';

function idOf(word) {
  return String(word?.id ?? word?.word_id ?? word ?? '').normalize('NFC').trim();
}

export function uniqueRouteWords(stations = []) {
  const map = new Map();
  (Array.isArray(stations) ? stations : []).forEach((station) => {
    (Array.isArray(station?.words) ? station.words : []).forEach((word) => {
      const id = idOf(word);
      if (id) map.set(id, word);
    });
  });
  return Array.from(map.values());
}

export function routeStationStatus(station, progressById) {
  const words = Array.isArray(station?.words) ? station.words : [];
  const summary = summarizeWordProgress(words, progressById);
  if (summary.percent === 100) return summary.review ? 'review' : 'mastered';
  if (summary.mastered > 0 || summary.review > 0) return 'studying';
  const rowFor = (id) => typeof progressById?.get === 'function' ? progressById.get(id) : progressById?.[id];
  const hasActivity = words.some((word) => {
    const row = rowFor(idOf(word));
    return Number(row?.study_shown_count || 0) > 0
      || Number(row?.test_correct_count || 0) > 0
      || Number(row?.test_wrong_count || 0) > 0;
  });
  return hasActivity ? 'studying' : 'available';
}

export function routeStoryProgress(story, progressById) {
  const words = uniqueRouteWords(story?.stations || []);
  const summary = summarizeWordProgress(words, progressById);
  const stationProgress = (station) => summarizeWordProgress(station?.words || [], progressById);
  const stations = Array.isArray(story?.stations) ? story.stations : [];
  const sections = Array.isArray(story?.sections) ? story.sections : [];
  const catalogs = Array.isArray(story?.catalogs) ? story.catalogs : [];
  return {
    totalStations: stations.length,
    masteredStations: stations.filter((station) => stationProgress(station).percent === 100).length,
    percent: summary.percent,
    totalWords: summary.total,
    masteredWords: summary.mastered,
    reviewWords: summary.review,
    totalSections: sections.length,
    completedSections: sections.filter((section) => (section.stations || []).every((station) => stationProgress(station).percent === 100)).length,
    totalCatalogs: catalogs.length,
    completedCatalogs: catalogs.filter((catalog) => (catalog.sections || []).every((section) => (section.stations || []).every((station) => stationProgress(station).percent === 100))).length,
  };
}

export function allRouteStoryProgress(route, progressById) {
  return Object.fromEntries((route?.storyOrder || []).map((storyId) => [storyId, routeStoryProgress(route?.stories?.[storyId], progressById)]));
}
