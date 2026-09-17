import { UI_TOKENS, WEB_VISUAL_REFERENCE, VISUAL_CONTRACT_VERSION } from '../../packages/alantil-ui/tokens.js';
import { CHROME_CONTRACT } from '../../packages/alantil-ui/chrome.js';

// Canonical semantic visual contract mirrored from the current Web 16.7.0 source.
// Every listed Git blob SHA is verified in CI so Mobile cannot silently target a stale Web snapshot.
export const WEB_VISUAL_SOURCES = Object.freeze({
  ref: '16.7.0',
  styles: Object.freeze([
    ["src/shared/styles/shared-visual-tokens.css","33079232457f5048d00bdcc3d24cc550d782629c"],
    ["src/shared/styles/theme.css","0bb945732751c81ea2e154d8e82720e10ae0cf3e"],
    ["src/shared/styles/typography.css","f5a5fe2f1e5e87f95c0f854c6a9ed505737131bd"],
    ["src/shared/styles/shell.css","0a2ff7a499973e2f484b92d0b8b83c09974a9d97"],
    ["src/shared/styles/chrome.css","72c005160fcc48bd36ca2b68251adfab08de315f"],
    ["src/shared/styles/components.css","78f4d327c488900f4d758a9d25cdb90b976375f8"],
    ["src/shared/styles/paper-components.css","90a2f805a2e85ea4196e4a39aa4ed1e7ec8c1997"],
    ["src/shared/styles/segmented-control.css","c98c3144f2aafdddb4684de5b89b8c6c06a45ce1"],
    ["src/shared/styles/table-system.css","8160eda4f999745a5430621c3faff9ad01001645"],
    ["src/shared/styles/app.css","d0dbd21cd2e93ff0938d56350fc923ba63087dd1"],
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
    ["src/shared/ui/list.js","9e66ae24a9d7235236de40fbc44e13f502c394d9"],
    ["src/shared/ui/modal.js","70d109486edb4ba4fd6b754fad5fc03691536489"],
    ["src/shared/ui/panel.js","cb351a1b8ef4fee86bda4a061d48ec96ecce24b2"],
  ]),
  account: Object.freeze([
    ["src/features/account/account.css","e5d543cb7e6aa2f0995e8c5c1c6c3a9426c0c63b"],
    ["src/features/account/index.js","8c88c0b598ecd900098977e513a30f669b2b37c9"],
    ["src/features/account/login.js","0749e4f3e145f21c2c00a4416859e482e727b71d"],
    ["src/features/account/profile.js","a4bcfacab675d0ad624019c54bcb7c21ea4ec330"],
  ]),
  features: Object.freeze([
    ["src/features/path/path.css","96d336e58d790cfbbd6d7431c58d5b66d71cc0b4"],
    ["src/features/path/path-navigation.css","f17954314fae6f71f425a53c3be64cdc742739ea"],
    ["src/features/path/story-stele.css","525a13a2d1f407ec63f9e920ed25e5927430aa3e"],
    ["src/features/path/story-word-list.css","ac6c06b090ca37a236cd8681193f5f5ebb9ed99c"],
    ["src/features/profile/profile.css","44d215c62bea3bcdf50c910b5de7e28f587c6ead"],
    ["src/features/settings/settings.css","36eee86324696ee691e1ed3370835774fca0658e"],
    ["src/features/practice/practice.css","8a934a2cc4f4beb9903fc7177e4327cff7f2f566"],
    ["src/features/friends/friends-16-7.css","f0d4f3fbf783eb48f2437894f6f3a1f5f8dd65dc"],
    ["src/features/ashyk/ashyk.css","1eb6b577ade655e0911de05eb67686add37fe585"],
    ["src/features/admin/admin.css","39f9d957187fdfdb5b4a555e047024bc1cc98be6"],
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
