import { msg } from "../shared/i18n/index.js?v=13.9.0";
import { CORE_PATH_CONFIG, STATION_STATUSES, STORY_TYPES } from "../../packages/alantil-core/path-config.js";

export const PATH_CONFIG = Object.freeze({
  ...CORE_PATH_CONFIG,
  storyLabels: Object.freeze({
    get oblivion() { return "На пороге забвения"; },
    get roots() { return msg("path.voshozhdenie"); },
    get ascent() { return msg("path.na_vershine"); },
    get pathways() { return msg("path.tropy"); },
  }),
});

export { STATION_STATUSES, STORY_TYPES };
