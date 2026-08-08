import { PATH_CONFIG } from "../../config/path.js?v=13.12";
import { createSlugMap, toSlug } from "./slugs.js?v=13.9.0";
import { sortNatural } from "./word-selection.js?v=13.12";

export function normalizeRouteText(value) {
  return String(value ?? "").normalize("NFC").trim().replace(/\s+/g, " ");
}

function numericOrder(value, fallback = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function routeOrder(word, fallback) {
  return numericOrder(word?.global_order, numericOrder(word?.dict_order, fallback));
}

function stableId(value, fallback) {
  return normalizeRouteText(value) || fallback;
}

function storyDescriptor(word, sourceOrder) {
  const id = stableId(word?.story_id || word?.story_type, PATH_CONFIG.defaultStoryType);
  return {
    id,
    name: normalizeRouteText(word?.story_name) || id,
    order: numericOrder(word?.story_order, sourceOrder),
  };
}

function dictionaryDescriptor(word, sourceOrder) {
  const id = stableId(word?.dictionary_id || word?.catalog_id || word?.dict, "dictionary");
  return {
    id,
    name: normalizeRouteText(word?.dictionary_name || word?.dict) || id,
    order: routeOrder(word, sourceOrder),
  };
}

function setDescriptor(word, sourceOrder) {
  const id = normalizeRouteText(word?.set_id || word?.set);
  if (!id) return null;
  return {
    id,
    name: normalizeRouteText(word?.set_name || word?.set) || id,
    order: routeOrder(word, sourceOrder),
  };
}

function makeStationKey(station) {
  return [station.storyType, station.dictionaryId, station.setId]
    .map(normalizeRouteText)
    .join("::");
}

export function stationKey(station) {
  return makeStationKey(station);
}

export function routeKeyParts(key) {
  const [storyType = "", dictionaryId = "", setId = ""] = String(key || "").split("::");
  return {
    storyType,
    dictionaryId,
    catalogId: dictionaryId,
    groupId: dictionaryId,
    setId,
  };
}

function createStationSlugMap(stations = []) {
  const valueToSlug = new Map();
  const slugToValue = new Map();
  const occupied = new Set();
  stations.forEach((station, index) => {
    const value = String(station.setId || "");
    const base = String(station.slug || toSlug(value, `station-${index + 1}`));
    let slug = base;
    let suffix = 2;
    while (occupied.has(slug)) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    occupied.add(slug);
    valueToSlug.set(value, slug);
    slugToValue.set(slug, value);
  });
  return {
    slugFor(value) { return valueToSlug.get(String(value ?? "")) || toSlug(value); },
    valueFor(slug) { return slugToValue.get(String(slug || "").toLowerCase()) || null; },
  };
}

function createStation({ story, dictionary, set, words }) {
  const sortedWords = words.slice().sort((left, right) => routeOrder(left, 0) - routeOrder(right, 0));
  const station = {
    dictionaryId: dictionary.id,
    catalogId: dictionary.id,
    catalogName: dictionary.name,
    // Progress/session tables still have legacy catalog/group columns. Both
    // now point to the real dictionary; there is no content section entity.
    groupId: dictionary.id,
    groupName: dictionary.name,
    setId: set.id,
    sourceSetId: set.id,
    selectionSetId: set.id,
    name: set.name,
    words: sortedWords,
    storyType: story.id,
    storyName: story.name,
    isNamedSet: true,
    requiredAccuracy: Number(sortedWords[0]?.required_accuracy || PATH_CONFIG.stationRequiredAccuracy),
    order: Math.min(...sortedWords.map((word, index) => routeOrder(word, index + 1))),
  };
  station.key = makeStationKey(station);
  station.slug = toSlug(set.id, `set-${set.id}`);
  station.anchorWordId = String(sortedWords[0]?.id || "");
  return station;
}

export function buildLearningRoute(words) {
  const source = Array.isArray(words) ? words.filter((word) => word?.id && word?.dictionary_id && word?.set_id) : [];
  const storiesMap = new Map();

  source.forEach((word, index) => {
    const sourceOrder = index + 1;
    const story = storyDescriptor(word, sourceOrder);
    const dictionary = dictionaryDescriptor(word, sourceOrder);
    const set = setDescriptor(word, sourceOrder);
    if (!set) return;

    if (!storiesMap.has(story.id)) {
      storiesMap.set(story.id, { ...story, dictionariesMap: new Map(), sourceOrder });
    }
    const storyNode = storiesMap.get(story.id);
    if (!storyNode.dictionariesMap.has(dictionary.id)) {
      storyNode.dictionariesMap.set(dictionary.id, { ...dictionary, setsMap: new Map(), sourceOrder });
    }
    const dictionaryNode = storyNode.dictionariesMap.get(dictionary.id);
    if (!dictionaryNode.setsMap.has(set.id)) {
      dictionaryNode.setsMap.set(set.id, { ...set, words: [], sourceOrder });
    }
    dictionaryNode.setsMap.get(set.id).words.push(word);
  });

  const storyOrder = Array.from(storiesMap.values())
    .sort((left, right) => left.order - right.order || left.sourceOrder - right.sourceOrder || sortNatural(left.name, right.name))
    .map((story) => story.id);
  const stories = {};
  const allCatalogs = [];

  storyOrder.forEach((storyId) => {
    const storyNode = storiesMap.get(storyId);
    const catalogs = Array.from(storyNode.dictionariesMap.values())
      .map((dictionaryNode) => {
        const stations = Array.from(dictionaryNode.setsMap.values())
          .sort((left, right) => left.order - right.order || left.sourceOrder - right.sourceOrder || sortNatural(left.name, right.name))
          .map((setNode) => createStation({
            story: storyNode,
            dictionary: dictionaryNode,
            set: setNode,
            words: setNode.words,
          }));
        return {
          dictionaryId: dictionaryNode.id,
          catalogId: dictionaryNode.id,
          name: dictionaryNode.name,
          order: dictionaryNode.order,
          sourceOrder: dictionaryNode.sourceOrder,
          stations,
          // Compatibility for existing route/progress presentation only.
          groups: [{
            dictionaryId: dictionaryNode.id,
            catalogId: dictionaryNode.id,
            groupId: dictionaryNode.id,
            name: dictionaryNode.name,
            order: dictionaryNode.order,
            sourceOrder: dictionaryNode.sourceOrder,
            stations,
          }],
        };
      })
      .filter((catalog) => catalog.stations.length)
      .sort((left, right) => left.order - right.order || left.sourceOrder - right.sourceOrder || sortNatural(left.name, right.name));

    const groups = catalogs.flatMap((catalog) => catalog.groups);
    const stations = catalogs.flatMap((catalog) => catalog.stations);
    stories[storyId] = {
      type: storyId,
      label: storyNode.name,
      order: storyNode.order,
      catalogs,
      groups,
      stations,
      stationCount: stations.length,
      groupCount: catalogs.length,
      wordCount: stations.reduce((sum, station) => sum + station.words.length, 0),
    };
    allCatalogs.push(...catalogs);
  });

  const allStations = storyOrder.flatMap((storyId) => stories[storyId].stations);
  const byKey = new Map(allStations.map((station) => [station.key, station]));
  const slugMaps = {
    story: createSlugMap(storyOrder),
    catalogByStory: new Map(),
    groupByCatalog: new Map(),
    setByGroup: new Map(),
  };

  storyOrder.forEach((storyId) => {
    const story = stories[storyId];
    slugMaps.catalogByStory.set(storyId, createSlugMap(story.catalogs.map((catalog) => catalog.catalogId)));
    story.catalogs.forEach((catalog) => {
      const catalogKey = `${storyId}::${catalog.catalogId}`;
      slugMaps.groupByCatalog.set(catalogKey, createSlugMap([catalog.catalogId]));
      const groupKey = `${storyId}::${catalog.catalogId}::${catalog.catalogId}`;
      slugMaps.setByGroup.set(groupKey, createStationSlugMap(catalog.stations));
    });
  });

  const defaultStoryType = stories[PATH_CONFIG.defaultStoryType]
    ? PATH_CONFIG.defaultStoryType
    : (storyOrder[0] || PATH_CONFIG.defaultStoryType);

  return {
    storyOrder,
    storyLabels: Object.fromEntries(storyOrder.map((type) => [type, stories[type].label])),
    catalogs: allCatalogs,
    stories,
    byKey,
    slugMaps,
    defaultStoryType,
  };
}

export function stationPathParams(route, station) {
  const storyType = station.storyType;
  const catalogKey = `${storyType}::${station.catalogId}`;
  const groupKey = `${storyType}::${station.catalogId}::${station.catalogId}`;
  return {
    storyType,
    catalogSlug: route.slugMaps.catalogByStory.get(storyType)?.slugFor(station.catalogId) || toSlug(station.catalogId),
    groupSlug: route.slugMaps.groupByCatalog.get(catalogKey)?.slugFor(station.catalogId) || toSlug(station.catalogId),
    setSlug: station.slug || route.slugMaps.setByGroup.get(groupKey)?.slugFor(station.setId) || toSlug(station.setId),
  };
}

export function resolveStationFromParams(route, params = {}) {
  const story = route.stories[params.storyType] || null;
  if (!story) return null;
  const catalogId = route.slugMaps.catalogByStory.get(params.storyType)?.valueFor(params.catalogSlug);
  if (!catalogId) return null;
  const catalog = story.catalogs.find((item) => item.catalogId === catalogId);
  if (!catalog) return null;
  const catalogKey = `${params.storyType}::${catalogId}`;
  const groupId = route.slugMaps.groupByCatalog.get(catalogKey)?.valueFor(params.groupSlug);
  if (groupId !== catalogId) return null;
  const groupKey = `${params.storyType}::${catalogId}::${catalogId}`;
  const setId = route.slugMaps.setByGroup.get(groupKey)?.valueFor(params.setSlug);
  if (!setId) return null;
  return catalog.stations.find((station) => station.setId === setId) || null;
}
