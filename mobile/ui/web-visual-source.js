import { UI_TOKENS, WEB_VISUAL_REFERENCE, VISUAL_CONTRACT_VERSION } from '../../packages/alantil-ui/tokens.js';
import { CHROME_CONTRACT } from '../../packages/alantil-ui/chrome.js';

// Canonical semantic visual contract mirrored from the current Web 16.7.0 source.
// Every listed Git blob SHA is verified in CI so Mobile cannot silently target a stale Web snapshot.
export const WEB_VISUAL_SOURCES = Object.freeze({
  ref: '16.7.0',
  styles: Object.freeze([
    ["src/shared/styles/shared-visual-tokens.css","7ddea6059bddc8ddb5472a53ccb7e8291ded164b"],
    ["src/shared/styles/theme.css","add3d0fb6724c7341c28f17c4ebbcfae2b011042"],
    ["src/shared/styles/typography.css","d6c471bf6e8a549af85003addd601c148bf853d1"],
    ["src/shared/styles/shell.css","c26709a7d4d0e90549912d299c5e42a21bd468a1"],
    ["src/shared/styles/chrome.css","6188c4c3a1d2e1296106b4a7dff5ce60c168912d"],
    ["src/shared/styles/components.css","d63e9e752fe8931833daf93fc7c13110d58d0f30"],
    ["src/shared/styles/paper-components.css","4ea005099d52fa02244dac6f2a2f8aed7f6d72b5"],
    ["src/shared/styles/segmented-control.css","9e2f60ce5991249420fbdc8c2fb5d9ed503cdef2"],
    ["src/shared/styles/table-system.css","09e3c2f311441c23f04e22f9e3c75f1da143ca18"],
    ["src/shared/styles/app.css","7669aa9e3910ffb0fd105d816f07b6185f997372"],
    ["src/shared/styles/base.css","aff5f0473ff1b269100c5d20df98b5ad142e1bd3"],
    ["src/shared/styles/reset.css","3a1f3aa732f773c8b88c027cb5555f5fd0206fad"],
    ["src/shared/styles/privacy.css","465d6687b02ff2d52a03b2bfd8e4b82d0c4094c5"],
  ]),
  ui: Object.freeze([
    ["src/shared/ui/adaptive-layout.js","ef704e4cd1f09f04dbe0620f22ba20179a0007d2"],
    ["src/shared/ui/auth-provider-button.js","8357b25bbd1e5347166a68d261cd8eb3caf0bc92"],
    ["src/shared/ui/favorite-button.js","36437c2122c3a8083e567efb093b53c0cc157923"],
    ["src/shared/ui/icons.js","d3a8e379c8889edc01e4f8808ecb0b90c5c7996d"],
    ["src/shared/ui/info-modal.js","8e75927be91b1c8d13290085e1108a7b3448f594"],
    ["src/shared/ui/list.js","73433730517e976acad10caeea945989d37ebbff"],
    ["src/shared/ui/modal.js","74bacee46ccfbd098bdf2f789854c08d128ef5d2"],
    ["src/shared/ui/panel.js","cb351a1b8ef4fee86bda4a061d48ec96ecce24b2"],
  ]),
  account: Object.freeze([
    ["src/features/account/account.css","ace760a1ae2a79b6c28684db3e3229456927c361"],
    ["src/features/account/index.js","d7bcf408f50f44bb36da22be9eb9a45732f06c45"],
    ["src/features/account/login.js","eb42b7253fe73ddc1e956922b91d8169bafb5162"],
    ["src/features/account/profile.js","acc158ef90352f4734ea820a71961aa12887204e"],
  ]),
  features: Object.freeze([
    ["src/features/path/path.css","73586c2e12fc4d522d34d5005d2d44e16af44db3"],
    ["src/features/path/path-navigation.css","f17954314fae6f71f425a53c3be64cdc742739ea"],
    ["src/features/path/story-stele.css","525a13a2d1f407ec63f9e920ed25e5927430aa3e"],
    ["src/features/path/story-word-list.css","a701b69d6a9d1a64f66e89c07aecc02735409f95"],
    ["src/features/profile/profile.css","c750f3ac8e3980f27faa79f9fb95b1e6a9a81716"],
    ["src/features/settings/settings.css","889195b5993d263635b56863a80c554def300752"],
    ["src/features/practice/practice.css","0b20cba6a0dd3a73682d88ef1864b5dd4d08a759"],
    ["src/features/friends/friends-16-7.css","92d7d677066c548b440cc36fe9c05aac55c7677c"],
    ["src/features/ashyk/ashyk.css","2f480b0f5a24db9f3bae2b7e348b78c22f0b4110"],
    ["src/features/admin/admin.css","f018503b75de9bc3a956014f486a50b0ca188424"],
    ["src/features/learn/learn.css","bf944453057f72626416077ab35033d71ead6dd7"],
    ["src/features/test/test.css","67ca426f05756dceff1800daa1c400ee24887c05"],
    ["src/features/match/match.css","a5ead484e925fef24b1f7d28270a31fc0e63085a"],
    ["src/features/songs/songs.css","261c4aa3b6cc538375231e1bfe6f3beca6c90ae3"],
    ["src/features/onboarding/onboarding.css","364f3a80d4c6fd963b7592ff8b0c3b7c6799f58c"],
  ]),
});

