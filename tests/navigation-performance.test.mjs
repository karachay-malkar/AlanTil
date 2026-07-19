import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("navigation queues the latest intent instead of dropping taps", async () => {
  const router = await read("src/app/router.js");
  const shell = await read("src/app/shell.js");
  assert.match(router, /if \(navigating\) return queueNavigation\(target, options\)/);
  assert.match(router, /settleQueuedNavigation\(false\)/);
  assert.match(router, /drainPendingWork/);
  assert.doesNotMatch(router, /if \(navigating\) return false/);
  assert.match(shell, /setNavigationPending/);
  assert.match(shell, /aria-busy/);
});

test("background refresh is coalesced and cannot follow the user to another route", async () => {
  const router = await read("src/app/router.js");
  const bootstrap = await read("src/app/bootstrap.js");
  assert.match(router, /queuedRefresh = \{ \.\.\.queuedRefresh, \.\.\.options, target: refreshTarget \}/);
  assert.match(router, /options\.background && !targetsEqual\(refreshTarget, current\)/);
  assert.doesNotMatch(bootstrap, /pullCloudProgress/);
});

test("account scope becomes visible from local settings before cloud synchronization", async () => {
  const progress = await read("src/shared/progress/progress-sync.js");
  assert.match(progress, /activateScopeForUser\(lastUserId, \{ deferCloud: true \}\)/);
  const localReadyAt = progress.indexOf('announceScopeReady(userId, "local")');
  const cloudSyncAt = progress.indexOf("const synchronization = synchronizeActiveScope(userId)");
  assert.ok(localReadyAt >= 0 && cloudSyncAt > localReadyAt, "local scope must unblock rendering before cloud work starts");
  assert.match(progress, /if \(!activeScopeMatches\(userId\)\) return false;/);
});

test("path rendering reuses dictionary, route and progress snapshots", async () => {
  const repository = await read("src/shared/data/word-repository.js");
  const path = await read("src/features/path/index.js");
  const progress = await read("src/shared/progress/word-progress-store.js");
  const routeProgress = await read("src/shared/domain/route-progress.js");
  assert.match(repository, /displayedWordsKey/);
  assert.match(path, /routeCache\.words !== words/);
  assert.match(path, /createRouteProgressSnapshot\(\)/);
  assert.match(progress, /if \(cachedState && cachedScope === scope\) return cachedState/);
  assert.match(progress, /if \(cachedProgressMap\) return cachedProgressMap/);
  assert.match(routeProgress, /stationSummaries: new Map\(\)/);
});

test("versioned route assets are served cache-first while auth stays network-first", async () => {
  const worker = await read("service-worker.js");
  const authAt = worker.indexOf('url.pathname.startsWith("/src/shared/auth/")');
  const generalAt = worker.indexOf('url.pathname.startsWith("/src/")');
  assert.ok(authAt >= 0 && generalAt > authAt);
  assert.match(worker.slice(generalAt), /event\.respondWith\(staticResponse\(request\)\)/);
});
