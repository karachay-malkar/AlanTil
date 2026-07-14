export function panel({
  title,
  headerExtra = "",
  body = "",
  classes = "",
  viewClasses = "",
}) {
  const viewClassName = `view screen${viewClasses ? ` ${viewClasses}` : ""}`;
  const panelClassName = `panel${classes ? ` ${classes}` : ""}`;
  return `
    <section class="${viewClassName}">
      <div class="${panelClassName}" data-unified-panel="1">
        <div class="panel-header">
          <div class="panelTitle">${title}</div>
          ${headerExtra}
        </div>
        <div class="panel-body">${body}</div>
      </div>
    </section>`;
}
