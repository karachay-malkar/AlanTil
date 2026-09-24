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
    ["src/shared/styles/shell.css","c26709a7d4d0e90549912d299c5e42a21bd468a1"],
    ["src/shared/styles/chrome.css","6188c4c3a1d2e1296106b4a7dff5ce60c168912d"],
    ["src/shared/styles/components.css","90fe2738897baa9f6d24eb68e4ede9f079d41721"],
    ["src/shared/styles/paper-components.css","4ea005099d52fa02244dac6f2a2f8aed7f6d72b5"],
    ["src/shared/styles/segmented-control.css","c98c3144f2aafdddb4684de5b89b8c6c06a45ce1"],
    ["src/shared/styles/table-system.css","09e3c2f311441c23f04e22f9e3c75f1da143ca18"],
    ["src/shared/styles/app.css","86e8327972be3d9f1a783af1eaa05577543058a6"],
    ["src/shared/styles/base.css","aff5f0473ff1b269100c5d20df98b5ad142e1bd3"],
    ["src/shared/styles/reset.css","3a1f3aa732f773c8b88c027cb5555f5fd0206fad"],
    ["src/shared/styles/privacy.css","465d6687b02ff2d52a03b2bfd8e4b82d0c4094c5"],
  ]),
  ui: Object.freeze([
    ["src/shared/ui/adaptive-layout.js","ef704e4cd1f09f04dbe0620f22ba20179a0007d2"],
    ["src/shared/ui/auth-provider-button.js","3c78688efca098a8b3c80bdbbf4b087c077b2d0f"],
    ["src/shared/ui/favorite-button.js","2526b9c027c2609234e62c46f9240ae875f3180f"],
    ["src/shared/ui/icons.js","d3a8e379c8889edc01e4f8808ecb0b90c5c7996d"],
    ["src/shared/ui/info-modal.js","e672808090f81383ba9fdafd5cdb9a01923ee896"],
    ["src/shared/ui/list.js","32e54943ae59823de39818c751bb82346b319e5c"],
    ["src/shared/ui/modal.js","55c92d6eb69661943a073fbf21fca80e23178b3e"],
    ["src/shared/ui/panel.js","cb351a1b8ef4fee86bda4a061d48ec96ecce24b2"],
  ]),
  account: Object.freeze([
    ["src/features/account/account.css","3bee8cbd397ad86f4eb8c5b34498014d1fda15c1"],
    ["src/features/account/index.js","2dd01c9a5e030d72df7cb9a4390d63aeba704c69"],
    ["src/features/account/login.js","54fe8ecd837fb0f5952bc6dcb86a45848c8afcbd"],
    ["src/features/account/profile.js","cdbaeebabcfe3d80a6398ad33fff15e051088311"],
  ]),
  features: Object.freeze([
    ["src/features/path/path.css","e91e532edd29092b19b52306885cb6e8dbef5ece"],
    ["src/features/path/path-navigation.css","f17954314fae6f71f425a53c3be64cdc742739ea"],
    ["src/features/path/story-stele.css","525a13a2d1f407ec63f9e920ed25e5927430aa3e"],
    ["src/features/path/story-word-list.css","a701b69d6a9d1a64f66e89c07aecc02735409f95"],
    ["src/features/profile/profile.css","c750f3ac8e3980f27faa79f9fb95b1e6a9a81716"],
    ["src/features/settings/settings.css","0bfda54e5db67e53fee368b3a6eff72f848ddf3a"],
    ["src/features/practice/practice.css","0b20cba6a0dd3a73682d88ef1864b5dd4d08a759"],
    ["src/features/friends/friends-16-7.css","0d9c396db620ce56f3a7c94f08b753d999ee42aa"],
    ["src/features/ashyk/ashyk.css","1eb6b577ade655e0911de05eb67686add37fe585"],
    ["src/features/admin/admin.css","f018503b75de9bc3a956014f486a50b0ca188424"],
    ["src/features/learn/learn.css","bf944453057f72626416077ab35033d71ead6dd7"],
    ["src/features/test/test.css","454e1bcbf60462c10243c8da9c86d7ba7b63b139"],
    ["src/features/match/match.css","a5ead484e925fef24b1f7d28270a31fc0e63085a"],
    ["src/features/songs/songs.css","261c4aa3b6cc538375231e1bfe6f3beca6c90ae3"],
    ["src/features/onboarding/onboarding.css","e977cc3c4fbd7129b2136b05b46aa67f29d89266"],
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
