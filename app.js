// ============================================
// app.js — UI rendering, filters, dropdown UX
// ============================================

// Use globals exposed by api.js (loaded in index.html)
const { loadDeliveries, deriveHints } = window;

// Routing helpers (module)
import { getRouteLock, getPrefilterMilestone, getHashTask } from './routing.js';

const by = (sel, root=document) => root.querySelector(sel);
const all = (sel, root=document) => Array.from(root.querySelectorAll(sel));

// -------- Dates --------
function parseUSDateLike(val){
  if(!val) return null;
  const m = String(val).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/);
  if (!m) return null;
  const mm = m[1].padStart(2,'0');
  const dd = m[2].padStart(2,'0');
  const yyyy = m[3];
  const time = m[4] ? m[4].trim() : '00:00:00';
  const d = new Date(`${yyyy}-${mm}-${dd} ${time}`);
  return isNaN(d) ? null : d;
}
function addDays(d, n){
  const copy = new Date(d.getTime());
  copy.setDate(copy.getDate() + n);
  return copy;
}
function fmtDateTwoLine(val){
  if(!val) return '';
  let d = val instanceof Date ? val : parseUSDateLike(val);
  if (!d) return '';
  const month = d.toLocaleString('en-US',{month:'long'});
  const day = String(d.getDate()).padStart(2,'0');
  const yyyy = d.getFullYear();
  return `<div class="date"><div class="m">${month},</div><div class="dy">${day} ${yyyy}</div></div>`;
}

// Group tasks by Customer → Milestone
function groupByCustomerMilestone(rows) {
  const map = new Map();
  for (const r of rows) {
    const customer = (r.CustomerName || '').trim();
    const milestone = (r.MilestoneName || '').trim();
    if (!customer || !milestone) continue;

    if (!map.has(customer)) {
      // Prefer Ship-To for card subheader; fall back to customer address
      map.set(customer, {
        address: r.QuoteShipToAddressFullAddress || r.CustomerAddressFullAddress || '',
        milestones: new Map()
      });
    }
    const c = map.get(customer);
    if (!c.milestones.has(milestone)) c.milestones.set(milestone, []);
    c.milestones.get(milestone).push(r);
  }
  return map;
}

// Determine a single status label for a card (across tasks)
function summarizeStatus(tasks) {
  const statuses = tasks
    .map(t => String(t.Status || '').trim())
    .filter(Boolean);

  if (statuses.length === 0) return { label: '—', cls: 'badge--plain' };

  const norm = new Set(statuses.map(s => s.toLowerCase()));
  if (norm.size === 1) {
    const only = statuses[0];
    const mapped = only.toLowerCase() === 'done' ? 'Shipped' : only;
    return { label: mapped, cls: only.toLowerCase() === 'done' ? '' : 'badge--plain' };
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
    activeIndex = -1; render(); onChange();
  });
  listEl.addEventListener('click', (e) => {
    const item = e.target.closest('.combo-item'); if (!item) return;
    inputEl.value = item.getAttribute('data-val') || ''; close(); onChange();
  });
  inputEl.addEventListener('keydown', (e) => {
    if (listEl.hidden && (e.key === 'ArrowDown' || e.key === 'Enter')) { openAll(); return; }
    if (e.key === 'ArrowDown'){ e.preventDefault(); activeIndex = Math.min(activeIndex+1, filtered.length-1); render(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); activeIndex = Math.max(activeIndex-1, 0); render(); }
    else if (e.key === 'Enter'){ if (activeIndex>=0){ inputEl.value = filtered[activeIndex]; close(); onChange(); } }
    else if (e.key === 'Escape'){ close(); }
  });
  inputEl.addEventListener('blur', () => setTimeout(close, 120));
}

/* ---------- Right-side Drawer ---------- */

