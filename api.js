// ============================================
// api.js  — All API interaction & parsing here
// ============================================

// Striven Report endpoint
const API_URL = "https://api.striven.com/v2/reports/EtkAf4OkxEMXD6Txd9ruxRdnFLnxMcXKV7E0oztsAcak7TGPFhplXCnouRYX8nPBiH9tKV6WO8WNH7Vuotw";

/**
 * Low-level fetch wrapper.
 * - Throws an Error on non-2xx HTTP status codes with a friendly message.
 * - Network/CORS failures bubble as errors too.
 */
async function fetchReportRaw() {
  let res;
  try {
    res = await fetch(API_URL, { headers: { "Accept": "application/json" } });
  } catch (e) {
    // Likely network or CORS
    throw new Error("Network/CORS error contacting Striven.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Helpful messages by class
    if (res.status >= 500) throw new Error(`Striven server error (${res.status}). Try again later.`);
    if (res.status === 404) throw new Error(`Report not found (404). Check the API URL.`);
    if (res.status === 401 || res.status === 403) throw new Error(`Unauthorized/Forbidden (${res.status}).`);
    throw new Error(`Fetch failed (${res.status}). ${text?.slice(0,140)}`);
  }

  // Try JSON decode
  try {
    return await res.json();
  } catch {
    throw new Error("Invalid JSON returned by Striven.");
  }
}

/**
 * Normalizes the response shape into a clean array of rows.
 * Accepts either `{ data: [...] }` or bare arrays; otherwise returns [].
 */
function parseReport(json) {
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json)) return json;
  return [];
}

/**
 * Public: Load & normalize rows in one call for app.js
 */
async function loadDeliveries() {
  const json = await fetchReportRaw();
  return parseReport(json);
}

/**
 * Derive unique lists (used for dropdowns)
 */
function deriveHints(rows) {
  const customers = [...new Set(rows.map(r => r.CustomerName).filter(Boolean))].sort();
  const milestones = [...new Set(rows.map(r => r.MilestoneName).filter(Boolean))].sort();
  return { customers, milestones };
}
