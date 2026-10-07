import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("part 6 extended statistics keeps shared chrome and owns only the inner scroll surface", () => {
  const admin = read("src/features/admin/index.js");
  const css = read("src/features/admin/admin.css");
  const shell = read("src/shared/styles/shell.css");

  const embedded = admin.match(/export async function renderAdminUsersEmbedded[\s\S]*?\n}\n\nfunction storyProgressSection/)?.[0] || "";
  assert.match(embedded, /isAnalyticsOnly/);
  assert.match(embedded, /adminStatsPane/);
  assert.match(embedded, /renderGuestAnalytics/);
  assert.doesNotMatch(embedded, /appHeader|bottomNav|backdrop-filter/);

  assert.match(css, /\.adminUsersEmbedded\{[^}]*overflow:hidden[^}]*background:transparent/);
  assert.match(css, /\.adminUsersEmbedded\.isAnalyticsOnly\{grid-template-rows:minmax\(0,1fr\)\}/);
  assert.match(css, /\.adminStatsPane\.isGuest\{[^}]*height:100%[^}]*min-height:0[^}]*display:block[^}]*overflow:hidden/);

  const scroll = css.match(/\.adminGuestScroll\{[\s\S]*?\n}/)?.[0] || "";
  assert.match(scroll, /height:100%/);
  assert.match(scroll, /min-height:0/);
  assert.match(scroll, /overflow:auto/);
  assert.match(scroll, /overscroll-behavior:contain/);
  assert.match(scroll, /padding:0 var\(--ui-list-horizontal\) calc\(var\(--safe-bottom\) \+ 24px\)/);
  assert.doesNotMatch(scroll, /background:/);
  assert.doesNotMatch(scroll, /backdrop-filter/);
  assert.doesNotMatch(scroll, /border:/);

  assert.match(css, /\.adminAnalyticsSection\{[^}]*border-bottom:1px solid var\(--line-soft\)/);
  assert.match(css, /\.adminAnalyticsSection:last-child\{border-bottom:0\}/);
  assert.match(css, /@media\(max-width:560px\)\{[\s\S]*?\.adminAnalyticsSectionHead\{display:grid;align-items:start\}[\s\S]*?\.adminGuestPeriodTabs\{width:100%;min-width:0\}[\s\S]*?\.adminUsageMetric\{grid-template-columns:1fr;gap:4px\}/);

  assert.match(shell, /\.appViewport::before,\.appViewport::after[\s\S]*?backdrop-filter:blur\(var\(--system-mask-blur\)\)/);
  assert.match(shell, /\.appHeader\{[\s\S]*?background:transparent/);
  assert.match(shell, /\.bottomNav\{[\s\S]*?background:transparent/);
});
