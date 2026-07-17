import { PATH_CONFIG } from "../../config/path.js?v=13.8.1";
import { createSlugMap, toSlug } from "./slugs.js?v=13.8.1";
import { sortNatural } from "./word-selection.js?v=13.8.1";

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
    order: numericOrder(word?.story_order, numericOrder(id, sourceOrder)),
  };
}

function dictionaryDescriptor(word, sourceOrder) {
  const id = stableId(word?.dictionary_id || word?.catalog_id || word?.dict, "dictionary");
  return {
    id,
    name: normalizeRouteText(word?.dictionary_name || word?.dict) || id,
    order: numericOrder(word?.dictionary_order, numericOrder(id, sourceOrder)),
  };
}

function sectionDescriptor(word, sourceOrder) {
  const id = stableId(word?.section_id || word?.group_id || word?.section, "section");
  return {
    id,
    name: normalizeRouteText(word?.section_name || word?.section) || id,
    order: numericOrder(word?.section_order, numericOrder(id, sourceOrder)),
  };
}

function namedSetDescriptor(word, sourceOrder) {
  const id = normalizeRouteText(word?.set_id);
  if (!id) return null;
  return {
    id,
    name: normalizeRouteText(word?.set_name || word?.set) || id,
    order: numericOrder(word?.set_order, numericOrder(id, sourceOrder)),
  };
}

function makeStationKey(station) {
  return [station.storyType, station.dictionaryId, station.catalogId, station.groupId, station.setId]
    .map(normalizeRouteText)
    .join("::");
}

export function stationKey(station) {
  return makeStationKey(station);
}

export function routeKeyParts(key) {
  const [storyType = "", dictionaryId = "", catalogId = "", groupId = "", setId = ""] = String(key || "").split("::");
  return { storyType, dictionaryId, catalogId, groupId, setId };
}


