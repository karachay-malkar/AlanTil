import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const win = process.platform === 'win32';
const executable = command => win && command === 'npm' ? 'npm.cmd' : win && command === 'npx' ? 'npx.cmd' : command;

export function run(command, args = [], options = {}) {
  const result = spawnSync(executable(command), args, {
    cwd: options.cwd || ROOT,
    env: {...process.env, ...(options.env || {})},
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stdout || ''}${result.stderr || ''}` : '';
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}${detail}`);
  }
  return options.capture ? (result.stdout || '').trim() : '';
}

export const git = (...args) => run('git', args, {capture: true});

export function gitPath(name) {
  return path.resolve(ROOT, git('rev-parse', '--git-path', name));
}

export function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function sha256Text(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function assertCleanWorktree() {
  const status = git('status', '--porcelain', '--untracked-files=all');
  if (status) throw new Error(`Final QA requires a clean committed worktree. Commit or revert these changes first:\n${status}`);
}

export function currentRevision() {
  return {
    sha: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}'),
  };
}

export function markerPath() {
  return gitPath('alantil-final-qa.json');
}

export function writeQaMarker(payload) {
  const target = markerPath();
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export function readQaMarker() {
  const target = markerPath();
  if (!fs.existsSync(target)) return null;
  try { return JSON.parse(fs.readFileSync(target, 'utf8')); }
  catch { return null; }
}

export function installLocalHook() {
  run('git', ['config', 'core.hooksPath', '.githooks']);
}

export function resolveBase() {
  const requested = process.env.QA_BASE?.trim();
  const candidates = requested ? [requested] : ['origin/main', 'main'];
  for (const ref of candidates) {
    try {
      git('rev-parse', '--verify', ref);
      return {ref, sha: git('merge-base', 'HEAD', ref)};
    } catch {}
  }
  return null;
}

export function changedFilesFromBase(baseSha) {
  if (!baseSha) return [];
  const out = git('diff', '--name-only', `${baseSha}...HEAD`);
  return out ? out.split(/\r?\n/).filter(Boolean) : [];
}

function dependencyFingerprint(dir) {
  const parts = [];
  for (const name of ['package.json', 'package-lock.json', 'npm-shrinkwrap.json']) {
    const file = path.join(dir, name);
    if (fs.existsSync(file)) parts.push(`${name}\n${fs.readFileSync(file, 'utf8')}`);
  }
  return sha256Text(parts.join('\n---\n'));
}

export function ensureDependencies(relativeDir) {
  const sourceDir = path.join(ROOT, relativeDir);
  const pkg = path.join(sourceDir, 'package.json');
  if (!fs.existsSync(pkg)) throw new Error(`Missing ${relativeDir}/package.json`);

  const fingerprint = dependencyFingerprint(sourceDir);
  const trackedNodeModules = Boolean(git('ls-files', '--', `${relativeDir.replace(/\\/g, '/')}/node_modules`).trim());
  const isolatedDir = path.join(gitPath('alantil-deps-cache'), relativeDir.replace(/[\\/]+/g, '-'));
  const dir = trackedNodeModules ? isolatedDir : sourceDir;
  const markerDir = gitPath('alantil-deps');
  const marker = path.join(markerDir, `${relativeDir.replace(/[\\/]+/g, '-')}.json`);
  const nodeModules = path.join(dir, 'node_modules');

  if (trackedNodeModules) {
    fs.mkdirSync(dir, {recursive: true});
    fs.copyFileSync(pkg, path.join(dir, 'package.json'));
    for (const name of ['package-lock.json', 'npm-shrinkwrap.json']) {
      const source = path.join(sourceDir, name);
      const target = path.join(dir, name);
      if (fs.existsSync(source)) fs.copyFileSync(source, target);
      else if (fs.existsSync(target)) fs.rmSync(target);
    }
  }

  if (fs.existsSync(marker) && fs.existsSync(nodeModules)) {
    try {
      const saved = JSON.parse(fs.readFileSync(marker, 'utf8'));
      if (saved.fingerprint === fingerprint && saved.dir === dir) return {dir, nodeModules, isolated: trackedNodeModules};
    } catch {}
  }

  if (fs.existsSync(nodeModules)) {
    const check = spawnSync(executable('npm'), ['ls', '--depth=0', '--silent'], {
      cwd: dir, stdio: 'ignore', shell: false,
    });
    if (!check.error && check.status === 0) {
      fs.mkdirSync(markerDir, {recursive: true});
      fs.writeFileSync(marker, `${JSON.stringify({fingerprint, dir, verifiedAt: new Date().toISOString()})}\n`);
      return {dir, nodeModules, isolated: trackedNodeModules};
    }
  }

  if (trackedNodeModules && fs.existsSync(nodeModules)) fs.rmSync(nodeModules, {recursive: true, force: true});
  const hasLock = fs.existsSync(path.join(dir, 'package-lock.json')) || fs.existsSync(path.join(dir, 'npm-shrinkwrap.json'));
  run('npm', hasLock ? ['ci', '--no-audit', '--no-fund'] : ['install', '--no-package-lock', '--no-audit', '--no-fund'], {cwd: dir});
  fs.mkdirSync(markerDir, {recursive: true});
  fs.writeFileSync(marker, `${JSON.stringify({fingerprint, dir, verifiedAt: new Date().toISOString()})}\n`);
  return {dir, nodeModules, isolated: trackedNodeModules};
}

export function listTests(relativeDir) {
  const dir = path.join(ROOT, relativeDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => name.endsWith('.test.mjs'))
    .sort()
    .map(name => path.posix.join(relativeDir.replace(/\\/g, '/'), name));
}

export function runNodeTests(files) {
  if (!files.length) return;
  run(process.execPath, ['--test', ...files]);
}

export function tempDir(prefix = 'alantil-qa-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
