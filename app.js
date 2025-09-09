/* ===============================
   CONFIG
=================================*/

// Your live Striven Report endpoint:
const API_URL = "https://api.striven.com/v2/reports/EtkAf4OkxEMXD6Txd9ruxRdnFLnxMcXKV7E0oztsAcak7TGPFhplXCnouRYX8nPBiH9tKV6WO8WNH7Vuotw";

/* ===============================
   UTILITIES
=================================*/

const by = (sel, root=document) => root.querySelector(sel);

// Normalize common date inputs like "MM/DD/YYYY hh:mm" or ISO → "YYYY-MM-DD".
const fmtDate = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (!isNaN(d.valueOf())) return d.toISOString().slice(0,10);
  const m = String(val).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const [, mm, dd, yyyy] = m;
    return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
  }
  return val;
};

function groupByCustomerMilestone(rows) {
  const map = new Map();
  for (const r of rows) {
    const customer = (r.CustomerName || '').trim();
    const milestone = (r.MilestoneName || '').trim();
    if (!customer || !milestone) continue; // skip incomplete groups

    if (!map.has(customer)) {
      map.set(customer, { address: r.CustomerAddressFullAddress || '', milestones: new Map() });
    }
    const c = map.get(customer);
    if (!c.milestones.has(milestone)) c.milestones.set(milestone, []);
    c.milestones.get(milestone).push(r);
  }
  return map;
}

/* ===============================
   RENDER
=================================*/

function renderCards(grouped, filters) {
  const host = by('#cards');
  const empty = by('#empty');
  host.innerHTML = '';

  const customerFilter = (filters.customer || '').toLowerCase();
  const milestoneFilter = (filters.milestone || '').toLowerCase();

  let count = 0;

  for (const [customerName, obj] of grouped) {
    for (const [milestoneName, tasks] of obj.milestones) {
      if (customerFilter && !customerName.toLowerCase().includes(customerFilter)) continue;
      if (milestoneFilter && !milestoneName.toLowerCase().includes(milestoneFilter)) continue;
      if (!tasks?.length) continue;

      count++;
      host.appendChild(cardElement({
        customerName,
        milestoneName,
        address: obj.address,
        tasks
      }));
    }
  }

  empty.hidden = count > 0;
  if (!count) empty.textContent = 'No results. Try adjusting your search.';
}

function cardElement({ customerName, milestoneName, address, tasks }) {
  const card = document.createElement('section');
  card.className = 'card';

  // Header
  const header = document.createElement('div');
  header.className = 'card__header';

  const title = document.createElement('div');
  title.className = 'card__title';

  const titleText = document.createElement('span');
  titleText.textContent = customerName;

  const pill = document.createElement('span');
  pill.className = 'pill';
  pill.textContent = milestoneName;

  title.appendChild(titleText);
  title.appendChild(pill);

  const sub = document.createElement('div');
  sub.className = 'card__sub';
  sub.textContent = address || '';

  header.appendChild(title);
  header.appendChild(sub);

  // Table
  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width:30%">Name</th>
        <th style="width:16%">BOL / Tracking</th>
        <th style="width:12%">Status</th>
        <th style="width:14%">Milestone</th>
        <th style="width:10%">Due</th>
        <th style="width:10%">Contract</th>
        <th style="width:12%">Completion</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  for (const t of tasks) {
    const tr = document.createElement('tr');

    // Name (fallback to Number if Name missing)
    const tdName = document.createElement('td');
    tdName.textContent = t.Name || t.Number || '';
    tr.appendChild(tdName);

    // Tracking
    const tdTrack = document.createElement('td');
    if (t.ReleasesBOLTrackingNumber) {
      const a = document.createElement('a');
      a.href = t.ReleasesBOLTrackingNumber;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Track';
      tdTrack.appendChild(a);
    } else {
      tdTrack.textContent = '—';
    }
    tr.appendChild(tdTrack);

    // Status
    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    const isDone = String(t.Status || '').toLowerCase() === 'done';
    badge.className = 'badge' + (isDone ? '' : ' badge--plain');
    badge.textContent = t.Status || '';
    tdStatus.appendChild(badge);
    tr.appendChild(tdStatus);

    // Milestone (repeat per spec)
    const tdMilestone = document.createElement('td');
    tdMilestone.textContent = t.MilestoneName || '';
    tr.appendChild(tdMilestone);

    // Dates
    const tdDue = document.createElement('td');
    tdDue.textContent = fmtDate(t.DueDate);
    tr.appendChild(tdDue);

    const tdContract = document.createElement('td');
    tdContract.textContent = fmtDate(t.ReleasesContractDate);
    tr.appendChild(tdContract);

    const tdCompletion = document.createElement('td');
    tdCompletion.textContent = fmtDate(t.CompletionDate);
    tr.appendChild(tdCompletion);

    tbody.appendChild(tr);
  }

  card.appendChild(header);
  card.appendChild(table);
  return card;
}

/* ===============================
   DATA & FILTERS
=================================*/

async function fetchRows() {
  try {
    const res = await fetch(API_URL, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const json = await res.json();
    // Accept either { data: [...] } or bare array
    return Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
  } catch (e) {
    console.error('Data load error:', e);
    throw e;
  }
}

let _GROUPED = new Map();

function applyFilters() {
  const filters = {
    customer: by('#searchCustomer').value,
    milestone: by('#searchMilestone').value
  };
  renderCards(_GROUPED, filters);
}

function wireSearch() {
  const cust = by('#searchCustomer');
  const mile = by('#searchMilestone');
  const clear = by('#clearFilters');

  let t;
  const onType = () => { clearTimeout(t); t = setTimeout(applyFilters, 120); };

  cust.addEventListener('input', onType);
  mile.addEventListener('input', onType);
  clear.addEventListener('click', () => {
    cust.value = '';
    mile.value = '';
    applyFilters();
    cust.focus();
  });
}

/* ===============================
   BOOT
=================================*/

(async function init(){
  wireSearch();
  const empty = by('#empty');
  try{
    const rows = await fetchRows();
    _GROUPED = groupByCustomerMilestone(rows);
    renderCards(_GROUPED, { customer:'', milestone:'' });
    if (!rows?.length) { empty.hidden = false; empty.textContent = 'No data returned from API.'; }
  }catch(err){
    empty.hidden = false;
    empty.textContent = 'Failed to load data. (Check API access/CORS)';
  }
})();
