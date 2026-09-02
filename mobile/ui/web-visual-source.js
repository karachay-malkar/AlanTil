// Canonical visual contract mirrored from Web 13.15.12.
// This file is the auditable bridge between Web CSS/UI sources and React Native.

export const WEB_VISUAL_SOURCES = Object.freeze({
  ref: '13.15.12',
  styles: Object.freeze([
    ['src/shared/styles/app.css','1f616612b2a0c5d40b5e9ca9398d13e424e792f5'],
    ['src/shared/styles/base.css','aff5f0473ff1b269100c5d20df98b5ad142e1bd3'],
    ['src/shared/styles/chrome.css','3f2ffa5abfc2d0dc157cb0020d24bed0a2494dff'],
    ['src/shared/styles/components.css','daf4266a1f83691102f662244b4881e3a73db638'],
    ['src/shared/styles/guest-profile-prompt.css','e3cd2d00df49d96585e682b95e4f482f72646e54'],
    ['src/shared/styles/paper-components.css','d39121efbd1eb19c10c3b41992c67be0a50f338e'],
    ['src/shared/styles/privacy.css','465d6687b02ff2d52a03b2bfd8e4b82d0c4094c5'],
    ['src/shared/styles/reset.css','3a1f3aa732f773c8b88c027cb5555f5fd0206fad'],
    ['src/shared/styles/segmented-control.css','c98c3144f2aafdddb4684de5b89b8c6c06a45ce1'],
    ['src/shared/styles/shell.css','14032e0b4c3d1111ce92831dbd991284b8b41503'],
    ['src/shared/styles/table-system.css','8160eda4f999745a5430621c3faff9ad01001645'],
    ['src/shared/styles/theme.css','9afc17328e22829ad9a13dec8cd7681705131a5f'],
    ['src/shared/styles/typography.css','f5a5fe2f1e5e87f95c0f854c6a9ed505737131bd'],
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
});

export const WEB_VISUAL_TOKENS = Object.freeze({
  colors: Object.freeze({
    appBg:'#eee9df', appBgDeep:'#e7e0d4', surface0:'#f6f2e9', surface1:'#eee8dc', surface2:'#e2d9c9', surface3:'#cec0aa', surfaceDark:'#34312c',
    text1:'#292722', text2:'#666158', text3:'#918b80', inverse:'#faf8f2',
    lineSoft:'rgba(54,50,43,0.12)', line:'rgba(54,50,43,0.22)', lineStrong:'rgba(54,50,43,0.46)',
    accent:'#8b6b3b', accentStrong:'#65491f', accentSoft:'rgba(139,107,59,0.11)', accentGlow:'rgba(139,107,59,0.20)',
    success:'#5d7654', successStrong:'#425a3b', successSoft:'rgba(93,118,84,0.12)', successBorder:'rgba(93,118,84,0.32)',
    danger:'#98564c', dangerStrong:'#733e36', dangerSoft:'rgba(152,86,76,0.12)', dangerBorder:'rgba(152,86,76,0.35)',
    warning:'#a47736', info:'#58777a', locked:'#aaa49a', favorite:'#9b7027',
    paper:'rgba(255,255,255,0.22)', paperSoft:'rgba(255,255,255,0.13)', component:'rgba(255,255,255,0.28)',
    panelStrong:'rgba(255,255,255,0.20)', panelMid:'rgba(255,255,255,0.14)', panelSoft:'rgba(255,255,255,0.10)', panelFaint:'rgba(255,255,255,0.08)',
    white55:'rgba(255,255,255,0.55)', overlay:'rgba(31,30,26,0.52)', modalShadow:'rgba(31,30,26,0.20)',
    controlGlass:'rgba(246,242,233,0.28)', controlGlassActive:'rgba(246,242,233,0.46)', controlBorder:'rgba(54,50,43,0.0968)', maskGlass:'rgba(238,233,223,0.18)',
    pathBubbleGlass:'rgba(41,39,34,0.34)', pathBubbleBorder:'rgba(41,39,34,0.18)', activeBubbleGlass:'rgba(41,39,34,0.88)', activeBubbleBorder:'rgba(41,39,34,0.32)',
  }),
  typeScale: Object.freeze({
    small:Object.freeze({micro:10,caption:10,body:12,emphasis:14,title:16,display:40,result:54}),
    medium:Object.freeze({micro:10,caption:12,body:14,emphasis:16,title:20,display:48,result:64}),
    large:Object.freeze({micro:12,caption:14,body:16,emphasis:20,title:20,display:56,result:72}),
  }),
  radius:Object.freeze({xs:7,sm:10,md:15,lg:20,pill:999}),
  spacing:Object.freeze({s1:4,s2:8,s3:12,s4:16,s5:20,s6:24,s7:32,s8:40}),
  control:Object.freeze({sm:36,normal:44,compact:36,text:28,large:44,header:42,nav:60}),
  chrome:Object.freeze({contentRestGap:16,actionEdgeGap:16,headerSide:10,headerSideCompact:6,headerCenterInset:56,navSide:12,navSideCompact:8,actionSize:36,actionIconSize:20,navBubbleSize:38,navBubbleCompactSize:36,blur:10,controlBlur:8,compactWidth:360}),
  motion:Object.freeze({fast:110,normal:145}),
  layout:Object.freeze({contentMax:720,viewPadding:12,viewPaddingCompact:8,panelBodyHorizontal:16,panelBodyHorizontalCompact:12,panelBodyTop:8,panelBodyBottom:18}),
  shadow:Object.freeze({xs:{opacity:0.05,radius:2,y:1},sm:{opacity:0.07,radius:14,y:5},md:{opacity:0.12,radius:30,y:12}}),
});

export function verifyWebVisualSourceManifest() {
  const paths = [...WEB_VISUAL_SOURCES.styles, ...WEB_VISUAL_SOURCES.ui, ...WEB_VISUAL_SOURCES.account].map(([path])=>path);
  return { ref:WEB_VISUAL_SOURCES.ref, total:paths.length, unique:new Set(paths).size, complete:new Set(paths).size===paths.length };
}
