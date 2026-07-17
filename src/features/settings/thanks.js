import { panel } from "../../shared/ui/panel.js?v=13.8";

export function renderThanks(context) {
  context.shell.setHeaderContent?.({ title: "Благодарности" });
  context.root.innerHTML = panel({
    title: "Благодарности",
    body: `<article class="settingsDocument">
      <h1>Благодарственное слово</h1>
      <p>Здесь будет размещена благодарность людям, которые помогали создавать и развивать «Алан тил».</p>
    </article>`,
  });
}
