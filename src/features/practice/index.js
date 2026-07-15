import { panel } from "../../shared/ui/panel.js";
import { uiIcon } from "../../shared/ui/icons.js";

let controller = null;

export function mount(context) {
  controller = new AbortController();
  context.root.innerHTML = panel({
    title: "Практика",
    classes: "practicePanel",
    viewClasses: "practiceView",
    body: `
      <div class="practiceMenu">
        <button class="menuItem" type="button" data-practice-route="test.menu"><span class="menuIcon">${uiIcon("test")}</span><span class="menuItemText"><strong>Общий тест</strong><small>Проверьте слова из выбранных разделов</small></span><span class="menuArrow">${uiIcon("chevron")}</span></button>
        <button class="menuItem" type="button" data-practice-route="match.menu"><span class="menuIcon">${uiIcon("match")}</span><span class="menuItemText"><strong>Сопоставление</strong><small>Соединяйте слова и переводы</small></span><span class="menuArrow">${uiIcon("chevron")}</span></button>
        <button class="menuItem" type="button" data-practice-route="songs.playlists"><span class="menuIcon">${uiIcon("songs")}</span><span class="menuItemText"><strong>Песни</strong><small>Слушайте язык в живом контексте</small></span><span class="menuArrow">${uiIcon("chevron")}</span></button>
        <button class="menuItem disabled" type="button" disabled><span class="menuIcon">${uiIcon("difficult")}</span><span class="menuItemText"><strong>Трудные слова</strong><small>Откроются после накопления статистики</small></span><span class="menuArrow">${uiIcon("locked")}</span></button>
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
