import { panel } from "../../shared/ui/panel.js?v=13.8";
import { uiIcon } from "../../shared/ui/icons.js?v=13.8";

let controller = null;

export function mount(context) {
  controller = new AbortController();
  context.shell.setHeaderContent?.({ title: "Alan Til!" });
  context.root.innerHTML = panel({
    title: "Практика",
    classes: "practicePanel",
    viewClasses: "practiceView",
    body: `
      <div class="practiceMenu">
        <button class="menuItem" type="button" data-practice-route="test.menu"><span class="menuIcon">${uiIcon("listChecks")}</span><span class="menuItemText"><strong>Тест</strong><small>Проверка слов из выбранных разделов</small></span></button>
        <button class="menuItem" type="button" data-practice-route="match.menu"><span class="menuIcon">${uiIcon("puzzle")}</span><span class="menuItemText"><strong>Сопоставление</strong><small>Соединение слов и переводов</small></span></button>
        <button class="menuItem" type="button" data-practice-route="songs.playlists"><span class="menuIcon">${uiIcon("music2")}</span><span class="menuItemText"><strong>Песни</strong><small>Язык в живом контексте</small></span></button>
      </div>`,
  });
  context.root.querySelectorAll("[data-practice-route]").forEach((button) => {
    button.addEventListener("click", () => context.router.navigate(button.dataset.practiceRoute), { signal: controller.signal });
  });
}

export function unmount() {
  controller?.abort();
  controller = null;
}
