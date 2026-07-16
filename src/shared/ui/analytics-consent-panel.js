let panel = null;
let controller = null;

function removePanel() {
  controller?.abort();
  controller = null;
  panel?.remove();
  panel = null;
}

export function hideAnalyticsConsentPanel() {
  removePanel();
}

export function showAnalyticsConsentPanel({ onDecline, onAccept, onPrivacy } = {}) {
  removePanel();
  controller = new AbortController();
  panel = document.createElement("aside");
  panel.className = "analyticsConsentPanel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Настройка статистики использования");
  panel.innerHTML = `
    <div class="analyticsConsentText">
      <strong>Помогите «Алан тил» становиться лучше.</strong>
      Статистика использования помогает нам улучшать приложение.
      <a href="/settings/privacy" data-consent-privacy>Политика конфиденциальности</a>
    </div>
    <div class="analyticsConsentActions">
      <button class="btn actionText analyticsConsentButton analyticsConsentDecline" type="button" data-consent-decline>Не собирать статистику</button>
      <button class="btn actionPrimary analyticsConsentButton analyticsConsentAccept" type="button" data-consent-accept>Продолжить со статистикой</button>
    </div>`;

  panel.querySelector("[data-consent-decline]")?.addEventListener("click", () => onDecline?.(), { signal: controller.signal });
  panel.querySelector("[data-consent-accept]")?.addEventListener("click", () => onAccept?.(), { signal: controller.signal });
  panel.querySelector("[data-consent-privacy]")?.addEventListener("click", (event) => {
    event.preventDefault();
    onPrivacy?.();
  }, { signal: controller.signal });

  document.body.appendChild(panel);
  return panel;
}
