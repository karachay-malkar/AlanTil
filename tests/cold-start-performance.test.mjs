import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("settings render local content before checking the remote dictionary version", async () => {
  const settings = await read("src/features/settings/index.js");
  const renderIndex = settings.indexOf("context.root.innerHTML =");
  const checkIndex = settings.indexOf("void updateDictionaryVersionStatus");
  assert.ok(renderIndex >= 0, "settings markup is missing");
  assert.ok(checkIndex > renderIndex, "dictionary version check must start after local render");
  assert.doesNotMatch(settings, /versionStatus\s*=\s*await getDictionaryVersionStatus/);
});

test("dictionary checks are deduplicated and short in foreground", async () => {
  const repository = await read("src/shared/data/word-repository.js");
  assert.match(repository, /VERSION_TIMEOUT_MS = 5000/);
  assert.match(repository, /let versionPromise = null/);
  assert.match(repository, /latestVersion === currentVersion/);
  assert.match(repository, /changed: false/);
});

test("remote feature data has bounded waits", async () => {
  const songs = await read("src/features/songs/repository.js");
  const profiles = await read("src/shared/profile/profile-service.js");
  assert.match(songs, /SONGS_REQUEST_TIMEOUT_MS = 8000/);
  assert.match(songs, /signal: controller\.signal/);
  assert.match(profiles, /PROFILE_REQUEST_TIMEOUT_MS = 12000/);
  assert.match(profiles, /withProfileTimeout/);
});

test("song catalog does not eagerly import the player", async () => {
  const songs = await read("src/features/songs/index.js");
  assert.doesNotMatch(songs, /^import .*song-view/m);
  assert.doesNotMatch(songs, /^import .*player/m);
  assert.match(songs, /async function loadSongScreen/);
  assert.match(songs, /import\("\.\/song-view\.js/);
  assert.match(songs, /import\("\.\/player\.js/);
});
