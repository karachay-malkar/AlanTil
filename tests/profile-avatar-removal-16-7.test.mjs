import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const fileUrl = (path) => new URL(`../${path}`, import.meta.url);
const read = (path) => readFile(fileUrl(path), "utf8");

test("profile keeps avatar images removed while restoring explicit gender metadata", async () => {
  const sources = await Promise.all([
    "src/features/profile/index.js",
    "src/features/profile/profile.css",
    "src/features/account/index.js",
    "src/features/account/profile.js",
    "src/features/account/account.css",
    "src/shared/profile/profile-service.js",
    "packages/alantil-core/profile.js",
    "mobile/platform/profile-api.js",
    "mobile/screens/profile-main.js",
    "mobile/screens/profile.js",
  ].map(read));

  const runtime = sources.join("\n");
  assert.doesNotMatch(runtime, /avatar_male[.]png|avatar_female[.]png/);
  assert.doesNotMatch(runtime, /AvatarFigure|LockedAvatarFigure/);
  assert.match(runtime, /avatar_gender/);
  assert.match(runtime, /normalizeProfileGender/);
  assert.match(sources[8], /!profile[?][.]avatar_gender/);

  await assert.rejects(access(fileUrl("assets/images/profile/avatar_male.png")));
  await assert.rejects(access(fileUrl("assets/images/profile/avatar_female.png")));
});

test("profile account flow requires nickname and one-time gender and supports nickname changes", async () => {
  const webAccount = await read("src/features/account/index.js");
  const webProfileService = await read("src/shared/profile/profile-service.js");
  const mobileAccount = await read("mobile/screens/profile.js");
  const mobileApi = await read("mobile/platform/profile-api.js");

  assert.match(webAccount, /profileIncomplete = !profile[?][.]nickname \|\| !profile[?][.]avatar_gender/);
  assert.match(webAccount, /updateProfileNickname/);
  assert.match(webProfileService, /PROFILE_COLUMNS = "user_id,nickname,avatar_gender,created_at,updated_at"/);
  assert.match(webProfileService, /updateProfileNickname/);
  assert.match(mobileAccount, /updateNativeNickname/);
  assert.match(mobileAccount, /profile[?][.]avatar_gender/);
  assert.match(mobileApi, /PROFILE_SELECT='user_id,nickname,avatar_gender,created_at,updated_at'/);
});
