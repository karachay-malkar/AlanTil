import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('Web first run starts General Guide automatically and persists completion',()=>{
  const guide=read('src/features/onboarding/guide.js');
  assert.match(guide,/general_completed: Boolean\(value\?\.general_completed\)/);
  assert.match(guide,/updateGuideState\(\{ general_completed: true \}\)/);
  assert.match(guide,/!generalGuide\.active && !storedGuideState\(\)\.general_completed && document\.querySelector\("\.pathView"\)\) startGeneralGuide\(\)/);
  assert.match(guide,/stepKey: `general:stages:\$\{[\s\S]*onNext: finishGeneralGuide/);
  assert.match(guide,/window\.dispatchEvent\(new CustomEvent\("alantil:general-guide-completed"\)\)/);
});

test('Web Stella is not mounted before the first guide and opens only after guide completion',()=>{
  const pathFeature=read('src/features/path/feature.js');
  assert.match(pathFeature,/guideCompleted=Boolean\(readScopedJson\("alantil_guided_help_v1",\{\}\)\?\.general_completed\)/);
  assert.match(pathFeature,/if\(guideCompleted\)mountStele\(\);else window\.addEventListener\("alantil:general-guide-completed"/);
  assert.match(pathFeature,/if\(!hasSeenStoryStele\(activeStory\)\)mountStele\(\)/);
});

test('Mobile keeps the same Guide then Stella first-run ordering',()=>{
  const mobile=read('mobile/screens/path.js');
  const guideState=read('mobile/platform/guide-state.js');
  assert.match(guideState,/general_completed:Boolean\(value\?\.general_completed\)/);
  assert.match(mobile,/if\(!guideState\.general_completed\)\{beginNativeGeneralGuide\(\)/);
  assert.match(mobile,/generalCompleted&&route\.stories\?\.\[activeStory\]\?\.intro&&!getNativeGeneralGuideRuntime\(\)\.active/);
  assert.match(mobile,/saveNativeGuideState\(\{general_completed:true\}\)/);
  assert.match(mobile,/await showUnseenStele\(\)/);
});
