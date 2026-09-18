import { UI_TOKENS, WEB_VISUAL_REFERENCE, VISUAL_CONTRACT_VERSION } from '../../packages/alantil-ui/tokens.js';
import { CHROME_CONTRACT } from '../../packages/alantil-ui/chrome.js';

// Canonical semantic visual contract mirrored from the current Web 16.7.0 source.
// Every listed Git blob SHA is verified in CI so Mobile cannot silently target a stale Web snapshot.
export const WEB_VISUAL_SOURCES = Object.freeze({
  ref: '16.7.0',
  styles: Object.freeze([
    ["src/shared/styles/shared-visual-tokens.css","f4630106abb7c431a1992b30ba9b38853ce264ef"],
    ["src/shared/styles/theme.css","607421df419079fb055af138a1875f892d9b38ce"],
    ["src/shared/styles/typography.css","1d96743682fad93533de4db1948e9a402d3e40f6"],
    ["src/shared/styles/shell.css","4a511a72d022d993090d32a8218a7781d5ebfc89"],
    ["src/shared/styles/chrome.css","7ddf74255e483aa9e2647b96e78e4c89cb4859d8"],
    ["src/shared/styles/components.css","90fe2738897baa9f6d24eb68e4ede9f079d41721"],
    ["src/shared/styles/paper-components.css","4ea005099d52fa02244dac6f2a2f8aed7f6d72b5"],
    ["src/shared/styles/segmented-control.css","c98c3144f2aafdddb4684de5b89b8c6c06a45ce1"],
    ["src/shared/styles/table-system.css","09e3c2f311441c23f04e22f9e3c75f1da143ca18"],
    ["src/shared/styles/app.css","cbf436c267a2dfc00487683ffa87e8261a5fbaaa"],
    ["src/shared/styles/base.css","aff5f0473ff1b269100c5d20df98b5ad142e1bd3"],
    ["src/shared/styles/reset.css","3a1f3aa732f773c8b88c027cb5555f5fd0206fad"],
    ["src/shared/styles/guest-profile-prompt.css","e3cd2d00df49d96585e682b95e4f482f72646e54"],
    ["src/shared/styles/privacy.css","465d6687b02ff2d52a03b2bfd8e4b82d0c4094c5"],
  ]),
  ui: Object.freeze([
    ["src/shared/ui/adaptive-layout.js","7e050afff3c3de6210f78bd9808d2edfc8a98d01"],
    ["src/shared/ui/auth-provider-button.js","05ce88e60d5e826abb24882043f50ac7b6b663fe"],
    ["src/shared/ui/favorite-button.js","82e632b228433bf2c7bba9f813be6517036fecc8"],
    ["src/shared/ui/icons.js","d3a8e379c8889edc01e4f8808ecb0b90c5c7996d"],
    ["src/shared/ui/info-modal.js","b05fbf6d41d18f112cc5239986582548cea33e47"],
    ["src/shared/ui/list.js","6b402b88b46abdcf83ecadffe53dc7d17d229153"],
    ["src/shared/ui/modal.js","70d109486edb4ba4fd6b754fad5fc03691536489"],
    ["src/shared/ui/panel.js","cb351a1b8ef4fee86bda4a061d48ec96ecce24b2"],
  ]),
  account: Object.freeze([
    ["src/features/account/account.css","93e9cea5ed79917f281e425487e77212a89566a3"],
    ["src/features/account/index.js","8c88c0b598ecd900098977e513a30f669b2b37c9"],
    ["src/features/account/login.js","0749e4f3e145f21c2c00a4416859e482e727b71d"],
    ["src/features/account/profile.js","a4bcfacab675d0ad624019c54bcb7c21ea4ec330"],
  ]),
  features: Object.freeze([
    ["src/features/path/path.css","df93c963461d7e1a82b48db68c4ace5218fb0a99"],
    ["src/features/path/path-navigation.css","f17954314fae6f71f425a53c3be64cdc742739ea"],
    ["src/features/path/story-stele.css","525a13a2d1f407ec63f9e920ed25e5927430aa3e"],
    ["src/features/path/story-word-list.css","a701b69d6a9d1a64f66e89c07aecc02735409f95"],
    ["src/features/profile/profile.css","8d263ab112f377f229b09c5845b0d1bbc9c665d6"],
    ["src/features/settings/settings.css","907658b4848403a800c63de827de65cf7711650f"],
    ["src/features/practice/practice.css","0b20cba6a0dd3a73682d88ef1864b5dd4d08a759"],
    ["src/features/friends/friends-16-7.css","a0c62b21459370eda7f654f20aa01349061190c8"],
    ["src/features/ashyk/ashyk.css","1eb6b577ade655e0911de05eb67686add37fe585"],
    ["src/features/admin/admin.css","93cdcb1917d24d06a52d0e4368d786fcd2e7948d"],
    ["src/features/learn/learn.css","bf944453057f72626416077ab35033d71ead6dd7"],
    ["src/features/test/test.css","454e1bcbf60462c10243c8da9c86d7ba7b63b139"],
    ["src/features/match/match.css","a5ead484e925fef24b1f7d28270a31fc0e63085a"],
    ["src/features/songs/songs.css","261c4aa3b6cc538375231e1bfe6f3beca6c90ae3"],
    ["src/features/onboarding/onboarding.css","d61507a2a6ae896a84bbaebb7ea2dd5e6e0c006a"],
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
  "src/shared/styles/guest-profile-prompt.css": "mapped: guest/login prompt geometry",
  "src/shared/styles/privacy.css": "mapped by shared document typography and checkbox primitives",
  "src/shared/ui/adaptive-layout.js": "mapped: compact breakpoint and horizontal insets",
  "src/shared/ui/auth-provider-button.js": "mapped: AuthProviderButton",
  "src/shared/ui/favorite-button.js": "mapped: FavoriteButton",
  "src/shared/ui/icons.js": "mapped by mobile/ui/icons.js; DOM injection is Web-only",
  "src/shared/ui/info-modal.js": "mapped: shared info modal geometry",
  "src/shared/ui/list.js": "mapped: list row contract",
  "src/shared/ui/modal.js": "mapped: overlay, card, actions and motion",
  "src/shared/ui/panel.js": "mapped: Panel",
  "src/features/account/account.css": "mapped: account stack, fields, facts, messages and gender cards",
  "src/features/account/index.js": "logic-parity target: account state machine",
  "src/features/account/login.js": "logic-parity target: provider and guest entry",
  "src/features/account/profile.js": "logic-parity target: nickname/avatar completion flow",
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