let drawerEls = null;
function ensureDrawer() {
  if (drawerEls) return drawerEls;
  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.hidden = true;

  const panel = document.createElement('aside');
  panel.className = 'drawer-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'drawerTitle');

  panel.innerHTML = `
    <div class="drawer-header">
      <h2 id="drawerTitle" class="drawer-title"></h2>
      <button class="drawer-close" aria-label="Close details">&times;</button>
    </div>
    <div class="drawer-meta"></div>
    <div class="drawer-body">
      <table class="drawer-table">
        <thead><tr><th>Item</th><th style="text-align:right">Quantity</th></tr></thead>
        <tbody></tbody>
      </table>
      <div class="drawer-empty" hidden>No items for this shipment.</div>
    </div>
    <div class="drawer-footer">
      <a class="drawer-track btn-link" target="_blank" rel="noopener noreferrer" hidden>Open Tracking</a>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  const close = () => closeDrawer();
  overlay.addEventListener('click', close);
  panel.querySelector('.drawer-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (!overlay.hidden && e.key === 'Escape') close();
  });

  drawerEls = { overlay, panel };
  return drawerEls;
}
function openDrawer(row) {
  const { overlay, panel } = ensureDrawer();

  const title = panel.querySelector('.drawer-title');
  const customer = row.CustomerName || '—';
  const milestone = row.MilestoneName || '—';
  const taskNumber = row.Number || '—';
  title.innerHTML = `
    <div class="drawer-customer">${customer}</div>
    <div class="drawer-sub"><span class="sub-label">Project:</span> <span class="sub-val">${milestone}</span></div>
    <div class="drawer-sub"><span class="sub-label">AWM Task Number:</span> <span class="sub-val">${taskNumber}</span></div>
  `;

  const meta = panel.querySelector('.drawer-meta');
  const location = row.QuoteShipToAddressFullAddress || row.CustomerAddressFullAddress || '';
  const statusRaw = (row.Status || '').trim();
  const status = statusRaw.toLowerCase() === 'done' ? 'Shipped' : statusRaw || '—';
  meta.innerHTML = `
    <div class="drawer-meta-grid">
      <div><strong>Status:</strong> ${status}</div>
      ${location ? `<div><strong>Location:</strong> ${location}</div>` : ''}
    </div>
  `;

  const tbody = panel.querySelector('.drawer-table tbody');
  const empty = panel.querySelector('.drawer-empty');
  tbody.innerHTML = '';
  const items = (Array.isArray(row.items) ? row.items : []).filter(
    it => (it.name || '').trim() !== '80-0009'
  );
  if (items.length) {
    empty.hidden = true;
    for (const it of items) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${it.name}</td><td style="text-align:right">${it.qty === '' ? '—' : it.qty}</td>`;
      tbody.appendChild(tr);
    }
  } else {
    empty.hidden = false;
  }

  const track = panel.querySelector('.drawer-track');
  if (row.ReleasesBOLTrackingNumber) { track.href = row.ReleasesBOLTrackingNumber; track.hidden = false; }
  else { track.hidden = true; }

  overlay.hidden = false;
  panel.classList.add('open');
}
function closeDrawer() {
  const els = ensureDrawer();
  els.overlay.hidden = true;
  els.panel.classList.remove('open');
}

/* ---------- Rendering ---------- */

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

  const table = document.createElement('table'); table.className = 'table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Shipment</th>
        <th>Tracking Link</th>
        <th>Project Name</th>
        <th><span class="th-stack"><span>Due</span><span>Date</span></span></th>
        <th><span class="th-stack"><span>Ship</span><span>Date</span></span></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  const sorted = tasks.slice().sort((a,b) => {
    const da = parseUSDateLike(a.CompletionDate);
    const db = parseUSDateLike(b.CompletionDate);
    const av = da ? da.getTime() : Number.POSITIVE_INFINITY;
    const bv = db ? db.getTime() : Number.POSITIVE_INFINITY;
    return av - bv;
  });

  for (const t of sorted) {
    const tr = document.createElement('tr');
    tr.className = 'row-click';
    tr.tabIndex = 0;
    tr.setAttribute('role', 'button');
    tr.setAttribute('aria-label', `View items for ${t.Number || t.Name || 'shipment'}`);

    const tdName = document.createElement('td'); tdName.textContent = t.Name || t.Number || ''; tr.appendChild(tdName);

    const tdTrack = document.createElement('td');
    if (t.ReleasesBOLTrackingNumber) {
      const a = document.createElement('a'); a.href = t.ReleasesBOLTrackingNumber; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Click here to track';
      tdTrack.appendChild(a);
    } else { tdTrack.textContent = '—'; }
    tr.appendChild(tdTrack);

    const tdProject = document.createElement('td'); tdProject.textContent = t.MilestoneName || ''; tr.appendChild(tdProject);

    let duePlus7 = '';
    const due = parseUSDateLike(t.DueDate);
    if (due) duePlus7 = fmtDateTwoLine(addDays(due, 7));
    const tdDue = document.createElement('td'); tdDue.innerHTML = duePlus7 || ''; tr.appendChild(tdDue);

    const tdShip = document.createElement('td'); tdShip.innerHTML = fmtDateTwoLine(t.CompletionDate) || ''; tr.appendChild(tdShip);

    tr.addEventListener('click', () => openDrawer(t));
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrawer(t); } });

    tbody.appendChild(tr);
  }

  card.appendChild(header); card.appendChild(table);
  return card;
}

/* ---------- State, Filters, Refresh & Lock ---------- */
let _GROUPED = new Map();
let _LOCK = getRouteLock();   // <-- read once from URL
let _LOCK_BADGE = null;

function applyFilters() {
  renderCards(_GROUPED, {
    // When locked, we hide the customer search and ignore its value
    customer: _LOCK.enabled ? '' : (by('#searchCustomer')?.value || ''),
    milestone: (by('#searchMilestone')?.value || '')
  });
}

