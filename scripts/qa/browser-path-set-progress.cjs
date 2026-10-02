'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const depsRoot = process.env.ASHYK_BROWSER_DEPS_ROOT;
if (!depsRoot) throw new Error('ASHYK_BROWSER_DEPS_ROOT is required');
const { chromium } = require(path.join(depsRoot, 'node_modules', 'playwright'));

const baseURL = process.env.ASHYK_BROWSER_BASE_URL || 'http://127.0.0.1:4173';
const guestSettings = {
  interface_language_code: 'ru',
  translation_language_code: 'ru',
  alan_script_code: 'cyrillic',
  alan_dialect_code: 'canonical',
  text_size_code: 'medium',
  learning_setup_completed_at: '2026-10-02T00:00:00.000Z',
};

async function waitForDiorama(page, stationKey) {
  await page.waitForFunction((key) => Array.from(document.querySelectorAll('[data-station-key]')).some((node) => node.dataset.stationKey === key && node.classList.contains('beginnerDioramaNode')), stationKey, { timeout: 20000 });
}

async function writeProgress(page, ratio, stationKey) {
  return page.evaluate(async ({ targetRatio, stationKey }) => {
    const build = document.querySelector('meta[name="alantil-build"]')?.content || '16.8.0.14';
    const [{ getCompleteDictionaryWords }, { buildLearningRoute }, wordStore] = await Promise.all([
      import(`/src/shared/data/word-repository.js?v=${build}`),
      import(`/src/shared/domain/learning-route.js?v=${build}`),
      // Path's route-progress wrapper currently owns the v16.8.0.3 word-progress-store module instance.
      // Use that same instance so this QA exercises the real live refresh path instead of a second cache.
      import('/src/shared/progress/word-progress-store.js?v=16.8.0.3'),
    ]);
    const words = await getCompleteDictionaryWords();
    const route = buildLearningRoute(words);
    const station = (route.storyOrder || [])
      .flatMap((storyId) => route.stories?.[storyId]?.stations || [])
      .find((item) => String(item?.key || '') === String(stationKey || ''));
    if (!station) throw new Error(`Rendered station ${stationKey} is missing from the learning route`);
    const ids = station.words.map((word) => String(word.id));
    const mastered = Math.max(0, Math.min(ids.length, Math.round(ids.length * targetRatio)));
    const rows = {};
    const now = '2026-10-02T00:00:00.000Z';
    ids.slice(0, mastered).forEach((id) => {
      rows[id] = { word_id: id, mastery_status: 'mastered', mastery_percent: 100, mastered_at: now, last_seen_at: now };
    });
    wordStore.mergeCloudWordProgress(Object.values(rows));
    const percent = ids.length ? Math.round((mastered / ids.length) * 100) : 0;
    window.dispatchEvent(new CustomEvent('alantil:scope-ready'));
    return {
      key: String(station.key),
      total: ids.length,
      mastered,
      percent,
    };
  }, { targetRatio: ratio, stationKey });
}

