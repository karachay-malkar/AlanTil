import { PATH_CONFIG, STORY_TYPES } from "../../config/path.js";
import { createSlugMap, toSlug } from "./slugs.js";
import { sortNatural } from "./word-selection.js";

const EASY_RE = /(^|\s)(легк|easy)/i;
const MEDIUM_RE = /(^|\s)(средн|medium)/i;
const HARD_RE = /(^|\s)(сложн|hard)/i;
const RARE_RE = /(^|\s)(редк|rare)/i;
const THEMATIC_RE = /(темат|theme|topic)/i;

export function normalizeRouteText(value) {
  return String(value ?? "").normalize("NFC").trim().replace(/\s+/g, " ");
}

export function difficultyKind(value) {
  const text = normalizeRouteText(value);
  if (EASY_RE.test(text)) return "easy";
  if (MEDIUM_RE.test(text)) return "medium";
  if (RARE_RE.test(text)) return "rare";
  if (HARD_RE.test(text)) return "hard";
  return "thematic";
}

export function storyTypeFor({ catalogId, groupId }) {
  const group = normalizeRouteText(groupId);
  const catalog = normalizeRouteText(catalogId);
  const kind = difficultyKind(group);
  if (kind === "easy" || kind === "medium") return STORY_TYPES.ASCENT;
  if (kind === "hard" || kind === "rare") return STORY_TYPES.SUMMIT;
  if (THEMATIC_RE.test(catalog) || kind === "thematic") return STORY_TYPES.TRAILS;
  return STORY_TYPES.TRAILS;
}

