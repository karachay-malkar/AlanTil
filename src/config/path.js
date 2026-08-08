import { msg } from "../shared/i18n/index.js?v=13.9.0";
export const PATH_CONFIG = Object.freeze({
  dictionaryId: "alantil-kb-ru",
  review1DelayDays: 1,
  review2DelayDays: 3,
  stationRequiredAccuracy: 80,
  milestoneRequiredAccuracy: 90,
  summitUnlockAscentPercent: 60,
  routeBackground: "first-gorge",
  defaultStoryType: "roots",
  storyColumn: "story_type",
  storyOrder: ["roots", "ascent", "pathways"],
  storyLabels: Object.freeze({
    get roots() { return msg("path.voshozhdenie"); },
    get ascent() { return msg("path.na_vershine"); },
    get pathways() { return msg("path.tropy"); },
  }),
  mainPathWeights: Object.freeze({
    beginner: 50,
    intermediate: 30,
    advanced: 20,
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
  ROOTS: "roots",
  ASCENT: "ascent",
  PATHWAYS: "pathways",
});