function installLockBadgeIfNeeded(filteredRows){
  // Ensure a badge exists/updates when locked
  if (!_LOCK.enabled) {
    if (_LOCK_BADGE) { _LOCK_BADGE.remove(); _LOCK_BADGE = null; }
    return;
  }
  const wrap = by('.search-wrap');
  if (!wrap) return;

  const name = resolveLockedCustomerName(filteredRows) || `Customer #${_LOCK.customers.join(', ')}`;
  if (!_LOCK_BADGE) {
    _LOCK_BADGE = document.createElement('div');
    _LOCK_BADGE.className = 'pill';
    _LOCK_BADGE.style.whiteSpace = 'nowrap';
    wrap.prepend(_LOCK_BADGE);
  }
  _LOCK_BADGE.textContent = `Viewing: ${name}`;
}

function resolveLockedCustomerName(rows){
  // Try to find a friendly display name from rows
  for (const r of rows) {
    if (_LOCK.customers.includes(String(r.CustomerNumber))) {
      if (r.CustomerName) return r.CustomerName;
    }
  }
  return '';
}

function hideCustomerSearchIfLocked(){
  if (!_LOCK.enabled) return;
  const input = by('#searchCustomer');
  const list = by('#comboCustomers');
  if (input) input.style.display = 'none';
  if (list) list.style.display = 'none';
}

function wireSearchAndButtons(onRefresh, hints) {
  const cust = by('#searchCustomer');
  const mile = by('#searchMilestone');
  const clear = by('#clearFilters');
  const refresh = by('#refreshBtn');

  // Setup combos (customer combo is hidden if locked but harmless to init)
  if (cust) setupCombo(cust, by('#comboCustomers'), hints.customers, applyFilters);
  if (mile) setupCombo(mile, by('#comboMilestones'), hints.milestones, applyFilters);

  // If URL pre-filters milestone, set it
  const mPref = getPrefilterMilestone();
  if (mPref && mile) { mile.value = mPref; }

  // Clear: if locked, DO NOT clear customer; only milestone
  if (clear) {
    clear.addEventListener('click', () => {
      if (!_LOCK.enabled && cust) cust.value = '';
      if (mile) mile.value = '';
      applyFilters();
      (mile || cust)?.focus();
    });
  }

  // Refresh: re-fetch & re-apply lock + filters
  if (refresh) {
    refresh.addEventListener('click', async () => {
      refresh.disabled = true; refresh.textContent = 'Refreshing…';
      try { await onRefresh(); } finally { refresh.disabled = false; refresh.textContent = 'Refresh'; }
    });
  }

  // Hide customer search if locked
  hideCustomerSearchIfLocked();
}

async function reloadData(firstLoad=false) {
  const empty = by('#empty');
  try{
    const rows = await loadDeliveries();     // from api.js

    // Apply client-side lock filter (cosmetic; GH Pages only)
    const filtered = _LOCK.enabled
      ? rows.filter(r => _LOCK.customers.includes(String(r.CustomerNumber)))
      : rows;

    // If locked but zero rows, show empty state (do not fall back to all)
    if (_LOCK.enabled && filtered.length === 0) {
      _GROUPED = new Map(); // nothing to render
      installLockBadgeIfNeeded(filtered);
      hideCustomerSearchIfLocked();
      by('#cards').innerHTML = '';
      empty.hidden = false;
      empty.textContent = 'No results for this customer.';
      return;
    }

    _GROUPED = groupByCustomerMilestone(filtered);

    const hints = deriveHints(filtered.length ? filtered : rows); // hints prefer filtered set
    if (firstLoad) wireSearchAndButtons(() => reloadData(false), hints);
    else {
      const cust = by('#searchCustomer');
      const mile = by('#searchMilestone');
      if (cust) setupCombo(cust, by('#comboCustomers'), hints.customers, applyFilters);
      if (mile) setupCombo(mile, by('#comboMilestones'), hints.milestones, applyFilters);
      hideCustomerSearchIfLocked();
    }

    // If we prefilled milestone via URL, ensure filter applies
    applyFilters();
    installLockBadgeIfNeeded(filtered);

    // Optional deep link to a task
    const deepTask = getHashTask();
    if (deepTask) {
      // naive find: open first row with matching Number
      for (const [, obj] of _GROUPED) {
        for (const [, tasks] of obj.milestones) {
          const hit = tasks.find(t => String(t.Number) === String(deepTask));
          if (hit) { openDrawer(hit); break; }
        }
      }
    }

    empty.hidden = true;
    if (!filtered?.length) { empty.hidden = false; empty.textContent = 'No data returned.'; }
  }catch(err){
    empty.hidden = false; empty.textContent = err?.message || 'Failed to load data.';
  }
}

// Boot
(function init(){
  const yEl = by('#year'); if (yEl) yEl.textContent = new Date().getFullYear();
  reloadData(true);
})();
