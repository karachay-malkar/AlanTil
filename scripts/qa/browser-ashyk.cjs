'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const depsRoot = process.env.ASHYK_BROWSER_DEPS_ROOT;
if (!depsRoot) throw new Error('ASHYK_BROWSER_DEPS_ROOT is required');
const { chromium, request: httpRequest } = require(path.join(depsRoot, 'node_modules', 'playwright'));

const baseURL = process.env.ASHYK_BROWSER_BASE_URL || 'http://127.0.0.1:4173';
const guestSettings = {
  interface_language_code: 'ru',
  translation_language_code: 'ru',
  alan_script_code: 'cyrillic',
  alan_dialect_code: 'canonical',
  text_size_code: 'medium',
  learning_setup_completed_at: '2026-10-02T00:00:00.000Z',
};
const expected = {
  small: [10, 12, 16, 48],
  medium: [10, 14, 20, 48],
  large: [12, 16, 24, 48],
  huge: [14, 18, 28, 48],
};

function trackBrowserErrors(page, bucket) {
  page.on('requestfailed', (request) => {
    // Navigation/reload cancels in-flight requests; cancellation is not a transport failure.
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') bucket.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`);
  });
  page.on('pageerror', (error) => bucket.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') bucket.push(`console.error: ${message.text()}`);
  });
}

async function waitForPath(page, pathname) {
  await page.waitForFunction((expectedPath) => window.location.pathname === expectedPath, pathname);
}

async function setTextSize(page, code) {
  const build = await page.locator('meta[name="alantil-build"]').getAttribute('content');
  await page.evaluate(async ({ code, build }) => {
    const settings = await import(`/src/shared/settings/user-settings-store.js?v=${build}`);
    settings.setUserSettings({ text_size_code: code }, { queue: false });
  }, { code, build });
}

async function roleSizes(page) {
  return page.evaluate(() => {
    const px = (selector) => Number.parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    const variablePx = (name) => {
      const probe = document.createElement('span');
      probe.style.cssText = `position:fixed;visibility:hidden;font-size:var(${name})`;
      document.body.appendChild(probe);
      const value = Number.parseFloat(getComputedStyle(probe).fontSize);
      probe.remove();
      return value;
    };
    return [
      px('.ashykDifficultyHint'),
      px('.ashykModeButton'),
      px('.ashykSetupHelpButton span'),
      variablePx('--text-result'),
    ];
  });
}

