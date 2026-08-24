const TARGET_SELECTOR = [
  '.appShell[data-feature="path"][data-screen="station"] .appHeaderScreenTitle',
  '.stationWordRow .stationStaticText',
  '.adminUsersTable tbody td:not(.adminTableNumber)',
  '.adminUsersTable .adminUserLink',
  ':where([data-feature="admin"],.adminActivityModal) .adminTestStory',
].join(',');

const managed = new Set();
let frame = 0;

function durationFor(distance) {
  return `${Math.min(9.5, Math.max(4.8, distance / 42 + 3.4)).toFixed(1)}s`;
}

function ensureStationMeta(root = document) {
  root.querySelectorAll?.('.stationNode').forEach((node) => {
    if (node.querySelector(':scope > .stationMeta')) return;
    const label = node.querySelector(':scope > .stationLabel');
    const count = node.querySelector(':scope > .stationWordCount');
    if (!label && !count) return;
    const meta = document.createElement('span');
    meta.className = 'stationMeta';
    if (label) meta.append(label);
    if (count) meta.append(count);
    const milestones = node.querySelector(':scope > .stationMilestones');
    if (milestones) node.insertBefore(meta, milestones);
    else node.append(meta);
  });
}

function ensureMarquee(target) {
  if (!target || target.dataset.adaptiveMarquee === 'true') return;
  const text = String(target.textContent || '');
  if (!text) return;
  const clip = document.createElement('span');
  clip.className = 'adaptiveMarqueeClip';
  const track = document.createElement('span');
  track.className = 'adaptiveMarqueeTrack';
  track.textContent = text;
  clip.append(track);
  target.textContent = '';
  target.append(clip);
  target.dataset.adaptiveMarquee = 'true';
  target.title ||= text;
  managed.add(target);
}

function enhance(root = document) {
  ensureStationMeta(root);
  if (root.matches?.(TARGET_SELECTOR)) ensureMarquee(root);
  root.querySelectorAll?.(TARGET_SELECTOR).forEach(ensureMarquee);
}

function measure() {
  frame = 0;
  for (const target of [...managed]) {
    if (!target.isConnected) {
      managed.delete(target);
      continue;
    }
    const clip = target.querySelector(':scope > .adaptiveMarqueeClip');
    const track = clip?.querySelector(':scope > .adaptiveMarqueeTrack');
    if (!clip || !track) continue;
    const distance = Math.max(0, Math.ceil(track.scrollWidth - clip.clientWidth));
    const overflowing = distance > 2;
    track.classList.toggle('isOverflowing', overflowing);
    track.classList.toggle('isMarqueeVisible', overflowing);
    if (overflowing) {
      track.style.setProperty('--marquee-distance', `${distance}px`);
      track.style.setProperty('--marquee-duration', durationFor(distance));
    } else {
      track.style.removeProperty('--marquee-distance');
      track.style.removeProperty('--marquee-duration');
    }
  }
}

function schedule(root = document) {
  enhance(root);
  if (frame) return;
  frame = requestAnimationFrame(measure);
}

function start() {
  const root = document.documentElement;
  schedule(document);
  const observer = new MutationObserver((records) => {
    let needsDocumentPass = false;
    for (const record of records) {
      if (record.type === 'childList') {
        needsDocumentPass = true;
        record.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) enhance(node);
        });
      } else {
        needsDocumentPass = true;
      }
    }
    if (needsDocumentPass) schedule(document);
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-feature', 'data-screen', 'data-text-size'],
  });
  window.addEventListener('resize', () => schedule(document), { passive: true });
  document.fonts?.ready?.then?.(() => schedule(document)).catch?.(() => {});
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
