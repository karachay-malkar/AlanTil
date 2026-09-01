import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { readReleaseMetadata, releaseMetadata } from '../scripts/release-metadata.mjs';

function fixture() {
  return [
    { expo: {
      version: '14.2.0',
      extra: { releaseVersion: '14.2.0' },
      android: { package: 'app.alantil.mobile', versionCode: 7 },
      ios: { bundleIdentifier: 'app.alantil.mobile', buildNumber: '7' },
    } },
    { version: '14.2.0' },
    { version: '14.2.0', packages: { '': { version: '14.2.0' } } },
  ];
}

test('release names use the verified application version', () => {
  const metadata = releaseMetadata(...fixture());
  assert.equal(metadata.apk_filename, 'AlanTil-14.2.0.apk');
  assert.equal(metadata.apk_artifact, 'AlanTil-14.2.0-Android-APK');
  assert.equal(metadata.source_filename, 'AlanTil_14.2.0_mobile_source.zip');
  assert.equal(metadata.app_id, 'app.alantil.mobile');
  assert.equal(metadata.build_number, '7');
});

test('release validation rejects stale package and lockfile versions', () => {
  for (const mutate of [
    ([, manifest]) => { manifest.version = '14.1.6'; },
    ([, , lockfile]) => { lockfile.version = '14.1.6'; },
    ([, , lockfile]) => { lockfile.packages[''].version = '14.1.6'; },
    ([app]) => { app.expo.extra.releaseVersion = '14.1.6'; },
  ]) {
    const values = fixture();
    mutate(values);
    assert.throws(() => releaseMetadata(...values), /version|releaseVersion/i);
  }
});

test('release validation rejects renamed apps and invalid native build numbers', () => {
  for (const mutate of [
    ([app]) => { app.expo.android.package = 'app.alantil.preview'; },
    ([app]) => { app.expo.ios.bundleIdentifier = 'app.alantil.preview'; },
    ([app]) => { app.expo.android.versionCode = 0; },
    ([app]) => { app.expo.android.versionCode = 7.5; },
    ([app]) => { app.expo.ios.buildNumber = '6'; },
    ([app]) => { app.expo.version = '../unexpected\noutput=value'; },
  ]) {
    const values = fixture();
    mutate(values);
    assert.throws(() => releaseMetadata(...values));
  }
});

test('release CLI prints safe GitHub outputs for the actual source tree', () => {
  const metadata = readReleaseMetadata();
  const output = execFileSync(process.execPath, ['scripts/release-metadata.mjs'], {
    cwd: new URL('../', import.meta.url), encoding: 'utf8',
  });
  assert.deepEqual(Object.fromEntries(output.trim().split('\n').map((line) => line.split('='))), metadata);
});

test('APK workflow targets the working branch and verifies the native artifact', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/mobile-14-1-android.yml', import.meta.url), 'utf8');
  assert.match(workflow, /agent\/14\.2-mobile-parity/);
  assert.match(workflow, /agent\/15\.0-unified-core/);
  assert.doesNotMatch(workflow, /agent\/14\.1-mobile-foundation|AlanTil-14\.1\.6/);
  assert.match(workflow, /node-version: '24'/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /expo export --platform android/);
  assert.match(workflow, /assembleRelease/);
  assert.match(workflow, /manifest application-id/);
  assert.match(workflow, /manifest version-name/);
  assert.match(workflow, /manifest version-code/);
  assert.match(workflow, /assets\/index\.android\.bundle/);
  assert.match(workflow, /steps\.release\.outputs\.apk_filename/);
  assert.match(workflow, /sha256sum/);
  assert.match(workflow, /if-no-files-found: error/);
  assert.doesNotMatch(workflow, /contents: write|pull_request:/);
});

test('source archive packages the complete committed unified project and remains distinct from APK', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/mobile-14-1-source.yml', import.meta.url), 'utf8');
  assert.match(workflow, /agent\/14\.2-mobile-parity/);
  assert.match(workflow, /agent\/15\.0-unified-core/);
  assert.match(workflow, /git archive --format=zip/);
  assert.match(workflow, /--output="\$ALANTIL_SOURCE_FILENAME" HEAD/);
  assert.match(workflow, /--prefix="\$ALANTIL_SOURCE_PREFIX\/"/);
  assert.match(workflow, /steps\.release\.outputs\.source_artifact/);
  assert.doesNotMatch(workflow, /cp -R mobile|HEAD mobile|14\.1\.6/);
});
