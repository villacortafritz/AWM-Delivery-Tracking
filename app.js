/* ===============================
   CONFIG
=================================*/

// TODO: Replace this with your Striven endpoint.
// Example: const API_URL = '/api/striven/deliveries';
const API_URL = null; // set to string when ready

// For local dev, we’ll use your provided sample as mock data:
const MOCK = {
  "totalRecords": 1,
  "pageSize": 10000,
  "pageIndex": 0,
  "nextPage": null,
  "data": [
    {
      "Number": "17096",
      "Name": "MasTec Union Ridge CMS From AWD",
      "ReleasesBOLTrackingNumber": "https://parcelsapp.com/en/tracking/836689906",
      "MilestoneName": "Union Ridge",
      "ProjectName": "Releases",
      "Type": "Releases",
      "Status": "Done",
      "DueDate": "08/26/2025 11:59:59 PM",
      "CompletionDate": "08/22/2025 01:12:22 PM",
      "ReleasesContractDate": "09/04/2025",
      "CustomerName": "MasTec, Inc.",
      "CustomerNumber": "86",
      "CustomerAddressFullAddress": "P.O. Box 38, Clinton, IN 47842, USA",
      "QuoteShipToLocation": "MasTec - Union Ridge"
    }
  ]
};

/* ===============================
   UTILITIES
=================================*/

const by = (sel, root=document) => root.querySelector(sel);
const fmtDate = (val) => {
  if (!val) return '';
  // Accepts "MM/DD/YYYY ..." or ISO; return as "YYYY-MM-DD" for consistency.
  const tryNative = new Date(val);
  if (!isNaN(tryNative.valueOf())) return tryNative.toISOString().slice(0,10);

  // Fallback simple parser for "MM/DD/YYYY"
  const m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const [_, mm, dd, yyyy] = m;
    return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
  }
  return val;
};

function groupByCustomerMilestone(rows) {
  // Structure: { [CustomerName]: { address, milestones: { [MilestoneName]: Task[] } } }
  const map = new Map();
  for (const r of rows) {
    const customer = r.CustomerName?.trim() || 'Unknown Customer';
    const milestone = r.MilestoneName?.trim() || '—';

    if (!map.has(customer)) {
      map.set(customer, {
        address: r.CustomerAddressFullAddress || '',
        milestones: new Map()
      });
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
    // If customer doesn't match, skip all their milestones
    if (customerFilter && !customerName.toLowerCase().includes(customerFilter)) {
      // still check if any milestone name matches + we want to show only those; but spec says search by CustomerName OR MilestoneName
      // We'll continue but filter milestones below.
    }

    for (const [milestoneName, tasks] of obj.milestones) {
      // Apply milestone filter
      if (milestoneFilter && !milestoneName.toLowerCase().includes(milestoneFilter)) continue;

      // If customer filter set but doesn't match this customer, skip
      if (customerFilter && !customerName.toLowerCase().includes(customerFilter)) continue;

      // Only render card when there are tasks (per spec)
      if (!tasks || tasks.length === 0) continue;

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
}

function cardElement({ customerName, milestoneName, address, tasks }) {
  const card = document.createElement('section');
  card.className = 'c