async function readVisualState(page, key) {
  return page.evaluate((stationKey) => {
    const node = Array.from(document.querySelectorAll('[data-station-key]')).find((item) => item.dataset.stationKey === stationKey);
    if (!node) throw new Error(`Station ${stationKey} not rendered`);
    const label = node.querySelector('.beginnerDioramaLabel');
    const muted = node.querySelector('.beginnerDioramaImageMuted');
    const progress = node.querySelector('.beginnerDioramaImageProgress');
    const frame = node.querySelector('.beginnerDioramaFrame');
    const markNodes = Array.from(node.querySelectorAll('.stationAchievementLogo'));
    const starNodes = Array.from(node.querySelectorAll('.stationOrbitStar'));
    const progressStyle = getComputedStyle(progress);
    return {
      progressAttr: Number(node.dataset.stationProgressPercent),
      progressVariable: getComputedStyle(node).getPropertyValue('--station-progress-percent').trim(),
      markCount: markNodes.length,
      mutedFilter: getComputedStyle(muted).filter,
      clipPath: progressStyle.clipPath,
      nodeAchievementLevel: Number(node.dataset.achievementLevel || 0),
      starCount: starNodes.length,
      starSizes: starNodes.map((item) => Number.parseFloat(getComputedStyle(item).fontSize)),
      starAnimationNames: starNodes.map((item) => getComputedStyle(item).animationName),
      starColors: starNodes.map((item) => getComputedStyle(item).color),
      starRadii: starNodes.map((item) => item.style.getPropertyValue('--star-radius')),
      starAngles: starNodes.map((item) => item.style.getPropertyValue('--star-angle')),
      starDurations: starNodes.map((item) => item.style.getPropertyValue('--star-duration')),
      labelHasNextVisualMark: Boolean(label?.nextElementSibling?.classList?.contains('stationAchievementMarks')),
      frameZ: getComputedStyle(frame).zIndex,
      imageZ: getComputedStyle(progress).zIndex,
    };
  }, key);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript((settings) => {
      if (!localStorage.getItem('alantil_scope_v1:guest:settings')) {
        localStorage.setItem('alantil_scope_v1:guest:settings', JSON.stringify(settings));
      }
      localStorage.setItem('alantil_analytics_enabled_v1', 'false');
      localStorage.setItem('alantil_scope_v1:guest:guide.state', JSON.stringify({ general_completed: true, learning_completed: true }));
    }, guestSettings);
    const page = await context.newPage();

    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#appShell');
    await page.waitForSelector('.beginnerDioramaNode', { timeout: 20000 });
    assert.equal((await page.locator('body').innerText()).includes('Не удалось открыть раздел'), false);
    const renderedStationKey = await page.locator('.beginnerDioramaNode').first().getAttribute('data-station-key');
    assert.ok(renderedStationKey, 'rendered set station key is missing');

    const ratios = [0.47, 0.80, 0.90, 1];
    for (const ratio of ratios) {
      const expected = await writeProgress(page, ratio, renderedStationKey);
      await page.waitForFunction(({ key, percent }) => {
        const node = Array.from(document.querySelectorAll('[data-station-key]')).find((item) => item.dataset.stationKey === key);
        return node && Number(node.dataset.stationProgressPercent) === percent;
      }, { key: expected.key, percent: expected.percent }, { timeout: 10000 });
      const state = await readVisualState(page, expected.key);
      const level = expected.percent >= 100 ? 3 : expected.percent >= 90 ? 2 : expected.percent >= 80 ? 1 : 0;

      assert.equal(state.progressAttr, expected.percent, `wrong progress attribute at ${expected.percent}%`);
      assert.equal(state.progressVariable, `${expected.percent}%`, `wrong CSS progress value at ${expected.percent}%`);
      assert.equal(state.nodeAchievementLevel, level, `wrong node achievement level at ${expected.percent}%`);
      assert.equal(state.markCount, 0, 'mountain/application-logo progress marks must be removed');
      assert.equal(state.labelHasNextVisualMark, false, 'set name must not be followed by a mountain progress row');
      assert.ok(state.mutedFilter.includes('saturate(0.42)'), `base image is not softly muted: ${state.mutedFilter}`);
      assert.notEqual(state.clipPath, 'none', 'exact progress layer is not clipped');
      if (level === 0) {
        assert.equal(state.starCount, 0, `unpassed set must not render stars at ${expected.percent}%`);
      } else {
        assert.equal(state.starCount, 12, 'passed set must render the restrained 12-star field');
        assert.ok(Math.min(...state.starSizes) >= 5, `stars are smaller than 5px: ${state.starSizes.join(',')}`);
        assert.ok(Math.max(...state.starSizes) <= 10, `stars are larger than 10px: ${state.starSizes.join(',')}`);
        assert.ok(new Set(state.starSizes).size >= 3, `star sizes are not varied enough: ${state.starSizes.join(',')}`);
        assert.ok(new Set(state.starRadii).size >= 4, `not enough distinct orbit radii: ${state.starRadii.join(',')}`);
        assert.ok(new Set(state.starAngles).size >= 8, `star phases are too regular: ${state.starAngles.join(',')}`);
        assert.ok(new Set(state.starDurations).size >= 4, `orbit speeds are not varied enough: ${state.starDurations.join(',')}`);
        assert.ok(state.starColors.every((color) => color.includes('208') && color.includes('154') && color.includes('67')), 'stars are not stele-gold');
        assert.ok(state.starAnimationNames.every((name) => name.includes('stationDioramaOrbit')), `passed set stars are not orbiting: ${state.starAnimationNames.join(' | ')}`);
        assert.ok(state.starAnimationNames.some((name) => name.includes('stationDioramaOrbitReverse')), 'passed set needs counter-rotating stars');
      }
      assert.equal(state.imageZ, '1', 'diorama must stay above background stars');
    }

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await readVisualState(page, renderedStationKey);
    assert.ok(reduced.starAnimationNames.every((name) => name === 'none'), 'reduced-motion must disable all star animation');

    await context.close();
    console.log('Path set progress verification passed: exact fill, no mountain marks, no stars before 80%, restrained varied passed-set orbits, reduced motion');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
