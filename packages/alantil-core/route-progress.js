function uniqueWords(stations = []) {
  const map = new Map();
  stations.forEach((station) => (station.words || []).forEach((word) => map.set(String(word.id), word)));
  return Array.from(map.values());
}

export function summarizeRouteWords(words = [], progressMap = new Map()) {
  const ids = (Array.isArray(words) ? words : []).map((word) => String(word?.id || word || '').trim()).filter(Boolean);
  let mastered = 0;
  let review = 0;
  ids.forEach((id) => {
    const status = progressMap.get(id)?.mastery_status;
    if (status === 'mastered' || status === 'review') mastered += 1;
    if (status === 'review') review += 1;
  });
  return {
    total: ids.length,
    mastered,
    review,
    percent: ids.length ? Math.round((mastered / ids.length) * 100) : 0,
  };
}

export function createRouteProgressSnapshot(progressMap = new Map()) {
  return { progressMap, stationSummaries: new Map() };
}

export function stationWordProgress(station, snapshot) {
  const activeSnapshot = snapshot || createRouteProgressSnapshot();
  if (!activeSnapshot.stationSummaries.has(station)) {
    activeSnapshot.stationSummaries.set(station, summarizeRouteWords(station?.words || [], activeSnapshot.progressMap));
  }
  return activeSnapshot.stationSummaries.get(station);
}

export function stationMilestoneCount(masteredWords=0){return Math.min(4,Math.max(0,Math.floor((Number(masteredWords)||0)/20)));}

export function storyProgress(route, storyType, snapshot) {
  const activeSnapshot = snapshot || createRouteProgressSnapshot();
  const story = route?.stories?.[storyType] || { stations: [], sections: [], catalogs: [] };
  const words = uniqueWords(story.stations);
  const summary = summarizeRouteWords(words, activeSnapshot.progressMap);
  const completedStations = story.stations.filter((station) => stationWordProgress(station, activeSnapshot).percent === 100);
  const completedSections = story.sections.filter((section) => section.stations.every((station) => stationWordProgress(station, activeSnapshot).percent === 100));
  const completedCatalogs = story.catalogs.filter((catalog) => catalog.sections.every((section) => section.stations.every((station) => stationWordProgress(station, activeSnapshot).percent === 100)));
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

export function allStoryProgress(route, snapshot) {
  const activeSnapshot = snapshot || createRouteProgressSnapshot();
  return Object.fromEntries((route?.storyOrder || []).map((type) => [type, storyProgress(route, type, activeSnapshot)]));
}

export function dictionaryPathProgress(route, progressMap = new Map()) {
  const snapshot = createRouteProgressSnapshot(progressMap);
  const stories = allStoryProgress(route, snapshot);
  const words = uniqueWords((route?.storyOrder || []).flatMap((type) => route.stories[type]?.stations || []));
  const summary = summarizeRouteWords(words, snapshot.progressMap);
  return { percent: summary.percent, rarePercent: 0, stories, totalWords: summary.total, masteredWords: summary.mastered };
}

export function computedStationStatus(station, snapshot) {
  const activeSnapshot = snapshot || createRouteProgressSnapshot();
  const summary = stationWordProgress(station, activeSnapshot);
  if (summary.percent === 100) return summary.review ? 'review_1_due' : 'mastered';
  if (summary.mastered > 0 || summary.review > 0) return 'studying';
  const hasActivity = (station?.words || []).some((word) => {
    const progress = activeSnapshot.progressMap?.get(String(word.id)) || {};
    return progress.study_shown_count > 0 || progress.test_correct_count > 0 || progress.test_wrong_count > 0;
  });
  return hasActivity ? 'studying' : 'available';
}

export function stationsDueForReview(route, progressMap = new Map()) {
  const snapshot = createRouteProgressSnapshot(progressMap);
  return (route?.storyOrder || [])
    .flatMap((type) => route.stories[type]?.stations || [])
    .filter((station) => stationWordProgress(station, snapshot).review > 0);
}

export function uniqueRouteWords(stations = []) {
  return uniqueWords(stations);
}
