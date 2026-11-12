/* ============================================================
   FINANCE ENGINE — dataset-agnostic analytics core
   Pure logic (no DOM). Works in the browser (window.FSE) and Node.
   - auto column mapping for ANY tabular dataset (+ manual override)
   - normalisation to a canonical record model
   - filters: date range · financial year · quarter · region ·
     department · category · product
   - forecasting (damped-trend Holt + seasonality + backtest)
   - market attractiveness scoring + recommendations
   - break-even / cost-structure analysis, stability score
   - budget tracking, alerts, payroll
   ============================================================ */
(function (root) {
  "use strict";

  /* ---------------- small utils ---------------- */
  const sum = (a, f) => { let s = 0; for (let i = 0; i < a.length; i++) { const v = f ? f(a[i]) : a[i]; if (Number.isFinite(v)) s += v; } return s; };
  const mean = a => a.length ? sum(a) / a.length : 0;
  const std = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(sum(a, v => (v - m) ** 2) / (a.length - 1)); };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp01 = (v, lo, hi) => clamp((v - lo) / (hi - lo), 0, 1);
  const norm = s => String(s == null ? "" : s).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_\-./]+/g, " ").replace(/[^\w\s%]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

  function num(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
    if (v == null) return NaN;
    let s = String(v).trim();
    if (!s || /^(n\/?a|null|none|-|--|nan)$/i.test(s)) return NaN;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[₹$€£¥\s]/g, "").replace(/,/g, "").replace(/%$/, "");
    if (/^-?\d+(\.\d+)?e[+-]?\d+$/i.test(s)) { const x = Number(s); return Number.isFinite(x) ? (neg ? -x : x) : NaN; }
    if (!/^-?\d*\.?\d+$/.test(s)) return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? (neg ? -n : n) : NaN;
  }

  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  function parseDate(v, dmy) {
    if (v == null || v === "") return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
    if (typeof v === "number") {
      if (v >= 20000 && v <= 90000) return new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000 + 43200000);
      if (v >= 1900 && v <= 2100) return new Date(v, 0, 1);
      return null;
    }
    const s = String(v).trim();
    if (!s) return null;
    let m;
    if ((m = s.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?(?:[T\s].*)?$/))) return new Date(+m[1], +m[2] - 1, m[3] ? +m[3] : 1);
    if ((m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/))) {
      let a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += y < 50 ? 2000 : 1900;
      let d, mo;
      if (a > 12) { d = a; mo = b; } else if (b > 12) { d = b; mo = a; } else if (dmy === false) { d = b; mo = a; } else { d = a; mo = b; }
      return new Date(y, mo - 1, d);
    }
    if ((m = s.match(/^([A-Za-z]{3,9})[\s\-,']*(\d{2,4})$/))) {
      const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
      if (mi >= 0) { let y = +m[2]; if (y < 100) y += 2000; return new Date(y, mi, 1); }
    }
    if ((m = s.match(/^(\d{1,2})[\s\-]([A-Za-z]{3,9})[\s\-,']*(\d{2,4})$/))) {
      const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
      if (mi >= 0) { let y = +m[3]; if (y < 100) y += 2000; return new Date(y, mi, +m[1]); }
    }
    if ((m = s.match(/^(\d{4})\s*-?\s*Q([1-4])$/i))) return new Date(+m[1], (+m[2] - 1) * 3, 1);
    if (/^\d{4}$/.test(s)) return new Date(+s, 0, 1);
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /* ---------------- fiscal calendar ---------------- */
  const ymOf = d => d.getFullYear() * 12 + d.getMonth();
  const ymStart = ym => new Date(Math.floor(ym / 12), ym % 12, 1).getTime();
  const ymEnd = ym => new Date(Math.floor(ym / 12), (ym % 12) + 1, 1).getTime() - 1;
  function fyOf(ym, fyStart) { const y = Math.floor(ym / 12), m = ym % 12; return fyStart === 0 ? y : (m >= fyStart ? y : y - 1); }
  function qOf(ym, fyStart) { return Math.floor((((ym % 12) - fyStart + 12) % 12) / 3) + 1; }
  function fyLabel(fy, fyStart) { return fyStart === 0 ? "FY " + fy : "FY " + fy + "-" + String((fy + 1) % 100).padStart(2, "0"); }
  function fyStartYM(fy, fyStart) { return fy * 12 + fyStart; }
  const monthLabel = ym => MONTHS[ym % 12][0].toUpperCase() + MONTHS[ym % 12].slice(1) + " " + String(Math.floor(ym / 12)).slice(2);
  function qMonths(q, fyStart) {
    const a = (fyStart + (q - 1) * 3) % 12; const f = i => MONTHS[(a + i) % 12][0].toUpperCase() + MONTHS[(a + i) % 12].slice(1);
    return f(0) + "–" + f(2);
  }

  /* ---------------- currency formatting ---------------- */
  const CURRENCIES = {
    INR: { sym: "₹", name: "Indian Rupee (₹ Cr / L)", style: "indian" },
    USD: { sym: "$", name: "US Dollar ($ B / M)", style: "western" },
    EUR: { sym: "€", name: "Euro (€ B / M)", style: "western" },
    GBP: { sym: "£", name: "Pound (£ B / M)", style: "western" },
  };
  function money(v, cur, scale, dp) {
    if (!Number.isFinite(v)) return "—";
    const c = CURRENCIES[cur] || CURRENCIES.INR; const x = v * (scale || 1); const a = Math.abs(x), sg = x < 0 ? "−" : "";
    const d = dp == null ? 2 : dp;
    const f = (n, dd) => n.toLocaleString("en-IN", { minimumFractionDigits: dd, maximumFractionDigits: dd });
    if (c.style === "indian") {
      if (a >= 1e7) return sg + c.sym + f(a / 1e7, d) + " Cr";
      if (a >= 1e5) return sg + c.sym + f(a / 1e5, d) + " L";
      if (a >= 1e3) return sg + c.sym + f(a / 1e3, 1) + " K";
      return sg + c.sym + f(a, a < 10 && a % 1 ? 2 : 0);
    }
    if (a >= 1e12) return sg + c.sym + f(a / 1e12, d) + " T";
    if (a >= 1e9) return sg + c.sym + f(a / 1e9, d) + " B";
    if (a >= 1e6) return sg + c.sym + f(a / 1e6, d) + " M";
    if (a >= 1e3) return sg + c.sym + f(a / 1e3, 1) + " K";
    return sg + c.sym + f(a, a < 10 && a % 1 ? 2 : 0);
  }
  const pct = (v, d) => Number.isFinite(v) ? (v * 100).toFixed(d == null ? 1 : d) + "%" : "—";
  const pctSign = (v, d) => Number.isFinite(v) ? (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(d == null ? 1 : d) + "%" : "—";
  const compact = v => !Number.isFinite(v) ? "—" : Math.abs(v) >= 1e7 ? (v / 1e7).toFixed(2) + " Cr" : Math.abs(v) >= 1e5 ? (v / 1e5).toFixed(2) + " L" : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1) + " K" : String(Math.round(v * 100) / 100);

  /* ============================================================
     DEMO DATASET — synthetic multinational (deterministic)
     ============================================================ */
  function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function demoData() {
    const R = rng(20260401);
    const regions = [
      { n: "North America", w: 1.00, g: 0.055, cm: 1.00, fix: 1.0 },
      { n: "Europe", w: 0.78, g: 0.035, cm: 1.04, fix: 1.0 },
      { n: "India", w: 0.46, g: 0.215, cm: 0.90, fix: 0.80 },
      { n: "Asia Pacific", w: 0.58, g: 0.145, cm: 0.97, fix: 0.90 },
      { n: "Middle East", w: 0.24, g: 0.185, cm: 0.86, fix: 0.80 },
      { n: "Latin America", w: 0.30, g: 0.020, cm: 1.20, fix: 1.15 },
      { n: "Africa", w: 0.14, g: 0.085, cm: 1.12, fix: 1.05 },
    ];
    const products = [
      { n: "Cloud Platform", c: "Cloud Services", d: "Engineering", w: 1.35, g: 0.10, price: 18000, v: 0.50 },
      { n: "Data & AI Suite", c: "Cloud Services", d: "R&D", w: 0.85, g: 0.20, price: 26000, v: 0.46 },
      { n: "Enterprise Suite", c: "Software", d: "Sales & Marketing", w: 1.10, g: 0.04, price: 9500, v: 0.56 },
      { n: "Developer Tools", c: "Software", d: "Engineering", w: 0.55, g: 0.09, price: 2400, v: 0.44 },
      { n: "Digital Transformation", c: "Consulting", d: "Customer Success", w: 1.00, g: 0.07, price: 60000, v: 0.66 },
      { n: "Cybersecurity Advisory", c: "Consulting", d: "Operations", w: 0.50, g: 0.17, price: 42000, v: 0.60 },
      { n: "Devices", c: "Hardware", d: "Operations", w: 0.90, g: -0.01, price: 1400, v: 0.78 },
      { n: "Edge Infrastructure", c: "Hardware", d: "R&D", w: 0.45, g: 0.08, price: 8800, v: 0.70 },
    ];
    const roles = {
      "Engineering": [["Software Engineer", 160000], ["Senior Engineer", 260000], ["Engineering Manager", 380000]],
      "R&D": [["Research Scientist", 300000], ["ML Engineer", 280000], ["Principal Researcher", 450000]],
      "Sales & Marketing": [["Sales Executive", 120000], ["Account Manager", 210000], ["Marketing Lead", 240000]],
      "Operations": [["Operations Analyst", 110000], ["Support Engineer", 135000], ["Operations Manager", 260000]],
      "Customer Success": [["Customer Success Manager", 190000], ["Solutions Consultant", 230000], ["Delivery Lead", 320000]],
    };
    const deptBias = { "Engineering": 0.03, "R&D": 0.05, "Sales & Marketing": -0.125, "Operations": 0.02, "Customer Success": 0.0 };
    const seas = [0.96, 0.97, 1.08, 0.98, 0.99, 1.04, 0.97, 0.98, 1.05, 1.00, 1.03, 1.10]; // by calendar month idx (Jan..Dec)
    const rows = [];
    const start = new Date(2023, 3, 1);
    const months = 42;
    let shock = 1;
    for (let t = 0; t < months; t++) {
      shock = clamp(0.55 * shock + 0.45 * (0.93 + R() * 0.14), 0.92, 1.08); // company-wide demand shock (autocorrelated)
      const dt = new Date(start.getFullYear(), start.getMonth() + t, 1);
      const cal = dt.getMonth(), yrs = t / 12;
      const iso = dt.getFullYear() + "-" + String(cal + 1).padStart(2, "0") + "-01";
      for (const rg of regions) for (const p of products) {
        const base = 5.2e7 * rg.w * p.w;
        let rev = base * Math.pow(1 + rg.g + p.g * 0.5, yrs) * seas[cal] * shock * (0.88 + R() * 0.24);
        if (rg.n === "Europe" && p.n === "Devices" && t >= 25 && t <= 28) rev *= 0.72; // one-off hardware dip
        if (rg.n === "Latin America" && t > 30) rev *= 0.97;
        const fixedRow = base * 0.25 * rg.fix * (1 + 0.012 * t / 12); // fixed monthly cost, barely grows
        const creep = (p.d === "Operations" && t >= 30 ? 1.09 : 1) * (rg.n === "Latin America" && t >= 24 ? 1.05 : 1);
        const varCost = rev * p.v * 1.12 * rg.cm * creep * (0.94 + R() * 0.12);
        const cost = fixedRow + varCost;
        const budget = (fixedRow + rev * p.v * 1.12 * rg.cm * 0.99) * (1 + deptBias[p.d]) * (0.97 + R() * 0.06);
        const units = Math.max(1, Math.round(rev / (p.price * (0.95 + R() * 0.1))));
        const rl = roles[p.d]; const rr = R(); const rolePick = rr < 0.5 ? rl[0] : rr < 0.82 ? rl[1] : rl[2];
        const regionPay = { "North America": 1.9, "Europe": 1.6, "India": 0.55, "Asia Pacific": 0.95, "Middle East": 1.1, "Latin America": 0.8, "Africa": 0.65 }[rg.n];
        const avgSal = rolePick[1] * regionPay * Math.pow(1.06, yrs) * (0.96 + R() * 0.08);
        const payroll = cost * (0.24 + R() * 0.08);
        const hc = Math.max(1, Math.round(payroll / avgSal));
        rows.push([iso, rg.n, p.d, p.c, p.n, rolePick[0], Math.round(rev), Math.round(cost), Math.round(budget), units, Math.round(hc * avgSal), hc]);
      }
    }
    return {
      name: "Demo · Global Enterprise (synthetic)", demo: true,
      columns: ["Date", "Region", "Department", "Category", "Product", "Role", "Revenue", "Cost", "Budget", "Units", "Salary", "Headcount"],
      rows,
    };
  }

  /* ============================================================
     COLUMN AUTO-MAPPING
     ============================================================ */
  const FIELD_DEFS = [
    { key: "date", label: "Date", kind: "date", pat: /\b(date|datetime|timestamp|period|month|posting|invoice date|order date|txn date|transaction date)\b/ },
    { key: "revenue", label: "Revenue / Sales", kind: "num", pat: /\b(revenue|revenues|net sales|total sales|gross sales|sales amount|sales|turnover|gmv|income|order value|total amount|net amount|sale amount|amount)\b/, not: /\b(profit|cost|expense|budget|tax|discount|salary|net income)\b/ },
    { key: "cost", label: "Cost / Expense", kind: "num", pat: /\b(cost|costs|expense|expenses|spend|cogs|expenditure|opex|total cost|operating cost)\b/, not: /\b(budget|planned|plan)\b/ },
    { key: "profit", label: "Profit", kind: "num", pat: /\b(net profit|gross profit|profit|earnings|ebitda|net income|operating income)\b/ },
    { key: "budget", label: "Budget / Plan", kind: "num", pat: /\b(budget|budgeted|planned|plan amount|plan|target|allocation)\b/ },
    { key: "units", label: "Units / Quantity", kind: "num", pat: /\b(units|unit sold|quantity|qty|volume|orders|order count|pieces|sold)\b/ },
    { key: "salary", label: "Salary / Payroll", kind: "num", pat: /\b(salary|salaries|pay|wage|wages|compensation|ctc|payroll|remuneration|annual pay)\b/ },
    { key: "headcount", label: "Headcount", kind: "num", pat: /\b(headcount|head count|employees|employee count|staff|fte|manpower|no of employees)\b/ },
    { key: "region", label: "Region / Market", kind: "text", pat: /\b(region|territory|market|state|country|zone|geography|location|area|city|geo)\b/ },
    { key: "dept", label: "Department", kind: "text", pat: /\b(department|dept|division|business unit|team|function|cost center|cost centre|bu)\b/ },
    { key: "category", label: "Category", kind: "text", pat: /\b(category|product category|segment|class|product line|line of business|vertical|family|industry|type|sub category|company|entity|organisation|organization|client|customer|brand|account)\b/ },
    { key: "product", label: "Product / Item", kind: "text", pat: /\b(product|product name|item|item name|sku|service|offering|description|name)\b/ },
    { key: "role", label: "Role / Designation", kind: "text", pat: /\b(role|designation|job title|job|title|position|grade|level|job role)\b/ },
  ];
  const ID_LIKE = /\b(id|row id|record id|index|serial|sr no|s no|phone|mobile|zip|pin|postal|postcode|invoice no|order no|account no|number)\b/;

  function profileColumns(columns, rows) {
    const n = rows.length, sample = rows.length > 4000 ? rows.filter((_, i) => i % Math.ceil(rows.length / 4000) === 0) : rows;
    return columns.map((c, i) => {
      let filled = 0, numeric = 0, dated = 0; const set = new Set();
      for (const r of sample) {
        const v = r[i]; if (v == null || String(v).trim() === "") continue;
        filled++; if (Number.isFinite(num(v))) numeric++;
        if (set.size < 2000) set.add(String(v).trim());
      }
      // date detection on a smaller subset
      let dtest = 0;
      for (let k = 0, step = Math.max(1, Math.floor(sample.length / 300)); k < sample.length; k += step) {
        const v = sample[k][i]; if (v == null || v === "") continue; dtest++;
        const s = String(v).trim();
        if (/^\d+(\.\d+)?$/.test(s) && !(+s >= 20000 && +s <= 90000)) continue; // plain numbers are not dates unless serials
        if (parseDate(v)) dated++;
      }
      return { i, name: String(c), n: norm(c), filled, numShare: filled ? numeric / filled : 0, dateShare: dtest ? dated / dtest : 0, distinct: set.size, fillShare: sample.length ? filled / sample.length : 0 };
    });
  }

  function autoMap(columns, rows) {
    const prof = profileColumns(columns, rows);
    const used = new Set(); const map = {};
    const isNumCol = p => p.numShare >= 0.7;
    const isTextCol = p => p.numShare < 0.5 && p.distinct > 0 && p.distinct <= Math.max(60, rows.length * 0.5);
    const isDateCol = p => p.dateShare >= 0.8 && p.numShare < 0.95 || (p.dateShare >= 0.8 && /date|month|period|time|day/.test(p.n));
    const order = ["date", "profit", "salary", "headcount", "budget", "revenue", "cost", "units", "region", "dept", "category", "product", "role"];
    for (const key of order) {
      const def = FIELD_DEFS.find(d => d.key === key);
      let cands = prof.filter(p => !used.has(p.i) && p.filled > 0);
      if (def.kind === "date") cands = cands.filter(isDateCol);
      else if (def.kind === "num") cands = cands.filter(isNumCol).filter(p => !ID_LIKE.test(p.n) || def.pat.test(p.n));
      else cands = cands.filter(isTextCol);
      cands = cands.filter(p => def.pat.test(p.n) && !(def.not && def.not.test(p.n)));
      // prefer exact / shorter / higher fill
      cands.sort((a, b) => {
        const ea = def.pat.exec(a.n), eb = def.pat.exec(b.n);
        const sa = (ea && ea[0] === a.n ? 3 : 0) + a.fillShare, sb = (eb && eb[0] === b.n ? 3 : 0) + b.fillShare;
        return sb - sa || a.n.length - b.n.length;
      });
      if (cands[0]) { map[key] = cands[0].i; used.add(cands[0].i); } else map[key] = -1;
    }
    // fallbacks
    if (map.date < 0) { const d = prof.find(p => !used.has(p.i) && isDateCol(p) && p.filled > 0); if (d) { map.date = d.i; used.add(d.i); } }
    if (map.revenue < 0) {
      const nums = prof.filter(p => !used.has(p.i) && isNumCol(p) && !ID_LIKE.test(p.n) && p.i !== map.date && p.filled > 0 && !/\b(year|month|quarter|age|rating|score|percent|rate|pct)\b/.test(p.n));
      nums.sort((a, b) => sum(rows, r => num(r[b.i])) - sum(rows, r => num(r[a.i])));
      if (nums[0]) { map.revenue = nums[0].i; used.add(nums[0].i); map._revenueFallback = true; }
    }
    // text dims fallback: first unused low-cardinality text column becomes category
    if (map.category < 0 && map.product < 0 && map.region < 0 && map.dept < 0) {
      const t = prof.find(p => !used.has(p.i) && isTextCol(p) && p.distinct >= 2);
      if (t) { map.category = t.i; used.add(t.i); }
    }
    return map;
  }

  /* ============================================================
     NORMALISATION
     ============================================================ */
  function detectDMY(rows, idx) {
    if (idx < 0) return true;
    let a = 0, b = 0;
    for (let i = 0; i < rows.length && i < 3000; i++) {
      const m = String(rows[i][idx] ?? "").match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
      if (m) { if (+m[1] > 12) a++; if (+m[2] > 12) b++; }
    }
    return !(b > a);
  }

  function normalize(raw, mapping, opts) {
    opts = opts || {};
    const fyStart = opts.fyStart == null ? 3 : opts.fyStart, scale = opts.scale || 1;
    const mp = Object.assign({}, mapping);
    const has = {};
    ["date", "revenue", "cost", "profit", "budget", "units", "salary", "headcount", "region", "dept", "category", "product", "role"].forEach(k => { has[k] = Number.isInteger(mp[k]) && mp[k] >= 0; });
    const dmy = detectDMY(raw.rows, has.date ? mp.date : -1);
    const derivedCost = !has.cost && has.revenue && has.profit;
    const derivedProfit = !has.profit && has.revenue && has.cost;
    const recs = [];
    let badDates = 0, missingCells = 0;
    const txt = (r, k) => { const v = r[mp[k]]; const s = v == null ? "" : String(v).trim(); return s || "Unspecified"; };
    for (const r of raw.rows) {
      if (!r) continue;
      let t = NaN, ym = NaN;
      if (has.date) { const d = parseDate(r[mp.date], dmy); if (d) { t = d.getTime(); ym = ymOf(d); } else badDates++; }
      const g = k => has[k] ? num(r[mp[k]]) : NaN;
      let rev = g("revenue"), cost = g("cost"), profit = g("profit");
      if (!Number.isFinite(rev) && has.revenue) { missingCells++; }
      if (!Number.isFinite(rev)) rev = 0;
      if (derivedCost) cost = rev - (Number.isFinite(profit) ? profit : 0);
      if (!Number.isFinite(cost)) cost = 0;
      // Revenue minus expenses is the authoritative P&L profit whenever both
      // source fields exist. Uploaded "profit" columns are often cumulative,
      // margin, or otherwise inconsistent; using them here creates impossible
      // charts (e.g. revenue > expenses while every profit bar is negative).
      if (has.revenue && has.cost) profit = rev - cost;
      else if (derivedProfit || !Number.isFinite(profit)) profit = rev - cost;
      const rec = {
        t, ym, fy: Number.isFinite(ym) ? fyOf(ym, fyStart) : NaN, q: Number.isFinite(ym) ? qOf(ym, fyStart) : NaN,
        rev: rev * scale, cost: cost * scale, profit: profit * scale,
        budget: has.budget ? (Number.isFinite(g("budget")) ? g("budget") * scale : 0) : 0,
        units: has.units ? (Number.isFinite(g("units")) ? g("units") : 0) : 0,
        salary: has.salary ? (Number.isFinite(g("salary")) ? g("salary") * scale : 0) : 0,
        hc: has.headcount ? (Number.isFinite(g("headcount")) ? g("headcount") : 0) : (has.salary ? 1 : 0),
        region: has.region ? txt(r, "region") : "", dept: has.dept ? txt(r, "dept") : "", category: has.category ? txt(r, "category") : "",
        product: has.product ? txt(r, "product") : "", role: has.role ? txt(r, "role") : "",
      };
      recs.push(rec);
    }
    const yms = recs.map(r => r.ym).filter(Number.isFinite);
    let minYM = Infinity, maxYM = -Infinity; for (const y of yms) { if (y < minYM) minYM = y; if (y > maxYM) maxYM = y; }
    const uniq = k => [...new Set(recs.map(r => r[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const dims = { region: has.region ? uniq("region") : [], dept: has.dept ? uniq("dept") : [], category: has.category ? uniq("category") : [], product: has.product ? uniq("product") : [] };
    const fys = [...new Set(recs.map(r => r.fy).filter(Number.isFinite))].sort((a, b) => a - b);
    // duplicates (cheap signature) for quality
    const seen = new Set(); let dups = 0;
    for (const r of raw.rows) { const k = r.join("\u0001"); if (seen.has(k)) dups++; else seen.add(k); }
    const cells = raw.rows.length * raw.columns.length;
    let blank = 0; for (const r of raw.rows) for (let i = 0; i < raw.columns.length; i++) { const v = r[i]; if (v == null || String(v).trim() === "") blank++; }
    has.hasPL = has.revenue && (has.cost || has.profit);
    has.payroll = has.salary || has.role;
    return {
      name: raw.name, demo: !!raw.demo, columns: raw.columns, mapping: mp, has, recs, fyStart, scale, minYM: Number.isFinite(minYM) ? minYM : null, maxYM: Number.isFinite(maxYM) ? maxYM : null,
      dims, fys, derivedCost, derivedProfit,
      quality: { rows: raw.rows.length, cols: raw.columns.length, blank, completeness: cells ? 1 - blank / cells : 1, duplicates: dups, badDates, undated: has.date ? badDates : raw.rows.length, revenueFallback: !!mp._revenueFallback },
    };
  }

  /* ============================================================
     FILTERS
     ============================================================ */
  // fs = {range:"all|12m|6m|3m|ytd|custom", from:"YYYY-MM-DD", to:"", fy:"", q:"", region, dept, category, product}
  function filterSpec(M, f) {
    const spec = { t0: null, t1: null, fy: null, q: null, region: f.region || "", dept: f.dept || "", category: f.category || "", product: f.product || "", windowMonths: null, label: "All time", comparable: false };
    if (!M.has.date || M.maxYM == null) { spec.label = "All records"; return spec; }
    const mx = M.maxYM; let a = null, b = null;
    const r = f.range || "all";
    if (r === "12m") { a = mx - 11; b = mx; spec.label = "Last 12 months"; }
    else if (r === "6m") { a = mx - 5; b = mx; spec.label = "Last 6 months"; }
    else if (r === "3m") { a = mx - 2; b = mx; spec.label = "Last 3 months"; }
    else if (r === "ytd") { const fy = fyOf(mx, M.fyStart); a = fyStartYM(fy, M.fyStart); b = mx; spec.label = fyLabel(fy, M.fyStart) + " YTD"; }
    if (a != null) { spec.t0 = ymStart(a); spec.t1 = ymEnd(b); spec.windowMonths = b - a + 1; spec.comparable = true; }
    if (r === "custom" && (f.from || f.to)) {
      const d0 = f.from ? parseDate(f.from) : null, d1 = f.to ? parseDate(f.to) : null;
      spec.t0 = d0 ? d0.getTime() : null; spec.t1 = d1 ? d1.getTime() + 86399999 : null;
      spec.label = (f.from || "start") + " → " + (f.to || "latest");
      if (d0 && d1) { spec.windowMonths = Math.max(1, ymOf(d1) - ymOf(d0) + 1); spec.comparable = true; }
    }
    if (f.fy !== "" && f.fy != null) { spec.fy = +f.fy; spec.label = fyLabel(+f.fy, M.fyStart); spec.comparable = true; }
    if (f.q) { spec.q = +f.q; spec.label += (spec.fy != null || r !== "all" ? " · " : "") + "Q" + f.q; spec.comparable = spec.fy != null; }
    return spec;
  }
  function pass(r, s, ignoreDate) {
    if (!ignoreDate) {
      if (s.t0 != null && !(r.t >= s.t0)) return false;
      if (s.t1 != null && !(r.t <= s.t1)) return false;
      if (s.fy != null && r.fy !== s.fy) return false;
      if (s.q != null && r.q !== s.q) return false;
    }
    if (s.region && r.region !== s.region) return false;
    if (s.dept && r.dept !== s.dept) return false;
    if (s.category && r.category !== s.category) return false;
    if (s.product && r.product !== s.product) return false;
    return true;
  }
  function select(M, spec, ignoreDate) { return M.recs.filter(r => pass(r, spec, ignoreDate)); }
  function priorRecs(M, spec) {
    if (!spec.comparable) return null;
    const p = Object.assign({}, spec);
    if (spec.fy != null) { p.fy = spec.fy - 1; }
    else if (spec.t0 != null && spec.windowMonths) {
      const d = new Date(spec.t0); const ym0 = ymOf(d);
      p.t0 = ymStart(ym0 - spec.windowMonths); p.t1 = spec.t0 - 1;
    } else return null;
    const rows = M.recs.filter(r => pass(r, p));
    return rows.length ? rows : null;
  }

  /* ---------------- aggregation ---------------- */
  function agg(recs) {
    let rev = 0, cost = 0, profit = 0, budget = 0, units = 0, salary = 0, hc = 0;
    for (const r of recs) { rev += r.rev; cost += r.cost; profit += r.profit; budget += r.budget; units += r.units; salary += r.salary; hc += r.hc; }
    return { rev, cost, profit, budget, units, salary, hc, margin: rev ? profit / rev : 0, count: recs.length };
  }
  function monthly(recs) {
    const m = new Map();
    for (const r of recs) {
      if (!Number.isFinite(r.ym)) continue;
      let o = m.get(r.ym); if (!o) { o = { ym: r.ym, rev: 0, cost: 0, profit: 0, budget: 0, units: 0, salary: 0, hc: 0 }; m.set(r.ym, o); }
      o.rev += r.rev; o.cost += r.cost; o.profit += r.profit; o.budget += r.budget; o.units += r.units; o.salary += r.salary; o.hc += r.hc;
    }
    return [...m.values()].sort((a, b) => a.ym - b.ym).map(o => (o.margin = o.rev ? o.profit / o.rev : 0, o));
  }
  function fillGaps(series) {
    if (series.length < 2) return series.slice();
    const out = []; const keys = ["rev", "cost", "profit", "budget", "units", "salary", "hc"];
    for (let i = 0; i < series.length; i++) {
      out.push(series[i]);
      if (i < series.length - 1) {
        const a = series[i], b = series[i + 1];
        for (let y = a.ym + 1; y < b.ym; y++) {
          const t = (y - a.ym) / (b.ym - a.ym); const o = { ym: y, interpolated: true };
          keys.forEach(k => o[k] = a[k] + (b[k] - a[k]) * t); o.margin = o.rev ? o.profit / o.rev : 0; out.push(o);
        }
      }
    }
    return out;
  }
  function growthOf(series, maxYM, minYM) {
    // equal-length window comparison (last h months vs previous h)
    if (maxYM == null || minYM == null) return { g: null, h: 0 };
    const span = maxYM - minYM + 1; const h = Math.min(12, Math.floor(span / 2));
    if (h < 3) return { g: null, h };
    const last = sum(series.filter(x => x.ym > maxYM - h && x.ym <= maxYM), x => x.rev);
    const prev = sum(series.filter(x => x.ym > maxYM - 2 * h && x.ym <= maxYM - h), x => x.rev);
    return { g: prev > 0 ? last / prev - 1 : null, h, last, prev };
  }

  /* ============================================================
     FORECASTING
     ============================================================ */
  function linreg(y) {
    const n = y.length; if (n < 2) return { a: y[0] || 0, b: 0, r2: 0, sd: 0 };
    const mx = (n - 1) / 2, my = mean(y); let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (i - mx) * (y[i] - my); sxx += (i - mx) ** 2; syy += (y[i] - my) ** 2; }
    const b = sxx ? sxy / sxx : 0, a = my - b * mx; let sse = 0; for (let i = 0; i < n; i++) sse += (y[i] - (a + b * i)) ** 2;
    return { a, b, r2: syy ? 1 - sse / syy : 0, sd: Math.sqrt(sse / Math.max(1, n - 2)) };
  }
  function seasonalIndices(y, startMonth) {
    // ratio-to-centred-moving-average; returns array of 12 indices by calendar month
    const n = y.length; if (n < 24) return null;
    const cma = new Array(n).fill(null);
    for (let t = 6; t < n - 6; t++) { let s = 0.5 * y[t - 6] + 0.5 * y[t + 6]; for (let k = -5; k <= 5; k++) s += y[t + k]; cma[t] = s / 12; }
    const buckets = Array.from({ length: 12 }, () => []);
    for (let t = 0; t < n; t++) if (cma[t] && cma[t] > 0) buckets[(startMonth + t) % 12].push(y[t] / cma[t]);
    const idx = buckets.map(b => b.length ? mean(b) : 1); const m = mean(idx);
    return idx.map(v => clamp(v / m, 0.5, 1.8));
  }
  function holtFit(y, alpha, beta, phi) {
    const n = y.length; const k = Math.min(3, n - 1);
    let l = y[0], b = k > 0 ? (y[k] - y[0]) / k : 0, sse = 0; const errs = [];
    for (let t = 1; t < n; t++) {
      const pred = l + phi * b, e = y[t] - pred; sse += e * e; errs.push(e);
      const ln = alpha * y[t] + (1 - alpha) * pred; b = beta * (ln - l) + (1 - beta) * phi * b; l = ln;
    }
    return { l, b, sse, errs };
  }
  function holtBest(y) {
    let best = null;
    for (const alpha of [0.2, 0.4, 0.6, 0.8]) for (const beta of [0.05, 0.15, 0.3]) for (const phi of [0.85, 0.92, 0.98, 1]) {
      const f = holtFit(y, alpha, beta, phi); if (!best || f.sse < best.sse) best = Object.assign(f, { alpha, beta, phi });
    }
    return best;
  }
  function holtPath(fit, h) { const out = []; let acc = 0, p = 1; for (let i = 1; i <= h; i++) { p *= fit.phi; acc += p; out.push(fit.l + fit.b * acc); } return out; }

  function runModel(y, startMonth, h) {
    const n = y.length;
    if (n < 6) {
      const lr = linreg(y); const base = []; for (let i = 0; i < h; i++) base.push(Math.max(0, lr.a + lr.b * (n + i)));
      const sd = Math.max(lr.sd, mean(y) * 0.1);
      return { base, sd: base.map((_, i) => sd * Math.sqrt(1 + (i + 1) * 0.5)), method: "Linear trend (limited history)", seasonal: false, params: null, sigma: sd };
    }
    const si = seasonalIndices(y, startMonth);
    const ds = si ? y.map((v, t) => v / si[(startMonth + t) % 12]) : y.slice();
    const fit = holtBest(ds); const path = holtPath(fit, h); const sigma = Math.sqrt(fit.sse / Math.max(1, n - 1));
    const base = path.map((v, i) => Math.max(0, v * (si ? si[(startMonth + n + i) % 12] : 1)));
    const sd = path.map((_, i) => sigma * Math.sqrt(1 + i * 0.5) * (si ? si[(startMonth + n + i) % 12] : 1));
    return { base, sd, method: si ? "Damped-trend Holt + seasonal index" : "Damped-trend Holt (no seasonality: <24 months)", seasonal: !!si, seasonalIdx: si, params: { alpha: fit.alpha, beta: fit.beta, phi: fit.phi }, sigma };
  }
  function forecastSeries(series, h, key) {
    key = key || "rev"; h = h || 12;
    const f = fillGaps(series); const y = f.map(x => x[key]); const n = y.length;
    if (n < 3) return null;
    const startMonth = f[0].ym % 12; const lastYM = f[n - 1].ym;
    const res = runModel(y, startMonth, h);
    // backtest
    let mape = null, mae = null, rmse = null, holdout = 0;
    if (n >= 12) {
      holdout = Math.min(6, Math.floor(n / 3));
      const train = y.slice(0, n - holdout); const m2 = runModel(train, startMonth, holdout);
      const act = y.slice(n - holdout); const errs = act.map((a, i) => a - m2.base[i]);
      const pe = act.map((a, i) => Math.abs(a) > 0 ? Math.abs(errs[i]) / Math.abs(a) : 0);
      mape = mean(pe); mae = mean(errs.map(Math.abs)); rmse = Math.sqrt(mean(errs.map(e => e * e)));
    }
    const z90 = 1.645, z50 = 0.674;
    const out = res.base.map((b, i) => ({
      ym: lastYM + 1 + i, base: b, lo90: Math.max(0, b - z90 * res.sd[i]), hi90: b + z90 * res.sd[i],
      opt: b + z50 * res.sd[i], cons: Math.max(0, b - z50 * res.sd[i]),
    }));
    const last12 = sum(y.slice(-12)); const total12 = sum(out.slice(0, 12), x => x.base);
    const confidence = mape == null ? "Limited history" : mape < 0.08 ? "High" : mape < 0.15 ? "Medium" : "Low";
    return {
      hist: f.map(x => ({ ym: x.ym, v: x[key] })), fc: out, total12, last12, growth: last12 > 0 ? total12 / last12 - 1 : null,
      model: { method: res.method, seasonal: res.seasonal, params: res.params, n, mape, mae, rmse, holdout, confidence, seasonalIdx: res.seasonalIdx || null, interpolated: f.filter(x => x.interpolated).length },
    };
  }

  /* ============================================================
     ENTITY ANALYSIS + MARKET SCORING
     ============================================================ */
  function pctRank(vals, v) { const f = vals.filter(Number.isFinite); if (f.length < 2 || !Number.isFinite(v)) return 0.5; let below = 0, eq = 0; f.forEach(x => { if (x < v) below++; else if (x === v) eq++; }); return (below + Math.max(0, eq - 1) / 2) / (f.length - 1); }

  function entityStats(M, spec, dimKey, opts) {
    opts = opts || {};
    const winRecs = select(M, spec, false), allRecs = select(M, spec, true);
    const byWin = new Map(), byAll = new Map();
    winRecs.forEach(r => { const k = r[dimKey] || "Unspecified"; (byWin.get(k) || byWin.set(k, []).get(k)).push(r); });
    allRecs.forEach(r => { const k = r[dimKey] || "Unspecified"; (byAll.get(k) || byAll.set(k, []).get(k)).push(r); });
    const total = agg(winRecs); const names = [...new Set([...byWin.keys()])];
    const ents = names.map(name => {
      const w = byWin.get(name) || [], a = agg(w), all = byAll.get(name) || [];
      const ms = monthly(all); const gr = growthOf(ms, M.maxYM, M.minYM);
      const pg = (() => { // profit growth, same windows
        if (!gr.h || gr.h < 3) return null; const mx = M.maxYM, h = gr.h;
        const l = sum(ms.filter(x => x.ym > mx - h), x => x.profit), p = sum(ms.filter(x => x.ym > mx - 2 * h && x.ym <= mx - h), x => x.profit);
        return p > 0 ? l / p - 1 : null;
      })();
      const filled = fillGaps(ms); const y = filled.map(x => x.rev);
      let vol = null; if (y.length >= 6) { const lr = linreg(y); const mu = mean(y); vol = mu ? lr.sd / mu : null; }
      return { name, rev: a.rev, cost: a.cost, profit: a.profit, margin: a.margin, units: a.units, budget: a.budget, salary: a.salary, hc: a.hc, share: total.rev ? a.rev / total.rev : 0, count: a.count, growth: gr.g, profitGrowth: pg, vol, series: ms, allRecs: all };
    }).sort((x, y2) => y2.rev - x.rev);
    if (!opts.noForecast && M.has.date) {
      ents.slice(0, opts.forecastTop || 40).forEach(e => { const f = e.series.length >= 4 ? forecastSeries(e.series, 12, "rev") : null; if (f) { e.fcGrowth = f.growth; e.fcTotal = f.total12; e.fcLast = f.last12; e.confidence = f.model.confidence; } });
    }
    return { ents, total };
  }

  function scoreEntities(ents) {
    const g = ents.map(e => Number.isFinite(e.fcGrowth) && Number.isFinite(e.growth) ? 0.5 * e.fcGrowth + 0.5 * e.growth : Number.isFinite(e.fcGrowth) ? e.fcGrowth : e.growth);
    const m = ents.map(e => e.margin), sc = ents.map(e => e.rev), v = ents.map(e => e.vol), pgs = ents.map(e => e.profitGrowth);
    ents.forEach((e, i) => {
      e.blendGrowth = g[i];
      const parts = {
        growth: pctRank(g, g[i]), margin: pctRank(m, m[i]), scale: pctRank(sc, sc[i]),
        stability: Number.isFinite(v[i]) ? 1 - pctRank(v, v[i]) : 0.5, momentum: Number.isFinite(pgs[i]) ? pctRank(pgs, pgs[i]) : 0.5,
      };
      e.score = Math.round(100 * (0.35 * parts.growth + 0.25 * parts.margin + 0.15 * parts.scale + 0.15 * parts.stability + 0.10 * parts.momentum));
      e.parts = parts;
    });
    const gm = ents.map(e => e.blendGrowth).filter(Number.isFinite).sort((a, b) => a - b), mm = ents.map(e => e.margin).sort((a, b) => a - b);
    const medG = gm.length ? gm[Math.floor(gm.length / 2)] : 0, medM = mm.length ? mm[Math.floor(mm.length / 2)] : 0;
    ents.forEach(e => {
      const hiG = Number.isFinite(e.blendGrowth) ? e.blendGrowth >= medG : true, hiM = e.margin >= medM;
      e.quadrant = hiG && hiM ? "Invest & expand" : hiG && !hiM ? "Grow, fix margin" : !hiG && hiM ? "Defend & harvest" : "Reassess";
      if (e.quadrant === "Invest & expand" && Number.isFinite(e.blendGrowth) && e.blendGrowth <= 0) e.quadrant = "Defend & harvest";
    });
    return { medG, medM };
  }

  function strategy(M, spec, ctx) {
    // ctx.total = agg of window recs
    const out = { cards: [], dims: {}, summary: [], allocation: null };
    const label = { region: "region", category: "category", product: "product", dept: "department" };
    ["region", "category", "product", "dept"].forEach(k => {
      if (!M.has[k] || spec[k]) return; // skip if filtered to a single value
      const { ents, total } = entityStats(M, spec, k, { forecastTop: 40 });
      if (ents.length < 2) return; const med = scoreEntities(ents); out.dims[k] = { ents, total, med };
    });
    const co = ctx.total;
    const rationale = (e, k) => {
      const parts = [];
      if (Number.isFinite(e.fcGrowth)) parts.push(`forecast ${pctSign(e.fcGrowth)} over the next 12 months`);
      else if (Number.isFinite(e.growth)) parts.push(`${pctSign(e.growth)} recent growth`);
      parts.push(`${pct(e.margin)} margin vs ${pct(co.margin)} company`);
      parts.push(`${pct(e.share)} of revenue`);
      return parts.join(" · ");
    };
    ["region", "category", "product", "dept"].forEach(k => {
      const d = out.dims[k]; if (!d) return;
      const top = d.ents.slice().sort((a, b) => b.score - a.score);
      d.top = top; d.focus = top.filter(e => e.quadrant === "Invest & expand").slice(0, 3); if (!d.focus.length) d.focus = top.slice(0, 2);
      d.fix = top.filter(e => e.quadrant === "Grow, fix margin").slice(0, 2);
      d.harvest = top.filter(e => e.quadrant === "Defend & harvest").slice(0, 2);
      d.avoid = top.slice().reverse().filter(e => e.quadrant === "Reassess").slice(0, 2);
      d.focus.forEach(e => { e.reason = rationale(e, k); });
    });
    const R = out.dims.region || out.dims.category || out.dims.product || out.dims.dept, RK = out.dims.region ? "region" : out.dims.category ? "category" : out.dims.product ? "product" : out.dims.dept ? "dept" : null;
    if (R) {
      const e = R.focus[0];
      const upl = Number.isFinite(e.fcTotal) && Number.isFinite(e.fcLast) ? e.fcTotal - e.fcLast : null;
      out.summary.push(`Focus on ${e.name} ${label[RK]}: market-attractiveness score ${e.score}/100. ${rationale(e, RK)}.` + (upl != null && upl > 0 ? ` Forecast adds ${money(upl, M.currency || "INR", 1)} of revenue over the next 12 months.` : ""));
      if (R.focus[1]) out.summary.push(`Second priority: ${R.focus[1].name} — ${rationale(R.focus[1], RK)}.`);
      if (R.fix[0]) out.summary.push(`${R.fix[0].name} is growing faster than the median but earns only ${pct(R.fix[0].margin)} margin — fix pricing/cost-to-serve before adding spend.`);
      if (R.harvest[0]) out.summary.push(`${R.harvest[0].name} is a mature ${label[RK]} with an above-median margin (${pct(R.harvest[0].margin)}) and slower growth — defend share and use its cash flow to fund growth markets.`);
      if (R.avoid[0]) out.summary.push(`${R.avoid[0].name} combines below-median growth with below-median margin — reassess commitment or restructure the cost base.`);
      // allocation: shift 10% of cost from lowest-quartile score to top-quartile (illustrative linear returns)
      if (R.ents.length >= 4) {
        const s = R.ents.slice().sort((a, b) => b.score - a.score); const q = Math.max(1, Math.floor(s.length / 4));
        const hi = s.slice(0, q), lo = s.slice(-q);
        const pool = sum(lo, x => x.cost) * 0.10; const effHi = sum(hi, x => x.rev) / Math.max(1, sum(hi, x => x.cost)), effLo = sum(lo, x => x.rev) / Math.max(1, sum(lo, x => x.cost));
        out.allocation = { dimKey: RK, from: lo.map(x => x.name), to: hi.map(x => x.name), shift: pool, effHi, effLo, revDelta: pool * (effHi - effLo) };
      }
    }
    return out;
  }

  /* ============================================================
     BREAK-EVEN + STABILITY
     ============================================================ */
  function breakEven(recs, fixedShareOverride) {
    const ms = fillGaps(monthly(recs)); const A = agg(recs); const R = A.rev, C = A.cost;
    let f = null, method = "assumed", r2 = null, fixedMonthly = null;
    if (ms.length >= 6) {
      const x = ms.map(m => m.rev), y = ms.map(m => m.cost); const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
      for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
      const b = sxx ? sxy / sxx : 0, a = my - b * mx; r2 = syy ? (sxy * sxy) / (sxx * syy) : 0;
      if (r2 >= 0.25 && a > 0 && b >= 0 && b < 1.05 && C > 0) { f = clamp((a * ms.length) / C, 0.02, 0.9); method = "regression"; fixedMonthly = a; }
    }
    if (f == null) f = 0.35;
    if (fixedShareOverride != null && Number.isFinite(fixedShareOverride)) { f = clamp(fixedShareOverride, 0, 0.95); method = "manual"; }
    const months = Math.max(1, ms.length);
    const FC = f * C, VC = C - FC, v = R > 0 ? VC / R : NaN, cm = 1 - v;
    const be = cm > 0 ? FC / cm : Infinity; const mos = R > 0 && Number.isFinite(be) ? (R - be) / R : null;
    const profit = R - C; const dol = profit !== 0 ? (cm * R) / profit : null;
    const price = A.units > 0 ? R / A.units : null; const vcu = A.units > 0 ? VC / A.units : null;
    const beUnits = price && vcu != null && price - vcu > 0 ? FC / (price - vcu) : null;
    return { fixedShare: f, method, r2, months, revenue: R, cost: C, fixedCost: FC, variableCost: VC, varRatio: v, contributionRatio: cm, breakEvenRevenue: be, breakEvenMonthly: Number.isFinite(be) ? be / months : null, marginOfSafety: mos, profit, dol, price, varCostPerUnit: vcu, breakEvenUnits: beUnits, units: A.units, fixedMonthly };
  }
  function pnlAt(be, revenueFactor, costFactor) {
    const R = be.revenue * revenueFactor; const FC = be.fixedCost * (costFactor || 1); const VC = be.varRatio * R * (costFactor || 1);
    return { revenue: R, cost: FC + VC, profit: R - FC - VC, margin: R ? (R - FC - VC) / R : 0 };
  }

  function hhi(ents) { const t = sum(ents, e => Math.max(0, e.rev)); if (!t) return null; return sum(ents, e => (Math.max(0, e.rev) / t) ** 2); }

  function stability(inp) {
    // inp: {agg, prior, series, be, regionEnts, productEnts, budgetVar (abs avg variance fraction) , hasBudget}
    const F = []; const add = (key, label, weight, score, value, text) => { if (score != null && Number.isFinite(score)) F.push({ key, label, weight, score: Math.round(score), value, text }); };
    const A = inp.agg;
    if (inp.hasPL) add("margin", "Profitability", 0.20, 100 * lerp01(A.margin, 0, 0.25), pct(A.margin), A.margin >= 0.2 ? "Healthy net margin" : A.margin > 0 ? "Thin margin — little buffer for shocks" : "Operating at a loss");
    const gr = inp.growth; if (Number.isFinite(gr)) add("growth", "Growth trend", 0.15, 100 * lerp01(gr, -0.15, 0.15), pctSign(gr), gr > 0.08 ? "Strong revenue momentum" : gr > 0 ? "Modest growth" : "Revenue is contracting");
    const ser = inp.series || [];
    if (ser.length >= 6) {
      const y = ser.map(x => x.rev), lr = linreg(y), cv = mean(y) ? lr.sd / mean(y) : 0;
      add("vol", "Revenue volatility", 0.15, 100 * (1 - lerp01(cv, 0.03, 0.20)), pct(cv), cv < 0.1 ? "Predictable monthly revenue" : cv < 0.2 ? "Moderate swings around trend" : "Highly volatile revenue");
      if (inp.hasPL) { const mg = ser.map(x => x.margin * 100), s = std(mg); add("mstab", "Margin consistency", 0.10, 100 * (1 - lerp01(s, 2, 15)), s.toFixed(1) + " pp σ", s < 4 ? "Stable margins month to month" : "Margins swing materially"); }
    }
    const conc = [inp.regionEnts, inp.productEnts].filter(e => e && e.length >= 2).map(hhi).filter(Number.isFinite);
    if (conc.length) { const h = mean(conc); add("conc", "Concentration risk", 0.10, 100 * (1 - lerp01(h, 0.15, 0.45)), "HHI " + h.toFixed(2), h < 0.25 ? "Revenue is well diversified" : h < 0.4 ? "Moderate dependence on top segments" : "High dependence on few segments"); }
    if (inp.hasBudget && Number.isFinite(inp.budgetVar)) add("budget", "Budget discipline", 0.10, 100 * (1 - lerp01(inp.budgetVar, 0.05, 0.25)), pct(inp.budgetVar) + " avg |variance|", inp.budgetVar < 0.08 ? "Spend tracks plan closely" : "Material deviations from plan");
    if (inp.be && Number.isFinite(inp.be.marginOfSafety)) add("be", "Break-even safety", 0.15, 100 * lerp01(inp.be.marginOfSafety, 0, 0.40), pct(inp.be.marginOfSafety) + " margin of safety", inp.be.marginOfSafety > 0.3 ? "Revenue can fall >30% before losses" : inp.be.marginOfSafety > 0.1 ? "Limited cushion above break-even" : "Close to or below break-even");
    if (inp.prior && inp.prior.rev > 0 && inp.prior.cost > 0 && inp.hasPL) {
      const rg = A.rev / inp.prior.rev - 1, cg = A.cost / inp.prior.cost - 1, gap = cg - rg;
      add("costctl", "Cost control", 0.05, 100 * (1 - lerp01(gap, 0, 0.15)), (gap <= 0 ? "costs −" : "costs +") + Math.abs(gap * 100).toFixed(1) + "pp vs rev", gap <= 0 ? "Costs growing slower than revenue" : "Costs outpacing revenue growth");
    }
    const w = sum(F, f => f.weight);
    const score = w ? Math.round(sum(F, f => f.score * f.weight) / w) : null;
    const rating = score == null ? "n/a" : score >= 80 ? "Strong" : score >= 65 ? "Stable" : score >= 50 ? "Watch" : "At risk";
    const flags = F.filter(f => f.score < 50).sort((a, b) => a.score - b.score).map(f => `${f.label}: ${f.text} (${f.value})`);
    return { score, rating, factors: F, flags, coverage: w };
  }

  /* ============================================================
     BUDGET TRACKING
     ============================================================ */
  function budgetTable(M, spec, dimKey, userBudgets, thr) {
    const recs = select(M, spec, false); const all = select(M, spec, true);
    const key = dimKey; const groups = new Map();
    recs.forEach(r => { const k = key ? (r[key] || "Unspecified") : "Company"; (groups.get(k) || groups.set(k, []).get(k)).push(r); });
    const allG = new Map(); all.forEach(r => { const k = key ? (r[key] || "Unspecified") : "Company"; (allG.get(k) || allG.set(k, []).get(k)).push(r); });
    const winMonths = Math.max(1, new Set(recs.map(r => r.ym).filter(Number.isFinite)).size) || 1;
    const maxYM = M.maxYM; const fy = maxYM != null ? fyOf(maxYM, M.fyStart) : null;
    const fyStartIdx = fy != null ? fyStartYM(fy, M.fyStart) : null; const elapsed = maxYM != null ? maxYM - fyStartIdx + 1 : null; const remaining = elapsed != null ? 12 - elapsed : null;
    const rows = [...groups.entries()].map(([name, rs]) => {
      const a = agg(rs); const ga = allG.get(name) || [];
      const fyRecs = fy != null ? ga.filter(r => r.fy === fy) : [];
      const fyA = agg(fyRecs);
      let planned, source, annual;
      if (M.has.budget) { planned = a.budget; source = "dataset"; annual = elapsed ? fyA.budget / elapsed * 12 : null; }
      else {
        const ub = userBudgets && userBudgets[name];
        if (ub != null && Number.isFinite(+ub)) { annual = +ub; planned = annual * winMonths / 12; source = "user"; }
        else { const l12 = sum(ga.filter(r => M.maxYM != null && r.ym > M.maxYM - 12), r => r.cost); annual = l12 * 1.05; planned = annual * winMonths / 12; source = "auto"; }
      }
      const variance = a.cost - planned; const util = planned ? a.cost / planned : null;
      const burn = winMonths ? a.cost / winMonths : 0;
      let proj = null, projVar = null;
      if (elapsed && fyA.cost) { const fyBurn = fyA.cost / elapsed; proj = fyA.cost + fyBurn * remaining; projVar = annual ? proj - annual : null; }
      let status = "On track", tone = "ok";
      if (util == null) { status = "No plan"; tone = "mut"; }
      else if (util - 1 > thr) { status = "Over budget"; tone = "bad"; }
      else if (util > 1) { status = "Watch"; tone = "warn"; }
      else if (util < 1 - 2 * thr) { status = "Under-utilised"; tone = "info"; }
      return { name, actual: a.cost, planned, variance, util, burn, annual, proj, projVar, status, tone, source, revenue: a.rev, count: a.count, months: winMonths };
    }).sort((x, y) => y.actual - x.actual);
    const T = { actual: sum(rows, r => r.actual), planned: sum(rows, r => r.planned) };
    T.variance = T.actual - T.planned; T.util = T.planned ? T.actual / T.planned : null;
    // cumulative monthly
    const ms = monthly(recs); let ca = 0, cb = 0;
    const cum = ms.map(m => { ca += m.cost; cb += (M.has.budget ? m.budget : (T.planned / Math.max(1, ms.length))); return { ym: m.ym, actual: ca, budget: cb }; });
    const absVar = rows.filter(r => r.util != null).map(r => Math.abs(r.util - 1));
    return { rows, total: T, cum, avgAbsVar: absVar.length ? mean(absVar) : null, elapsed, remaining, fy, hasBudgetCol: M.has.budget };
  }

  /* ============================================================
     PAYROLL
     ============================================================ */
  function payroll(recs) {
    const roles = new Map(), depts = new Map(), regions = new Map();
    recs.forEach(r => {
      if (r.role) { const o = roles.get(r.role) || { name: r.role, salary: 0, hc: 0, rows: 0 }; o.salary += r.salary; o.hc += r.hc; o.rows++; roles.set(r.role, o); }
      if (r.dept) { const o = depts.get(r.dept) || { name: r.dept, salary: 0, hc: 0, rev: 0 }; o.salary += r.salary; o.hc += r.hc; o.rev += r.rev; depts.set(r.dept, o); }
      if (r.region) { const o = regions.get(r.region) || { name: r.region, salary: 0, hc: 0, rev: 0 }; o.salary += r.salary; o.hc += r.hc; o.rev += r.rev; regions.set(r.region, o); }
    });
    const fin = m => [...m.values()].map(o => (o.avg = o.hc ? o.salary / o.hc : 0, o)).sort((a, b) => b.avg - a.avg);
    return { roles: fin(roles), depts: fin(depts), regions: fin(regions) };
  }

  /* ============================================================
     ALERTS
     ============================================================ */
  function buildAlerts(M, spec, c) {
    const out = []; const fm = (v) => money(v, M.currency || "INR", 1);
    if (c.budget) c.budget.rows.forEach(r => { if (r.tone === "bad") out.push({ id: "bud-" + r.name, sev: "high", title: `${r.name} is over budget`, body: `Actual ${fm(r.actual)} vs plan ${fm(r.planned)} (${pctSign(r.util - 1)}).`, link: "#/budgets", icon: "budget" }); else if (r.tone === "warn") out.push({ id: "budw-" + r.name, sev: "med", title: `${r.name} is trending above plan`, body: `Utilisation ${pct(r.util)} — watch run-rate.`, link: "#/budgets", icon: "budget" }); });
    if (c.prior && c.agg && M.has.hasPL && c.prior.rev > 0) { const dm = c.agg.margin - c.prior.margin; if (dm <= -0.02) out.push({ id: "mgn", sev: "high", title: "Profit margin is contracting", body: `Margin ${pct(c.agg.margin)} vs ${pct(c.prior.margin)} in the prior period (${(dm * 100).toFixed(1)} pp).`, link: "#/expenses", icon: "trendDown" }); }
    const rd = c.strategy && c.strategy.dims && (c.strategy.dims.region || c.strategy.dims.category);
    if (rd) rd.ents.filter(e => Number.isFinite(e.growth) && e.growth < -0.05 && e.share > 0.03).slice(0, 3).forEach(e => out.push({ id: "dec-" + e.name, sev: "med", title: `${e.name} revenue is declining`, body: `${pctSign(e.growth)} vs the previous period with ${pct(e.share)} of revenue.`, link: "#/insights", icon: "trendDown" }));
    if (c.forecast && Number.isFinite(c.forecast.growth) && c.forecast.growth < 0) out.push({ id: "fc", sev: "high", title: "Forecast shows revenue decline", body: `Next-12-month forecast is ${pctSign(c.forecast.growth)} vs the last 12 months.`, link: "#/forecast", icon: "forecast" });
    if (c.stability && c.stability.score != null && c.stability.score < 50) out.push({ id: "stab", sev: "high", title: "Financial stability score is at risk", body: `Score ${c.stability.score}/100. ${c.stability.flags[0] || ""}`, link: "#/stability", icon: "shield" });
    if (c.be && Number.isFinite(c.be.marginOfSafety) && c.be.marginOfSafety < 0.1) out.push({ id: "be", sev: c.be.marginOfSafety < 0 ? "high" : "med", title: c.be.marginOfSafety < 0 ? "Operating below break-even" : "Thin margin of safety", body: `Break-even revenue ${fm(c.be.breakEvenRevenue)} vs actual ${fm(c.be.revenue)}.`, link: "#/stability", icon: "scale" });
    if (M.quality.completeness < 0.9) out.push({ id: "dq", sev: "low", title: "Data completeness below 90%", body: `${pct(M.quality.completeness)} of cells are populated — some metrics may be understated.`, link: "#/data", icon: "quality" });
    if (M.quality.duplicates > 0) out.push({ id: "dup", sev: "low", title: `${M.quality.duplicates.toLocaleString("en-IN")} duplicate rows`, body: "Exact duplicates can double-count revenue — review in Data.", link: "#/data", icon: "copy" });
    const order = { high: 0, med: 1, low: 2 }; return out.sort((a, b) => order[a.sev] - order[b.sev]);
  }

  const api = {
    num, parseDate, norm, sum, mean, std, clamp, linreg,
    ymOf, ymStart, ymEnd, fyOf, qOf, fyLabel, fyStartYM, monthLabel, qMonths, MONTHS,
    CURRENCIES, money, pct, pctSign, compact,
    demoData, autoMap, profileColumns, FIELD_DEFS, normalize, filterSpec, pass, select, priorRecs,
    agg, monthly, fillGaps, growthOf, forecastSeries, entityStats, scoreEntities, strategy,
    breakEven, pnlAt, hhi, stability, budgetTable, payroll, buildAlerts,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.FSE = api;
})(typeof window !== "undefined" ? window : globalThis);
