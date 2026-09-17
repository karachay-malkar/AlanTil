import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const write=(file,content)=>fs.writeFileSync(path.join(ROOT,file),content);

function replaceContract(source,before,after,label){
  if(source.includes(after))return source;
  if(!source.includes(before))throw new Error(`Visual contract source drift: ${label}`);
  return source.replace(before,after);
}

const ashykPath='mobile/screens/ashyk.js';
let ashyk=read(ashykPath);
const replacements=[
  ["segmented:{width:'100%',minHeight:34,padding:2,borderWidth:1,borderColor:C.line,borderRadius:999,","segmented:{width:'100%',minHeight:theme.ashyk.segmentedHeight,padding:theme.segmented.padding,borderWidth:1,borderColor:C.line,borderRadius:theme.segmented.radius,",'Ashyk segmented container'],
  ["segmentedItem:{flex:1,minHeight:28,borderRadius:999,","segmentedItem:{flex:1,minHeight:theme.ashyk.segmentedItemHeight,borderRadius:theme.segmented.radius,",'Ashyk segmented item'],
  ["ashykButton:{width:'100%',minHeight:38,paddingVertical:7,paddingHorizontal:13,borderWidth:1,borderColor:C.line,borderRadius:14,","ashykButton:{width:'100%',minHeight:theme.ashyk.buttonHeight,paddingVertical:theme.ashyk.buttonVertical,paddingHorizontal:theme.ashyk.buttonHorizontal,borderWidth:1,borderColor:C.line,borderRadius:theme.ashyk.buttonRadius,",'Ashyk button geometry'],
  ["ashykButtonLabel:{fontSize:13,lineHeight:17,fontWeight:'700',","ashykButtonLabel:{fontSize:theme.ashyk.buttonFontSize,lineHeight:theme.ashyk.buttonLineHeight,fontWeight:'700',",'Ashyk button typography'],
  ["friendChoice:{minHeight:52,borderWidth:1,borderColor:C.line,borderRadius:14,","friendChoice:{minHeight:52,borderWidth:1,borderColor:C.line,borderRadius:theme.ashyk.buttonRadius,",'Ashyk friend choice'],
  ["surface:{borderWidth:1,borderColor:'rgba(86,82,75,.26)',backgroundColor:'rgba(246,242,233,.58)',borderRadius:14,","surface:{borderWidth:1,borderColor:'rgba(86,82,75,.26)',backgroundColor:'rgba(246,242,233,.58)',borderRadius:theme.ashyk.surfaceRadius,",'Ashyk surface'],
  ["dialog:{width:'100%',maxWidth:360,maxHeight:'100%',padding:0,borderRadius:20,","dialog:{width:'100%',maxWidth:360,maxHeight:'100%',padding:0,borderRadius:theme.ashyk.dialogRadius,",'Ashyk dialog'],
  ["questionCard:{width:'100%',maxWidth:520,padding:16,borderRadius:20},","questionCard:{width:'100%',maxWidth:520,padding:16,borderRadius:theme.ashyk.dialogRadius},",'Ashyk question card'],
  ["questionChoice:{width:'100%',minHeight:50,paddingVertical:9,paddingHorizontal:11,borderWidth:1,borderColor:C.line,borderRadius:14,","questionChoice:{width:'100%',minHeight:50,paddingVertical:9,paddingHorizontal:11,borderWidth:1,borderColor:C.line,borderRadius:theme.ashyk.buttonRadius,",'Ashyk question choice'],
  ["finishCard:{width:'100%',maxWidth:420,padding:18,alignItems:'center',borderRadius:20},","finishCard:{width:'100%',maxWidth:420,padding:18,alignItems:'center',borderRadius:theme.ashyk.dialogRadius},",'Ashyk finish card'],
];
for(const [before,after,label] of replacements)ashyk=replaceContract(ashyk,before,after,label);
write(ashykPath,ashyk);

function gitBlobSha(file){
  const content=fs.readFileSync(path.join(ROOT,file));
  return crypto.createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
}

