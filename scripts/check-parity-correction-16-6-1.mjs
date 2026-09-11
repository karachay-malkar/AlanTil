import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const requireText=(file,patterns)=>{const source=read(file);for(const pattern of patterns)if(!source.includes(pattern))throw new Error(`${file}: missing ${pattern}`);};
const requireRegex=(file,patterns)=>{const source=read(file);for(const pattern of patterns)if(!pattern.test(source))throw new Error(`${file}: missing ${pattern}`);};
const requireFile=(file)=>{if(!fs.existsSync(path.join(root,file)))throw new Error(`Missing ${file}`);};
const versionAtLeast=(value,minimum)=>{const a=String(value||'').split('.').map(Number),b=String(minimum).split('.').map(Number);for(let i=0;i<3;i+=1){if((a[i]||0)>(b[i]||0))return true;if((a[i]||0)<(b[i]||0))return false;}return true;};

[
  'packages/alantil-core/hidden-selection.js','packages/alantil-core/story-word-list.js','packages/alantil-core/learn-card.js','packages/alantil-core/guide-contract.js','packages/alantil-core/dictionary-bootstrap.js',
  'mobile/platform/path-state.js','mobile/platform/guide-state.js','mobile/platform/privacy.js','mobile/screens/story-word-list.js','mobile/screens/settings-child.js','mobile/ui/guide.js','mobile/ui/checkbox.js','mobile/tests/parity-correction-16-6-1.test.mjs'
].forEach(requireFile);
requireText('packages/alantil-core/test.js',['hasWordConflict']);
requireRegex('packages/alantil-core/test.js',[/metadata\s*:\s*\{\.\.\.\(state\.session\.metadata\|\|\{\}\)\}/]);
requireText('packages/alantil-core/station-test.js',['stationTestPhaseFromProgress','hasWordConflict']);
requireRegex('packages/alantil-core/station-test.js',[/phase\s*:\s*session\.phase/]);
requireText('packages/alantil-core/match.js',['activeRoundIds','activeRightIds']);
requireRegex('packages/alantil-core/match.js',[/metadata\s*:\s*\{\.\.\.\(state\.session\.metadata\|\|\{\}\)\}/]);
requireText('packages/alantil-core/practice-scope.js',['scopeSelectionState','scopeSelectionCounts','selectedScopeSources']);
requireText('mobile/screens/path.js',['loadNativePathSettings','loadNativeStoryScroll','stationMilestoneCount','computedStationStatus','onOpenWordList']);
requireText('mobile/screens/practice-games.js',['restoreMatchActiveRound','setMatchActiveOrdering','Checkbox']);
requireRegex('mobile/ui/checkbox.js',[/checked\s*===\s*true\s*\?\s*['"]all['"]/,/mixed\s*\?\s*['"]mixed['"]\s*:\s*resolved\s*===\s*['"]all['"]/]);
requireText('mobile/screens/station-test.js',['FavoriteButton','clearNativeSessionSnapshot','retry']);
requireText('mobile/screens/learn.js',['PanResponder','buildLearnCardModel','gestureLock','GuideOverlay']);
requireText('mobile/screens/profile-main.js',['SettingsChildScreen','checkNativeDictionaryUpdate','onOpenStory']);
requireText('mobile/platform/dictionary.js',['bootstrapDictionaryRuntime','currentVersion','latestVersion','needsUpdate']);
requireText('mobile/AppRoot.js',['RuntimeSettingsProvider','StoryWordListScreen','saveNativeActiveStory']);
const pkg=JSON.parse(read('mobile/package.json')),app=JSON.parse(read('mobile/app.json'));
if(pkg.version!==app.expo.version||app.expo.extra?.releaseVersion!==app.expo.version||!versionAtLeast(app.expo.version,'16.6.1'))throw new Error('Mobile release must preserve 16.6.1+ functional contract with coherent metadata');
if(Number(app.expo.android?.versionCode)<24||Number(app.expo.ios?.buildNumber)<24)throw new Error('Native build numbers must preserve the 16.6.1+ floor');
const testSource=read('mobile/tests/parity-correction-16-6-1.test.mjs');
for(const required of ['Match snapshot restores metadata','bundled dictionary remains runtime source','scope parent selection','guide contract preserves Web','analytics domain events'])if(!testSource.includes(required))throw new Error(`Missing executable regression: ${required}`);
console.log('16.6.1 parity correction source gate: PASS');
console.log('16.6.1 functional contract preserved by current release.');
