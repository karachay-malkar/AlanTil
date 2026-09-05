import { UI_TOKENS, WEB_VISUAL_REFERENCE, VISUAL_CONTRACT_VERSION } from '../../packages/alantil-ui/tokens.js';
import { CHROME_CONTRACT } from '../../packages/alantil-ui/chrome.js';

// Canonical semantic visual contract mirrored from Web 13.15.12.
// CSS is not copied mechanically. Every web source is mapped to RN semantics or marked non-applicable.

export const WEB_VISUAL_SOURCES = Object.freeze({
  ref: '13.15.12',
  styles: Object.freeze([
    ['src/shared/styles/theme.css','9afc17328e22829ad9a13dec8cd7681705131a5f'],
    ['src/shared/styles/typography.css','f5a5fe2f1e5e87f95c0f854c6a9ed505737131bd'],
    ['src/shared/styles/shell.css','14032e0b4c3d1111ce92831dbd991284b8b41503'],
    ['src/shared/styles/chrome.css','3f2ffa5abfc2d0dc157cb0020d24bed0a2494dff'],
    ['src/shared/styles/components.css','daf4266a1f83691102f662244b4881e3a73db638'],
    ['src/shared/styles/paper-components.css','d39121efbd1eb19c10c3b41992c67be0a50f338e'],
    ['src/shared/styles/segmented-control.css','c98c3144f2aafdddb4684de5b89b8c6c06a45ce1'],
    ['src/shared/styles/table-system.css','8160eda4f999745a5430621c3faff9ad01001645'],
    ['src/shared/styles/app.css','1f616612b2a0c5d40b5e9ca9398d13e424e792f5'],
    ['src/shared/styles/base.css','aff5f0473ff1b269100c5d20df98b5ad142e1bd3'],
    ['src/shared/styles/reset.css','3a1f3aa732f773c8b88c027cb5555f5fd0206fad'],
    ['src/shared/styles/guest-profile-prompt.css','e3cd2d00df49d96585e682b95e4f482f72646e54'],
    ['src/shared/styles/privacy.css','465d6687b02ff2d52a03b2bfd8e4b82d0c4094c5'],
  ]),
  ui: Object.freeze([
    ['src/shared/ui/adaptive-layout.js','7e050afff3c3de6210f78bd9808d2edfc8a98d01'],
    ['src/shared/ui/auth-provider-button.js','05ce88e60d5e826abb24882043f50ac7b6b663fe'],
    ['src/shared/ui/favorite-button.js','82e632b228433bf2c7bba9f813be6517036fecc8'],
    ['src/shared/ui/icons.js','d3a8e379c8889edc01e4f8808ecb0b90c5c7996d'],
    ['src/shared/ui/info-modal.js','b05fbf6d41d18f112cc5239986582548cea33e47'],
    ['src/shared/ui/list.js','9e66ae24a9d7235236de40fbc44e13f502c394d9'],
    ['src/shared/ui/modal.js','70d109486edb4ba4fd6b754fad5fc03691536489'],
    ['src/shared/ui/panel.js','cb351a1b8ef4fee86bda4a061d48ec96ecce24b2'],
  ]),
  account: Object.freeze([
    ['src/features/account/account.css','e5d543cb7e6aa2f0995e8c5c1c6c3a9426c0c63b'],
    ['src/features/account/index.js','8c88c0b598ecd900098977e513a30f669b2b37c9'],
    ['src/features/account/login.js','0749e4f3e145f21c2c00a4416859e482e727b71d'],
    ['src/features/account/profile.js','f8c60b181410cfe262d29dc9cc06866b0ac10712'],
  ]),
  features: Object.freeze([
    ['src/features/path/path.css','9e6c746c8eb079f0ecfbb410457f5f7e39f612ee'],
    ['src/features/path/path-navigation.css','f17954314fae6f71f425a53c3be64cdc742739ea'],
    ['src/features/path/story-stele.css','525a13a2d1f407ec63f9e920ed25e5927430aa3e'],
    ['src/features/path/story-word-list.css','ac6c06b090ca37a236cd8681193f5f5ebb9ed99c'],
    ['src/features/profile/profile.css','09e4a18859cf51f7ae80b4ebe876fe77083bdd82'],
    ['src/features/settings/settings.css','73cdab1163fc4a065ffb2132800f50d725a03e05'],
    ['src/features/practice/practice.css','5dc627763e8caa236d5677c2a21e5c5b5f4cb657'],
    ['src/features/learn/learn.css','838c152e40c36fe622d89fa50ec392e9e4d687b2'],
    ['src/features/test/test.css','0da75c3b833467a9436d0a49e50a82b392aa9acc'],
    ['src/features/match/match.css','7f48c62efe343136ccde811d2496a8b664078bbe'],
    ['src/features/songs/songs.css','261c4aa3b6cc538375231e1bfe6f3beca6c90ae3'],
    ['src/features/onboarding/onboarding.css','d61507a2a6ae896a84bbaebb7ea2dd5e6e0c006a'],
  ]),
});

