import { CORE_PATH_CONFIG } from "./path-config.js";
import { sortNatural } from "./practice.js";
import { createSlugMap, toSlug } from "./slugs.js";

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

function setOrdinal(value) {
  const match = String(value || "").match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function storyDescriptor(word, sourceOrder) {
  const id = stableId(word?.story_id || word?.story_type, CORE_PATH_CONFIG.defaultStoryType);
  return {
    id,
    name: normalizeRouteText(word?.story_name),
    intro: normalizeRouteText(word?.story_intro),
    order: numericOrder(word?.story_order, sourceOrder),
  };
}

function dictionaryDescriptor(word, sourceOrder) {
  const id = stableId(word?.dictionary_id || word?.catalog_id, "dictionary");
  return {
    id,
    name: normalizeRouteText(word?.dictionary_name),
    order: routeOrder(word, sourceOrder),
  };
}

function sectionDescriptor(word, sourceOrder) {
  const id = normalizeRouteText(word?.section_id || word?.group_id);
  if (!id) return null;
  return {
    id,
    name: normalizeRouteText(word?.section_name),
    order: routeOrder(word, sourceOrder),
  };
}

function setDescriptor(word, sourceOrder) {
  const id = normalizeRouteText(word?.set_id);
  if (!id) return null;
  return {
    id,
    name: normalizeRouteText(word?.set_name),
    ordinal: setOrdinal(id),
    order: routeOrder(word, sourceOrder),
  };
}

function makeStationKey(station) {
  return [station.storyType, station.dictionaryId, station.sectionId, station.setId]
    .map(normalizeRouteText)
    .join("::");
}

export function stationKey(station) {
  return makeStationKey(station);
}

export function routeKeyParts(key) {
  const parts = String(key || "").split("::");
  const legacy = parts.length === 3;
  const [storyType = "", dictionaryId = ""] = parts;
  const sectionId = legacy ? dictionaryId : (parts[2] || "");
  const setId = legacy ? (parts[2] || "") : (parts[3] || "");
  return {
    storyType,
    dictionaryId,
    catalogId: dictionaryId,
    sectionId,
    groupId: sectionId,
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

function createStation({ story, dictionary, section, set, words }) {
  const sortedWords = words.slice().sort((left, right) => routeOrder(left, 0) - routeOrder(right, 0));
  const numberLabel = set.ordinal ? String(set.ordinal).padStart(2, "0") : "";
  const station = {
    dictionaryId: dictionary.id,
    catalogId: dictionary.id,
    catalogName: dictionary.name,
    sectionId: section.id,
    sectionName: section.name,
    groupId: section.id,
    groupName: section.name,
    setId: set.id,
    sourceSetId: set.id,
    selectionSetId: set.id,
    setNumber: set.ordinal,
    name: set.name || numberLabel,
    words: sortedWords,
    storyType: story.id,
    storyName: story.name,
    storyIntro: story.intro,
    isNamedSet: Boolean(set.name),
    requiredAccuracy: Number(sortedWords[0]?.required_accuracy || CORE_PATH_CONFIG.stationRequiredAccuracy),
    order: Math.min(...sortedWords.map((word, index) => routeOrder(word, index + 1))),
  };
  station.key = makeStationKey(station);
  station.slug = toSlug(set.id, `set-${set.ordinal || 1}`);
  station.anchorWordId = String(sortedWords[0]?.id || "");
  return station;
}

export function buildLearningRoute(words) {
  const source = Array.isArray(words)
    ? words.filter((word) => word?.id && word?.story_id && word?.dictionary_id && word?.section_id && word?.set_id)
    : [];
  const storiesMap = new Map();

  source.forEach((word, index) => {
    const sourceOrder = index + 1;
    const story = storyDescriptor(word, sourceOrder);
    const dictionary = dictionaryDescriptor(word, sourceOrder);
    const section = sectionDescriptor(word, sourceOrder);
    const set = setDescriptor(word, sourceOrder);
    if (!section || !set) return;

    if (!storiesMap.has(story.id)) {
      storiesMap.set(story.id, { ...story, dictionariesMap: new Map(), sourceOrder });
    }
    const storyNode = storiesMap.get(story.id);
    if (!storyNode.name && story.name) storyNode.name = story.name;
    if (!storyNode.intro && story.intro) storyNode.intro = story.intro;

    if (!storyNode.dictionariesMap.has(dictionary.id)) {
      storyNode.dictionariesMap.set(dictionary.id, { ...dictionary, sectionsMap: new Map(), sourceOrder });
    }
    const dictionaryNode = storyNode.dictionariesMap.get(dictionary.id);
    if (!dictionaryNode.sectionsMap.has(section.id)) {
      dictionaryNode.sectionsMap.set(section.id, { ...section, setsMap: new Map(), sourceOrder });
    }
    const sectionNode = dictionaryNode.sectionsMap.get(section.id);
    if (!sectionNode.setsMap.has(set.id)) {
      sectionNode.setsMap.set(set.id, { ...set, words: [], sourceOrder });
    }
    sectionNode.setsMap.get(set.id).words.push(word);
  });

  const preferredOrder = new Map(CORE_PATH_CONFIG.storyOrder.map((id, index) => [id, index]));
  const storyOrder = Array.from(storiesMap.values())
    .sort((left, right) => (preferredOrder.get(left.id) ?? 999) - (preferredOrder.get(right.id) ?? 999)
      || left.order - right.order
      || left.sourceOrder - right.sourceOrder
      || sortNatural(left.name, right.name))
    .map((story) => story.id);
  const stories = {};
  const allCatalogs = [];

  storyOrder.forEach((storyId) => {
    const storyNode = storiesMap.get(storyId);
    const catalogs = Array.from(storyNode.dictionariesMap.values())
      .map((dictionaryNode) => {
        const sections = Array.from(dictionaryNode.sectionsMap.values())
          .map((sectionNode) => {
            const stations = Array.from(sectionNode.setsMap.values())
              .sort((left, right) => left.order - right.order || left.sourceOrder - right.sourceOrder || sortNatural(left.id, right.id))
              .map((setNode) => createStation({
                story: storyNode,
                dictionary: dictionaryNode,
                section: sectionNode,
                set: setNode,
                words: setNode.words,
              }));
            return {
              dictionaryId: dictionaryNode.id,
              catalogId: dictionaryNode.id,
              sectionId: sectionNode.id,
              groupId: sectionNode.id,
              name: sectionNode.name,
              order: sectionNode.order,
              sourceOrder: sectionNode.sourceOrder,
              stations,
            };
          })
          .filter((section) => section.stations.length)
          .sort((left, right) => left.order - right.order || left.sourceOrder - right.sourceOrder || sortNatural(left.name, right.name));
        const stations = sections.flatMap((section) => section.stations);
        return {
          dictionaryId: dictionaryNode.id,
          catalogId: dictionaryNode.id,
          name: dictionaryNode.name,
          order: dictionaryNode.order,
          sourceOrder: dictionaryNode.sourceOrder,
          sections,
          groups: sections,
          stations,
        };
      })
      .filter((catalog) => catalog.stations.length)
      .sort((left, right) => left.order - right.order || left.sourceOrder - right.sourceOrder || sortNatural(left.name, right.name));

    const sections = catalogs.flatMap((catalog) => catalog.sections);
    const stations = catalogs.flatMap((catalog) => catalog.stations);
    stories[storyId] = {
      type: storyId,
      label: storyNode.name,
      intro: storyNode.intro,
      order: storyNode.order,
      catalogs,
      sections,
      groups: sections,
      stations,
      stationCount: stations.length,
      sectionCount: sections.length,
      groupCount: sections.length,
      wordCount: stations.reduce((sum, station) => sum + station.words.length, 0),
    };
    allCatalogs.push(...catalogs);
  });

  const allStations = storyOrder.flatMap((storyId) => stories[storyId].stations);
  const byKey = new Map(allStations.map((station) => [station.key, station]));
  const slugMaps = {
    story: createSlugMap(storyOrder),
    catalogByStory: new Map(),
    sectionByCatalog: new Map(),
    setBySection: new Map(),
  };

  storyOrder.forEach((storyId) => {
    const story = stories[storyId];
    slugMaps.catalogByStory.set(storyId, createSlugMap(story.catalogs.map((catalog) => catalog.catalogId)));
    story.catalogs.forEach((catalog) => {
      const catalogKey = `${storyId}::${catalog.catalogId}`;
      slugMaps.sectionByCatalog.set(catalogKey, createSlugMap(catalog.sections.map((section) => section.sectionId)));
      catalog.sections.forEach((section) => {
        const sectionKey = `${storyId}::${catalog.catalogId}::${section.sectionId}`;
        slugMaps.setBySection.set(sectionKey, createStationSlugMap(section.stations));
      });
    });
  });

  const defaultStoryType = stories[CORE_PATH_CONFIG.defaultStoryType]
    ? CORE_PATH_CONFIG.defaultStoryType
    : (storyOrder[0] || CORE_PATH_CONFIG.defaultStoryType);

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
  const sectionKey = `${storyType}::${station.catalogId}::${station.sectionId}`;
  return {
    storyType,
    catalogSlug: route.slugMaps.catalogByStory.get(storyType)?.slugFor(station.catalogId) || toSlug(station.catalogId),
    groupSlug: route.slugMaps.sectionByCatalog.get(catalogKey)?.slugFor(station.sectionId) || toSlug(station.sectionId),
    setSlug: station.slug || route.slugMaps.setBySection.get(sectionKey)?.slugFor(station.setId) || toSlug(station.setId),
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
  const sectionId = route.slugMaps.sectionByCatalog.get(catalogKey)?.valueFor(params.groupSlug);
  if (!sectionId) return null;
  const section = catalog.sections.find((item) => item.sectionId === sectionId);
  if (!section) return null;
  const sectionKey = `${params.storyType}::${catalogId}::${sectionId}`;
  const setId = route.slugMaps.setBySection.get(sectionKey)?.valueFor(params.setSlug);
  if (!setId) return null;
  return section.stations.find((station) => station.setId === setId) || null;
}