export const WEB_VISUAL_COVERAGE = Object.freeze({
  "src/shared/styles/shared-visual-tokens.css": "mapped: generated 16.7 shared token bridge consumed by Web",
  "src/shared/styles/theme.css": "mapped: colors, surfaces, borders, state colors, radii and shadows",
  "src/shared/styles/typography.css": "mapped: semantic text scales and families",
  "src/shared/styles/shell.css": "mapped: app shell, header and navigation base geometry",
  "src/shared/styles/chrome.css": "mapped: viewport masks and shared screen chrome",
  "src/shared/styles/components.css": "mapped: buttons, inputs, lists and state presentation",
  "src/shared/styles/paper-components.css": "mapped: paper/glass surfaces, borders and shadows",
  "src/shared/styles/segmented-control.css": "mapped: segmented controls and active states",
  "src/shared/styles/table-system.css": "mapped: table-like row geometry; CSS table layout itself is Web-only",
  "src/shared/styles/app.css": "mapped: 16.7 feature cascade, bracket tabs and shared bottom navigation geometry",
  "src/shared/styles/base.css": "mapped: base background, text and control defaults",
  "src/shared/styles/reset.css": "not-applicable: browser reset has no React Native equivalent",
  "src/shared/styles/privacy.css": "mapped by shared document typography and checkbox primitives",
  "src/shared/ui/adaptive-layout.js": "mapped: compact breakpoint and horizontal insets",
  "src/shared/ui/auth-provider-button.js": "mapped: AuthProviderButton",
  "src/shared/ui/favorite-button.js": "mapped: FavoriteButton",
  "src/shared/ui/icons.js": "mapped by mobile/ui/icons.js; DOM injection is Web-only",
  "src/shared/ui/info-modal.js": "mapped: shared info modal geometry",
  "src/shared/ui/list.js": "mapped: list row contract",
  "src/shared/ui/modal.js": "mapped: overlay, card, actions and motion",
  "src/shared/ui/panel.js": "mapped: Panel",
  "src/features/account/account.css": "mapped: account stack, fields, facts and messages",
  "src/features/account/index.js": "logic-parity target: account state machine",
  "src/features/account/login.js": "logic-parity target: provider and guest entry",
  "src/features/account/profile.js": "logic-parity target: nickname completion flow",
  "src/features/path/path.css": "mapped: route, station geometry, scale and topographic scene",
  "src/features/path/path-navigation.css": "mapped: story navigation and route controls",
  "src/features/path/story-stele.css": "mapped: story stele proportions and overlay geometry",
  "src/features/path/story-word-list.css": "mapped: story word rows and separators",
  "src/features/profile/profile.css": "mapped: bracket navigation, identity, progress and statistics",
  "src/features/settings/settings.css": "mapped: settings rows, learning preview, dictionary version and links",
  "src/features/practice/practice.css": "mapped: shared 16.7 practice row geometry",
  "src/features/friends/friends-16-7.css": "mapped: shared 16.7 social rows, search and action controls",
  "src/features/ashyk/ashyk.css": "mapped: shared Ashyk UI geometry; renderer, engine, physics and audio remain feature-owned",
  "src/features/admin/admin.css": "mapped: extended statistics/users presentation under Friends",
  "src/features/learn/learn.css": "mapped: word card, actions, results and progress",
  "src/features/test/test.css": "mapped: question, answer states and results",
  "src/features/match/match.css": "mapped: pair grid, card states and results",
  "src/features/songs/songs.css": "mapped: catalog, player, lyrics and search",
  "src/features/onboarding/onboarding.css": "mapped: setup and guide spacing/actions",
});

export const WEB_VISUAL_TOKENS = Object.freeze({...UI_TOKENS,chrome:CHROME_CONTRACT});
export { UI_TOKENS, CHROME_CONTRACT, WEB_VISUAL_REFERENCE, VISUAL_CONTRACT_VERSION };

export function verifyWebVisualSourceManifest() {
  const sources=[...WEB_VISUAL_SOURCES.styles,...WEB_VISUAL_SOURCES.ui,...WEB_VISUAL_SOURCES.account,...WEB_VISUAL_SOURCES.features];
  const paths=sources.map(([sourcePath])=>sourcePath);
  const missingCoverage=paths.filter(sourcePath=>!WEB_VISUAL_COVERAGE[sourcePath]);
  return {ref:WEB_VISUAL_SOURCES.ref,total:paths.length,unique:new Set(paths).size,missingCoverage,complete:new Set(paths).size===paths.length&&missingCoverage.length===0};
}
