export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MONTH_LONG = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function parseMonthToken(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const s = raw.toLowerCase();

  if (/^\d{1,2}$/.test(s)) {
    const n = Number(s);
    return n >= 1 && n <= 12 ? n - 1 : null;
  }

  const iso = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?(?:[t\s].*)?$/);
  if (iso) {
    const n = Number(iso[2]);
    return n >= 1 && n <= 12 ? n - 1 : null;
  }

  if (/\bsept(?:ember)?\b/.test(s)) return 8;
  for (let i = 0; i < 12; i++) {
    const long = MONTH_LONG[i];
    const short = MONTH_SHORT[i];
    const re = new RegExp(`\\b${long}\\b|\\b${short}\\b`);
    if (re.test(s)) return i;
  }
  return null;
}

function findMonthColumn(cols) {
  const ranked = [
    /^(month|mo)$/i,
    /month/i,
    /^(date|period)$/i,
    /billing\s*(period|date|month)/i,
    /bill\s*date/i,
    /service\s*(month|period|date)/i,
  ];
  for (const re of ranked) {
    const hit = cols.find((c) => re.test(c));
    if (hit) return hit;
  }
  return null;
}

function findBillCsvColumns(fields) {
  const cols = fields || [];
  const monthCol = findMonthColumn(cols);
  const rest = cols.filter((c) => c !== monthCol);
  const usageCol = rest.find((c) => /usage|kwh/i.test(c)) || null;
  const costCol = rest.find((c) => /cost|amount|\$|bill|total|charge/i.test(c)) || null;
  return { monthCol, usageCol, costCol };
}

function cellNumber(value) {
  const n = parseFloat(String(value ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(n) ? String(n) : '';
}

function blankYear() {
  return MONTHS.map((month) => ({ month, usage: '', cost: '' }));
}

export function billsFromCsvRows(rows, fields) {
  const cols = fields || [];
  const { monthCol, usageCol, costCol } = findBillCsvColumns(cols);
  if (!usageCol || !costCol) {
    return { error: `Couldn't find usage/cost columns. Found: ${cols.join(', ')}` };
  }

  const data = (rows || []).filter((row) =>
    row && Object.values(row).some((v) => String(v ?? '').trim() !== ''),
  );

  if (!monthCol) {
    if (data.length < 12) {
      return { error: `CSV has ${data.length} rows — 12 months are required.` };
    }
    return {
      bills: blankYear().map((b, i) => ({
        ...b,
        usage: cellNumber(data[i][usageCol]),
        cost: cellNumber(data[i][costCol]),
      })),
    };
  }

  const bills = blankYear();
  const filled = new Set();
  for (const row of data) {
    const idx = parseMonthToken(row[monthCol]);
    if (idx == null) continue;
    bills[idx] = {
      month: MONTHS[idx],
      usage: cellNumber(row[usageCol]),
      cost: cellNumber(row[costCol]),
    };
    filled.add(idx);
  }

  if (filled.size < 12) {
    return { error: `CSV mapped ${filled.size} months — 12 months are required.` };
  }
  return { bills };
}