function createStationSlugMap(stations = []) {
  const valueToSlug = new Map();
  const slugToValue = new Map();
  const occupied = new Set();
  stations.forEach((station, index) => {
    const value = String(station.setId || "");
    let base = String(station.slug || toSlug(value, `station-${index + 1}`));
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

function dynamicStationName(start, end) {
  return start === end ? `Слово ${start}` : `Топ ${start}–${end}`;
}

function createNamedStation({ story, dictionary, section, set, words }) {
  const sortedWords = words.slice().sort((left, right) => routeOrder(left, 0) - routeOrder(right, 0));
  const station = {
    dictionaryId: dictionary.id,
    catalogId: dictionary.id,
    catalogName: dictionary.name,
    groupId: section.id,
    groupName: section.name,
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

function createDynamicStations({ story, dictionary, section, words, stationSize }) {
  const sortedWords = words.slice().sort((left, right) => routeOrder(left, 0) - routeOrder(right, 0));
  const output = [];
  for (let offset = 0; offset < sortedWords.length; offset += stationSize) {
    const stationWords = sortedWords.slice(offset, offset + stationSize);
    if (!stationWords.length) continue;
    const first = offset + 1;
    const last = offset + stationWords.length;
    const anchorWordId = String(stationWords[0]?.id || `row-${first}`);
    const station = {
      dictionaryId: dictionary.id,
      catalogId: dictionary.id,
      catalogName: dictionary.name,
      groupId: section.id,
      groupName: section.name,
      setId: `dynamic:${anchorWordId}`,
      sourceSetId: "",
      selectionSetId: `dynamic-section-${section.id}`,
      name: dynamicStationName(first, last),
      words: stationWords,
      storyType: story.id,
      storyName: story.name,
      isNamedSet: false,
      requiredAccuracy: PATH_CONFIG.stationRequiredAccuracy,
      order: routeOrder(stationWords[0], first),
      anchorWordId,
      chunkIndex: output.length + 1,
      stationSize,
    };
    station.key = makeStationKey(station);
    station.slug = `words-${toSlug(anchorWordId, `station-${output.length + 1}`)}`;
    output.push(station);
  }
  return output;
}

export function buildLearningRoute(words, { stationSize = 40 } = {}) {
  const size = Number(stationSize) === 20 ? 20 : 40;
  const source = Array.isArray(words) ? words.filter((word) => word?.id) : [];
  const storiesMap = new Map();

  source.forEach((word, index) => {
    const sourceOrder = index + 1;
    const story = storyDescriptor(word, sourceOrder);
    const dictionary = dictionaryDescriptor(word, sourceOrder);
    const section = sectionDescriptor(word, sourceOrder);
    const namedSet = namedSetDescriptor(word, sourceOrder);

    if (!storiesMap.has(story.id)) {
      storiesMap.set(story.id, { ...story, dictionariesMap: new Map(), sourceOrder });
    }
    const storyNode = storiesMap.get(story.id);
    if (!storyNode.dictionariesMap.has(dictionary.id)) {
      storyNode.dictionariesMap.set(dictionary.id, { ...dictionary, sectionsMap: new Map(), sourceOrder });
    }
    const dictionaryNode = storyNode.dictionariesMap.get(dictionary.id);
    if (!dictionaryNode.sectionsMap.has(section.id)) {
      dictionaryNode.sectionsMap.set(section.id, {
        ...section,
        dynamicWords: [],
        setsMap: new Map(),
        sourceOrder,
      });
    }
    const sectionNode = dictionaryNode.sectionsMap.get(section.id);
    if (namedSet) {
      if (!sectionNode.setsMap.has(namedSet.id)) {
        sectionNode.setsMap.set(namedSet.id, { ...namedSet, words: [], sourceOrder });
      }
      sectionNode.setsMap.get(namedSet.id).words.push(word);
    } else {
      sectionNode.dynamicWords.push(word);
    }
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
        const groups = Array.from(dictionaryNode.sectionsMap.values())
          .map((sectionNode) => {
            const dynamicStations = createDynamicStations({
              story: storyNode,
              dictionary: dictionaryNode,
              section: sectionNode,
              words: sectionNode.dynamicWords,
              stationSize: size,
            });
            const namedStations = Array.from(sectionNode.setsMap.values())
              .sort((left, right) => left.order - right.order || left.sourceOrder - right.sourceOrder || sortNatural(left.name, right.name))
              .map((setNode) => createNamedStation({
                story: storyNode,
                dictionary: dictionaryNode,
                section: sectionNode,
                set: setNode,
                words: setNode.words,
              }));
            const stations = [...dynamicStations, ...namedStations]
              .sort((left, right) => left.order - right.order || sortNatural(left.name, right.name));
            return {
              dictionaryId: dictionaryNode.id,
              catalogId: dictionaryNode.id,
              groupId: sectionNode.id,
              name: sectionNode.name,
              order: sectionNode.order,
              stations,
              sourceOrder: sectionNode.sourceOrder,
            };
          })
          .filter((group) => group.stations.length)
          .sort((left, right) => left.order - right.order || left.sourceOrder - right.sourceOrder || sortNatural(left.name, right.name));
        return {
          dictionaryId: dictionaryNode.id,
          catalogId: dictionaryNode.id,
          name: dictionaryNode.name,
          order: dictionaryNode.order,
          sourceOrder: dictionaryNode.sourceOrder,
          groups,
        };
      })
      .filter((catalog) => catalog.groups.length)
      .sort((left, right) => left.order - right.order || left.sourceOrder - right.sourceOrder || sortNatural(left.name, right.name));

    const groups = catalogs.flatMap((catalog) => catalog.groups);
    const stations = groups.flatMap((group) => group.stations);
    stories[storyId] = {
      type: storyId,
      label: storyNode.name,
      order: storyNode.order,
      catalogs,
      groups,
      stations,
      stationCount: stations.length,
      groupCount: groups.length,
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
      slugMaps.groupByCatalog.set(catalogKey, createSlugMap(catalog.groups.map((group) => group.groupId)));
      catalog.groups.forEach((group) => {
        const groupKey = `${storyId}::${catalog.catalogId}::${group.groupId}`;
        slugMaps.setByGroup.set(groupKey, createStationSlugMap(group.stations));
      });
    });
  });

  const defaultStoryType = stories[PATH_CONFIG.defaultStoryType]
    ? PATH_CONFIG.defaultStoryType
    : (storyOrder[0] || PATH_CONFIG.defaultStoryType);

  return {
    stationSize: size,
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
  const groupKey = `${storyType}::${station.catalogId}::${station.groupId}`;
  return {
    storyType,
    catalogSlug: route.slugMaps.catalogByStory.get(storyType)?.slugFor(station.catalogId) || toSlug(station.catalogId),
    groupSlug: route.slugMaps.groupByCatalog.get(catalogKey)?.slugFor(station.groupId) || toSlug(station.groupId),
    setSlug: station.slug || route.slugMaps.setByGroup.get(groupKey)?.slugFor(station.setId) || toSlug(station.setId),
  };
}

export function resolveStationFromParams(route, params = {}) {
  const story = route.stories[params.storyType] || null;
  if (!story) return null;
  const catalogId = route.slugMaps.catalogByStory.get(params.storyType)?.valueFor(params.catalogSlug);
  if (!catalogId) return null;
  const catalogKey = `${params.storyType}::${catalogId}`;
  const groupId = route.slugMaps.groupByCatalog.get(catalogKey)?.valueFor(params.groupSlug);
  if (!groupId) return null;
  const groupKey = `${params.storyType}::${catalogId}::${groupId}`;
  const setId = route.slugMaps.setByGroup.get(groupKey)?.valueFor(params.setSlug);
  const group = story.groups.find((item) => item.catalogId === catalogId && item.groupId === groupId);
  if (!group) return null;
  if (setId) return group.stations.find((station) => station.setId === setId) || null;
  const anchorSlug = String(params.setSlug || "").replace(/^words-/, "");
  if (!anchorSlug) return null;
  return group.stations.find((station) => station.words.some((word) => toSlug(word.id) === anchorSlug)) || null;
}
