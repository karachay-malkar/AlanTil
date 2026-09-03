import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const requireText=(file,patterns)=>{const source=read(file);for(const pattern of patterns)if(!source.includes(pattern))throw new Error(`${file}: missing ${pattern}`);};
const requireFile=(file)=>{if(!fs.existsSync(path.join(root,file)))throw new Error(`Missing ${file}`);};

[
  'packages/alantil-core/hidden-selection.js','packages/alantil-core/story-word-list.js','packages/alantil-core/learn-card.js','packages/alantil-core/guide-contract.js','packages/alantil-core/dictionary-bootstrap.js',
  'mobile/platform/path-state.js','mobile/platform/guide-state.js','mobile/platform/privacy.js','mobile/screens/story-word-list.js','mobile/screens/settings-child.js','mobile/ui/guide.js','mobile/tests/parity-correction-16-6-1.test.mjs'
].forEach(requireFile);
requireText('packages/alantil-core/test.js',['metadata:{...(state.session.metadata||{})}','hasWordConflict']);
requireText('packages/alantil-core/station-test.js',['stationTestPhaseFromProgress','phase:session.phase','hasWordConflict']);
requireText('packages/alantil-core/match.js',['activeRoundIds','activeRightIds','metadata:{...(state.session.metadata||{})}']);
requireText('packages/alantil-core/practice-scope.js',['scopeSelectionState','scopeSelectionCounts','selectedScopeSources']);
requireText('mobile/screens/path.js',['loadNativePathSettings','loadNativeStoryScroll','stationMilestoneCount','computedStationStatus','onOpenWordList']);
requireText('mobile/screens/practice-games.js',['restoreMatchActiveRound','setMatchActiveOrdering',"checked: mixed ? 'mixed' : checked"]);
requireText('mobile/screens/station-test.js',['FavoriteButton','clearNativeSessionSnapshot','retry']);
requireText('mobile/screens/learn.js',['PanResponder','buildLearnCardModel','gestureLock','GuideOverlay']);
requireText('mobile/screens/profile-main.js',['SettingsChildScreen','checkNativeDictionaryUpdate','onOpenStory']);
requireText('mobile/platform/dictionary.js',['bootstrapDictionaryRuntime','currentVersion','latestVersion','needsUpdate']);
requireText('mobile/AppRoot.js',['RuntimeSettingsProvider','StoryWordListScreen','saveNativeActiveStory']);
const pkg=JSON.parse(read('mobile/package.json')),app=JSON.parse(read('mobile/app.json'));
if(pkg.version!=='16.6.1'||app.expo.version!=='16.6.1'||app.expo.extra?.releaseVersion!=='16.6.1')throw new Error('Mobile version is not 16.6.1');
if(Number(app.expo.android?.versionCode)<24||String(app.expo.ios?.buildNumber)!=='24')throw new Error('Native build numbers were not bumped');
const testSource=read('mobile/tests/parity-correction-16-6-1.test.mjs');
for(const required of ['Match snapshot restores metadata','bundled dictionary remains runtime source','scope parent selection','guide contract preserves Web','analytics domain events'])if(!testSource.includes(required))throw new Error(`Missing executable regression: ${required}`);
console.log('16.6.1 parity correction source gate: PASS');
console.log('Q03 pixel comparison intentionally remains outside this functional gate for 16.6.2.');
