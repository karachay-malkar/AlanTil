import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const requireFile=(file)=>{if(!fs.existsSync(path.join(root,file)))throw new Error(`Missing ${file}`);};
const requireText=(file,patterns)=>{const source=read(file);for(const pattern of patterns)if(!source.includes(pattern))throw new Error(`${file}: missing ${pattern}`);};
const requireRegex=(file,patterns)=>{const source=read(file);for(const pattern of patterns)if(!pattern.test(source))throw new Error(`${file}: missing ${pattern}`);};

['mobile/tests/visual-parity-16-6-2.test.mjs','mobile/ui/web-visual-source.js','mobile/ui/theme.js','mobile/screens/path.js'].forEach(requireFile);
const pkg=JSON.parse(read('mobile/package.json')),app=JSON.parse(read('mobile/app.json'));
if(pkg.version!=='16.6.2'||app.expo.version!=='16.6.2'||app.expo.extra?.releaseVersion!=='16.6.2')throw new Error('Mobile version is not 16.6.2');
if(Number(app.expo.android?.versionCode)!==25||String(app.expo.ios?.buildNumber)!=='25')throw new Error('16.6.2 native build numbers must be 25');
requireRegex('mobile/ui/web-visual-source.js',[/control:Object\.freeze\([^\n]*header:46/,/path:Object\.freeze\([^\n]*rootControlsHeight:56[^\n]*mapTop:64[^\n]*stationSize:60[^\n]*stationGap:43[^\n]*scaleDot:4[^\n]*scaleSection:6[^\n]*scaleDiamond:9/]);
requireText('mobile/ui/theme.js',['path:W.path']);
requireRegex('mobile/screens/path.js',[/pathControls:\{[^}]*top:0[^}]*height:theme\.path\.rootControlsHeight/s,/pathViewport:\{[^}]*top:0/s,/pathContent:\{[^}]*paddingTop:theme\.path\.mapTop[^}]*paddingLeft:20[^}]*paddingRight:50/s,/stationNode:\{[^}]*width:theme\.path\.stationSize[^}]*height:theme\.path\.stationSize/s,/routeScale:\{[^}]*right:theme\.path\.scaleRight[^}]*top:'20%'[^}]*bottom:'20%'[^}]*width:theme\.path\.scaleWidth/s]);
const regression=read('mobile/tests/visual-parity-16-6-2.test.mjs');
for(const required of ['canonical header token follows Web theme','Path geometry uses final Web chrome','does not reintroduce the old Path'])if(!regression.includes(required))throw new Error(`Missing executable 16.6.2 regression: ${required}`);
console.log('16.6.2 visual geometry source gate: PASS');
console.log('Physical Android/iOS font rasterization and native safe-area comparison remain DEVICE_REQUIRED for 16.7.');
