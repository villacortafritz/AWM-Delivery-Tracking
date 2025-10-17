// ============================================
// routing.js — parse URL and expose a lock
// ============================================

/*
  Single-customer link:
    ?c=mastec-inc        (name-based slug)
    ?c=86                (customer number)

  Staff (all customers):
    ?admin=true

  Optional filters:
    ?m=Union Ridge
    #task=17096
*/

export function getRouteLock() {
  const params = new URLSearchParams(window.location.search);
  const c = (params.get('c') || '').trim().toLowerCase();
  const isAdmin = params.get('admin') === 'true';
  if (isAdmin || !c) return { enabled: false, customers: [], isAdmin };
  return { enabled: true, customers: [c], isAdmin: false };
}

export function getPrefilterMilestone() {
  const params = new URLSearchParams(window.location.search);
  const m = (params.get('m') || '').trim();
  return m || null;
}

export function getHashTask() {
  const hash = (window.location.hash || '').replace(/^#/, '');
  if (!hash) return null;
  const parts = new URLSearchParams(hash);
  const task = (parts.get('task') || '').trim();
  return task || null;
}

export function updateRouteParams({ c, m }) {
  const params = new URLSearchParams(window.location.search);
  if (c === null) params.delete('c'); else if (c) params.set('c', c);
  if (m === null) params.delete('m'); else if (m) params.set('m', m);
  const q = params.toString();
  history.replaceState(null, '', `${location.pathname}${q ? `?${q}` : ''}`);
}
