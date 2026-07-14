export const PATH_CONFIG = Object.freeze({
  dictionaryId: "alantil-kb-ru",
  review1DelayDays: 1,
  review2DelayDays: 3,
  stationRequiredAccuracy: 80,
  milestoneRequiredAccuracy: 90,
  summitUnlockAscentPercent: 60,
  routeBackground: "first-gorge",
  storyOrder: ["ascent", "summit", "trails"],
  storyLabels: Object.freeze({
    ascent: "Восхождение",
    summit: "На вершине",
    trails: "Тропы",
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
