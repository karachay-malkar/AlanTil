import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("part 5 counts only natural computer completions", () => {
  const store = read("packages/ashyk-game/store.js");
  const web = read("src/features/ashyk/index.js");
  const native = read("mobile/screens/ashyk.js");
  const migration = read("supabase/migrations/20261007043500_alantil_16_8_extended_statistics_ashyk_songs.sql");

  assert.match(store, /export function isNaturalAshykComputerCompletion/);
  assert.match(store, /state\?\.gameMode==='computer'/);
  assert.match(store, /state\?\.status==='finished'/);
  assert.match(store, /state\?\.lastOutcome\?\.code==='capture'/);

  assert.match(web, /isNaturalAshykComputerCompletion\(finished\)/);
  assert.match(web, /eventType:"ashyk_computer_complete"/);
  assert.match(web, /itemKey:finished\.winByKyt\?"kyt":"score"/);

  assert.match(native, /isNaturalAshykComputerCompletion\(state\)/);
  assert.match(native, /eventType:'ashyk_computer_complete'/);
  assert.match(native, /itemKey:state\.winByKyt\?'kyt':'score'/);

  assert.match(migration, /p_event_type='ashyk_computer_complete'/);
  assert.match(migration, /v_item_key not in \('score','kyt'\)/);
  assert.match(migration, /ue\.event_type<>'ashyk_computer_complete'[\s\S]*ue\.item_key in \('score','kyt'\)/);
});

test("part 5 online Ashyk excludes resignation disconnect and abandoned rooms", () => {
  const migration = read("supabase/migrations/20261007043500_alantil_16_8_extended_statistics_ashyk_songs.sql");
  const usageSources = migration.match(/usage_people as \([\s\S]*?\n  \),\n  usage_agg as/)?.[0] || "";

  assert.match(usageSources, /from public\.ashyk_rooms r/);
  assert.match(usageSources, /r\.status='finished'/);
  assert.match(usageSources, /r\.finish_reason in \('score','kyt'\)/);
  assert.match(usageSources, /r\.guest_user_id is not null/);
  assert.match(usageSources, /when up\.event_type='ashyk_online_complete'[\s\S]*count\(distinct up\.item_key\)::int/);
  assert.doesNotMatch(usageSources, /r\.finish_reason in \('resign','disconnect'\)/);
});

test("part 5 song analytics requires a concrete published song with lyrics", () => {
  const migration = read("supabase/migrations/20261007043500_alantil_16_8_extended_statistics_ashyk_songs.sql");
  const webSongs = read("src/features/songs/song-view.js");
  const nativeSongs = read("mobile/screens/songs.js");

  assert.match(webSongs, /if \(lyricsMarkup\) \{[\s\S]*eventType: "song_lyrics_open"[\s\S]*itemKey: String\(song\.id\)/);
  assert.match(nativeSongs, /if\(song\?\.id&&model\.length\)recordNativeUsageEvent\(\{eventType:'song_lyrics_open',itemKey:String\(song\.id\)\}\)/);

  assert.match(migration, /p_event_type='song_lyrics_open'/);
  assert.match(migration, /from public\.songs s/);
  assert.match(migration, /s\.id=v_item_key/);
  assert.match(migration, /s\.is_published is true/);
  assert.match(migration, /from public\.song_lines sl/);
  assert.match(migration, /sl\.song_id=v_item_key/);
  assert.match(migration, /ue\.event_type<>'song_lyrics_open'[\s\S]*public\.songs/);
});

test("part 5 keeps the approved UI metrics", () => {
  const admin = read("src/features/admin/index.js");
  assert.match(admin, /selected\.ashyk_computer/);
  assert.match(admin, /selected\.ashyk_online/);
  assert.match(admin, /selected\.song_lyrics/);
  assert.match(admin, /usageGames/);
  assert.match(admin, /usageOpens/);
});
