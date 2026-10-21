import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const read = async (path) => readFile(new URL(path, root), "utf8");

test("16.7.12 removes mandatory avatar setup across Web and mobile", async () => {
  for (const path of ["src/features/profile/index.js", "src/features/account/index.js", "mobile/screens/profile.js", "mobile/screens/profile-main.js"]) {
    const source = await read(path);
    assert.doesNotMatch(source, /avatar_male\.png|avatar_female\.png|setNativeAvatarGender|setAvatarGender|profile\.avatar_gender/);
  }
  for (const path of ["assets/images/profile/avatar_male.png", "assets/images/profile/avatar_female.png"]) {
    await assert.rejects(access(new URL(path, root)));
  }
});

test("16.7.12 keeps heavy feature CSS off the initial stylesheet", async () => {
  const appCss = await read("src/shared/styles/app.css");
  const router = await read("src/app/router.js");
  const index = await read("index.html");
  const features = ["practice", "masonry", "ashyk", "friends", "profile", "admin", "learn", "test", "match", "songs", "account", "settings"];
  for (const feature of features) {
    assert.match(router, new RegExp("feature/" + feature + "\\.css"));
    assert.ok((await read("src/shared/styles/feature/" + feature + ".css")).includes("@import"));
    assert.doesNotMatch(appCss, new RegExp("features/" + feature + "/"));
  }
  assert.doesNotMatch(index, /<link[^>]*friends-16-7\.css/);
  assert.doesNotMatch(router, /scheduleFeatureWarmup/);
});

test("16.7.12 uses versioned cache-first static responses and lazy stele art", async () => {
  const worker = await read("service-worker.js");
  const stele = await read("src/features/path/story-stele.js");
  assert.match(worker, /16\.7\.12-lazy-onboarding-guide/);
  assert.match(worker, /if \(cached\) return cached/);
  assert.doesNotMatch(worker, /\/assets\/path\/story-stele\.webp\?v=13\.15\.6/);
  assert.match(stele, /data-src="\$\{ASSET_URL\}"/);
  assert.match(stele, /artwork\.src = artwork\.dataset\.src/);
});
