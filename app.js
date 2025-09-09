// ===============================
// UTILITIES
// ===============================
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

// Group tasks by Customer → Milestone
function groupByCustomerMilestone(rows) {
  const map = new Map();
  for (const r of rows) {
    const customer = (r.CustomerName || '').trim();
    const milestone = (r.MilestoneName || '').trim();
    if (!customer || !milestone) continue;

    if (!map.has(customer)) {
      map.set(customer, { address: r.CustomerAddressFullAddress || '', milestones: new Map() });
    }
    const c = map.get(customer);
    if (!c.milestones.has(milestone)) c.milestones.set(milestone, []);
    c.milestones.get(milestone).push(r);
  }
  return map;
}

// Determine a single status label for a card (across tasks)
function summarizeStatus(tasks) {
  const set = new Set(tasks.map(t => String(t.Status || '').trim().toLowerCase()).filter(Boolean));
  if (set.size === 0) return { label: '—', cls: 'badge--plain' };
  if (set.size === 1) {
    const only = tasks[0].Status || '';
    const isDone = only.toLowerCase() === 'done';
    return { label: only, cls: isDone ? '' : 'badge--plain' };
  }
  return { label: 'Mixed', cls: 'badge--mixed' };
}

// ===============================
// RENDER
// ===============================
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

  // Status (top-right)
  const statusWrap = document.createElement('div');
  statusWrap.className = 'card__status';
  const { label, cls } = summarizeStatus(tasks);
  const statusBadge = document.createElement('span');
  statusBadge.className = 'badge ' + (cls || '');
  statusBadge.textContent = label;
  statusWrap.appendChild(statusBadge);

  header.appendChild(title);
  header.appendChild(sub);

  // Table
  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width:32%">Name</th>
        <th style="width:18%">Tracking Link</th>
        <th style="width:16%">Milestone</th>
        <th style="width:12%">Due</th>
        <th style="width:12%">Completion</th>
        <th style="width:10%">Contract</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  for (const t of tasks) {
    const tr = document.createElement('tr');

    // Name (fallback to Number)
    const tdName = document.createElement('td');
    tdName.textContent = t.Name || t.Number || '';
    tr.appendChild(tdName);

    // Tracking link
    const tdTrack = document.createElement('td');
    if (t.ReleasesBOLTrackingNumber) {
      const a = document.createElement('a');
      a.href = t.ReleasesBOLTrackingNumber;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Click here to track';
      tdTrack.appendChild(a);
    } else {
      tdTrack.textContent = '—';
    }
    tr.appendChild(tdTrack);

    // Milestone (echo per spec)
    const tdMilestone = document.createElement('td');
    tdMilestone.textContent = t.MilestoneName || '';
    tr.appendChild(tdMilestone);

    // Due
    const tdDue = document.createElement('td');
    tdDue.textContent = fmtDate(t.DueDate);
    tr.appendChild(tdDue);

    // Completion (moved right after Due)
    const tdCompletion = document.createElement('td');
    tdCompletion.textContent = fmtDate(t.CompletionDate);
    tr.appendChild(tdCompletion);

    // Contract
    const tdContract = document.createElement('td');
    tdContract.textContent = fmtDate(t.ReleasesContractDate);
    tr.appendChild(tdContract);

    tbody.appendChild(tr);
  }

  card.appendChild(header);
  card.appendChild(statusWrap);
  card.appendChild(table);
  return card;
}

// ===============================
// STATE, FILTERS & REFRESH
// ===============================
let _GROUPED = new Map();

function applyFilters() {
  const filters = {
    customer: by('#searchCustomer').value,
    milestone: by('#searchMilestone').value
  };
  renderCards(_GROUPED, filters);
}

function wireSearchAndButtons(onRefresh) {
  const cust = by('#searchCustomer');
  const mile = by('#searchMilestone');
  const clear = by('#clearFilters');
  const refresh = by('#refreshBtn');

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

  refresh.addEventListener('click', async () => {
    refresh.disabled = true;
    refresh.textContent = 'Refreshing…';
    try { await onRefresh(); }
    finally {
      refresh.disabled = false;
      refresh.textContent = 'Refresh';
    }
  });
}

async function reloadData() {
  const empty = by('#empty');
  try{
    const rows = await fetchRows();          // from api.js
    _GROUPED = groupByCustomerMilestone(rows);
    renderCards(_GROUPED, { customer:'', milestone:'' });
    empty.hidden = true;
    if (!rows?.length) { empty.hidden = false; empty.textContent = 'No data returned from API.'; }
  }catch(err){
    empty.hidden = false;
    empty.textContent = 'Failed to load data. (Check API access/CORS)';
  }
}

// ===============================
// BOOT
// ===============================
(async function init(){
  wireSearchAndButtons(reloadData);
  await reloadData();
})();
