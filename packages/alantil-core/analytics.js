export const EVENTS = Object.freeze({
  APP_OPEN: 'app_open', SCREEN_TIME: 'screen_time', ACTIVITY_START: 'activity_start', ACTIVITY_COMPLETE: 'activity_complete', ACTIVITY_ABANDON: 'activity_abandon', WORD_RESULT: 'word_result',
  SONGS_OPEN: 'songs_open', PLAYLIST_OPEN: 'playlist_open', SONG_OPEN: 'song_open', SONG_PLAY: 'song_play', SONG_PAUSE: 'song_pause', SONG_COMPLETE: 'song_complete', SONG_PROGRESS: 'song_progress',
  FAVORITE_WORD_ADD: 'favorite_word_add', FAVORITE_WORD_REMOVE: 'favorite_word_remove', FAVORITE_SONG_ADD: 'favorite_song_add', FAVORITE_SONG_REMOVE: 'favorite_song_remove',
  SEARCH_OPEN: 'search_open', SEARCH_RESULT: 'search_result', SEARCH_EMPTY: 'search_empty', DICTIONARY_OPEN: 'dictionary_open', SECTION_OPEN: 'section_open', SET_OPEN: 'set_open',
});
export const DOMAIN_EVENTS=Object.freeze({TEST_CORRECT:'test.answer.correct',TEST_WRONG:'test.answer.wrong',MATCH_CORRECT:'match.pair.correct',MATCH_WRONG:'match.pair.wrong',LEARN_KNOWN:'learn.known',LEARN_UNKNOWN:'learn.unknown',SESSION_COMPLETED:'session.completed',SESSION_INTERRUPTED:'session.interrupted'});
export const ACTIVITY_TYPES = Object.freeze({ LEARN: 'learn', TEST: 'test', MATCH: 'match' });
export const DIRECTIONS = Object.freeze({ ALAN_RU: 'alan_ru', RU_ALAN: 'ru_alan', NONE: 'none' });
export const CANCEL_REASONS = Object.freeze({ BACK: 'back', HOME: 'home', ROUTE_CHANGE: 'route_change', RELOAD: 'reload', CLOSE: 'close', NEW_SESSION: 'new_session' });
export const WORD_SOURCES = Object.freeze({ LEARN: 'learn', TEST: 'test', MATCH: 'match', SONG: 'song' });
export const WORD_RESULTS = Object.freeze({ KNOWN: 'known', UNKNOWN: 'unknown', CORRECT: 'correct', WRONG: 'wrong', OPENED: 'opened' });
export const SEARCH_AREAS = Object.freeze({ SONGS: 'songs', DICTIONARY: 'dictionary' });
export const SEARCH_MODES = Object.freeze({ TITLE: 'title', ARTIST: 'artist', LYRICS: 'lyrics', WORD: 'word', TRANSLATION: 'translation' });
export function directionFromMode(mode) { if (mode === 'kb') return DIRECTIONS.ALAN_RU; if (mode === 'ru') return DIRECTIONS.RU_ALAN; return DIRECTIONS.NONE; }
export function createDomainEvent(type,payload={}){const source=payload||{};return{type:String(type||''),word_id:String(source.word_id||source.wordId||''),source:String(source.source||''),result:String(source.result||''),dictionary_id:String(source.dictionary_id||source.dictionaryId||''),section_id:String(source.section_id||source.sectionId||''),set_id:String(source.set_id||source.setId||''),direction:String(source.direction||''),session_id:String(source.session_id||source.sessionId||''),cancel_reason:String(source.cancel_reason||source.cancelReason||''),status:String(source.status||'')};}
export function domainWordResultEvent({activity,result,...payload}={}){const type=activity==='test'?(result==='correct'?DOMAIN_EVENTS.TEST_CORRECT:DOMAIN_EVENTS.TEST_WRONG):activity==='match'?(result==='correct'?DOMAIN_EVENTS.MATCH_CORRECT:DOMAIN_EVENTS.MATCH_WRONG):(result==='known'?DOMAIN_EVENTS.LEARN_KNOWN:DOMAIN_EVENTS.LEARN_UNKNOWN);return createDomainEvent(type,{...payload,source:activity,result});}
export function domainSessionEvent(completed,payload={}){return createDomainEvent(completed?DOMAIN_EVENTS.SESSION_COMPLETED:DOMAIN_EVENTS.SESSION_INTERRUPTED,{...payload,status:completed?'completed':'interrupted'});}

const FORBIDDEN_PARAMETER_NAMES = new Set(['name','email','phone','telephone','telegram_id','telegram_username','username','exact_location','latitude','longitude','message','messages','query','search_query','free_text','word','translation','lyrics','text']);
function sanitizeValue(value) { if (value === null || value === undefined) return undefined; if (typeof value === 'boolean' || typeof value === 'number') return value; if (typeof value === 'string') return value.slice(0, 300); return undefined; }
export function sanitizeAnalyticsParameters(parameters = {}, { appVersion = '', debugMode = false } = {}) { const safe = {}; Object.entries(parameters || {}).forEach(([key,value])=>{const normalizedKey=String(key||'').trim();if(!normalizedKey||FORBIDDEN_PARAMETER_NAMES.has(normalizedKey.toLowerCase()))return;const sanitized=sanitizeValue(value);if(sanitized!==undefined)safe[normalizedKey]=sanitized;});if(appVersion!==undefined)safe.app_version=appVersion;if(debugMode)safe.debug_mode=true;return safe; }
export function mergeAnalyticsContext(current = {}, nextContext = {}, options = {}) { const next={...current,...sanitizeAnalyticsParameters(nextContext,options)};delete next.app_version;delete next.debug_mode;return next; }
