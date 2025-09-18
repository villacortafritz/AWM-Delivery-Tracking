// ============================================
// routing.js — parse URL and expose a lock
// ============================================

/**
 * Customer-scoped URL:
 *   /home?c=86
 * Master view:
 *   /home   (no ?c)
 *
 * Returns:
 *   { enabled: true, customers: ["86"] }
 * or
 *   { enabled: false }
 */
export function getRouteLock() {
  const params = new URLSearchParams(window.location.search);
  const c = (params.get('c') || '').trim();
  if (c) {
    // Support comma-separated list just in case (e.g., c=86,102)
    const list = c.split(',').map(s => s.trim()).filter(Boolean);
    if (list.length) return { enabled: true, customers: list };
  }
  return { enabled: false };
}

/** Optional: read a prefilter milestone param (m=) */
export function getPrefilterMilestone() {
  const params = new URLSearchParams(window.location.search);
  const m = (params.get('m') || '').trim();
  return m || null;
}

/** Optional: deep link into a task via hash: #task=17096 */
export function getHashTask() {
  const hash = (window.location.hash || '').replace(/^#/, '');
  if (!hash) return null;
  const parts = new URLSearchParams(hash);
  const task = (parts.get('task') || '').trim();
  return task || null;
}
