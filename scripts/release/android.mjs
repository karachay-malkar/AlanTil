import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, ensureDependencies, run} from '../qa/lib.mjs';

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

try {
  if (!process.env.CI) run(process.execPath, ['scripts/qa/pre-push-guard.mjs']);
  ensureDependencies('mobile');

  const mobile = path.join(ROOT, 'mobile');
  run('npx', ['expo-doctor'], {cwd: mobile});
  run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], {cwd: mobile});

  const android = path.join(mobile, 'android');
  const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  run(gradle, ['assembleRelease', '--no-daemon'], {cwd: android});

  const pkg = JSON.parse(fs.readFileSync(path.join(mobile, 'package.json'), 'utf8'));
  const version = pkg.version || 'release';
  const artifacts = path.join(ROOT, 'artifacts');
  fs.mkdirSync(artifacts, {recursive: true});

  const builtApk = path.join(android, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  if (!fs.existsSync(builtApk)) throw new Error(`APK not found: ${builtApk}`);
  const apk = path.join(artifacts, `AlanTil-${version}.apk`);
  fs.copyFileSync(builtApk, apk);

  const source = path.join(artifacts, `AlanTil-${version}-source.zip`);
  run('git', ['archive', '--format=zip', '--output', source, 'HEAD']);

  const hashes = path.join(artifacts, `AlanTil-${version}.sha256`);
  fs.writeFileSync(hashes, `${sha256(apk)}  ${path.basename(apk)}\n${sha256(source)}  ${path.basename(source)}\n`, 'utf8');
  console.log(`Android release ready: ${path.relative(ROOT, apk)}`);
} catch (error) {
  console.error(`\nAndroid release failed: ${error.message}\n`);
  process.exit(1);
}
