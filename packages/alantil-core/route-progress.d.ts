export type RouteWord = { id?: unknown; word_id?: unknown; [key: string]: unknown };
export type RouteStation<T extends RouteWord = RouteWord> = { words?: T[]; [key: string]: unknown };
export type RouteSection<T extends RouteWord = RouteWord> = { stations?: RouteStation<T>[]; [key: string]: unknown };
export type RouteCatalog<T extends RouteWord = RouteWord> = { sections?: RouteSection<T>[]; [key: string]: unknown };
export type RouteStory<T extends RouteWord = RouteWord> = { stations?: RouteStation<T>[]; sections?: RouteSection<T>[]; catalogs?: RouteCatalog<T>[]; [key: string]: unknown };
export declare function uniqueRouteWords<T extends RouteWord>(stations?: RouteStation<T>[]): T[];
export declare function routeStationStatus<T extends RouteWord>(station: RouteStation<T>, progressById: Map<string, unknown> | Record<string, unknown>): 'review' | 'mastered' | 'studying' | 'available';
export declare function routeStoryProgress<T extends RouteWord>(story: RouteStory<T>, progressById: Map<string, unknown> | Record<string, unknown>): {
  totalStations: number; masteredStations: number; percent: number; totalWords: number; masteredWords: number; reviewWords: number; totalSections: number; completedSections: number; totalCatalogs: number; completedCatalogs: number;
};
export declare function allRouteStoryProgress(route: { storyOrder?: string[]; stories?: Record<string, RouteStory> }, progressById: Map<string, unknown> | Record<string, unknown>): Record<string, ReturnType<typeof routeStoryProgress>>;
