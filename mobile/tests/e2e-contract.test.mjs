import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('native screens expose translation-independent automation ids', async () => {
  const [ids, onboarding, path, station, learn, stationTest, generalTest, match, settings] = await Promise.all([
    read('src/mobile/test-ids.ts'),
    read('src/mobile/onboarding.tsx'),
    read('src/mobile/path.tsx'),
    read('src/mobile/station.tsx'),
    read('src/mobile/learn/engine.tsx'),
    read('src/mobile/learn/station-test.tsx'),
    read('src/mobile/practice/test.tsx'),
    read('src/mobile/practice/match.tsx'),
    read('src/mobile/profile/settings-screen.tsx'),
  ]);
  assert.match(ids, /screen\.onboarding\.setup/);
  assert.match(ids, /screen\.station-test\.result/);
  assert.match(onboarding, /testIds\.onboarding\.guest/);
  assert.match(path, /scopedTestId\('path\.station'/);
  assert.match(station, /testIds\.station\.study/);
  assert.match(learn, /testIds\.learn\.result/);
  assert.match(stationTest, /testIds\.stationTest\.result/);
  assert.match(generalTest, /testIds\.generalTest\.session/);
  assert.match(match, /testIds\.match\.session/);
  assert.match(settings, /testIds\.settings\.save/);
});

test('Maestro covers the six critical mobile flows and screenshot artifacts', async () => {
  const directory = new URL('../.maestro/', import.meta.url);
  const files = (await readdir(directory)).filter((name) => name.endsWith('_flow.yaml')).sort();
  assert.deepEqual(files, [
    '00_guest_onboarding_flow.yaml',
    '10_station_learning_flow.yaml',
    '11_station_test_flow.yaml',
    '20_general_test_resume_flow.yaml',
    '30_match_resume_flow.yaml',
    '40_settings_flow.yaml',
  ]);
  const sources = await Promise.all(files.map((file) => read(`.maestro/${file}`)));
  assert.ok(sources.every((source) => source.includes('appId: app.alantil.mobile')));
  assert.ok(sources.every((source) => source.includes('takeScreenshot:')));
  assert.match(sources.join('\n'), /killApp/);
  assert.match(sources.join('\n'), /screen\.learn\.result/);
  assert.match(sources.join('\n'), /screen\.station-test\.result/);
});

test('EAS has simulator and APK profiles plus parallel Maestro jobs', async () => {
  const [eas, workflow] = await Promise.all([read('eas.json').then(JSON.parse), read('.eas/workflows/e2e.yml')]);
  assert.equal(eas.build['e2e-test'].ios.simulator, true);
  assert.equal(eas.build['e2e-test'].android.buildType, 'apk');
  assert.match(workflow, /type: maestro/);
  assert.match(workflow, /needs: \[build_android\]/);
  assert.match(workflow, /needs: \[build_ios\]/);
});
