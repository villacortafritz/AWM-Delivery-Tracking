// ===============================
// API CONFIG & HELPERS
// ===============================

// Striven Report endpoint
const API_URL = "https://api.striven.com/v2/reports/EtkAf4OkxEMXD6Txd9ruxRdnFLnxMcXKV7E0oztsAcak7TGPFhplXCnouRYX8nPBiH9tKV6WO8WNH7Vuotw";

/**
 * Fetch rows from Striven. Accepts either { data: [...] } or bare array.
 * Throws on network / HTTP errors.
 */
async function fetchRows() {
  const res = await fetch(API_URL, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
}
