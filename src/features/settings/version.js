import { APP_VERSION, RELEASE_DATE, WEB_BUILD_VERSION, WEB_DEPLOY_BRANCH, WEB_DEPLOY_REPOSITORY } from "../../../packages/alantil-core/release.js?v=16.8.0.3";
import { msg } from "../../shared/i18n/index.js?v=16.8.0.3";
import { panel } from "../../shared/ui/panel.js?v=16.8.0.3";

function displayReleaseDate(value) {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}.${month}.${year}` : String(value || "");
}

async function hydratePagesCommit(root) {
  const target = root.querySelector("[data-pages-commit]");
  if (!target) return;
  try {
    const branch = encodeURIComponent(WEB_DEPLOY_BRANCH);
    const response = await fetch(
      `https://api.github.com/repos/${WEB_DEPLOY_REPOSITORY}/actions/runs?branch=${branch}&per_page=20`,
      { cache: "no-store", headers: { Accept: "application/vnd.github+json" } },
    );
    if (!response.ok) throw new Error(`GitHub Actions lookup failed: ${response.status}`);
    const payload = await response.json();
    const run = (payload.workflow_runs || []).find((item) =>
      item?.name === "pages build and deployment"
      && item?.head_branch === WEB_DEPLOY_BRANCH
      && item?.conclusion === "success"
    );
    target.textContent = run?.head_sha ? run.head_sha.slice(0, 7) : "—";
  } catch {
    target.textContent = "—";
  }
}

export function renderVersion(context) {
  context.shell.setHeaderContent?.({ title: msg("about.versiya_prilozheniya") });
  context.root.innerHTML = panel({
    title: msg("about.versiya_prilozheniya"),
    body: `
      <dl class="settingsFacts">
        <div><dt>${msg("about.versiya")}</dt><dd>${APP_VERSION}</dd></div>
        <div><dt>Web build</dt><dd>${WEB_BUILD_VERSION}</dd></div>
        <div><dt>Pages branch</dt><dd>${WEB_DEPLOY_BRANCH}</dd></div>
        <div><dt>Pages commit</dt><dd data-pages-commit>…</dd></div>
        <div><dt>${msg("about.poslednee_obnovlenie")}</dt><dd>${displayReleaseDate(RELEASE_DATE)}</dd></div>
      </dl>`,
  });
  void hydratePagesCommit(context.root);
}
