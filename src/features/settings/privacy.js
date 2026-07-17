import {
  getPrivacyState,
  subscribePrivacyState,
  updateAnalyticsPreference,
} from "../../shared/privacy/privacy-controller.js?v=13.8";
import { panel } from "../../shared/ui/panel.js?v=13.8";

export function renderPrivacy(context, signal, params = {}) {
  context.shell.setHeaderContent?.({ title: "Конфиденциальность" });
  const initialState = getPrivacyState();
  context.root.innerHTML = panel({
    title: "Политика конфиденциальности",
    body: `
      <article class="settingsDocument">
        <p><strong>AlanTil / «Алан тил»</strong> — приложение для изучения карачаево-балкарского языка. По вопросам конфиденциальности можно написать на <a href="mailto:alantil0709@gmail.com">alantil0709@gmail.com</a>.</p>

        <h2>Какие данные сохраняются на устройстве</h2>
        <p>Приложение может локально сохранять в браузере избранные и скрытые слова, избранные песни, прогресс сетов, настройки, незавершённые занятия, очередь синхронизации, кэш словаря и песен, служебное состояние и сессию авторизации Supabase. Эти данные нужны для работы без входа и восстановления состояния после перезагрузки.</p>
        <p>Для выбора применимого режима статистики приложение может определить код страны подключения. В приложении он сохраняется только на время текущего сеанса.</p>

        <h2>Аккаунт и авторизация</h2>
        <p>Регистрация необязательна. При входе через Google пароль вводится только на стороне Google и не передаётся AlanTil. При входе по электронной почте используется одноразовая ссылка без пароля.</p>
        <p>Supabase Auth хранит технический идентификатор аккаунта, электронную почту, способ входа, дату создания и служебные данные авторизации. Имя и фотография из Google не используются в интерфейсе и не копируются в профиль AlanTil. В таблице профиля хранится только идентификатор пользователя и выбранный уникальный никнейм. Электронная почта не дублируется в открытом профиле.</p>
        <p>Электронная почта отображается только самому владельцу на экране его аккаунта. Другие пользователи не могут получить её через интерфейс или публичные запросы приложения.</p>

        <h2>Облачный прогресс</h2>
        <p>Для авторизованного пользователя Supabase может хранить избранные слова и песни, скрытые слова, прогресс сетов, выбранные языки, общие данные завершённых и прерванных занятий, результаты слов в режимах обучения и теста, ошибки сопоставления и длительность занятий.</p>
        <p>В облачный прогресс передаются технические ID слов, словарей, разделов и сетов, но не тексты слов, переводов, песен и поисковых запросов.</p>

        <h2>Какие данные передаются в Google Analytics</h2>
        <p>При включённой статистике могут передаваться просмотры разделов, тип устройства и браузера, приблизительная страна, события использования приложения, длительность занятий, факт завершения режимов, а также технические идентификаторы словарей, разделов, сетов, песен и слов.</p>

        <h2>Какие данные не передаются в Google Analytics</h2>
        <p>Приложение не передаёт в Google Analytics никнейм, email пользователя, номер телефона, Telegram ID, Telegram username, точную геолокацию, сообщения и свободный текст поискового запроса. Текст слова и его перевод также не используются как аналитические параметры.</p>

        <h2>Зачем используется аналитика</h2>
        <p>Аналитика помогает понимать, как применяются разделы приложения, находить проблемы интерфейса, развивать словарь и улучшать режимы обучения, тестирования, сопоставления и работы с песнями.</p>

        <h2>Удаление данных</h2>
        <p>Локальные данные можно удалить через очистку данных сайта в настройках браузера. Для удаления зарегистрированного аккаунта и связанных с ним данных можно написать на адрес, указанный в начале политики. Отдельная кнопка удаления аккаунта будет добавлена позднее.</p>

        <section id="analytics-settings" class="analyticsSettingsSection" aria-labelledby="analytics-settings-title">
          <h2 id="analytics-settings-title">Статистика использования</h2>
          <p>Статистика использования помогает нам улучшать приложение. Настройка не влияет на доступность словарей, песен и режимов обучения.</p>
          <label class="analyticsPreferenceRow">
            <input id="analyticsPreferenceCheckbox" class="analyticsPreferenceCheckbox" type="checkbox" ${initialState.enabled ? "checked" : ""} />
            <span>Разрешить статистику использования</span>
          </label>
          <button id="saveAnalyticsPreference" class="btn actionPrimary analyticsPreferenceSave" type="button">Сохранить настройки</button>
          <div id="analyticsPreferenceMessage" class="analyticsPreferenceMessage hidden" role="status">Настройки статистики сохранены</div>
        </section>

        <p class="settingsDocumentDate">Редакция: июль 2026 года.</p>
      </article>`,
  });

  const checkbox = context.root.querySelector("#analyticsPreferenceCheckbox");
  const saveButton = context.root.querySelector("#saveAnalyticsPreference");
  const message = context.root.querySelector("#analyticsPreferenceMessage");
  let dirty = false;

  checkbox?.addEventListener("change", () => {
    dirty = true;
    message?.classList.add("hidden");
  }, { signal });

  saveButton?.addEventListener("click", async () => {
    saveButton.disabled = true;
    try {
      await updateAnalyticsPreference(Boolean(checkbox?.checked));
      dirty = false;
      message?.classList.remove("hidden");
    } finally {
      saveButton.disabled = false;
    }
  }, { signal });

  const unsubscribe = subscribePrivacyState((nextState) => {
    if (!dirty && checkbox) checkbox.checked = nextState.enabled;
  });
  signal.addEventListener("abort", unsubscribe, { once: true });

  if (params.focus === "analytics") {
    requestAnimationFrame(() => {
      context.root.querySelector("#analytics-settings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}
