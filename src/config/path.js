import { msg } from "../shared/i18n/index.js?v=13.9.0";
export const PATH_CONFIG = Object.freeze({
  dictionaryId: "alantil-kb-ru",
  review1DelayDays: 1,
  review2DelayDays: 3,
  stationRequiredAccuracy: 80,
  milestoneRequiredAccuracy: 90,
  summitUnlockAscentPercent: 60,
  routeBackground: "first-gorge",
  defaultStoryType: "ascent",
  storyColumn: "story_type",
  storyOrder: ["ascent", "summit", "trails"],
  storyLabels: Object.freeze({
    get ascent() { return msg("path.voshozhdenie"); },
    get summit() { return msg("path.na_vershine"); },
    get trails() { return msg("path.tropy"); },
  }),
  mainPathWeights: Object.freeze({
    easy: 50,
    medium: 30,
    hard: 20,
  }),
});

export const STATION_STATUSES = Object.freeze([
  "locked",
  "available",
  "studying",
  "test_ready",
  "review_1_waiting",
  "review_1_due",
  "review_2_waiting",
  "review_2_due",
  "mastered",
]);

export const STORY_TYPES = Object.freeze({
  ASCENT: "ascent",
  SUMMIT: "summit",
  TRAILS: "trails",
});
