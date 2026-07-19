import { escapeHtml } from "./html.js?v=13.9.0";

function classNames(...values) {
  return values.flatMap((value) => String(value || "").split(/\s+/)).filter(Boolean).join(" ");
}

export function renderOverflowMarquee(value, {
  clipClass = "",
  trackClass = "",
} = {}) {
  const text = String(value ?? "");
  return `<span class="${classNames("overflowMarqueeClip", clipClass)}" data-overflow-marquee-clip title="${escapeHtml(text)}"><span class="${classNames("overflowMarqueeTrack", trackClass)}" data-overflow-marquee>${escapeHtml(text)}</span></span>`;
}

export function bindOverflowMarquees(root, {
  signal,
  scrollRoot = null,
  threshold = 0.35,
} = {}) {
  const tracks = Array.from(root?.querySelectorAll?.("[data-overflow-marquee]") || []);
  let frame = 0;
  let observer = null;
  let resizeObserver = null;
  let stopped = false;

  function measure() {
    frame = 0;
    if (stopped) return;
    tracks.forEach((track) => {
      if (!track.isConnected) return;
      const clip = track.closest("[data-overflow-marquee-clip]") || track.parentElement;
      const distance = Math.max(0, Math.ceil(track.scrollWidth - clip.clientWidth));
      const overflowing = distance > 2;
      track.classList.toggle("isOverflowing", overflowing);
      if (!overflowing) {
        track.classList.remove("isMarqueeVisible");
        track.style.removeProperty("--marquee-distance");
        track.style.removeProperty("--marquee-duration");
        return;
      }
      track.style.setProperty("--marquee-distance", `${distance}px`);
      track.style.setProperty("--marquee-duration", `${Math.min(9.5, Math.max(4.8, distance / 42 + 3.4)).toFixed(1)}s`);
      if (typeof IntersectionObserver !== "function") track.classList.add("isMarqueeVisible");
    });
  }

  function scheduleMeasure() {
    if (frame || stopped) return;
    frame = requestAnimationFrame(measure);
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    observer?.disconnect();
    resizeObserver?.disconnect();
    window.removeEventListener("resize", scheduleMeasure);
  }

  if (!tracks.length || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return stop;
  scheduleMeasure();
  window.addEventListener("resize", scheduleMeasure, { passive: true });

  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(scheduleMeasure);
    tracks.forEach((track) => resizeObserver.observe(track.parentElement));
  }

  if (typeof IntersectionObserver === "function") {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const track = entry.target.querySelector("[data-overflow-marquee]");
        track?.classList.toggle("isMarqueeVisible", entry.isIntersecting && entry.intersectionRatio > threshold);
      });
    }, { root: scrollRoot || null, threshold: [0, threshold, 0.75] });
    tracks.forEach((track) => observer.observe(track.parentElement));
  }

  signal?.addEventListener?.("abort", stop, { once: true });
  return stop;
}
