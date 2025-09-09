// ============================================
// app.js — UI rendering, filters, dropdown UX
// ============================================

const by = (sel, root=document) => root.querySelector(sel);

// Parse Striven date strings and format to two-line display:
// First line: Full month name + comma (e.g., "September,")
// Second line: DD YYYY (e.g., "03 2025")
function fmtDateTwoLine(val){
  if(!val) return '';
  let d = new Date(val);
  if (isNaN(d)) {
    const m = String(val).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m){ d = new Date(`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}T00:00:00`); }
  }
  if (isNaN(d)) return String(val);

  const month = d.toLocaleString('en-US',{month:'long'});
  const dd = String(d.getDate()).padStart(2,'0');
  const yyyy = d.getFullYear();
  return `<div class="date"><div class="m">${month},</div><div class="dy">${dd} ${yyyy}</div></div>`;
}

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
    return { label: only, cls: only.toLowerCase() === 'done' ? '' : 'badge--plain' };
  }
  return { label: 'Mixed', cls: 'badge--mixed' };
}

/* Combobox Dropdowns w/ Keys */
function setupCombo(inputEl, listEl, values, onChange) {
  let filtered = values.slice();
  let activeIndex = -1;

  const render = () => {
    listEl.innerHTML = filtered.map((v,i) =>
      `<div class="combo-item ${i===activeIndex?'combo-item--active':''}" role="option" data-val="${v.replace(/"/g,'&quot;')}">${v}</div>`
    ).join('');
    listEl.hidden = filtered.length === 0;
  };

  const openAll = () => { filtered = values.slice(); activeIndex = -1; render(); };
  const close = () => { listEl.hidden = true; activeIndex = -1; };

  inputEl.addEventListener('focus', openAll);
  inputEl.addEventListener('input', () => {
    const q = inputEl.value.toLowerCase().trim();
    filtered = values.filter(v => v.toLowerCase().includes(q));
    activeIndex = -1; render(); onChange();   // live filter
  });
  listEl.addEventListener('click', (e) => {
    const item = e.target.closest('.combo-item'); if (!item) return;
    inputEl.value = item.getAttribute('data-val') || ''; close(); onChange();
  });
  inputEl.addEventListener('keydown', (e) => {
    if (listEl.hidden && (e.key === 'ArrowDown' || e.key === 'Enter')) { openAll(); return; }
    if (e.key === 'ArrowDown'){ e.preventDefault(); activeIndex = Math.min(activeIndex+1, filtered.length-1); render(); scrollActiveIntoView(listEl, activeIndex); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); activeIndex = Math.max(activeIndex-1, 0); render(); scrollActiveIntoView(listEl, activeIndex); }
    else if (e.key === 'Enter'){ if (activeIndex>=0){ inputEl.value = filtered[activeIndex]; close(); onChange(); } }
    else if (e.key === 'Escape'){ close(); }
  });
  inputEl.addEventListener('blur', () => setTimeout(close, 120));

  function scrollActiveIntoView(container, idx){
    const el = container.querySelectorAll('.combo-item')[idx]; if (!el) return;
    const cTop = container.scrollTop, cBot = cTop + container.clientHeight;
    const eTop = el.offsetTop, eBot = eTop + el.offsetHeight;
    if (eTop < cTop) container.scrollTop = eTop; else if (eBot > cBot) container.scrollTop = eBot - container.clientHeight;
  }
}

/* Render */
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
      host.appendChild(cardElement({ customerName, milestoneName, address: obj.address, tasks }));
    }
  }

  empty.hidden = count > 0;
  if (!count) empty.textContent = 'No results. Try adjusting your search.';
}

function cardElement({ customerName, milestoneName, address, tasks }) {
  const card = document.createElement('section'); card.className = 'card';

  const header = document.createElement('div'); header.className = 'card__header';
  const toprow = document.createElement('div'); toprow.className = 'card__toprow';

  const title = document.createElement('div'); title.className = 'card__title';
  title.innerHTML = `<span>${customerName}</span><span class="pill">${milestoneName}</span>`;

  const { label, cls } = summarizeStatus(tasks);
  const statusBadge = document.createElement('span'); statusBadge.className = 'badge ' + (cls || ''); statusBadge.textContent = label;

  toprow.appendChild(title); toprow.appendChild(statusBadge);
  const sub = document.createElement('div'); sub.className = 'card__sub'; sub.textContent = address || '';
  header.appendChild(toprow); header.appendChild(sub);

  // Table (two-line headers for dates)
  const table = document.createElement('table'); table.className = 'table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Task Name</th>
        <th>Tracking Link</th>
        <th>Project Name</th>
        <th><span class="th-stack"><span>Contract</span><span>Date</span></span></th>
        <th><span class="th-stack"><span>Completion</span><span>Date</span></span></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  for (const t of tasks) {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td'); tdName.textContent = t.Name || t.Number || ''; tr.appendChild(tdName);

    const tdTrack = document.createElement('td');
    if (t.ReleasesBOLTrackingNumber) {
      const a = document.createElement('a'); a.href = t.ReleasesBOLTrackingNumber; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Click here to track';
      tdTrack.appendChild(a);
    } else { tdTrack.textContent = '—'; }
    tr.appendChild(tdTrack);

    const tdProject = document.createElement('td'); tdProject.textContent = t.MilestoneName || ''; tr.appendChild(tdProject);

    const tdContract = document.createElement('td'); tdContract.innerHTML = fmtDateTwoLine(t.ReleasesContractDate); tr.appendChild(tdContract);

    const tdCompletion = document.createElement('td'); tdCompletion.innerHTML = fmtDateTwoLine(t.CompletionDate); tr.appendChild(tdCompletion);

    tbody.appendChild(tr);
  }

  card.appendChild(header); card.appendChild(table);
  return card;
}

/* State / Filters / Refresh */
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

  setupCombo(cust, by('#comboCustomers'), hints.customers, applyFilters);
  setupCombo(mile, by('#comboMilestones'), hints.milestones, applyFilters);

  clear.addEventListener('click', () => { cust.value = ''; mile.value = ''; applyFilters(); cust.focus(); });

  refresh.addEventListener('click', async () => {
    refresh.disabled = true; refresh.textContent = 'Refreshing…';
    try { await onRefresh(); } finally { refresh.disabled = false; refresh.textContent = 'Refresh'; }
  });
}

async function reloadData(firstLoad=false) {
  const empty = by('#empty');
  try{
    const rows = await loadDeliveries();     // from api.js
    _GROUPED = groupByCustomerMilestone(rows);

    const hints = deriveHints(rows);         // from api.js
    if (firstLoad) wireSearchAndButtons(() => reloadData(false), hints);
    else {
      setupCombo(by('#searchCustomer'), by('#comboCustomers'), hints.customers, applyFilters);
      setupCombo(by('#searchMilestone'), by('#comboMilestones'), hints.milestones, applyFilters);
    }

    renderCards(_GROUPED, { customer:'', milestone:'' });
    empty.hidden = true;
    if (!rows?.length) { empty.hidden = false; empty.textContent = 'No data returned from API.'; }
  }catch(err){
    empty.hidden = false; empty.textContent = err?.message || 'Failed to load data.';
  }
}

/* Boot */
(function init(){
  const yEl = by('#year'); if (yEl) yEl.textContent = new Date().getFullYear();
  reloadData(true);
})();
