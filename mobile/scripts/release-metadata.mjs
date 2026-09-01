import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function releaseMetadata(app, manifest, lockfile) {
  const { expo } = app;
  const version = expo?.version;
  assert.match(version ?? '', /^\d+\.\d+\.\d+$/, 'Use a plain release version in app.json');
  assert.equal(manifest.version, version, 'package.json version must match app.json');
  assert.equal(lockfile.version, version, 'package-lock.json version must match app.json');
  assert.equal(lockfile.packages?.['']?.version, version, 'Lockfile root version must match app.json');
  assert.equal(expo.extra?.releaseVersion, version, 'releaseVersion must match app.json');
  assert.equal(expo.android?.package, 'app.alantil.mobile', 'Keep the existing Android application ID');
  assert.equal(expo.ios?.bundleIdentifier, expo.android.package, 'iOS and Android application IDs must agree');
  const buildNumber = expo.android.versionCode;
  assert.ok(Number.isSafeInteger(buildNumber) && buildNumber > 0, 'versionCode must be a positive integer');
  assert.equal(expo.ios.buildNumber, String(buildNumber), 'Native build numbers must agree');

  return {
    version,
    build_number: String(buildNumber),
    app_id: expo.android.package,
    apk_filename: `AlanTil-${version}.apk`,
    apk_artifact: `AlanTil-${version}-Android-APK`,
    source_prefix: `AlanTil_${version}_source`,
    source_filename: `AlanTil_${version}_mobile_source.zip`,
    source_artifact: `AlanTil-${version}-Mobile-Source`,
  };
}

export function readReleaseMetadata() {
  const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const read = (name) => JSON.parse(readFileSync(resolve(mobileRoot, name), 'utf8'));
  return releaseMetadata(read('app.json'), read('package.json'), read('package-lock.json'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  for (const [key, value] of Object.entries(readReleaseMetadata())) {
    process.stdout.write(`${key}=${value}\n`);
  }
}
