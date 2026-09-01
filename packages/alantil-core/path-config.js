export const CORE_PATH_CONFIG = Object.freeze({
  dictionaryId: "alantil-kb-ru",
  review1DelayDays: 1,
  review2DelayDays: 3,
  stationRequiredAccuracy: 80,
  milestoneRequiredAccuracy: 90,
  summitUnlockAscentPercent: 60,
  routeBackground: "first-gorge",
  defaultStoryType: "oblivion",
  storyColumn: "story_type",
  storyOrder: ["oblivion", "roots", "ascent", "pathways"],
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
  OBLIVION: "oblivion",
  ROOTS: "roots",
  ASCENT: "ascent",
  PATHWAYS: "pathways",
});
