import { escapeHtml } from "./html.js";

export function renderBracketHeading(text, { tag = "h2", className = "" } = {}) {
  const safeTag = /^(h[1-6]|div|span|p)$/.test(tag) ? tag : "div";
  return `<${safeTag} class="bracketHeading ${escapeHtml(className)}"><span aria-hidden="true">[</span><span>${escapeHtml(text)}</span><span aria-hidden="true">]</span></${safeTag}>`;
}
