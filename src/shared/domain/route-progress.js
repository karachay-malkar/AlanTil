import { PATH_CONFIG } from "../../config/path.js";
import { getAllStationProgress, getStationProgress } from "../progress/station-progress-store.js";

function percent(done, total) {
  return total ? Math.round((done / total) * 100) : 0;
}

function effectiveStoredStatus(station) {
  return getStationProgress(station)?.status || "";
}

export function storyProgress(route, storyType) {
  const story = route?.stories?.[storyType] || { stations: [], groups: [], catalogs: [] };
  const mastered = story.stations.filter((station) => effectiveStoredStatus(station) === "mastered");
  const completedGroups = story.groups.filter((group) => group.stations.every((station) => effectiveStoredStatus(station) === "mastered"));
  const completedCatalogs = story.catalogs.filter((catalog) => catalog.groups.every((group) => group.stations.every((station) => effectiveStoredStatus(station) === "mastered")));
  const difficulty = {};
  story.stations.forEach((station) => {
    const kind = station.difficulty || "thematic";
    if (!difficulty[kind]) difficulty[kind] = { total: 0, mastered: 0, percent: 0, wordsTotal: 0, wordsMastered: 0, wordPercent: 0 };
    difficulty[kind].total += 1;
    difficulty[kind].wordsTotal += station.words?.length || 0;
    if (effectiveStoredStatus(station) === "mastered") {
      difficulty[kind].mastered += 1;
      difficulty[kind].wordsMastered += station.words?.length || 0;
    }
  });
  Object.values(difficulty).forEach((item) => {
    item.percent = percent(item.mastered, item.total);
    item.wordPercent = percent(item.wordsMastered, item.wordsTotal);
  });
  return {
    totalStations: story.stations.length,
    masteredStations: mastered.length,
    percent: percent(mastered.length, story.stations.length),
    totalGroups: story.groups.length,
    completedGroups: completedGroups.length,
    totalCatalogs: story.catalogs.length,
    completedCatalogs: completedCatalogs.length,
    difficulty,
  };
}

export function allStoryProgress(route) {
  return Object.fromEntries(PATH_CONFIG.storyOrder.map((type) => [type, storyProgress(route, type)]));
}

export function dictionaryPathProgress(route) {
  const progress = allStoryProgress(route);
  const easy = progress.ascent.difficulty.easy?.wordPercent || 0;
  const medium = progress.ascent.difficulty.medium?.wordPercent || 0;
  const hard = progress.summit.difficulty.hard?.wordPercent || 0;
  const base = ((easy * PATH_CONFIG.mainPathWeights.easy)
    + (medium * PATH_CONFIG.mainPathWeights.medium)
    + (hard * PATH_CONFIG.mainPathWeights.hard)) / 100;
  const rare = progress.summit.difficulty.rare?.wordPercent || 0;
  return { percent: Math.round(base), rarePercent: rare, stories: progress };
}

function previousRequiredStation(story, station) {
  const index = story.stations.findIndex((item) => item.key === station.key);
  if (index <= 0) return null;
  return story.stations.slice(0, index).reverse().find((item) => !item.isOptional) || null;
}

function previousTrailStation(story, station) {
  const group = story.groups.find((item) => item.groupId === station.groupId && item.catalogId === station.catalogId);
  if (!group) return null;
  const index = group.stations.findIndex((item) => item.key === station.key);
  return index > 0 ? group.stations[index - 1] : null;
}

export function computedStationStatus(route, station) {
  const stored = effectiveStoredStatus(station);
  if (stored) return stored;
  const story = route.stories[station.storyType];
  if (!story) return "locked";

  if (station.storyType === "summit") {
    const ascent = storyProgress(route, "ascent");
    if (ascent.percent < PATH_CONFIG.summitUnlockAscentPercent) return "locked";
  }

  const previous = station.storyType === "trails"
    ? previousTrailStation(story, station)
    : previousRequiredStation(story, station);
  if (!previous) return "available";
  return effectiveStoredStatus(previous) === "mastered" ? "available" : "locked";
}

export function stationsDueForReview(route) {
  return Object.values(route.stories)
    .flatMap((story) => story.stations)
    .filter((station) => ["review_1_due", "review_2_due"].includes(computedStationStatus(route, station)));
}

export function stationProgressRows() {
  return getAllStationProgress();
}
