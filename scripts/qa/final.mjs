import path from 'node:path';
import {
  ROOT, assertCleanWorktree, changedFilesFromBase, currentRevision,
  ensureDependencies, installLocalHook, resolveBase, run,
  runNodeTests, tempDir, writeQaMarker,
} from './lib.mjs';

const TESTS = Object.freeze({
  architecture: [
    'tests/unified-core-boundary-16.test.mjs',
    'mobile/tests/architecture.test.mjs',
  ],
  core: [
    'tests/alantil-core-16.test.mjs',
    'mobile/tests/cloud-queue-race.test.mjs',
    'mobile/tests/cloud-scope-transaction.test.mjs',
  ],
  web: [
    'tests/visual-parity-16-7-0.test.mjs',
    'tests/web-style-cache-resilience-16-7-0.test.mjs',
    'tests/first-run-guide-stella-16-7-0.test.mjs',
  ],
  mobile: [
    'mobile/tests/practice-mechanics-parity-16-6-7.test.mjs',
    'mobile/tests/mobile-polish-16-6-8.test.mjs',
  ],
  auth: [
    'tests/web-auth-cache-16-7-0.test.mjs',
    'tests/auth-pkce-session.test.mjs',
  ],
  social: [
    'tests/friends-web-parity-16-7-0.test.mjs',
    'tests/visitor-analytics.test.mjs',
    'tests/admin-activity-13-15-10.test.mjs',
  ],
  ashyk: [
    'tests/social-ashyk-16-7-0.test.mjs',
    'tests/ashyk-online-authority-16-7.test.mjs',
    'tests/ashyk-shot-replication-16-7.test.mjs',
    'tests/ashyk-wood-board-16-7-0.test.mjs',
    'mobile/tests/ashyk-ui-help-16-6-12.test.mjs',
  ],
});

const ran = new Set();
function phase(title, files) {
  const selected = files.filter(file => !ran.has(file));
  console.log(`\n=== ${title} ===`);
  if (!selected.length) {
    console.log('skip');
    return;
  }
  selected.forEach(file => ran.add(file));
  runNodeTests(selected);
}

function commandPhase(title, fn, enabled = true) {
  console.log(`\n=== ${title} ===`);
  if (!enabled) {
    console.log('skip');
    return;
  }
  fn();
}

