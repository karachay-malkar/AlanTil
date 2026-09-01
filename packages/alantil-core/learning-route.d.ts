export type LearningRouteWord = {
  id?: string;
  word_id?: string;
  global_order?: number;
  dict_order?: number;
  story_id?: string;
  story_type?: string;
  story_name?: string;
  story_intro?: string;
  story_order?: number;
  dictionary_id?: string;
  catalog_id?: string;
  dictionary_name?: string;
  section_id?: string;
  group_id?: string;
  section_name?: string;
  set_id?: string;
  set_name?: string;
  required_accuracy?: number;
  [key: string]: unknown;
};

export type LearningRouteStation<T extends LearningRouteWord = LearningRouteWord> = {
  dictionaryId: string;
  catalogId: string;
  catalogName: string;
  sectionId: string;
  sectionName: string;
  groupId: string;
  groupName: string;
  setId: string;
  sourceSetId: string;
  selectionSetId: string;
  setNumber: number;
  name: string;
  words: T[];
  storyType: string;
  storyName: string;
  storyIntro: string;
  isNamedSet: boolean;
  requiredAccuracy: number;
  order: number;
  key: string;
  slug: string;
  anchorWordId: string;
};

export type LearningRouteSection<T extends LearningRouteWord = LearningRouteWord> = {
  dictionaryId: string;
  catalogId: string;
  sectionId: string;
  groupId: string;
  name: string;
  order: number;
  sourceOrder: number;
  stations: LearningRouteStation<T>[];
};

export type LearningRouteCatalog<T extends LearningRouteWord = LearningRouteWord> = {
  dictionaryId: string;
  catalogId: string;
  name: string;
  order: number;
  sourceOrder: number;
  sections: LearningRouteSection<T>[];
  groups: LearningRouteSection<T>[];
  stations: LearningRouteStation<T>[];
};

export type LearningRouteStory<T extends LearningRouteWord = LearningRouteWord> = {
  type: string;
  label: string;
  intro: string;
  order: number;
  catalogs: LearningRouteCatalog<T>[];
  sections: LearningRouteSection<T>[];
  groups: LearningRouteSection<T>[];
  stations: LearningRouteStation<T>[];
  stationCount: number;
  sectionCount: number;
  groupCount: number;
  wordCount: number;
};

export type SlugMap = {
  slugFor(value: unknown): string;
  valueFor(slug: unknown): string | null;
};

export type LearningRoute<T extends LearningRouteWord = LearningRouteWord> = {
  storyOrder: string[];
  storyLabels: Record<string, string>;
  catalogs: LearningRouteCatalog<T>[];
  stories: Record<string, LearningRouteStory<T>>;
  byKey: Map<string, LearningRouteStation<T>>;
  slugMaps: {
    story: SlugMap;
    catalogByStory: Map<string, SlugMap>;
    sectionByCatalog: Map<string, SlugMap>;
    setBySection: Map<string, SlugMap>;
  };
  defaultStoryType: string;
};

export type StationPathParams = {
  storyType: string;
  catalogSlug: string;
  groupSlug: string;
  setSlug: string;
};

export declare function normalizeRouteText(value: unknown): string;
export declare function stationKey(station: Partial<LearningRouteStation>): string;
export declare function routeKeyParts(key: unknown): {
  storyType: string;
  dictionaryId: string;
  catalogId: string;
  sectionId: string;
  groupId: string;
  setId: string;
};
export declare function buildLearningRoute<T extends LearningRouteWord>(words: T[]): LearningRoute<T>;
export declare function stationPathParams<T extends LearningRouteWord>(route: LearningRoute<T>, station: LearningRouteStation<T>): StationPathParams;
export declare function resolveStationFromParams<T extends LearningRouteWord>(route: LearningRoute<T>, params?: Partial<StationPathParams>): LearningRouteStation<T> | null;