function numericOrder(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function makeStationKey(station) {
  return [station.dictionaryId, station.catalogId, station.groupId, station.setId]
    .map(normalizeRouteText)
    .join("::");
}

export function stationKey(station) {
  return makeStationKey(station);
}

export function routeKeyParts(key) {
  const [dictionaryId = "", catalogId = "", groupId = "", setId = ""] = String(key || "").split("::");
  return { dictionaryId, catalogId, groupId, setId };
}

function firstOrder(words, fallback) {
  const values = words.map((word) => numericOrder(word.dict_order, 0)).filter(Boolean);
  return values.length ? Math.min(...values) : fallback;
}

export function buildLearningRoute(words, { dictionaryId = PATH_CONFIG.dictionaryId } = {}) {
  const source = Array.isArray(words) ? words : [];
  const catalogMap = new Map();
  let sourceIndex = 0;

  source.forEach((word) => {
    const catalogId = normalizeRouteText(word?.catalog_id || word?.dict) || "Словарь";
    const catalogName = normalizeRouteText(word?.dict) || catalogId;
    const groupId = normalizeRouteText(word?.group_id || word?.section) || "Раздел";
    const groupName = normalizeRouteText(word?.section) || groupId;
    const setId = normalizeRouteText(word?.set_id || word?.set);
    const setName = normalizeRouteText(word?.set) || setId;
    if (!word?.id || !setId) return;
    sourceIndex += 1;

    if (!catalogMap.has(catalogId)) {
      catalogMap.set(catalogId, {
        dictionaryId,
        catalogId,
        name: catalogName,
        groupsMap: new Map(),
        sourceOrder: sourceIndex,
      });
    }
    const catalog = catalogMap.get(catalogId);
    if (!catalog.groupsMap.has(groupId)) {
      catalog.groupsMap.set(groupId, {
        dictionaryId,
        catalogId,
        groupId,
        name: groupName,
        stationsMap: new Map(),
        sourceOrder: sourceIndex,
      });
    }
    const group = catalog.groupsMap.get(groupId);
    if (!group.stationsMap.has(setId)) {
      group.stationsMap.set(setId, {
        dictionaryId,
        catalogId,
        groupId,
        setId,
        name: setName,
        description: String(word?.description || "").trim(),
        words: [],
        sourceOrder: sourceIndex,
      });
    }
    group.stationsMap.get(setId).words.push(word);
  });

  const catalogs = Array.from(catalogMap.values()).map((catalog) => {
    const groups = Array.from(catalog.groupsMap.values()).map((group) => {
      const stations = Array.from(group.stationsMap.values())
        .map((station, index) => {
          const difficulty = difficultyKind(station.groupId);
          const storyType = storyTypeFor(station);
          const normalized = {
            ...station,
            storyType: station.words[0]?.story_type || storyType,
            difficulty,
            order: station.words[0]?.order_override || firstOrder(station.words, station.sourceOrder || index + 1),
            isOptional: Boolean(station.words[0]?.is_optional),
            requiredAccuracy: Number(station.words[0]?.required_accuracy || PATH_CONFIG.stationRequiredAccuracy),
            backgroundSegment: station.words[0]?.background_segment || "",
            positionX: Number.isFinite(station.words[0]?.position_x) ? station.words[0].position_x : null,
            positionY: Number.isFinite(station.words[0]?.position_y) ? station.words[0].position_y : null,
            rewardId: station.words[0]?.reward_id || "",
            reviewSchedule: station.words[0]?.review_schedule || "",
          };
          normalized.key = makeStationKey(normalized);
          normalized.slug = toSlug(station.setId, `station-${index + 1}`);
          return normalized;
        })
        .sort((left, right) => left.order - right.order || sortNatural(left.name, right.name));
      return {
        ...group,
        storyType: stations[0]?.storyType || storyTypeFor(group),
        difficulty: stations[0]?.difficulty || difficultyKind(group.groupId),
        stations,
        order: Math.min(...stations.map((station) => station.order), group.sourceOrder),
      };
    }).sort((left, right) => left.order - right.order || sortNatural(left.name, right.name));
    return {
      ...catalog,
      groups,
      storyTypes: Array.from(new Set(groups.map((group) => group.storyType))),
      order: Math.min(...groups.map((group) => group.order), catalog.sourceOrder),
    };
  }).sort((left, right) => left.order - right.order || sortNatural(left.name, right.name));

  const stories = {};
  PATH_CONFIG.storyOrder.forEach((type) => {
    stories[type] = { type, label: PATH_CONFIG.storyLabels[type], catalogs: [], groups: [], stations: [] };
  });

  catalogs.forEach((catalog) => {
    PATH_CONFIG.storyOrder.forEach((type) => {
      const groups = catalog.groups.filter((group) => group.storyType === type);
      if (!groups.length) return;
      const storyCatalog = { ...catalog, groups };
      stories[type].catalogs.push(storyCatalog);
      stories[type].groups.push(...groups);
      stories[type].stations.push(...groups.flatMap((group) => group.stations));
    });
  });

  Object.values(stories).forEach((story) => {
    story.stationCount = story.stations.length;
    story.groupCount = story.groups.length;
  });

  const byKey = new Map(Object.values(stories).flatMap((story) => story.stations).map((station) => [station.key, station]));
  const slugMaps = {
    catalog: createSlugMap(catalogs.map((catalog) => catalog.catalogId)),
    groupByCatalog: new Map(),
    setByGroup: new Map(),
  };
  catalogs.forEach((catalog) => {
    slugMaps.groupByCatalog.set(catalog.catalogId, createSlugMap(catalog.groups.map((group) => group.groupId)));
    catalog.groups.forEach((group) => {
      slugMaps.setByGroup.set(`${catalog.catalogId}::${group.groupId}`, createSlugMap(group.stations.map((station) => station.setId)));
    });
  });

  return { dictionaryId, catalogs, stories, byKey, slugMaps };
}

export function stationPathParams(route, station) {
  return {
    storyType: station.storyType,
    catalogSlug: route.slugMaps.catalog.slugFor(station.catalogId),
    groupSlug: route.slugMaps.groupByCatalog.get(station.catalogId)?.slugFor(station.groupId) || toSlug(station.groupId),
    setSlug: route.slugMaps.setByGroup.get(`${station.catalogId}::${station.groupId}`)?.slugFor(station.setId) || toSlug(station.setId),
  };
}

export function resolveStationFromParams(route, params = {}) {
  const story = route.stories[params.storyType] || null;
  if (!story) return null;
  const catalogId = route.slugMaps.catalog.valueFor(params.catalogSlug);
  if (!catalogId) return null;
  const groupId = route.slugMaps.groupByCatalog.get(catalogId)?.valueFor(params.groupSlug);
  if (!groupId) return null;
  const setId = route.slugMaps.setByGroup.get(`${catalogId}::${groupId}`)?.valueFor(params.setSlug);
  if (!setId) return null;
  return story.stations.find((station) => station.catalogId === catalogId && station.groupId === groupId && station.setId === setId) || null;
}