function detectScopes(files, baseFound) {
  const docsOnly = files.length > 0 && files.every(file => /^(docs\/|README(?:\.|$)|.*\.(md|txt)$)/i.test(file));
  const qaInfra = files.some(file => /^(package\.json|\.githooks\/|\.github\/workflows\/|scripts\/qa\/|scripts\/release\/)/.test(file));
  const shared = files.some(file => /^(packages\/(alantil-core|alantil-ui)\/|src\/shared\/|supabase\/)/.test(file));
  const web = files.some(file => /^(src\/|index\.html$|service-worker\.js$|assets\/)/.test(file));
  const mobile = files.some(file => /^mobile\//.test(file));
  const auth = files.some(file => /(auth|oauth|session|account|settings-claim|supabase-client)/i.test(file));
  const social = files.some(file => /(friends|social|community|admin-activity|visitor-analytics|admin\/)/i.test(file));
  const ashyk = files.some(file => /ashyk/i.test(file));
  const native = files.some(file => /^mobile\/(app\.json|package(?:-lock)?\.json|babel|metro|eas|android\/)/.test(file) || /(expo|gradle)/i.test(file));
  const generated = files.some(file => /(generate-|sync-|packages\/alantil-ui|mobile\/assets\/branding|tools\/ashyk-web|ashyk\/runtime\.js)/i.test(file));
  const dictionary = files.some(file => /(dictionary|content_structure|v_words|generate-mobile-dictionary|dictionary-snapshot)/i.test(file));
  const known = docsOnly || qaInfra || shared || web || mobile || auth || social || ashyk || native || generated || dictionary;
  const full = !baseFound || files.length === 0 || qaInfra || (!known && !docsOnly);
  return {docsOnly, shared, web, mobile, auth, social, ashyk, native, generated, dictionary, full};
}

try {
  installLocalHook();
  assertCleanWorktree();

  const base = resolveBase();
  const changed = changedFilesFromBase(base?.sha);
  const scopes = detectScopes(changed, Boolean(base));
  console.log(`Final QA base: ${base ? `${base.ref} @ ${base.sha.slice(0, 12)}` : 'unresolved; broad safety mode'}`);
  console.log(`Changed files: ${changed.length}`);
  console.log(`Scopes: ${Object.entries(scopes).filter(([, value]) => value).map(([key]) => key).join(', ') || 'baseline'}`);

  const runtime = scopes.full || scopes.shared || scopes.web || scopes.mobile || scopes.auth || scopes.social || scopes.ashyk;
  const needMobile = scopes.full || scopes.shared || scopes.mobile || scopes.native || scopes.ashyk;
  const needWeb = scopes.full || scopes.shared || scopes.web || scopes.social || scopes.auth || scopes.ashyk;
  const needAuth = scopes.full || scopes.shared || scopes.auth || scopes.web || scopes.mobile;
  const needSocial = scopes.full || scopes.shared || scopes.social || scopes.web;
  const needAshyk = scopes.full || scopes.shared || scopes.ashyk;

  phase('1. Architecture / invariant tests', [
    TESTS.architecture[0],
    ...(needMobile ? [TESTS.architecture[1]] : []),
  ]);
  phase('2. Shared Core', runtime ? TESTS.core : []);
  phase('3. Web regressions', needWeb ? TESTS.web : []);
  phase('4. Mobile regressions', needMobile ? TESTS.mobile : []);
  phase('5. Auth / session', needAuth ? TESTS.auth : []);
  phase('6. Social / community', needSocial ? TESTS.social : []);
  phase('7. Ashyk', needAshyk ? TESTS.ashyk : []);

  commandPhase('8. Generated runtime / generated assets', () => {
    run(process.execPath, ['scripts/sync-mobile-parity-16-7.mjs']);
    run(process.execPath, ['scripts/sync-visual-contract-16-7.mjs', '--check']);
    let ashykDeps = null;
    if (needAshyk) {
      ashykDeps = ensureDependencies('tools/ashyk-web');
      run(process.execPath, ['scripts/enforce-registered-ashyk-modes-16-7.mjs']);
    }
    if (needAshyk) {
      run(process.execPath, ['scripts/qa/check-generated.mjs', '--ashyk'], {
        env: {ASHYK_WEB_DEPS_ROOT: ashykDeps.dir},
      });
    }
  }, scopes.full || scopes.shared || scopes.mobile || scopes.generated || needAshyk);

  commandPhase('9. Expo Doctor', () => {
    ensureDependencies('mobile');
    run('npx', ['expo-doctor'], {cwd: path.join(ROOT, 'mobile')});
  }, needMobile);

  commandPhase('10. Android JavaScript bundle', () => {
    ensureDependencies('mobile');
    const dir = tempDir('alantil-android-export-');
    run('npx', ['expo', 'export', '--platform', 'android', '--output-dir', dir], {cwd: path.join(ROOT, 'mobile')});
  }, needMobile);

  commandPhase('11. Area-specific checks', () => {
    if (scopes.dictionary || scopes.shared) run(process.execPath, ['scripts/verify-mobile-dictionary-snapshot-parity.mjs']);
  }, scopes.dictionary || scopes.shared);

  assertCleanWorktree();
  const revision = currentRevision();
  writeQaMarker({
    ...revision,
    base: base?.sha || null,
    baseRef: base?.ref || null,
    scopes,
    checkedAt: new Date().toISOString(),
  });
  console.log(`\nFinal QA passed for ${revision.sha}. Push guard is active.`);
} catch (error) {
  console.error(`\nFinal QA failed: ${error.message}\n`);
  process.exit(1);
}
