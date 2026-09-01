import { buildLearningRoute } from '../../../packages/alantil-core/learning-route.js';
import type { MobileWord, StoryCopyRow } from '@/src/mobile/dictionary';
import { displayedStoryCopy, displayedStructureName } from '@/src/mobile/dictionary';
import type { UserSettings } from '@/src/mobile/settings';

export type MobileRouteStation = {
  key: string;
  storyId: string;
  dictionaryId: string;
  dictionaryName: string;
  sectionId: string;
  sectionName: string;
  setId: string;
  setName: string;
  setNumber: number;
  name: string;
  order: number;
  words: MobileWord[];
};

export type MobileRouteSection = { id: string; name: string; order: number; stations: MobileRouteStation[] };
export type MobileRouteCatalog = { id: string; name: string; order: number; sections: MobileRouteSection[]; stations: MobileRouteStation[] };
export type MobileRouteStory = { id: string; name: string; intro: string; catalogs: MobileRouteCatalog[]; sections: MobileRouteSection[]; stations: MobileRouteStation[] };
export type MobileRoute = { storyOrder: string[]; stories: Record<string, MobileRouteStory>; byKey: Map<string, MobileRouteStation> };

function text(value: unknown) {
  return String(value ?? '').normalize('NFC').trim();
}

function routeInput(word: MobileWord, settings: UserSettings, storyCopy: Map<string, StoryCopyRow>) {
  const localizedCopy = displayedStoryCopy(storyCopy.get(text(word.story_id)), settings);
  return {
    id: text(word.word_id),
    word_id: text(word.word_id),
    global_order: Number(word.global_order || 0),
    story_id: text(word.story_id),
    story_name: localizedCopy.name || displayedStructureName(word, 'story_name', settings),
    story_intro: localizedCopy.intro,
    dictionary_id: text(word.dictionary_id),
    dictionary_name: displayedStructureName(word, 'dictionary_name', settings),
    section_id: text(word.section_id),
    section_name: displayedStructureName(word, 'section_name', settings),
    set_id: text(word.set_id),
    set_name: displayedStructureName(word, 'set_name', settings),
  };
}

export function buildMobileRouteFromShared(words: MobileWord[], copy: StoryCopyRow[], settings: UserSettings): MobileRoute {
  const storyCopy = new Map((Array.isArray(copy) ? copy : []).map((row) => [text(row.entity_id), row]));
  const wordById = new Map((Array.isArray(words) ? words : []).map((word) => [text(word.word_id), word]));
  const shared = buildLearningRoute((Array.isArray(words) ? words : []).map((word) => routeInput(word, settings, storyCopy)));
  const stories: Record<string, MobileRouteStory> = {};
  const byKey = new Map<string, MobileRouteStation>();

  shared.storyOrder.forEach((storyId: string) => {
    const sharedStory = shared.stories[storyId];
    const catalogs: MobileRouteCatalog[] = sharedStory.catalogs.map((catalog: any) => {
      const sections: MobileRouteSection[] = catalog.sections.map((section: any) => {
        const stations: MobileRouteStation[] = section.stations.map((station: any) => {
          const mapped: MobileRouteStation = {
            key: station.key,
            storyId: station.storyType,
            dictionaryId: station.dictionaryId,
            dictionaryName: station.catalogName || catalog.name || station.dictionaryId,
            sectionId: station.sectionId,
            sectionName: station.sectionName || section.name || station.sectionId,
            setId: station.setId,
            setName: station.name || '',
            setNumber: Number(station.setNumber || 0),
            name: station.name || (station.setNumber ? String(station.setNumber).padStart(2, '0') : station.setId),
            order: Number(station.order || 0),
            words: station.words.map((word: any) => wordById.get(text(word.id || word.word_id))).filter((word: MobileWord | undefined): word is MobileWord => Boolean(word)),
          };
          byKey.set(mapped.key, mapped);
          return mapped;
        });
        return { id: section.sectionId, name: section.name || section.sectionId, order: Number(section.order || 0), stations };
      });
      return {
        id: catalog.catalogId,
        name: catalog.name || catalog.catalogId,
        order: Number(catalog.order || 0),
        sections,
        stations: sections.flatMap((section) => section.stations),
      };
    });
    stories[storyId] = {
      id: storyId,
      name: sharedStory.label || storyId,
      intro: sharedStory.intro || '',
      catalogs,
      sections: catalogs.flatMap((catalog) => catalog.sections),
      stations: catalogs.flatMap((catalog) => catalog.stations),
    };
  });

  return { storyOrder: shared.storyOrder.slice(), stories, byKey };
}

const bundleCache = new Map<string, unknown>();

export function pathBundleCacheKey(settings: UserSettings, userId?: string | null, revision = 0) {
  return [
    text(userId) || 'guest',
    settings.interface_language_code,
    settings.translation_language_code,
    settings.alan_script_code,
    settings.alan_dialect_code,
    String(revision),
  ].join('::');
}

export function getCachedPathBundle<T>(key: string): T | null {
  return (bundleCache.get(key) as T | undefined) ?? null;
}

export function setCachedPathBundle<T>(key: string, bundle: T): T {
  bundleCache.set(key, bundle);
  if (bundleCache.size > 8) bundleCache.delete(bundleCache.keys().next().value as string);
  return bundle;
}

export function clearPathBundleCache() {
  bundleCache.clear();
}
