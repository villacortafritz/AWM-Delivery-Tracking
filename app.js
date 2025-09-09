// ============================================
// app.js — UI rendering, filters, dropdown UX
// ============================================

const by = (sel, root=document) => root.querySelector(sel);

// Date → 'YYYY-MM-DD' (accepts ISO or 'MM/DD/YYYY ...')
const fmtDate = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (!isNaN(d.valueOf())) return d.toISOString().slice(0,10);
  const m = String(val).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) { const [, mm, dd, yyyy] = m; return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`; }
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

/* ---------------------------
   Simple Combobox Dropdowns
   ---------------------------
   - Populates with available values
   - Shows full list on focus
   - Filters as you type
   - Click to select
*/
function setupCombo(inputEl, listEl, values, onChange) {
  let current = values.slice();

  const render = (items) => {
    listEl.innerHTML = items.map(v => `<div class="combo-item" role="option" data-val="${v.replace(/"/g,'&quot;')}">${v}</div>`).join('');
    listEl.hidden = items.length === 0;
  };

  // Show all on focus
  inputEl.addEventListener('focus', () => { current = values.slice(); render(current); });

  // Filter as typing
  inputEl.addEventListener('input', () => {
    const q = inputEl.value.toLowerCase().trim();
    current = values.filter(v => v.toLowerCase().includes(q));
    render(current);
    onChange(); // live filter results even while typing
  });

  // Click to choose
  listEl.addEventListener('click', (e) => {
    const item = e.target.closest('.combo-item');
    if (!item) return;
    inputEl.value = item.getAttribute('data-val') || '';
    listEl.hidden = true;
    onChange();
  });

  // Hide on blur (slight delay to allow click)
  inputEl.addEventListener('blur', () => setTimeout(() => listEl.hidden = true, 120));
}

// ---------- Rendering ----------
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

  // Header (aligned status + milestone on same row)
  const header = document.createElement('div');
  header.className = 'card__header';

  const toprow = document.createElement('div');
  toprow.className = 'card__toprow';

  const title = document.createElement('div');
  title.className = 'card__title';
  title.innerHTML = `<span>${customerName}</span><span class="pill">${milestoneName}</span>`;

  const { label, cls } = summarizeStatus(tasks);
  const statusBadge = document.createElement('span');
  statusBadge.className = 'badge ' + (cls || '');
  statusBadge.textContent = label;

  toprow.appendChild(title);
  toprow.appendChild(statusBadge);

  const sub = document.createElement('div');
  sub.className = 'card__sub';
  sub.textContent = address || '';

  header.appendChild(toprow);
  header.appendChild(sub);

  // Table
  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width:34%">Task Name</th>
        <th style="width:20%">Tracking Link</th>
        <th style="width:16%">Project Name</th>
        <th style="width:10%">Due Date</th>
        <th style="width:10%">Completion Date</th>
        <th style="width:10%">Contract Date</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  for (const t of tasks) {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    tdName.textContent = t.Name || t.Number || '';
    tr.appendChild(tdName);

    const tdTrack = document.createElement('td');
    if (t.ReleasesBOLTrackingNumber) {
      const a = document.createElement('a');
      a.href = t.ReleasesBOLTrackingNumber;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Click here to track';
      tdTrack.appendChild(a);
    } else { tdTrack.textContent = '—'; }
    tr.appendChild(tdTrack);

    const tdProject = document.createElement('td');
    tdProject.textContent = t.MilestoneName || ''; // Source field is MilestoneName; shown as "Project Name"
    tr.appendChild(tdProject);

    const tdDue = document.createElement('td');
    tdDue.textContent = fmtDate(t.DueDate);
    tr.appendChild(tdDue);

    const tdCompletion = document.createElement('td');
    tdCompletion.textContent = fmtDate(t.CompletionDate);
    tr.appendChild(tdCompletion);

    const tdContract = document.createElement('td');
    tdContract.textContent = fmtDate(t.ReleasesContractDate);
    tr.appendChild(tdContract);

    tbody.appendChild(tr);
  }

  card.appendChild(header);
  card.appendChild(table);
  return card;
}

// ---------- State, Filters & Refresh ----------
let _GROUPED = new Map();

function applyFilters() {
  renderCards(_GROUPED, {
    customer: by('#searchCustomer').value,
    milestone: by('#searchMilestone').value
  });
}

function wireSearchAndButtons(onRefresh, hints) {
  const cust = by('#searchCustomer');
  const mile = by('#searchMilestone');
  const clear = by('#clearFilters');
  const refresh = by('#refreshBtn');

  // Set up custom combo dropdowns
  setupCombo(cust, by('#comboCustomers'), hints.customers, applyFilters);
  setupCombo(mile, by('#comboMilestones'), hints.milestones, applyFilters);

  // Clear
  clear.addEventListener('click', () => {
    cust.value = ''; mile.value = ''; applyFilters(); cust.focus();
  });

  // Refresh
  refresh.addEventListener('click', async () => {
    refresh.disabled = true; refresh.textContent = 'Refreshing…';
    try { await onRefresh(); }
    finally { refresh.disabled = false; refresh.textContent = 'Refresh'; }
  });
}

async function reloadData(firstLoad=false) {
  const empty = by('#empty');
  try{
    const rows = await loadDeliveries();     // from api.js
    _GROUPED = groupByCustomerMilestone(rows);

    // Build hints for combos (once on first load; refresh updates too)
    const hints = deriveHints(rows);         // from api.js
    if (firstLoad) wireSearchAndButtons(() => reloadData(false), hints);
    else {
      // Update combo lists on refresh
      setupCombo(by('#searchCustomer'), by('#comboCustomers'), hints.customers, applyFilters);
      setupCombo(by('#searchMilestone'), by('#comboMilestones'), hints.milestones, applyFilters);
    }

    renderCards(_GROUPED, { customer:'', milestone:'' });
    empty.hidden = true;
    if (!rows?.length) { empty.hidden = false; empty.textContent = 'No data returned from API.'; }
  }catch(err){
    empty.hidden = false;
    empty.textContent = err?.message || 'Failed to load data.';
  }
}

// ---------- Boot ----------
(function init(){
  // footer year
  const yEl = by('#year'); if (yEl) yEl.textContent = new Date().getFullYear();
  // initial load (true so we wire combos once with first hints)
  reloadData(true);
})();