(async () => {
  const proxyUrl = process.env.ASHYK_BROWSER_PROXY;
  const parsedProxy = proxyUrl ? new URL(proxyUrl) : null;
  const proxy = parsedProxy ? {
    server: `${parsedProxy.protocol}//${parsedProxy.host}`,
    bypass: '127.0.0.1,localhost',
    ...(parsedProxy.username ? { username: decodeURIComponent(parsedProxy.username), password: decodeURIComponent(parsedProxy.password) } : {}),
  } : undefined;
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const apiTransport = proxy ? await httpRequest.newContext({ proxy, ignoreHTTPSErrors: process.env.ASHYK_BROWSER_IGNORE_HTTPS_ERRORS === 'true' }) : null;
  const connectApiTransport = async (context) => {
    if (!apiTransport) return;
    await context.route('https://*.supabase.co/**', async (route) => {
      const incoming = route.request();
      try {
      const response = await apiTransport.fetch(incoming.url(), { method: incoming.method(), headers: incoming.headers(), data: incoming.postDataBuffer() || undefined, timeout: 20000 });
      await route.fulfill({ response });
      } catch { await route.abort().catch(() => {}); }
    });
  };
  const errors = [];
  try {
    const clean = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await connectApiTransport(clean);
    const cleanPage = await clean.newPage();
    trackBrowserErrors(cleanPage, errors);
    await cleanPage.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
    await cleanPage.waitForSelector('#appShell');
    assert.equal(await cleanPage.locator('html').getAttribute('data-text-size'), 'medium', 'clean profile must default to medium');
    await clean.close();

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await connectApiTransport(context);
    await context.addInitScript((settings) => {
      if (!localStorage.getItem('alantil_scope_v1:guest:settings')) {
        localStorage.setItem('alantil_scope_v1:guest:settings', JSON.stringify(settings));
      }
      localStorage.setItem('alantil_analytics_enabled_v1', 'false');
      localStorage.setItem('alantil_scope_v1:guest:guide.state', JSON.stringify({ general_completed: true, learning_completed: true }));
    }, guestSettings);
    const page = await context.newPage();
    trackBrowserErrors(page, errors);

    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-route="practice.home"]');
    await page.waitForFunction(() => document.querySelector('[data-guide-skip]') || document.querySelector('.practiceMenu') || document.querySelector('.pathView'));
    if (await page.locator('[data-guide-skip]').isVisible()) await page.locator('[data-guide-skip]').click();
    await page.waitForSelector('.storySteleBackdrop', { state: 'visible' });
    await page.locator('.storySteleDialog').press('Escape');
    await page.waitForSelector('.storySteleBackdrop', { state: 'hidden' });
    await page.locator('[data-route="practice.home"]').click();
    await waitForPath(page, '/practice');
    await page.waitForSelector('.practiceMenu');
    assert.ok(await page.locator('[data-practice-route]').count() >= 5, 'practice menu regression');

    await page.locator('[data-practice-route="practice.ashyk"]').click();
    await waitForPath(page, '/practice/ashyk');
    await page.waitForSelector('.ashykSetup', { timeout: 20000 });
    assert.equal((await page.locator('body').innerText()).includes('Не удалось открыть раздел'), false, 'Ashyk route rendered an error state');

    await page.locator('#btnBackArrow').click();
    await waitForPath(page, '/practice');
    await page.waitForSelector('.practiceMenu');

    await page.locator('[data-practice-route="practice.ashyk"]').click();
    await waitForPath(page, '/practice/ashyk');
    await page.waitForSelector('.ashykSetup', { timeout: 20000 });

    assert.equal(await page.locator('.ashykSetup .ashykModeButtons').count(), 0);
    assert.equal(await page.locator('.ashykSetupToolbar .ashykModeButtons').count(), 1);
    const modes = page.locator('.ashykModeButton');
    assert.ok(await modes.count() >= 2, 'computer/friend mode controls are missing');
    await modes.last().click();
    await page.waitForSelector('.ashykModeAccessLock');
    await modes.first().click();
    await page.waitForSelector('.ashykModeAccessLock', { state: 'detached' });

    const difficultyLabels = page.locator('.ashykSegmented .settingsChoice');
    assert.equal(await difficultyLabels.count(), 3, 'difficulty segmented control must contain three options');
    for (let index = 0; index < 3; index += 1) {
      await difficultyLabels.nth(index).click();
      assert.equal(await difficultyLabels.nth(index).locator('input').isChecked(), true, `difficulty option ${index} did not activate`);
    }

    await page.waitForSelector('.ashykQuestionScopeRow', { timeout: 20000 });
    assert.ok(await page.locator('.ashykQuestionScopeRow').count() > 0, 'dictionary scope controls are missing');

    for (const [mode, sizes] of Object.entries(expected)) {
      await setTextSize(page, mode);
      assert.equal(await page.locator('html').getAttribute('data-text-size'), mode);
      assert.deepEqual(await roleSizes(page), sizes, `semantic typography mismatch for ${mode}`);
    }

    await setTextSize(page, 'huge');
    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-route="practice.home"]');
    await page.waitForFunction(() => document.querySelector('[data-guide-skip]') || document.querySelector('.practiceMenu') || document.querySelector('.pathView'));
    if (await page.locator('[data-guide-skip]').isVisible()) await page.locator('[data-guide-skip]').click();
    assert.equal(await page.locator('html').getAttribute('data-text-size'), 'huge', 'text size did not survive a full reload');

    await page.locator('[data-route="practice.home"]').click();
    await waitForPath(page, '/practice');
    await page.locator('[data-practice-route="practice.ashyk"]').click();
    await waitForPath(page, '/practice/ashyk');
    await page.waitForSelector('.ashykSetup', { timeout: 20000 });
    await page.waitForSelector('.ashykQuestionScopeRow', { timeout: 20000 });

    const setupGeometry = await page.evaluate(() => ({
      title: document.querySelector('#headerTitle').getBoundingClientRect().bottom,
      toolbar: document.querySelector('.ashykSetupToolbar').getBoundingClientRect().top,
      toolbarBottom: document.querySelector('.ashykSetupToolbar').getBoundingClientRect().bottom,
      difficulty: document.querySelector('.ashykSetupSection').getBoundingClientRect().top,
    }));
    assert.ok(setupGeometry.toolbar >= setupGeometry.title, 'modes must sit below the section title');
    assert.ok(setupGeometry.difficulty >= setupGeometry.toolbarBottom, `difficulty must not overlap the toolbar: ${JSON.stringify(setupGeometry)}`);
    if (process.env.ASHYK_BROWSER_SCREENSHOT) await page.screenshot({ path: process.env.ASHYK_BROWSER_SCREENSHOT + '.setup.png', fullPage: true });
    const checkedScopes = page.locator('.ashykQuestionScopeRow input:checked');
    if (await checkedScopes.count() === 0) await page.locator('.ashykQuestionScopeRow').first().click();

    const start = page.locator('.ashykSetup > button.ashykPrimary');
    await page.waitForFunction(() => {
      const button = document.querySelector('.ashykSetup > button.ashykPrimary');
      return button && !button.disabled;
    }, null, { timeout: 20000 });
    await start.click();

    await page.waitForSelector('.ashykGame .ashykScene', { timeout: 20000 });
    await page.waitForSelector('.ashykScene canvas', { timeout: 20000 });
    assert.equal(await page.locator('.ashykScore strong').first().evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)), 28, 'in-game score must use accent size');
    assert.equal(await page.locator('.ashykTurnTimer').evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)), 28, 'huge mode timer must use accent size');
    for (const [size, roles] of Object.entries(expected)) {
      await setTextSize(page, size);
      assert.equal(await page.locator('.ashykScore strong').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize)), roles[2]);
    }
    await setTextSize(page, 'huge');
    // Exercise the exact shared dialog service used by Ashyk's resignation callback.
    await page.evaluate(async () => {
      const build = document.querySelector('meta[name="alantil-build"]').content;
      const { createModalService } = await import(`/src/shared/ui/modal.js?v=${build}`);
      window.__qaModal = createModalService(document.querySelector('#modalRoot'));
      window.__qaModalResult = null;
      void window.__qaModal.confirm({message:'Сдаться и завершить текущую игру?'}).then(value => { window.__qaModalResult = value; });
    });
    await page.waitForSelector('.exitModal');
    assert.ok((await page.locator('.exitConfirm').innerText()).includes('Не болса да болсун!'));
    await page.locator('.exitStay').click();
    assert.equal(await page.evaluate(() => window.__qaModalResult), false);
    await page.evaluate(() => { void window.__qaModal.confirm({message:'Сдаться и завершить текущую игру?'}).then(value => { window.__qaModalResult = value; }); });
    await page.locator('.exitConfirm').click();
    assert.equal(await page.evaluate(() => window.__qaModalResult), true);


    await page.waitForFunction(() => Number.parseInt(document.querySelector('.ashykTurnTimer')?.textContent, 10) > 0, null, { timeout: 30000 });
    const timerStart = await page.locator('.ashykTurnTimer').innerText();
    await page.waitForFunction((previous) => { const text = document.querySelector('.ashykTurnTimer')?.textContent?.trim(); return text && text !== previous && Number.parseInt(text, 10) >= 0; }, timerStart);

    const viewport = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(viewport.scrollWidth <= viewport.clientWidth + 2, `mobile viewport overflows: ${viewport.scrollWidth} > ${viewport.clientWidth}`);

    const text = await page.locator('body').innerText();
    assert.equal(text.includes('Не удалось открыть раздел'), false);
    if (process.env.ASHYK_BROWSER_SCREENSHOT) await page.screenshot({ path: process.env.ASHYK_BROWSER_SCREENSHOT, fullPage: true });
    console.log('Functional browser checks passed: routes, modes, difficulties, dictionaries, four text sizes, reload, game, timer, accent score and mobile layout');
    assert.deepEqual(errors, [], `browser console/runtime errors:\n${errors.join('\n')}`);
    if (process.env.ASHYK_BROWSER_SCREENSHOT) await page.screenshot({ path: process.env.ASHYK_BROWSER_SCREENSHOT, fullPage: true });
    await context.close();
    console.log('Ashyk browser verification passed');
  } finally {
    await browser.close();
    await apiTransport?.dispose();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
