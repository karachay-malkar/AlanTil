import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const fileUrl = (path) => new URL(`../${path}`, import.meta.url);
const read = (path) => readFile(fileUrl(path), "utf8");

test("16.7 profile runtime no longer depends on avatar selection or avatar assets", async () => {
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
  assert.doesNotMatch(runtime, /setAvatarGender|setNativeAvatarGender|normalizeAvatarGender/);
  assert.doesNotMatch(runtime, /avatar_gender|data-avatar-gender|renderAvatarGenderSelection|bindAvatarGenderSelection/);
  assert.doesNotMatch(runtime, /profileAvatarFrame|profileGenderSetup|accountGenderChoice|AvatarFigure|LockedAvatarFigure/);

  assert.match(sources[0], /profileIdentityBar/);
  assert.match(sources[1], /profileIdentityBar\{[^}]*min-height:72px/);
  assert.match(sources[8], /profileIdentity/);
  assert.match(sources[8], /incomplete=!guest&&!profile[?][.]nickname/);

  await assert.rejects(access(fileUrl("assets/images/profile/avatar_male.png")));
  await assert.rejects(access(fileUrl("assets/images/profile/avatar_female.png")));
});

test("16.7 profile account flow ends after nickname creation", async () => {
  const webAccount = await read("src/features/account/index.js");
  const webProfileService = await read("src/shared/profile/profile-service.js");
  const mobileAccount = await read("mobile/screens/profile.js");
  const mobileApi = await read("mobile/platform/profile-api.js");

  assert.match(webAccount, /if \(!profile\)/);
  assert.match(webAccount, /renderProfile\(context/);
  assert.doesNotMatch(webAccount, /profile[.]avatar_gender/);
  assert.doesNotMatch(mobileAccount, /profile[.]avatar_gender/);

  assert.match(webProfileService, /select\("user_id,nickname,created_at,updated_at"\)/);
  assert.match(mobileApi, /select=user_id,nickname,created_at,updated_at/);
});
