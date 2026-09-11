import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const requireFile=(file)=>{if(!fs.existsSync(path.join(root,file)))throw new Error(`Missing ${file}`);};
const requireText=(file,patterns)=>{const source=read(file);for(const pattern of patterns)if(!source.includes(pattern))throw new Error(`${file}: missing ${pattern}`);};
const requireRegex=(file,patterns)=>{const source=read(file);for(const pattern of patterns)if(!pattern.test(source))throw new Error(`${file}: missing ${pattern}`);};

[
  'mobile/tests/visual-parity-16-6-2.test.mjs',
  'mobile/ui/web-visual-source.js','mobile/ui/theme.js','mobile/ui/components.js','mobile/ui/parity.js',
  'mobile/screens/path.js','mobile/screens/station.js','mobile/screens/practice.js','mobile/screens/profile-main.js',
  'mobile/screens/favorites.js','mobile/screens/story-word-list.js','mobile/screens/profile.js','mobile/screens/onboarding.js','mobile/screens/settings-child.js',
].forEach(requireFile);
const pkg=JSON.parse(read('mobile/package.json')),app=JSON.parse(read('mobile/app.json'));
if(pkg.version!=='16.6.2'||app.expo.version!=='16.6.2'||app.expo.extra?.releaseVersion!=='16.6.2')throw new Error('Mobile version is not 16.6.2');
if(Number(app.expo.android?.versionCode)!==25||String(app.expo.ios?.buildNumber)!=='25')throw new Error('16.6.2 native build numbers must be 25');
requireRegex('mobile/ui/web-visual-source.js',[/control:Object\.freeze\([^\n]*header:46/,/path:Object\.freeze\([^\n]*rootControlsHeight:56[^\n]*mapTop:64[^\n]*stationSize:60[^\n]*stationGap:58[^\n]*scaleDot:4[^\n]*scaleSection:6[^\n]*scaleDiamond:9/]);
requireText('mobile/ui/theme.js',['path:W.path']);
requireRegex('mobile/ui/components.js',[/NAV_INACTIVE='rgba\(102,97,88,\.62\)'/,/button:\{[^}]*borderRadius:14/s,/buttonAction:\{borderRadius:15\}/,/navLabel:\{[^}]*color:NAV_INACTIVE/s,/webTopChromeMask:[\s\S]*maskImage:'linear-gradient\(to bottom/,/webBottomChromeMask:[\s\S]*maskImage:'linear-gradient\(to top/]);
requireRegex('mobile/ui/parity.js',[/segmentItem:\s*\{[^}]*minHeight:\s*28/s]);
requireRegex('mobile/screens/path.js',[/pathControls:\{[^}]*top:0[^}]*height:theme\.path\.rootControlsHeight/s,/pathViewport:\{[^}]*top:0/s,/pathContent:\{[^}]*paddingTop:theme\.path\.mapTop[^}]*paddingLeft:20[^}]*paddingRight:50/s,/stationNode:\{[^}]*width:theme\.path\.stationSize[^}]*height:theme\.path\.stationSize/s,/routeScale:\{[^}]*right:theme\.path\.scaleRight[^}]*top:'20%'[^}]*bottom:'20%'[^}]*width:theme\.path\.scaleWidth/s]);
requireRegex('mobile/screens/station.js',[/tabs:\{[^}]*top:theme\.control\.header-4[^}]*height:28/s,/toolbar:\{[^}]*top:theme\.control\.header\+24[^}]*height:28/s,/wordList:\{[^}]*paddingTop:theme\.control\.header\+56[^}]*paddingBottom:108/s,/launchPanel:\{[^}]*bottom:theme\.chrome\.actionEdgeGap/s]);
requireRegex('mobile/screens/practice.js',[/menuRow:\{[^}]*minHeight:68[^}]*paddingHorizontal:2[^}]*paddingVertical:10/s,/menuLeading:\{width:36,height:36\}/,/menuSubtitle:\{[^}]*fontSize:11[^}]*lineHeight:14\.3/s]);
requireRegex('mobile/screens/profile-main.js',[/tabs:\{[^}]*top:2[^}]*height:30/s,/body:\{[^}]*paddingTop:42[^}]*paddingHorizontal:14/s,/avatarFrame:\{[^}]*maxWidth:286[^}]*aspectRatio:\.8[^}]*borderRadius:2/s,/accountCircle:\{[^}]*width:42[^}]*height:42/s,/profileStat:\{[^}]*width:'50%'[^}]*minHeight:72/s]);
requireRegex('mobile/screens/favorites.js',[/toolbar:\{[^}]*top:theme\.control\.header\+4[^}]*left:14[^}]*right:14[^}]*height:34/s,/list:\{[^}]*paddingTop:theme\.control\.header\+54[^}]*paddingHorizontal:14[^}]*paddingBottom:154/s,/row:\{height:52,minHeight:52/s,/footer:\{[^}]*bottom:theme\.chrome\.actionEdgeGap/s]);
if(/<SurfaceCard>/.test(read('mobile/screens/favorites.js')))throw new Error('Favorites must stay flat without a card wrapper');
requireRegex('mobile/screens/story-word-list.js',[/HeaderCircleButton/,/SearchIcon/,/searchWidth=Math\.min\(width\*\.72,300\)/,/list:\{paddingTop:theme\.control\.header\+8/,/row:\{height:52,minHeight:52/]);
if(/searchWrap:/.test(read('mobile/screens/story-word-list.js')))throw new Error('Story Word List search must remain in the Header');
requireRegex('mobile/screens/profile.js',[/PROFILE_AVATAR_MALE=require\('\.\.\/\.\.\/assets\/images\/profile\/avatar_male\.png'\)/,/PROFILE_AVATAR_FEMALE=require\('\.\.\/\.\.\/assets\/images\/profile\/avatar_female\.png'\)/,/accountPanel:\{[^}]*margin:0[^}]*borderWidth:0[^}]*borderRadius:0[^}]*backgroundColor:'transparent'/s,/accountGenderChoice:\{[^}]*minHeight:170/s]);
if(/avatarHead:|avatarBody:/.test(read('mobile/screens/profile.js')))throw new Error('Account must not reintroduce synthetic avatar geometry');
requireRegex('mobile/screens/onboarding.js',[/paddingTop: theme\.control\.header \+ theme\.chrome\.contentRestGap/,/maxWidth: 560/]);
if(/fullButton:\s*\{[^}]*minHeight:\s*44/s.test(read('mobile/screens/onboarding.js')))throw new Error('Onboarding continue button must inherit Web button height');
requireText('mobile/screens/settings-child.js',['>16.6.2<']);
if(/<Header title="Alan Til!"/.test(read('mobile/screens/profile-main.js')))throw new Error('Profile root must not reintroduce brand Header above primary tabs');
const regression=read('mobile/tests/visual-parity-16-6-2.test.mjs');
for(const required of [
  'canonical header token follows Web theme',
  'shared chrome buttons and bottom navigation',
  'Practice menu uses Web 68px',
  'Favorites uses Web set-preparation',
  'Story Word List moves search into header',
  'Onboarding uses Web setup insets',
  'Account uses canonical avatar assets',
  'Profile root replaces brand header',
  'Path geometry uses final Web chrome',
  'Station uses final Web chrome offsets',
])if(!regression.includes(required))throw new Error(`Missing executable 16.6.2 regression: ${required}`);
console.log('16.6.2 visual geometry source gate: PASS');
console.log('Physical Android/iOS font rasterization and native safe-area comparison remain DEVICE_REQUIRED for 16.7.');
