export function panel({ title, headerExtra = "", body = "", classes = "" }) {
  return `
    <section class="view screen">
      <div class="panel ${classes}" data-unified-panel="1">
        <div class="panel-header">
          <div class="panelTitle">${title}</div>
          ${headerExtra}
        </div>
        <div class="panel-body">${body}</div>
      </div>
    </section>`;
}
