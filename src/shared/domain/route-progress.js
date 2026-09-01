import { getAllStationProgress } from "../progress/station-progress-store.js?v=13.13";
import { getWordProgressMap } from "../progress/word-progress-store.js?v=13.9.0";
import {
  allStoryProgress as allSharedStoryProgress,
  computedStationStatus as computedSharedStationStatus,
  createRouteProgressSnapshot as createSharedRouteProgressSnapshot,
  dictionaryPathProgress as sharedDictionaryPathProgress,
  stationWordProgress as sharedStationWordProgress,
  stationsDueForReview as sharedStationsDueForReview,
  storyProgress as sharedStoryProgress,
} from "../../../packages/alantil-core/route-progress.js";

export function createRouteProgressSnapshot() {
  return createSharedRouteProgressSnapshot(getWordProgressMap());
}

export function stationWordProgress(station, snapshot = null) {
  return sharedStationWordProgress(station, snapshot?.progressMap ? snapshot : createRouteProgressSnapshot());
}

export function storyProgress(route, storyType, snapshot = createRouteProgressSnapshot()) {
  return sharedStoryProgress(route, storyType, snapshot);
}

export function allStoryProgress(route, snapshot = createRouteProgressSnapshot()) {
  return allSharedStoryProgress(route, snapshot);
}

export function dictionaryPathProgress(route) {
  return sharedDictionaryPathProgress(route, getWordProgressMap());
}

export function computedStationStatus(route, station, snapshot = null) {
  return computedSharedStationStatus(station, snapshot?.progressMap ? snapshot : createRouteProgressSnapshot());
}

export function stationsDueForReview(route) {
  return sharedStationsDueForReview(route, getWordProgressMap());
}

export function stationProgressRows() {
  return getAllStationProgress();
}