export const WEB_VISUAL_COVERAGE = Object.freeze({
  'src/shared/styles/theme.css': 'mapped: colors, surfaces, borders, state colors, radii, shadows',
  'src/shared/styles/typography.css': 'mapped: S/M/L scales, body/display/terminal families and weights',
  'src/shared/styles/shell.css': 'mapped: app/view/panel geometry, content max width, safe-area spacing',
  'src/shared/styles/chrome.css': 'mapped: header/nav geometry, glass/blur controls and compact breakpoint',
  'src/shared/styles/components.css': 'mapped: buttons, inputs, progress, list rows, disabled/error/success states',
  'src/shared/styles/paper-components.css': 'mapped: paper/glass surfaces, borders and shadows',
  'src/shared/styles/segmented-control.css': 'mapped: segmented control geometry and active state',
  'src/shared/styles/table-system.css': 'mapped: row heights, separators and fact/list row semantics; CSS table layout is not applicable to RN',
  'src/shared/styles/app.css': 'mapped: root application spacing and view composition',
  'src/shared/styles/base.css': 'mapped: base background/text/control defaults',
  'src/shared/styles/reset.css': 'not-applicable: browser element reset, box sizing and native HTML defaults do not exist in React Native',
  'src/shared/styles/guest-profile-prompt.css': 'mapped: guest/login message and action geometry',
  'src/shared/styles/privacy.css': 'not-applicable-to-current-screen: privacy content-specific layout; shared typography/surface primitives already mapped',
  'src/shared/ui/adaptive-layout.js': 'mapped: compact breakpoint and adaptive horizontal insets',
  'src/shared/ui/auth-provider-button.js': 'mapped: AuthProviderButton',
  'src/shared/ui/favorite-button.js': 'mapped: FavoriteButton',
  'src/shared/ui/icons.js': 'mapped by mobile/ui/icons.js; DOM/SVG injection implementation itself is not applicable',
  'src/shared/ui/info-modal.js': 'mapped to shared modal geometry; feature content remains feature-owned',
  'src/shared/ui/list.js': 'mapped: list row contract',
  'src/shared/ui/modal.js': 'mapped: modal overlay/card/actions/motion',
  'src/shared/ui/panel.js': 'mapped: Panel',
  'src/features/account/account.css': 'mapped: accountStack max width, fields, facts, messages, gender cards and spacing',
  'src/features/account/index.js': 'logic-parity target: loading/auth/profile/nickname/avatar/completed state machine',
  'src/features/account/login.js': 'logic-parity target: provider loading/error and guest continuation',
  'src/features/account/profile.js': 'logic-parity target: nickname debounce/profile creation/avatar confirmation/facts',
  'src/features/path/path.css': 'mapped: route zigzag, station geometry, scale, topographic scene and progress states',
  'src/features/path/path-navigation.css': 'mapped: story navigation and route controls',
  'src/features/path/story-stele.css': 'mapped: story stele proportions and overlay geometry',
  'src/features/path/story-word-list.css': 'mapped: story word rows and separators',
  'src/features/profile/profile.css': 'mapped: primary profile navigation, identity, story progress and statistics',
  'src/features/settings/settings.css': 'mapped: 620px content, 46px rows, flat separators, learning preview, dictionary version and links',
  'src/features/practice/practice.css': 'mapped: 68px flat practice menu rows',
  'src/features/learn/learn.css': 'mapped: word card, actions, result layout and progress',
  'src/features/test/test.css': 'mapped: question answers, selected/correct/wrong states and results',
  'src/features/match/match.css': 'mapped: pair grid, pair states and results',
  'src/features/songs/songs.css': 'mapped: catalog, player, lyrics and search presentation',
  'src/features/onboarding/onboarding.css': 'mapped: setup/guide spacing and actions',
});

// Compatibility export: values now come from the shared visual contract rather than a Mobile copy.
export const WEB_VISUAL_TOKENS = Object.freeze({...UI_TOKENS,chrome:CHROME_CONTRACT});
export { UI_TOKENS, CHROME_CONTRACT, WEB_VISUAL_REFERENCE, VISUAL_CONTRACT_VERSION };

export function verifyWebVisualSourceManifest() {
  const sources=[...WEB_VISUAL_SOURCES.styles,...WEB_VISUAL_SOURCES.ui,...WEB_VISUAL_SOURCES.account,...WEB_VISUAL_SOURCES.features];
  const paths=sources.map(([path])=>path);
  const missingCoverage=paths.filter((path)=>!WEB_VISUAL_COVERAGE[path]);
  return {ref:WEB_VISUAL_SOURCES.ref,total:paths.length,unique:new Set(paths).size,missingCoverage,complete:new Set(paths).size===paths.length&&missingCoverage.length===0};
}
