// ================================
// api.js — data fetching & parsing
// ================================

const STRIVEN_URL =
  'https://api.striven.com/v2/reports/EtkAf4OkxEMXD6Txd9ruxRdnFLnxMcXKV7E0oztsAcak7TGPFhplXCnouRYX8nPBiH9tKV6WO8WNH7Vuotw';

// --- Helpers ---------------------------------------------------------------

function safeTrim(v) {
  return (v ?? '').toString().trim();
}

function coerceQty(v) {
  if (v == null || v === '') return '';
  // keep original if not a clean number — UI will render as-is
  const n = Number(v);
  return Number.isFinite(n) ? n : safeTrim(v);
}

/**
 * Normalize "ReleasesItemNo{i}" + weird qty keys into an items[] array:
 *   [{ name, qty }, ...]
 */
function extractItems(row) {
  const items = [];
  for (let i = 1; i <= 5; i++) {
    // Name field in your sample: ReleasesItemNo1, ReleasesItemNo2, ...
    const name =
      row[`ReleasesItemNo${i}`] ??
      row[`ReleasesItem${i}Name`] ?? // tolerate alternative naming
      null;

    // Qty normally ReleasesItem{i}Qty, but sample had ReleasesItemNo4Qty once
    const qtyRaw =
      row[`ReleasesItem${i}Qty`] ??
      row[`ReleasesItemNo${i}Qty`] ??
      null;

    const n = safeTrim(name);
    if (!n) continue;

    items.push({
      name: n,
      qty: coerceQty(qtyRaw),
    });
  }
  return items;
}

/**
 * Convert API rows into UI rows. Keep existing fields; add .items
 * and pre-format a few that the UI expects to exist.
 */
function toUIRow(row) {
  return {
    ...row,
    items: extractItems(row),
  };
}

// --- Public API ------------------------------------------------------------

/**
 * Load deliveries (single API) and return parsed rows
 */
async function loadDeliveries() {
  const res = await fetch(STRIVEN_URL, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Striven error ${res.status}: ${text || res.statusText}`);
  }
  const json = await res.json();

  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map(toUIRow);
}

/**
 * Build typeahead hints for search boxes
 */
function deriveHints(rows) {
  const customers = new Set();
  const milestones = new Set();
  for (const r of rows) {
    if (r.CustomerName) customers.add(r.CustomerName);
    if (r.MilestoneName) milestones.add(r.MilestoneName);
  }
  return {
    customers: Array.from(customers).sort((a, b) => a.localeCompare(b)),
    milestones: Array.from(milestones).sort((a, b) => a.localeCompare(b)),
  };
}

// expose to app.js
window.loadDeliveries = loadDeliveries;
window.deriveHints = deriveHints;