const groups={
  styles:[
    'src/shared/styles/shared-visual-tokens.css','src/shared/styles/theme.css','src/shared/styles/typography.css','src/shared/styles/shell.css','src/shared/styles/chrome.css','src/shared/styles/components.css','src/shared/styles/paper-components.css','src/shared/styles/segmented-control.css','src/shared/styles/table-system.css','src/shared/styles/app.css','src/shared/styles/base.css','src/shared/styles/reset.css','src/shared/styles/guest-profile-prompt.css','src/shared/styles/privacy.css'
  ],
  ui:[
    'src/shared/ui/adaptive-layout.js','src/shared/ui/auth-provider-button.js','src/shared/ui/favorite-button.js','src/shared/ui/icons.js','src/shared/ui/info-modal.js','src/shared/ui/list.js','src/shared/ui/modal.js','src/shared/ui/panel.js'
  ],
  account:[
    'src/features/account/account.css','src/features/account/index.js','src/features/account/login.js','src/features/account/profile.js'
  ],
  features:[
    'src/features/path/path.css','src/features/path/path-navigation.css','src/features/path/story-stele.css','src/features/path/story-word-list.css','src/features/profile/profile.css','src/features/settings/settings.css','src/features/practice/practice.css','src/features/friends/friends-16-7.css','src/features/ashyk/ashyk.css','src/features/admin/admin.css','src/features/learn/learn.css','src/features/test/test.css','src/features/match/match.css','src/features/songs/songs.css','src/features/onboarding/onboarding.css'
  ],
};
const coverage={
  'src/shared/styles/shared-visual-tokens.css':'mapped: generated 16.7 shared token bridge consumed by Web',
  'src/shared/styles/theme.css':'mapped: colors, surfaces, borders, state colors, radii and shadows',
  'src/shared/styles/typography.css':'mapped: semantic text scales and families',
  'src/shared/styles/shell.css':'mapped: app shell, header and navigation base geometry',
  'src/shared/styles/chrome.css':'mapped: viewport masks and shared screen chrome',
  'src/shared/styles/components.css':'mapped: buttons, inputs, lists and state presentation',
  'src/shared/styles/paper-components.css':'mapped: paper/glass surfaces, borders and shadows',
  'src/shared/styles/segmented-control.css':'mapped: segmented controls and active states',
  'src/shared/styles/table-system.css':'mapped: table-like row geometry; CSS table layout itself is Web-only',
  'src/shared/styles/app.css':'mapped: 16.7 feature cascade, bracket tabs and shared bottom navigation geometry',
  'src/shared/styles/base.css':'mapped: base background, text and control defaults',
  'src/shared/styles/reset.css':'not-applicable: browser reset has no React Native equivalent',
  'src/shared/styles/guest-profile-prompt.css':'mapped: guest/login prompt geometry',
  'src/shared/styles/privacy.css':'mapped by shared document typography and checkbox primitives',
  'src/shared/ui/adaptive-layout.js':'mapped: compact breakpoint and horizontal insets',
  'src/shared/ui/auth-provider-button.js':'mapped: AuthProviderButton',
  'src/shared/ui/favorite-button.js':'mapped: FavoriteButton',
  'src/shared/ui/icons.js':'mapped by mobile/ui/icons.js; DOM injection is Web-only',
  'src/shared/ui/info-modal.js':'mapped: shared info modal geometry',
  'src/shared/ui/list.js':'mapped: list row contract',
  'src/shared/ui/modal.js':'mapped: overlay, card, actions and motion',
  'src/shared/ui/panel.js':'mapped: Panel',
  'src/features/account/account.css':'mapped: account stack, fields, facts, messages and gender cards',
  'src/features/account/index.js':'logic-parity target: account state machine',
  'src/features/account/login.js':'logic-parity target: provider and guest entry',
  'src/features/account/profile.js':'logic-parity target: nickname/avatar completion flow',
  'src/features/path/path.css':'mapped: route, station geometry, scale and topographic scene',
  'src/features/path/path-navigation.css':'mapped: story navigation and route controls',
  'src/features/path/story-stele.css':'mapped: story stele proportions and overlay geometry',
  'src/features/path/story-word-list.css':'mapped: story word rows and separators',
  'src/features/profile/profile.css':'mapped: bracket navigation, identity, progress and statistics',
  'src/features/settings/settings.css':'mapped: settings rows, learning preview, dictionary version and links',
  'src/features/practice/practice.css':'mapped: shared 16.7 practice row geometry',
  'src/features/friends/friends-16-7.css':'mapped: shared 16.7 social rows, search and action controls',
  'src/features/ashyk/ashyk.css':'mapped: shared Ashyk UI geometry; renderer, engine, physics and audio remain feature-owned',
  'src/features/admin/admin.css':'mapped: extended statistics/users presentation under Friends',
  'src/features/learn/learn.css':'mapped: word card, actions, results and progress',
  'src/features/test/test.css':'mapped: question, answer states and results',
  'src/features/match/match.css':'mapped: pair grid, card states and results',
  'src/features/songs/songs.css':'mapped: catalog, player, lyrics and search',
  'src/features/onboarding/onboarding.css':'mapped: setup and guide spacing/actions',
};

const arrayBlock=items=>items.map(file=>`    [${JSON.stringify(file)},${JSON.stringify(gitBlobSha(file))}],`).join('\n');
const coverageBlock=Object.entries(coverage).map(([file,note])=>`  ${JSON.stringify(file)}: ${JSON.stringify(note)},`).join('\n');
const manifest=`import { UI_TOKENS, WEB_VISUAL_REFERENCE, VISUAL_CONTRACT_VERSION } from '../../packages/alantil-ui/tokens.js';
import { CHROME_CONTRACT } from '../../packages/alantil-ui/chrome.js';

// Canonical semantic visual contract mirrored from the current Web 16.7.0 source.
// Every listed Git blob SHA is verified in CI so Mobile cannot silently target a stale Web snapshot.
export const WEB_VISUAL_SOURCES = Object.freeze({
  ref: '16.7.0',
  styles: Object.freeze([\n${arrayBlock(groups.styles)}\n  ]),
  ui: Object.freeze([\n${arrayBlock(groups.ui)}\n  ]),
  account: Object.freeze([\n${arrayBlock(groups.account)}\n  ]),
  features: Object.freeze([\n${arrayBlock(groups.features)}\n  ]),
});

export const WEB_VISUAL_COVERAGE = Object.freeze({\n${coverageBlock}\n});

export const WEB_VISUAL_TOKENS = Object.freeze({...UI_TOKENS,chrome:CHROME_CONTRACT});
export { UI_TOKENS, CHROME_CONTRACT, WEB_VISUAL_REFERENCE, VISUAL_CONTRACT_VERSION };

export function verifyWebVisualSourceManifest() {
  const sources=[...WEB_VISUAL_SOURCES.styles,...WEB_VISUAL_SOURCES.ui,...WEB_VISUAL_SOURCES.account,...WEB_VISUAL_SOURCES.features];
  const paths=sources.map(([sourcePath])=>sourcePath);
  const missingCoverage=paths.filter(sourcePath=>!WEB_VISUAL_COVERAGE[sourcePath]);
  return {ref:WEB_VISUAL_SOURCES.ref,total:paths.length,unique:new Set(paths).size,missingCoverage,complete:new Set(paths).size===paths.length&&missingCoverage.length===0};
}
`;
write('mobile/ui/web-visual-source.js',manifest);
console.log('16.7 visual contract synchronized');
