import test from "node:test";
import assert from "node:assert/strict";
import {access,readFile} from "node:fs/promises";
const fileUrl=(path)=>new URL("../"+path,import.meta.url);
const read=(path)=>readFile(fileUrl(path),"utf8");

test("avatars do not exist in 17.2 Web and mobile runtime",async()=>{
 const paths=["src/features/profile/index.js","src/features/account/index.js","src/features/account/profile.js","src/shared/profile/profile-service.js","packages/alantil-core/profile.js","mobile/platform/profile-api.js","mobile/screens/profile-main.js","mobile/screens/profile.js"];
 const files=await Promise.all(paths.map(read));
 for(let i=0;i<files.length;i++){
  assert.doesNotMatch(files[i],/avatar_male[.]png|avatar_female[.]png|AvatarFigure|LockedAvatarFigure/,paths[i]);
 }
 for(const asset of ["assets/images/profile/avatar_male.png","assets/images/profile/avatar_female.png"]){
  await assert.rejects(access(fileUrl(asset)));
 }
});

test("profile completion depends only on nickname and preserves old gender data",async()=>{
 const [core,account,form,service,nativeApi,mobileAccount,mobileProfile]=await Promise.all(["packages/alantil-core/profile.js","src/features/account/index.js","src/features/account/profile.js","src/shared/profile/profile-service.js","mobile/platform/profile-api.js","mobile/screens/profile.js","mobile/screens/profile-main.js"].map(read));
 assert.match(core,/return Boolean\(normalizeNickname\(profile\?\.nickname\)\)/);
 assert.doesNotMatch(core,/normalizeNickname\(profile\?\.nickname\) && normalizeProfileGender/);
 assert.match(account,/const profileIncomplete = !hasCompleteProfile\(profile\)/);
 assert.doesNotMatch(account,/genderValue|onGenderChange|createProfile\(authState.user.id, nickname, gender\)/);
 assert.doesNotMatch(form,/genderPicker|input\[name="avatarGender"\]|accountGenderOptions/);
 assert.doesNotMatch(form,/renderAccountFact\(msg\("account.pol_avatara"/);
 assert.match(service,/PROFILE_COLUMNS = "user_id,nickname,avatar_gender,created_at,updated_at"/);
 assert.doesNotMatch(service,/if \(!gender\)|avatar_gender: gender/);
 assert.doesNotMatch(nativeApi,/gender_required|avatar_gender:gender/);
 assert.doesNotMatch(mobileAccount,/setGender|SegmentedControl|!profile\?\.avatar_gender/);
 assert.doesNotMatch(mobileProfile,/setGender|!profile\?\.avatar_gender/);
});
