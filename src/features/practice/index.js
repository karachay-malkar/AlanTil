import { panel } from "../../shared/ui/panel.js";

let controller = null;

export function mount(context) {
  controller = new AbortController();
  context.root.innerHTML = panel({
    title: "Практика",
    classes: "practicePanel",
    viewClasses: "practiceView",
    body: `
      <div class="practiceMenu">
        <button class="menuItem" type="button" data-practice-route="test.menu"><span class="menuIcon">◫</span><span><strong>Общий тест</strong><small>Проверьте слова из выбранных разделов</small></span></button>
        <button class="menuItem" type="button" data-practice-route="match.menu"><span class="menuIcon">⇄</span><span><strong>Сопоставление</strong><small>Соединяйте слова и переводы</small></span></button>
        <button class="menuItem" type="button" data-practice-route="songs.playlists"><span class="menuIcon">♫</span><span><strong>Песни</strong><small>Слушайте язык в живом контексте</small></span></button>
        <button class="menuItem disabled" type="button" disabled><span class="menuIcon">↻</span><span><strong>Трудные слова</strong><small>Появится в следующем обновлении</small></span></button>
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
