/* ============================================================
   REVENUE FORECASTING & BUSINESS INTELLIGENCE — mock data (single source of truth)
   Company: Finance Analytics Platform · Retail & E-Commerce · INR ₹
   All metrics are internally consistent:
   profit = revenue − expenses · margin = profit/revenue
   utilization = actual/budget · variance = actual − budget
   growth = (cur − prev)/prev
   ============================================================ */
(function () {
  "use strict";

  /* ---------- seeded RNG (deterministic mock data) ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- monthly series (₹ lakh) Apr-24 → Sep-26 ---------- */
  const MONTHS = ["Apr-24","May-24","Jun-24","Jul-24","Aug-24","Sep-24","Oct-24","Nov-24","Dec-24","Jan-25","Feb-25","Mar-25","Apr-25","May-25","Jun-25","Jul-25","Aug-25","Sep-25","Oct-25","Nov-25","Dec-25","Jan-26","Feb-26","Mar-26","Apr-26","May-26","Jun-26","Jul-26","Aug-26","Sep-26"];
  const REV = [172,168,182,176,184,218,178,205,214,185,180,216,172,168,182,176,184,218,200,226,232,198,195,235,196,192,206,202,212,266];
  const EXP = [128,126,136,132,138,172,132,142,150,135,130,161,128,126,136,132,140,172,145,156,160,148,146,172,142,141,151,147,153,159];
  const PROF = REV.map((r, i) => r - EXP[i]);

  const sum = (a, s, e) => a.slice(s, e).reduce((x, y) => x + y, 0);
  const last12 = { rev: sum(REV, 18, 30), exp: sum(EXP, 18, 30) };      // Oct-25 → Sep-26
  last12.profit = last12.rev - last12.exp;                                // 2560 / 1820 / 740
  const prev12 = { rev: sum(REV, 6, 18), exp: sum(EXP, 6, 18) };          // Oct-24 → Sep-25
  prev12.profit = prev12.rev - prev12.exp;                                // 2278 / 1684 / 594

  const PCT = (cur, prev) => (cur - prev) / prev * 100;
  const LATEST = {
    revenue: last12.rev, revenueGrowth: PCT(last12.rev, prev12.rev),
    expenses: last12.exp, expenseGrowth: PCT(last12.exp, prev12.exp),
    profit: last12.profit, profitGrowth: PCT(last12.profit, prev12.profit),
    margin: last12.profit / last12.rev * 100,
    prevMargin: prev12.profit / prev12.rev * 100,
    orders: 13.84, aov: last12.rev * 100000 / (last12.orders * 100000),
    customers: 6.21, revPerCustomer: last12.rev * 100000 / (last12.customers * 100000),
  };
  LATEST.aov = Math.round(last12.rev * 1e5 / (last12.orders * 1e5)); // ₹1,855
  LATEST.revPerCustomer = Math.round(last12.rev * 1e5 / (last12.customers * 1e5));

  /* ---------- period windows ---------- */
  const PERIODS = {
    t12m:  { label: "Last 12 months", sub: "Oct 2025 – Sep 2026", start: 18, len: 12 },
    t6m:   { label: "Last 6 months",  sub: "Apr 2026 – Sep 2026", start: 24, len: 6 },
    t3m:   { label: "Last quarter",   sub: "Jul 2026 – Sep 2026", start: 27, len: 3 },
    fy26:  { label: "FY 2026-27 YTD", sub: "Apr 2026 – Sep 2026", start: 24, len: 6 },
    fy25:  { label: "FY 2025-26",     sub: "Apr 2025 – Mar 2026", start: 12, len: 12 },
  };
  function windowData(key) {
    const p = PERIODS[key] || PERIODS.t12m;
    const c = { rev: sum(REV, p.start, p.start + p.len), exp: sum(EXP, p.start, p.start + p.len) };
    c.profit = c.rev - c.exp;
    const ps = p.start - p.len;
    const pr = { rev: sum(REV, ps, ps + p.len), exp: sum(EXP, ps, ps + p.len) };
    pr.profit = pr.rev - pr.exp;
    c.margin = c.profit / c.rev * 100; pr.margin = pr.profit / pr.rev * 100;
    return { cur: c, prev: pr, labels: MONTHS.slice(p.start, p.start + p.len), rev: REV.slice(p.start, p.start + p.len), exp: EXP.slice(p.start, p.start + p.len), profit: PROF.slice(p.start, p.start + p.len) };
  }

  /* ---------- categories (revenue ₹ lakh, T12M = 2,560) ---------- */
  const CATEGORIES = [
    { name: "Electronics",     rev: 770, growth: 30.0, margin: 31.2 },
    { name: "Home Appliances", rev: 460, growth: 12.0, margin: 27.4 },
    { name: "Fashion",         rev: 410, growth: -6.5, margin: 24.8 },
    { name: "Beauty",          rev: 310, growth: 18.0, margin: 38.6 },
    { name: "Furniture",       rev: 260, growth: 8.0,  margin: 21.9 },
    { name: "Accessories",     rev: 350, growth: 5.0,  margin: 33.5 },
  ];
  CATEGORIES.forEach(c => { c.share = c.rev / last12.rev * 100; c.prev = c.rev / (1 + c.growth / 100); c.profit = c.rev * c.margin / 100; });
  const CAT_COLOR = ["#1D5BD6", "#3E8FD8", "#7A5AF8", "#B45309", "#178A50", "#8593A9"];

  /* ---------- regions (T12M = 2,560) ---------- */
  const REGIONS = [
    { name: "South", rev: 870, growth: 16.5, margin: 31.3, orders: 4.86 },
    { name: "West",  rev: 720, growth: 13.0, margin: 30.3, orders: 3.92 },
    { name: "North", rev: 610, growth: 10.0, margin: 26.7, orders: 3.21 },
    { name: "East",  rev: 360, growth: 7.0,  margin: 24.2, orders: 1.85 },
  ];
  REGIONS.forEach(r => { r.share = r.rev / last12.rev * 100; r.prev = r.rev / (1 + r.growth / 100); r.profit = r.rev * r.margin / 100; });

  /* ---------- departments / budget plan (₹ Cr) ----------
     Budget envelope (approved plan) ₹23.8 Cr vs actual ₹18.2 Cr → 76.4% */
  const BUDGETS = [
    { dept: "Marketing",      budget: 4.0, actual: 4.6 },
    { dept: "Operations",     budget: 8.6, actual: 5.9 },
    { dept: "Technology",     budget: 6.0, actual: 4.1 },
    { dept: "HR",             budget: 1.5, actual: 1.2 },
    { dept: "Logistics",      budget: 1.8, actual: 1.2 },
    { dept: "Administration", budget: 1.0, actual: 0.7 },
    { dept: "Finance",        budget: 0.9, actual: 0.5 },
  ];
  const DEPT_META = {
    "Marketing":      { prev: 4.02, trend: [0.3, 0.5, 0.45, 0.55, 0.6, 0.62] },
    "Operations":     { prev: 5.55, trend: [-1.9, -2.1, -2.3, -2.5, -2.6, -2.7] },
    "Technology":     { prev: 3.88, trend: [-1.6, -1.7, -1.8, -1.85, -1.88, -1.9] },
    "HR":             { prev: 1.12, trend: [-0.2, -0.22, -0.24, -0.26, -0.28, -0.3] },
    "Logistics":      { prev: 1.14, trend: [-0.5, -0.52, -0.55, -0.57, -0.58, -0.6] },
    "Administration": { prev: 0.66, trend: [-0.2, -0.24, -0.26, -0.28, -0.29, -0.3] },
    "Finance":        { prev: 0.47, trend: [-0.3, -0.32, -0.35, -0.37, -0.38, -0.4] },
  };
  function deptStatus(b) {
    const u = b.actual / b.budget * 100;
    if (u > 100) return { key: "over", label: "Over Budget", cls: "bad" };
    if (u >= 95) return { key: "watch", label: "Watch", cls: "warn" };
    return { key: "ok", label: "On Track", cls: "ok" };
  }
  BUDGETS.forEach(b => { b.variance = +(b.actual - b.budget).toFixed(2); b.util = b.actual / b.budget * 100; b.status = deptStatus(b); b.prev = DEPT_META[b.dept].prev; b.trend = DEPT_META[b.dept].trend; });
  const BUD_TOTAL = {
    budget: BUDGETS.reduce((s, b) => s + b.budget, 0),   // 23.8
    actual: BUDGETS.reduce((s, b) => s + b.actual, 0),   // 18.2
  };
  BUD_TOTAL.remaining = +(BUD_TOTAL.budget - BUD_TOTAL.actual).toFixed(2); // 5.6
  BUD_TOTAL.util = BUD_TOTAL.actual / BUD_TOTAL.budget * 100;             // 76.4
  BUD_TOTAL.over = BUDGETS.filter(b => b.status.key === "over").length;   // 1

  /* ---------- expense categories (₹ lakh, T12M = 1,820) ---------- */
  const EXP_CATS = [
    { name: "Salaries",        val: 540, prev: 505 },
    { name: "Marketing",       val: 460, prev: 402 },
    { name: "Technology",      val: 280, prev: 261 },
    { name: "Logistics",       val: 240, prev: 225 },
    { name: "Operations",      val: 180, prev: 168 },
    { name: "Infrastructure",  val: 50,  prev: 44 },
    { name: "Office",          val: 30,  prev: 29 },
    { name: "Other",           val: 40,  prev: 50 },
  ];
  EXP_CATS.forEach(c => { c.share = c.val / last12.exp * 100; c.growth = PCT(c.val, c.prev); });

  /* ---------- products (revenue ₹ lakh, sums to category totals) ---------- */
  const PRODUCTS = [
    // Electronics 770
    { name: "Wireless Headphones", cat: "Electronics", rev: 185, margin: 34.2, growth: 38.0, units: 58200 },
    { name: "55\" 4K Smart TV", cat: "Electronics", rev: 165, margin: 17.8, growth: -12.0, units: 9800 },
    { name: "Gaming Laptop 15.6\"", cat: "Electronics", rev: 145, margin: 22.4, growth: 24.0, units: 3150 },
    { name: "Smartwatch Pro", cat: "Electronics", rev: 125, margin: 36.1, growth: 31.0, units: 47800 },
    { name: "Noise-Cancel Earbuds", cat: "Electronics", rev: 110, margin: 35.6, growth: 27.0, units: 52300 },
    { name: "Action Camera 4K", cat: "Electronics", rev: 40, margin: 20.5, growth: 9.0, units: 2900 },
    // Home Appliances 460
    { name: "260L Double-Door Fridge", cat: "Home Appliances", rev: 140, margin: 16.4, growth: 11.0, units: 2150 },
    { name: "10kg Front-Load Washing Machine", cat: "Home Appliances", rev: 115, margin: 18.9, growth: 14.0, units: 1980 },
    { name: "1.5T 5★ Inverter AC", cat: "Home Appliances", rev: 95, margin: 15.8, growth: 8.0, units: 1640 },
    { name: "HEPA Air Purifier", cat: "Home Appliances", rev: 60, margin: 28.4, growth: 38.0, units: 4100 },
    { name: "Induction Cooktop 2I", cat: "Home Appliances", rev: 50, margin: 24.7, growth: 6.0, units: 8600 },
    // Fashion 410
    { name: "Slim-Fit Jeans", cat: "Fashion", rev: 118, margin: 26.3, growth: -5.0, units: 96400 },
    { name: "Casual Sneakers", cat: "Fashion", rev: 112, margin: 28.9, growth: -4.0, units: 33200 },
    { name: "Cotton Tee Bundle (3)", cat: "Fashion", rev: 96, margin: 30.2, growth: -7.5, units: 68900 },
    { name: "Winter Jacket", cat: "Fashion", rev: 84, margin: 23.6, growth: -22.0, units: 11800 },
    // Beauty 310
    { name: "Vitamin-C Serum 30ml", cat: "Beauty", rev: 92, margin: 44.6, growth: 22.0, units: 71200 },
    { name: "Matte Lipstick Set", cat: "Beauty", rev: 78, margin: 46.8, growth: -9.0, units: 52400 },
    { name: "Hair Care Ritual Kit", cat: "Beauty", rev: 74, margin: 41.2, growth: 19.0, units: 28600 },
    { name: "SPF 50 Sunscreen", cat: "Beauty", rev: 66, margin: 43.4, growth: 25.0, units: 61800 },
    // Furniture 260
    { name: "3-Seater Fabric Sofa", cat: "Furniture", rev: 95, margin: 14.2, growth: 7.0, units: 740 },
    { name: "Ergonomic Office Chair", cat: "Furniture", rev: 80, margin: 19.6, growth: 13.0, units: 1480 },
    { name: "Oak Dining Table", cat: "Furniture", rev: 60, margin: 12.8, growth: -7.0, units: 310 },
    { name: "Bedside Table Pair", cat: "Furniture", rev: 25, margin: 18.4, growth: 4.0, units: 690 },
    // Accessories 350
    { name: "Leather Wallet", cat: "Accessories", rev: 98, margin: 39.4, growth: 4.0, units: 88400 },
    { name: "Canvas Tote Bag", cat: "Accessories", rev: 88, margin: 41.8, growth: 6.0, units: 74200 },
    { name: "Steel Bottle 1L", cat: "Accessories", rev: 76, margin: 36.2, growth: 3.0, units: 98600 },
    { name: "Digital Watch", cat: "Accessories", rev: 56, margin: 25.7, growth: 8.0, units: 15300 },
    { name: "Polarized Sunglasses", cat: "Accessories", rev: 32, margin: 31.9, growth: -11.0, units: 21500 },
  ];
  PRODUCTS.forEach(p => {
    p.profit = p.rev * p.margin / 100;
    p.cost = p.rev - p.profit;
    p.unitsRev = p.rev * 1e5 / p.units;               // ₹ per unit
    p.orders = Math.round(p.units * 0.86);            // ~86% of units are distinct orders
  });

  /* ---------- transactions (deterministic sample extract) ---------- */
  const DEPTS_TXN = ["Sales", "Sales", "Sales", "Sales", "Sales", "Sales", "Sales", "Sales", "Marketing", "Operations"];
  const TXN_STATUS = ["Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Pending", "Pending", "Pending", "Pending", "Pending", "Refunded", "Refunded", "Refunded", "Cancelled", "Cancelled"];
  function genTransactions(n) {
    const rnd = mulberry32(20261004);
    const pool = [];
    PRODUCTS.forEach(p => { for (let i = 0; i < Math.max(2, Math.round(p.rev / 12)); i++) pool.push(p); });
    const regionW = ["South", "South", "South", "South", "West", "West", "West", "West", "North", "North", "North", "East"];
    const txns = [];
    for (let i = 0; i < n; i++) {
      const p = pool[Math.floor(rnd() * pool.length)];
      const m = 18 + Math.floor(rnd() * 12);          // Oct-25 → Sep-26
      const day = 1 + Math.floor(rnd() * 28);
      const date = new Date(MONTHS[m].replace("-24", "-2024").replace("-25", "-2025").replace("-26", "-2026"), 0, 1);
      const mi = MONTHS[m];
      const dt = mi.split("-");
      const y = 2000 + parseInt(dt[1], 10);
      const mo = { Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11, Jan: 0, Feb: 1, Mar: 2 }[dt[0]];
      const bulk = rnd() < 0.06;
      const amount = bulk ? 60000 + rnd() * 240000 : 900 + rnd() * 6200;
      const rev = Math.round(amount);
      const marginJ = p.margin * (0.82 + rnd() * 0.36);
      const cost = Math.round(rev * (1 - marginJ / 100));
      txns.push({
        id: "TXN-" + (10001 + i * 3 + Math.floor(rnd() * 2)),
        date: `${String(day).padStart(2, "0")} ${mi.split("-")[0]} ${y}`,
        product: p.name, category: p.cat, region: regionW[Math.floor(rnd() * regionW.length)],
        dept: DEPTS_TXN[Math.floor(rnd() * DEPTS_TXN.length)],
        revenue: rev, cost, profit: rev - cost,
        status: TXN_STATUS[Math.floor(rnd() * TXN_STATUS.length)],
      });
    }
    txns.sort((a, b) => (a.date < b.date ? 1 : -1));
    return txns;
  }
  const TRANSACTIONS = genTransactions(240);

  /* ---------- forecast (₹ lakh) ----------
     Historical through Sep-26; forecast Oct-26 → Sep-27 (12 mo) = 2,940 L */
  const FC_MONTHS = ["Oct-26","Nov-26","Dec-26","Jan-27","Feb-27","Mar-27","Apr-27","May-27","Jun-27","Jul-27","Aug-27","Sep-27"];
  const FC_BASE = [278, 295, 300, 265, 256, 258, 200, 198, 212, 208, 215, 255]; // Σ 2,940
  const FC_OPT = FC_BASE.map(v => Math.round(v * 1.035));
  const FC_CON = FC_BASE.map(v => Math.round(v * 0.962));
  const FC_BAND_L = FC_BASE.map((v, i) => Math.round(v * (1 - (0.05 + i * 0.005))));
  const FC_BAND_U = FC_BASE.map((v, i) => Math.round(v * (1 + (0.05 + i * 0.005))));
  const FC = {
    total: sum(FC_BASE, 0, 12),            // 2940 L = ₹29.4 Cr
    growth: PCT(sum(FC_BASE, 0, 12), last12.rev), // +14.8%
    h2: sum(FC_BASE, 0, 6),
    bandH2L: sum(FC_BAND_L, 0, 6), bandH2U: sum(FC_BAND_U, 0, 6),
    optTotal: sum(FC_OPT, 0, 12), conTotal: sum(FC_CON, 0, 12),
    mae: "₹0.9 L", rmse: "₹1.4 L", mape: 5.8,
    train: "Jan 2023 – Sep 2026", horizon: "Oct 2026 – Mar 2027",
  };
  FC.confRange = [sum(FC_BAND_L, 0, 12) + 0, sum(FC_BAND_U, 0, 12)].map(v => v);

  /* ---------- P&L (₹ Cr) — T12M vs prior T12M ----------
     Rev 25.60 − COGS&Fulfil 9.40 = GP 16.20 − Opex 8.80 = NP 7.40 (28.9%) */
  const PL = {
    current: {
      revenue: { label: "Product Revenue", v: 22.40 },
      service: { label: "Service Revenue", v: 1.80 },
      other: { label: "Other Revenue", v: 1.40 },
      totalRevenue: 25.60,
      cogs: 9.40, grossProfit: 16.20,
      opex: { "Marketing": 4.60, "Technology": 1.80, "HR": 1.20, "Administration": 0.70, "Finance": 0.50 },
      opexTotal: 8.80, operatingProfit: 7.40,
      otherIncome: 0.20, otherExpense: 0.20, netProfit: 7.40,
    },
    prior: {
      revenue: { label: "Product Revenue", v: 19.90 },
      service: { label: "Service Revenue", v: 1.55 },
      other: { label: "Other Revenue", v: 1.33 },
      totalRevenue: 22.78,
      cogs: 8.30, grossProfit: 14.48,
      opex: { "Marketing": 4.35, "Technology": 1.82, "HR": 1.18, "Administration": 0.68, "Finance": 0.49 },
      opexTotal: 8.52, operatingProfit: 5.96,
      otherIncome: 0.15, otherExpense: 0.15, netProfit: 5.96,
    },
  };
  PL.current.gm = PL.current.grossProfit / PL.current.totalRevenue * 100;   // 63.3%
  PL.current.nm = PL.current.netProfit / PL.current.totalRevenue * 100;     // 28.9%
  PL.prior.gm = PL.prior.grossProfit / PL.prior.totalRevenue * 100;
  PL.prior.nm = PL.prior.netProfit / PL.prior.totalRevenue * 100;

  /* ---------- insights (explainable, metric-backed) ---------- */
  const INSIGHTS = [
    { id: 1, type: "budget", sev: "high", title: "Marketing spending is 15.0% above its approved budget",
      what: "Marketing actuals reached ₹4.6 Cr against a ₹4.0 Cr approved envelope.",
      why: "It pushed the department ₹0.6 Cr over budget — the only department above plan.",
      metric: { k: "Budget variance", v: "+₹0.6 Cr (115.0% utilization)" },
      action: "Review campaign-level ROI and compare incremental reach before approving further spend.",
      time: "Today, 09:12", link: "#/variance" },
    { id: 2, type: "revenue", sev: "high", title: "Fashion is the only declining category (−6.5%)",
      what: "Fashion revenue fell from ₹4.39 Cr to ₹4.10 Cr period-over-period.",
      why: "A ₹0.29 Cr drag on total growth; Winter Jacket (−22%) is the largest contributor.",
      metric: { k: "Category revenue", v: "₹4.10 Cr · −6.5% vs prior" },
      action: "Review seasonal assortment and consider a markdown plan to clear slow-moving stock.",
      time: "Today, 08:40", link: "#/revenue" },
    { id: 3, type: "revenue", sev: "medium", title: "Electronics up 30.0% — Wireless Headphones is the top product",
      what: "Electronics grew from ₹5.92 Cr to ₹7.70 Cr; Wireless Headphones alone contributed ₹1.85 Cr.",
      why: "Headphones (38.0% growth, 34.2% margin) are now 7.2% of total revenue.",
      metric: { k: "Product revenue", v: "₹1.85 Cr · 34.2% margin" },
      action: "Secure inventory cover for the Oct–Dec festive window and test a premium SKU.",
      time: "Yesterday, 18:22", link: "#/products" },
    { id: 4, type: "forecast", sev: "low", title: "October 2026 forecast revised +0.9% after September data",
      what: "September actuals (₹2.66 Cr) beat model expectations, nudging the October point forecast up to ₹2.78 Cr.",
      why: "Model MAPE remains 5.8%; confidence interval for Oct–Mar is ₹15.3 – 18.1 Cr.",
      metric: { k: "Forecast (Oct-26)", v: "₹2.78 Cr · CI ±5.0%" },
      action: "No action required — monitor post-Diwali run-rate in early December.",
      time: "Yesterday, 14:05", link: "#/forecast" },
    { id: 5, type: "expense", sev: "medium", title: "Logistics cost per order up 6.2% while AOV grew 2.1%",
      what: "Logistics spend rose from ₹2.25 Cr to ₹2.40 Cr; cost per order reached ₹173 (from ₹163).",
      why: "Fulfilment cost growth outpacing order value growth compresses margin by ~0.4 pp.",
      metric: { k: "Cost per order", v: "₹173 · +6.2%" },
      action: "Review last-mile routing in North region and zone-based rate cards.",
      time: "Oct 2, 11:47", link: "#/expenses" },
    { id: 6, type: "regional", sev: "medium", title: "East region margin is 4.7 pp below company average",
      what: "East margin is 24.2% vs 28.9% company average on ₹3.60 Cr revenue.",
      why: "Promotion-heavy category mix (41% of East orders include a discount).",
      metric: { k: "Region margin", v: "24.2% vs 28.9% avg" },
      action: "Rebalance promo budget toward Electronics and Beauty in East.",
      time: "Oct 1, 16:30", link: "#/regions" },
    { id: 7, type: "product", sev: "high", title: "Winter Jacket declining 22.0% — seasonal wind-down",
      what: "Winter Jacket revenue fell from ₹1.08 Cr to ₹84 L; units sold down 18%.",
      why: "Seasonal exit is expected, but remaining inventory is 2.4× the trailing 3-month sell-through.",
      metric: { k: "Inventory cover", v: "2.4× (target ≤ 1.5×)" },
      action: "Schedule a 20–25% markdown after the festive peak to release working capital.",
      time: "Sep 30, 10:12", link: "#/products" },
    { id: 8, type: "data", sev: "low", title: "Last import quarantined 60 duplicate records (0.5%)",
      what: "The Sep-28 revenue import contained 38 duplicate transaction IDs and 22 near-duplicates.",
      why: "Duplicates were quarantined automatically; no impact on reported figures.",
      metric: { k: "Quarantined", v: "60 of 12,450 records" },
      action: "Ask the ERP team to enable dedup on the nightly feed.",
      time: "Sep 28, 22:04", link: "#/data" },
  ];

  /* ---------- alerts / exceptions ---------- */
  const ALERTS = [
    { id: "AL-1042", sev: "critical", cat: "Budget", title: "Marketing exceeded approved budget (115.0%)", desc: "Actual ₹4.6 Cr vs ₹4.0 Cr plan — ₹0.6 Cr over.", time: "Today, 09:12", status: "New", owner: "—" },
    { id: "AL-1041", sev: "high", cat: "Revenue", title: "Fashion revenue down 6.5% period-over-period", desc: "Only category below prior period; ₹0.29 Cr drag.", time: "Today, 08:40", status: "New", owner: "—" },
    { id: "AL-1040", sev: "high", cat: "Expense", title: "Logistics cost spike in North region (+9.4%)", desc: "North logistics spend ₹0.31 Cr vs ₹0.28 Cr prior month.", time: "Oct 2, 11:52", status: "Acknowledged", owner: "R. Mehta" },
    { id: "AL-1039", sev: "medium", cat: "Margin", title: "Furniture margin down 1.8 pp", desc: "Oak Dining Table discounting raised COGS share.", time: "Oct 1, 16:44", status: "Investigating", owner: "K. Nair" },
    { id: "AL-1038", sev: "medium", cat: "Forecast", title: "Forecast deviation: July-26 actuals below model (−3.2%)", desc: "Model expected ₹2.10 Cr; actual ₹2.02 Cr.", time: "Sep 29, 09:31", status: "Acknowledged", owner: "K. Nair" },
    { id: "AL-1037", sev: "high", cat: "Data Quality", title: "Duplicate transaction IDs in Sep-28 import", desc: "38 exact + 22 near-duplicates quarantined.", time: "Sep 28, 22:04", status: "Resolved", owner: "A. Reddy" },
    { id: "AL-1036", sev: "low", cat: "Data Quality", title: "Missing region on 42 imported records", desc: "Defaults applied from shipping address lookup.", time: "Sep 28, 22:04", status: "Resolved", owner: "A. Reddy" },
    { id: "AL-1035", sev: "medium", cat: "Budget", title: "HR run-rate trending to 96% by year-end", desc: "If current pace holds, HR will breach the ₹1.5 Cr plan.", time: "Sep 26, 15:20", status: "Resolved", owner: "R. Mehta" },
    { id: "AL-1034", sev: "low", cat: "Revenue", title: "East region growth slowing (7.0% vs 9.5% prior)", desc: "Watch item — no threshold breached.", time: "Sep 24, 10:02", status: "Resolved", owner: "K. Nair" },
    { id: "AL-1033", sev: "high", cat: "Expense", title: "Marketing spend spike: Sep campaign +₹0.9 Cr MoM", desc: "Festive campaign outspend; now within monthly plan.", time: "Sep 20, 13:18", status: "Resolved", owner: "R. Mehta" },
  ];

  /* ---------- notifications ---------- */
  const NOTIFS = [
    { id: 1, type: "bad", icon: "alert", title: "Budget Alert", body: "Marketing exceeded its approved budget (₹4.6 Cr vs ₹4.0 Cr).", time: "Today, 09:12", read: false, link: "#/budgets" },
    { id: 2, type: "info", icon: "trending", title: "Forecast Updated", body: "October 2026 revenue forecast is now available: ₹2.78 Cr (CI ±5%).", time: "Yesterday, 14:05", read: false, link: "#/forecast" },
    { id: 3, type: "ok", icon: "db", title: "Data Import Complete", body: "12,210 records successfully imported · 60 quarantined.", time: "Yesterday, 10:31", read: false, link: "#/data" },
    { id: 4, type: "ok", icon: "report", title: "Report Ready", body: "September P&L statement is ready to download.", time: "Sep 30, 08:00", read: true, link: "#/reports" },
    { id: 5, type: "warn", icon: "trending-down", title: "Revenue Decline", body: "Fashion category down 6.5% — only category below prior period.", time: "Sep 29, 09:31", read: true, link: "#/insights" },
    { id: 6, type: "info", icon: "shield", title: "Session Security", body: "New sign-in from Hyderabad, IN · Chrome on Windows.", time: "Sep 28, 18:44", read: true, link: "#/settings" },
  ];

  /* ---------- reports ---------- */
  const REPORTS = [
    { id: "pl", icon: "scale", tint: "navy", name: "Profit & Loss", desc: "Full P&L statement with period comparison, gross and net margin.", last: "Sep 30, 2026", owner: "Finance", fmt: "PDF · XLSX", view: "#/pl" },
    { id: "rev", icon: "trending", tint: "blue", name: "Revenue Report", desc: "Revenue by month, category, region and product with growth.", last: "Sep 30, 2026", owner: "Finance", fmt: "PDF · XLSX · CSV", view: "#/revenue" },
    { id: "exp", icon: "wallet", tint: "amber", name: "Expense Report", desc: "Expense breakdown by category, department and region.", last: "Sep 30, 2026", owner: "Finance", fmt: "PDF · XLSX · CSV", view: "#/expenses" },
    { id: "bud", icon: "piggy", tint: "green", name: "Budget Report", desc: "Approved budget vs actual by department with utilization.", last: "Sep 28, 2026", owner: "Finance", fmt: "PDF · XLSX", view: "#/budgets" },
    { id: "dpt", icon: "users", tint: "violet", name: "Department Performance", desc: "Cost, variance and trend per department against plan.", last: "Sep 28, 2026", owner: "Ops", fmt: "PDF · XLSX", view: "#/variance" },
    { id: "reg", icon: "map", tint: "teal", name: "Regional Performance", desc: "Revenue, margin, orders and growth for North, South, East, West.", last: "Sep 30, 2026", owner: "Sales", fmt: "PDF · XLSX", view: "#/regions" },
    { id: "exec", icon: "star", tint: "navy", name: "Executive Summary", desc: "Board-ready one-pager: KPIs, health, exceptions and outlook.", last: "Oct 1, 2026", owner: "CFO Office", fmt: "PDF", view: "#/dashboard" },
  ];

  /* ---------- data sources ---------- */
  const SOURCES = [
    { name: "POS Transactions", icon: "card", records: "482,340", last: "Today, 02:00", fresh: "ok", desc: "In-store point-of-sale feed" },
    { name: "E-commerce Orders", icon: "cart", records: "611,208", last: "Today, 02:15", fresh: "ok", desc: "Online marketplace + D2C" },
    { name: "ERP Expenses", icon: "db", records: "118,442", last: "Yesterday, 23:40", fresh: "ok", desc: "General ledger expense lines" },
    { name: "Budget Plan", icon: "piggy", records: "336", last: "Sep 28, 11:20", fresh: "warn", desc: "Approved FY 2026-27 plan" },
    { name: "Product Master", icon: "box", records: "1,284", last: "Oct 2, 09:05", fresh: "ok", desc: "SKU, category, pricing" },
    { name: "POS Gateway (legacy)", icon: "plug", records: "69,912", last: "Sep 29, 04:10", fresh: "bad", desc: "Legacy terminal feed — sync failing" },
  ];

  /* ---------- audit log (seed) ---------- */
  let AUDIT = [
    { time: "Oct 3, 16:42", user: "Rohit Mehta", role: "Finance Manager", action: "Updated Marketing Budget", entity: "Budget · Marketing", prev: "₹4.0 Cr", next: "₹4.5 Cr", status: "Approved" },
    { time: "Oct 3, 11:20", user: "A. Reddy", role: "Administrator", action: "Imported data", entity: "Data · Revenue", prev: "—", next: "12,210 records", status: "Success" },
    { time: "Oct 2, 15:03", user: "Kavya Nair", role: "Business Analyst", action: "Re-ran forecast", entity: "Forecast · Model v4.2", prev: "MAPE 6.1%", next: "MAPE 5.8%", status: "Success" },
    { time: "Oct 2, 10:48", user: "Rohit Mehta", role: "Finance Manager", action: "Acknowledged alert", entity: "AL-1040 · Logistics spike", prev: "New", next: "Acknowledged", status: "Done" },
    { time: "Oct 1, 09:31", user: "Ananya Iyer", role: "CFO", action: "Approved executive summary", entity: "Report · Executive Summary", prev: "Draft", next: "Approved", status: "Approved" },
    { time: "Sep 30, 14:12", user: "A. Reddy", role: "Administrator", action: "Changed financial threshold", entity: "Settings · Variance", prev: "±4%", next: "±5%", status: "Saved" },
    { time: "Sep 29, 18:26", user: "Kavya Nair", role: "Business Analyst", action: "Exported report", entity: "Report · Revenue (CSV)", prev: "—", next: "All data", status: "Success" },
    { time: "Sep 28, 22:04", user: "System", role: "Automated", action: "Quarantined duplicates", entity: "Import · Sep-28 revenue", prev: "12,450", next: "12,390 clean", status: "Auto" },
  ];

  /* ---------- formatters (INR: Cr = crore, L = lakh) ---------- */
  const fmt = {
    cr(l, dp) { // lakh → display
      const d = dp == null ? (l >= 100 ? 1 : 2) : dp;
      return l >= 100 ? "₹" + (l / 100).toFixed(d).replace(/\.0+$/, "") + " Cr" : "₹" + l.toFixed(d) + " L";
    },
    crSign(l, dp) {
      const s = l > 0 ? "+" : l < 0 ? "−" : "";
      return s + fmt.cr(Math.abs(l), dp);
    },
    inr(n) { return "₹" + Math.round(n).toLocaleString("en-IN"); },
    pct(v, dp) { return (v == null || isNaN(v)) ? "—" : v.toFixed(dp == null ? 1 : dp) + "%"; },
    pctSign(v, dp) { const s = v > 0 ? "+" : v < 0 ? "−" : ""; return s + Math.abs(v).toFixed(dp == null ? 1 : dp) + "%"; },
    pp(v, dp) { const s = v > 0 ? "+" : v < 0 ? "−" : ""; return s + Math.abs(v).toFixed(dp == null ? 1 : dp) + " pp"; },
    num(n, dp) { return Number(n).toLocaleString("en-IN", { maximumFractionDigits: dp == null ? 0 : dp }); },
    lakh(n, dp) { return n.toFixed(dp == null ? 2 : dp) + " L"; },
    crExact(l) { return "₹" + (l / 100).toFixed(2) + " Cr"; },
  };

  /* ---------- product / revenue helpers ---------- */
  function productByName(n) { return PRODUCTS.find(p => p.name === n); }
  function catColor(name) { return CAT_COLOR[CATEGORIES.findIndex(c => c.name === name)] || "#8593A9"; }

  window.AV = window.AV || {};
  window.AV.pages = window.AV.pages || {};
  window.AV = Object.assign(window.AV, {
    MONTHS, REV, EXP, PROF, PERIODS, windowData, PCT, sum,
    LATEST, CATEGORIES, CAT_COLOR, REGIONS, BUDGETS, BUD_TOTAL, EXP_CATS,
    PRODUCTS, TRANSACTIONS, FC, FC_MONTHS, FC_BASE, FC_OPT, FC_CON, FC_BAND_L, FC_BAND_U, PL, INSIGHTS, ALERTS, NOTIFS,
    REPORTS, SOURCES, fmt, catColor, productByName,
    getAudit: () => AUDIT,
    logAudit(entry) { AUDIT.unshift({ status: "Saved", prev: "—", next: "—", ...entry }); },
  });
})();
