export function panel({
  title,
  headerExtra = "",
  body = "",
  classes = "",
  viewClasses = "",
}) {
  const viewClassName = `view screen${viewClasses ? ` ${viewClasses}` : ""}`;
  const panelClassName = `panel${headerExtra ? " hasPanelToolbar" : ""}${classes ? ` ${classes}` : ""}`;
  const toolbar = headerExtra
    ? `<div class="panel-header panel-toolbar">${headerExtra}</div>`
    : "";
  return `
    <section class="${viewClassName}">
      <div class="${panelClassName}" data-unified-panel="1">
        <h1 class="panelTitle srOnly">${title}</h1>
        ${toolbar}
        <div class="panel-body">${body}</div>
      </div>
    </section>`;
}
