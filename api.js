// ============================================
// api.js  — All API interaction & parsing here
// ============================================

const API_URL = "https://api.striven.com/v2/reports/EtkAf4OkxEMXD6Txd9ruxRdnFLnxMcXKV7E0oztsAcak7TGPFhplXCnouRYX8nPBiH9tKV6WO8WNH7Vuotw";

/** Fetch wrapper with readable errors (handles CORS/network + HTTP codes). */
async function fetchReportRaw() {
  let res;
  try {
    res = await fetch(API_URL, { headers: { "Accept": "application/json" } });
  } catch {
    throw new Error("Network/CORS error contacting Striven.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status >= 500) throw new Error(`Striven server error (${res.status}). Try again later.`);
    if (res.status === 404) throw new Error(`Report not found (404). Check the API URL.`);
    if (res.status === 401 || res.status === 403) throw new Error(`Unauthorized/Forbidden (${res.status}).`);
    throw new Error(`Fetch failed (${res.status}). ${text?.slice(0,140)}`);
  }

  try { return await res.json(); }
  catch { throw new Error("Invalid JSON returned by Striven."); }
}

/** Normalize to an array of rows whether API returns { data:[...] } or bare array. */
function parseReport(json) {
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json)) return json;
  return [];
}

/** Public: load & normalize rows for the app. */
async function loadDeliveries() {
  const json = await fetchReportRaw();
  return parseReport(json);
}

/** Derive unique lists used in dropdowns. */
function deriveHints(rows) {
  const customers = [...new Set(rows.map(r => r.CustomerName).filter(Boolean))].sort();
  const milestones = [...new Set(rows.map(r => r.MilestoneName).filter(Boolean))].sort();
  return { customers, milestones };
}
