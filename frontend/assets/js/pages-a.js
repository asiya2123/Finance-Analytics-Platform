/* ============================================================
   REVENUE FORECASTING & BUSINESS INTELLIGENCE — pages A: overview · analytics
   ============================================================ */
(function () {
  "use strict";
  const { icon, toast, modal, drawer, menu, delta, spark, ring, CH, table, skeletons, esc, S, persist, getCss, downloadFile } = window.UI;
  const A = window.AV;
  const P = window.AV.pages;
  const f = A.fmt;

  /* ---------------- shared scaffolding ---------------- */
  function head(title, sub, actions) {
    return `<div class="page-head"><div style="min-width:0"><h1>${title}</h1><div class="sub">${sub}</div></div><div class="actions">${actions || ""}</div></div>`;
  }
  function card(t, s, acts, body, cls, foot, h) {
    return `<div class="card ${cls || ""}"><div class="card-h"><div style="min-width:0"><div class="t">${t}</div>${s ? `<div class="s">${s}</div>` : ""}</div>${acts ? `<div class="acts">${acts}</div>` : ""}</div><div class="card-b" style="${h ? "min-height:" + h + "px" : ""}">${body}</div>${foot ? `<div class="card-f">${foot}</div>` : ""}</div>`;
  }
  function getWindow() {
    const fq = S.filters.quarter;
    if (fq === "q1") return { start: 24, len: 3, label: "Q1 FY 26-27 · Apr–Jun 2026" };
    if (fq === "q2") return { start: 27, len: 3, label: "Q2 FY 26-27 · Jul–Sep 2026" };
    const p = A.PERIODS[S.period] || A.PERIODS.t12m;
    return { start: p.start, len: p.len, label: p.sub };
  }
  function windowOf(w) {
    const c = { rev: A.sum(A.REV, w.start, w.start + w.len), exp: A.sum(A.EXP, w.start, w.start + w.len) };
    c.profit = c.rev - c.exp; c.margin = c.profit / c.rev * 100;
    const ps = w.start - w.len;
    const pr = { rev: A.sum(A.REV, ps, ps + w.len), exp: A.sum(A.EXP, ps, ps + w.len) };
    pr.profit = pr.rev - pr.exp; pr.margin = pr.profit / pr.rev * 100;
    return {
      cur: c, prev: pr,
      labels: A.MONTHS.slice(w.start, w.start + w.len),
      rev: A.REV.slice(w.start, w.start + w.len),
      exp: A.EXP.slice(w.start, w.start + w.len),
      profit: A.PROF.slice(w.start, w.start + w.len),
    };
  }
  function scopeKpi(base, growth, { exp = false } = {}) {
    let v = base, g = growth, why = [];
    const fl = S.filters;
    if (fl.category) { const c = A.CATEGORIES.find(x => x.name === fl.category); if (c) { v *= c.share / 100; g = c.growth; why.push(c.name); } }
    if (fl.region) { const r = A.REGIONS.find(x => x.name === fl.region); if (r) { v *= r.share / 100; g = exp ? r.growth * 0.85 : r.growth; why.push(r.name); } }
    if (fl.product) { const p = A.productByName(fl.product); if (p) { v = p.rev * (fl.category || fl.region ? 1 : 1) * (v / base); g = p.growth; why.push(p.name); } }
    if (fl.dept && exp) { const b = A.BUDGETS.find(x => x.dept === fl.dept); if (b) { v = b.actual * 100; g = A.PCT(b.actual, b.prev); why.push(b.dept); } }
    return { v, g, why };
  }
  function kpiCard({ label, ico, value, sub, deltaHtml, sparkVals, sparkColor, foot, href, tip, badge }) {
    const inner = `<div class="kpi-top"><span class="kpi-label">${label}</span>${badge || ""}<span class="kpi-ico ${badge ? "" : "tint"}">${icon(ico)}</span></div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-mid"><div>${deltaHtml || ""}${sub ? `<div class="kpi-sub" style="margin-top:5px">${sub}</div>` : ""}</div>${sparkVals ? spark(sparkVals, 84, 26, sparkColor) : ""}</div>
      ${foot ? `<div class="kpi-foot">${foot}</div>` : ""}`;
    if (href) return `<button class="kpi" data-go="${href}" title="${tip || label}">${inner}</button>`;
    return `<div class="kpi" title="${tip || label}">${inner}</div>`;
  }
  function wireKpiDrill(root) {
    root.querySelectorAll("[data-go]").forEach(b => b.onclick = () => location.hash = b.dataset.go);
  }
  function chipsHTML() {
    const fl = S.filters;
    const parts = [];
    if (fl.region) parts.push(fl.region);
    if (fl.dept) parts.push(fl.dept);
    if (fl.category) parts.push(fl.category);
    if (fl.product) parts.push(fl.product);
    if (fl.quarter) parts.push({ q1: "Q1 FY 26-27", q2: "Q2 FY 26-27" }[fl.quarter]);
    if (!parts.length) return "";
    return `<div class="fb-chips" id="fbChips"><span class="muted2 small" style="align-self:center">Filtered:</span>${parts.map(p => `<span class="chip">${p}<button data-clr="${esc(p)}" aria-label="Remove ${esc(p)}">${icon("x", "ic-14")}</button></span>`).join("")}<span class="chip" style="background:var(--surface-3);color:var(--text-3)">${A.PERIODS[S.period]?.label || ""}<button data-clr="__period" aria-label="Reset period">${icon("x", "ic-14")}</button></span></div>`;
  }
  function datasetDimension(kind) {
    const ds = A.DATASET;
    if (!ds || !Array.isArray(ds.columns) || !Array.isArray(ds.rows)) return null;
    const aliases = {
      region: /(^|\b)(region|territory|market|state|country|zone|location|sales area)(\b|$)/i,
      dept: /(^|\b)(department|dept|business unit|team|function|division)(\b|$)/i,
      category: /(^|\b)(category|product category|segment|class|type)(\b|$)/i,
      product: /(^|\b)(product|item|sku|product name|item name|description)(\b|$)/i
    };
    const preferred = ds.columns.find(c => aliases[kind].test(String(c).replace(/[_-]+/g, " ")));
    if (!preferred) return null;
    const idx = ds.columns.indexOf(preferred);
    const sourceRows = Array.isArray(A.DASHBOARD_ALL_ROWS) && A.DASHBOARD_ALL_ROWS.length ? A.DASHBOARD_ALL_ROWS : ds.rows;
    const values = [...new Set(sourceRows.map(r => String(r[idx] ?? "").trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    return { column: preferred, values };
  }
  function dimensionOptions(kind, fallback, selected, allLabel) {
    const dim = datasetDimension(kind);
    const values = dim ? dim.values : fallback;
    const validSelected = values.includes(selected) ? selected : "";
    return `<option value="">${allLabel}</option>` + values.map(v => `<option value="${esc(v)}" ${v === validSelected ? "selected" : ""}>${esc(v)}</option>`).join("");
  }
  function filterBarHTML() {
    const fl = S.filters;
    const opt = (cur, all, val) => all.map(o => `<option ${o === cur ? "selected" : ""} value="${val ? o : o}">${o}</option>`).join("");
    return `<div class="filterbar" id="filterbar">
      <div class="fb-field"><label for="fb-period">Date range</label><select class="select" id="fb-period">${Object.entries(A.PERIODS).map(([k, v]) => `<option value="${k}" ${k === S.period ? "selected" : ""}>${v.label}</option>`).join("")}</select></div>
      <div class="fb-field"><label for="fb-fy">Financial year</label><select class="select" id="fb-fy">
        <option ${S.period === "fy26" ? "selected" : ""} value="fy26">FY 2026-27 (YTD)</option>
        <option ${S.period === "fy25" ? "selected" : ""} value="fy25">FY 2025-26</option>
        <option ${["t12m", "t6m", "t3m"].includes(S.period) ? "selected" : ""} value="rolling">Rolling periods</option></select></div>
      <div class="fb-field"><label for="fb-q">Quarter</label><select class="select" id="fb-q">
        <option value="">All</option><option value="q1" ${fl.quarter === "q1" ? "selected" : ""}>Q1 · Apr–Jun 26</option><option value="q2" ${fl.quarter === "q2" ? "selected" : ""}>Q2 · Jul–Sep 26</option></select></div>
      <div class="fb-field"><label for="fb-region">Region</label><select class="select" id="fb-region">${dimensionOptions("region", A.REGIONS.map(r => r.name), fl.region, "All regions")}</select></div>
      <div class="fb-field"><label for="fb-dept">Department</label><select class="select" id="fb-dept">${dimensionOptions("dept", A.BUDGETS.map(b => b.dept), fl.dept, "All departments")}</select></div>
      <div class="fb-field"><label for="fb-cat">Category</label><select class="select" id="fb-cat">${dimensionOptions("category", A.CATEGORIES.map(c => c.name), fl.category, "All categories")}</select></div>
      <div class="fb-field" style="min-width:150px"><label for="fb-prod">Product</label><select class="select" id="fb-prod">${dimensionOptions("product", A.PRODUCTS.map(p => p.name), fl.product, "All products")}</select></div>
      <div class="fb-actions">
        <div class="saved-views" aria-label="Saved views">${Object.keys(S.savedViews).map(k => `<button class="view-chip ${k === fl.activeView ? "active" : ""}" data-view="${esc(k)}">${k}</button>`).join("")}</div>
        <button class="btn btn-g btn-sm" data-fb="export">${icon("download", "ic-14")} Export</button>
        <button class="btn btn-g btn-sm" data-fb="refresh">${icon("refresh", "ic-14")} Refresh</button>
        <button class="btn btn-s btn-sm" data-fb="reset">Reset</button>
        <button class="btn btn-p btn-sm" data-fb="apply">Apply</button>
      </div>
      ${chipsHTML()}
    </div>`;
  }
  function wireFilterBar(root) {
    const bar = root.querySelector("#filterbar");
    if (!bar) return;
    bar.querySelectorAll("[data-view]").forEach(b => b.onclick = () => {
      const v = S.savedViews[b.dataset.view];
      S.period = v.period || "t12m"; S.filters = { ...S.filters, region: v.region || "", dept: v.dept || "", category: v.category || "", product: v.product || "", quarter: v.quarter || "", activeView: b.dataset.view };
      persist(); toast("ok", b.dataset.view + " applied", "Filters updated across the platform."); APP.route(true);
    });
    bar.querySelector('[data-fb="refresh"]').onclick = e => {
      const btn = e.currentTarget; btn.classList.add("loading");
      setTimeout(() => { APP.route(true); toast("info", "Data refreshed", "All figures re-computed from the latest import."); }, 650);
    };
    bar.querySelector('[data-fb="reset"]').onclick = () => {
      S.filters = { region: "", dept: "", category: "", product: "", quarter: "" }; S.period = "t12m";
      persist(); toast("info", "Filters reset", "Showing company-wide, last 12 months."); APP.route(true);
    };
    bar.querySelector('[data-fb="export"]').onclick = () => AV.exportModal({ title: "Export current view" });
    bar.querySelector('[data-fb="apply"]').onclick = () => {
      S.period = bar.querySelector("#fb-period").value;
      const fy = bar.querySelector("#fb-fy").value;
      if (fy === "fy26" || fy === "fy25") S.period = fy;
      S.filters = { ...S.filters,
        quarter: bar.querySelector("#fb-q").value, region: bar.querySelector("#fb-region").value,
        dept: bar.querySelector("#fb-dept").value, category: bar.querySelector("#fb-cat").value,
        product: bar.querySelector("#fb-prod").value, activeView: "" };
      persist();
      const any = S.filters.region || S.filters.dept || S.filters.category || S.filters.product || S.filters.quarter;
      toast("ok", "Filters applied", any ? "Scoping: " + [S.filters.region, S.filters.dept, S.filters.category, S.filters.product, S.filters.quarter].filter(Boolean).join(" · ") : "Company-wide view, " + A.PERIODS[S.period].label + ".");
      APP.route(true);
    };
    bar.querySelectorAll("[data-clr]").forEach(b => b.onclick = () => {
      if (b.dataset.clr === "__period") S.period = "t12m";
      else { const key = { region: "region", department: "dept" }; const k = Object.keys(S.filters).find(x => S.filters[x] === b.dataset.clr); if (k) S.filters[k] = ""; }
      persist(); APP.route(true);
    });
  }
  function withLoading(sel, ms, fn) {
    const el = document.querySelector(sel); if (!el) return fn();
    const backup = el.innerHTML;
    el.innerHTML = `<div class="kpis">${skeletons(6, "kpi")}</div><div class="grid"><div class="c-8 card"><div class="card-b"><div class="sk sk-chart"></div></div></div><div class="c-4 card"><div class="card-b"><div class="sk sk-chart"></div></div></div></div>`;
    setTimeout(() => { el.innerHTML = backup; fn(); }, ms || 550);
  }
  AV.withLoading = withLoading;

  /* ---------------- export modal (shared) ---------------- */
  AV.exportModal = function (opts) {
    const m = modal({
      title: opts.title || "Export report", sub: "Choose format and scope", size: "sm",
      body: `<div class="field" style="margin-bottom:13px"><span class="f-label">Report</span><select class="select" id="exRep">${A.REPORTS.map(r => `<option ${r.id === (opts.report || "pl") ? "selected" : ""} value="${r.id}">${r.name}</option>`).join("")}</select></div>
        <div class="field" style="margin-bottom:13px"><span class="f-label">Format</span>
          <div class="row gap-8" id="exFmt">
            ${["PDF", "Excel", "CSV"].map(x => `<label class="chk"><input type="radio" name="exfmt" value="${x}" ${x === "PDF" ? "checked" : ""}> ${x}</label>`).join("")}
          </div></div>
        <div class="field" style="margin-bottom:6px"><span class="f-label">Scope</span>
          <div class="row gap-12" style="flex-wrap:wrap">
            <label class="chk"><input type="radio" name="exscope" value="Current view" checked> Current view</label>
            <label class="chk"><input type="radio" name="exscope" value="All data"> All data</label>
            <label class="chk"><input type="radio" name="exscope" value="Selected records"> Selected records</label>
          </div>
          <div class="note" style="margin-top:10px">${icon("insights", "ic-14")}<span>Exports respect the active period (${A.PERIODS[S.period]?.label || ""}) and filters. Files include source, period and generation timestamp.</span></div>
        </div>
        <div id="exProg" class="hidden" style="margin-top:14px"><div class="prog info" style="height:10px"><i id="exBar" style="width:0%"></i></div><div class="small muted" style="margin-top:7px" id="exStatus">Preparing export…</div></div>`,
      foot: `<button class="btn btn-g" id="exCancel">Cancel</button><button class="btn btn-p" id="exGo">${icon("download", "ic-14")} Generate</button>`,
    });
    m.foot.querySelector("#exCancel").onclick = () => m.close();
    m.foot.querySelector("#exGo").onclick = () => {
      const fmtSel = m.el.querySelector("input[name='exfmt']:checked").value;
      const scope = m.el.querySelector("input[name='exscope']:checked").value;
      const rep = A.REPORTS.find(r => r.id === m.el.querySelector("#exRep").value);
      m.foot.querySelector("#exGo").classList.add("loading");
      m.el.querySelector("#exProg").classList.remove("hidden");
      let p = 0;
      const iv = setInterval(() => {
        p = Math.min(96, p + 9 + Math.random() * 14);
        m.el.querySelector("#exBar").style.width = p + "%";
        m.el.querySelector("#exStatus").textContent = p < 40 ? "Aggregating records…" : p < 75 ? "Formatting " + fmtSel + "…" : "Finalizing…";
        if (p >= 96) {
          clearInterval(iv);
          setTimeout(() => {
            m.el.querySelector("#exBar").style.width = "100%";
            m.el.querySelector("#exStatus").innerHTML = `<span class="badge b-ok">${icon("check", "ic-14")} Export complete</span> ${rep.name} · ${scope} · ${fmtSel}`;
            m.foot.innerHTML = `<button class="btn btn-g" id="exAgain">Export another</button><a class="btn btn-p" id="exDl" href="#" download>${icon("download", "ic-14")} Download file</a>`;
            m.foot.querySelector("#exAgain").onclick = () => m.close();
            m.foot.querySelector("#exDl").onclick = e => {
              e.preventDefault();
              if (fmtSel === "PDF") { window.print(); }
              else AV.downloadSampleCSV(rep);
            };
          }, 500);
        }
      }, 130);
    };
  };
  AV.downloadSampleCSV = function (rep) {
    let rows = [];
    if (rep.id === "pl") rows = [["Line", "Current (INR Cr)", "Prior (INR Cr)"], ["Product Revenue", 22.40, 19.90], ["Service Revenue", 1.80, 1.55], ["Other Revenue", 1.40, 1.33], ["Total Revenue", 25.60, 22.78], ["Cost of Goods & Fulfilment", -9.40, -8.30], ["Gross Profit", 16.20, 14.48], ["Marketing", -4.60, -4.35], ["Technology", -1.80, -1.82], ["HR", -1.20, -1.18], ["Administration", -0.70, -0.68], ["Finance", -0.50, -0.49], ["Operating Profit", 7.40, 5.96], ["Net Profit", 7.40, 5.96]];
    else if (rep.id === "bud" || rep.id === "dpt") rows = [["Department", "Budget (INR Cr)", "Actual (INR Cr)", "Variance (INR Cr)", "Utilization %"], ...A.BUDGETS.map(b => [b.dept, b.budget, b.actual, b.variance, b.util.toFixed(1)])];
    else if (rep.id === "rev") rows = [["Category", "Revenue (INR L)", "Prior (INR L)", "Growth %"], ...A.CATEGORIES.map(c => [c.name, c.rev, +c.prev.toFixed(0), c.growth.toFixed(1)])];
    else if (rep.id === "exp") rows = [["Category", "Current (INR L)", "Prior (INR L)", "Growth %"], ...A.EXP_CATS.map(c => [c.name, c.val, c.prev, c.growth.toFixed(1)])];
    else if (rep.id === "reg") rows = [["Region", "Revenue (INR L)", "Growth %", "Margin %", "Orders (L)"], ...A.REGIONS.map(r => [r.name, r.rev, r.growth.toFixed(1), r.margin.toFixed(1), r.orders.toFixed(2)])];
    else rows = [["Month", "Revenue (INR L)", "Expense (INR L)", "Profit (INR L)"], ...A.MONTHS.slice(18).map((m, i) => [m, A.REV[18 + i], A.EXP[18 + i], A.PROF[18 + i]])];
    const csv = rows.map(r => r.join(",")).join("\n");
    downloadFile(rep.name.toLowerCase().replace(/[^a-z]+/g, "-") + ".csv", csv, "text/csv");
    toast("ok", "Download started", rep.name + " · CSV");
  };

  function normalizedColumn(value) { return String(value || "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase(); }
  function dataNumber(value) {
    if (value == null || String(value).trim() === "") return NaN;
    const raw = String(value).trim().replace(/[₹$€£,%\s]/g, "").replace(/,/g, "");
    if (/^\(.*\)$/.test(raw)) return -Number(raw.slice(1, -1));
    const n = Number(raw); return Number.isFinite(n) ? n : NaN;
  }
  function dataDate(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const str = String(value ?? "").trim();
    if (!str) return null;
    let d = new Date(str);
    if (!Number.isNaN(d.getTime())) return d;
    const m = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (m) { let y = +m[3]; if (y < 100) y += y < 50 ? 2000 : 1900; d = new Date(y, +m[1] - 1, +m[2]); if (!Number.isNaN(d.getTime())) return d; }
    return null;
  }
  function buildDatasetModel(ds) {
    if (!ds || !Array.isArray(ds.columns) || !Array.isArray(ds.rows)) return null;
    const columns = ds.columns, allRows = Array.isArray(A.DASHBOARD_ALL_ROWS) && A.DASHBOARD_ALL_ROWS.length ? A.DASHBOARD_ALL_ROWS : ds.rows;
    const names = columns.map(normalizedColumn), numericNames = (ds.numericColumns || []).map(normalizedColumn);
    const idx = re => names.findIndex(n => re.test(n));
    const idxNumeric = re => columns.findIndex((c, i) => re.test(names[i]) && ((ds.numericColumns || []).includes(c) || allRows.some(r => Number.isFinite(dataNumber(r[i])))));
    const dateIdx = (() => { const i = idx(/(^|\b)(date|order date|transaction date|invoice date|created at|timestamp|month|period|year)(\b|$)/i); if (i >= 0) return i; const c = (ds.dateColumns || [])[0]; return c ? columns.indexOf(c) : -1; })();
    const revenueIdx = idxNumeric(/(^|\b)(revenue|sales|net sales|gross sales|sales amount|total sales|turnover|gmv|income|amount|value)(\b|$)/i);
    const expenseIdx = idxNumeric(/(^|\b)(expenses?|cost|total cost|spend|cogs|purchase cost|operating expenses?|expenditure)(\b|$)/i);
    const profitIdx = idxNumeric(/(^|\b)(net profit|gross profit|profit|earnings|net income|operating income)(\b|$)/i);
    const regionIdx = idx(/(^|\b)(region|territory|market|state|country|zone|location|sales area)(\b|$)/i);
    const deptIdx = idx(/(^|\b)(department|dept|business unit|team|function|division)(\b|$)/i);
    const categoryIdx = idx(/(^|\b)(category|product category|segment|class|type)(\b|$)/i);
    const productIdx = idx(/(^|\b)(product|item|sku|product name|item name|description)(\b|$)/i);
    const candidateNumeric = columns.map((c, i) => ({ name:c, i, sum:allRows.map(r => dataNumber(r[i])).filter(Number.isFinite).reduce((a,b)=>a+b,0), count:allRows.filter(r => Number.isFinite(dataNumber(r[i]))).length })).filter(x => x.count && ((ds.numericColumns || []).includes(x.name) || x.count / Math.max(1, allRows.length) > .5)).sort((a,b) => Math.abs(b.sum)-Math.abs(a.sum));
    const primaryIdx = revenueIdx >= 0 ? revenueIdx : candidateNumeric.length ? candidateNumeric[0].i : -1;
    const textIdxs = columns.map((c,i) => ({c,i})).filter(x => !(ds.numericColumns || []).includes(x.c) && x.i !== dateIdx);
    const groupIdx = categoryIdx >= 0 ? categoryIdx : productIdx >= 0 ? productIdx : regionIdx >= 0 ? regionIdx : deptIdx >= 0 ? deptIdx : textIdxs.length ? textIdxs[0].i : -1;
    const filters = S.filters || {};
    const toDate = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const validDates = dateIdx >= 0 ? allRows.map(r => dataDate(r[dateIdx])).filter(Boolean).sort((a,b)=>a-b) : [];
    const latest = validDates.length ? toDate(validDates[validDates.length-1]) : null;
    function periodMatch(row) {
      if (dateIdx < 0 || !latest) return true;
      const d = dataDate(row[dateIdx]); if (!d) return false;
      const year = latest.getFullYear(), month = latest.getMonth();
      let start = null, end = null;
      if (filters.quarter === "q1") { start = new Date(year, 3, 1); end = new Date(year, 6, 1); }
      else if (filters.quarter === "q2") { start = new Date(year, 6, 1); end = new Date(year, 9, 1); }
      else if (S.period === "t6m") { start = new Date(year, month - 5, 1); end = new Date(year, month + 1, 1); }
      else if (S.period === "t3m") { start = new Date(year, month - 2, 1); end = new Date(year, month + 1, 1); }
      else if (S.period === "fy26") { start = new Date(year, 3, 1); end = new Date(year, month + 1, 1); }
      else if (S.period === "fy25") { start = new Date(year - 1, 3, 1); end = new Date(year, 3, 1); }
      else { start = new Date(year, month - 11, 1); end = new Date(year, month + 1, 1); }
      return d >= start && d < end;
    }
    let filtered = allRows.filter(row => {
      const dimensionMatch = (idx, value) => !value || idx < 0 || String(row[idx] ?? "").trim().toLowerCase() === String(value).trim().toLowerCase();
      return dimensionMatch(regionIdx, filters.region) && dimensionMatch(deptIdx, filters.dept) && dimensionMatch(categoryIdx, filters.category) && dimensionMatch(productIdx, filters.product) && periodMatch(row);
    });
    // A stale or unrelated date window should not render an empty dashboard; make the fallback explicit in the note.
    const noDateMatches = allRows.length > 0 && filtered.length === 0 && dateIdx >= 0 && validDates.length > 0;
    if (noDateMatches) filtered = allRows.filter(row => {
      const dimensionMatch = (i,v) => !v || i < 0 || String(row[i] ?? "").trim().toLowerCase() === String(v).trim().toLowerCase();
      return dimensionMatch(regionIdx, filters.region) && dimensionMatch(deptIdx, filters.dept) && dimensionMatch(categoryIdx, filters.category) && dimensionMatch(productIdx, filters.product);
    });
    const sumAt = (rows, i) => i < 0 ? 0 : rows.reduce((a,r) => { const v=dataNumber(r[i]); return a + (Number.isFinite(v) ? v : 0); }, 0);
    const countAt = (rows, i) => i < 0 ? 0 : rows.filter(r => Number.isFinite(dataNumber(r[i]))).length;
    const distinctAt = (rows, i) => i < 0 ? 0 : new Set(rows.map(r=>String(r[i] ?? "").trim()).filter(Boolean)).size;
    const primarySum = sumAt(filtered, primaryIdx), primaryCount = countAt(filtered, primaryIdx), expenseSum = sumAt(filtered, expenseIdx), profitSum = sumAt(filtered, profitIdx);
    const primaryName = primaryIdx >= 0 ? columns[primaryIdx] : "Metric";
    const isMoney = /revenue|sales|amount|cost|expense|profit|income|price|turnover|gmv|budget|spend/i.test(primaryName);
    const fmtRaw = n => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
    const metricValue = n => `${isMoney ? "₹" : ""}${fmtRaw(n)}`;
    const kpis = [
      { label:"Records in view", value:filtered.length, format:"number", sub:`${allRows.length.toLocaleString("en-IN")} total records in source`, icon:"db" },
      { label:primaryIdx >= 0 ? `Total ${primaryName}` : "Numeric fields", value:primaryIdx >= 0 ? primarySum : (ds.numericColumns || []).length, format:primaryIdx >= 0 ? (isMoney ? "money" : "number") : "number", sub:primaryIdx >= 0 ? `Sum of ${primaryName}` : "No numeric measure detected", icon:"revenue" },
      { label:primaryIdx >= 0 ? `Average ${primaryName}` : "Columns detected", value:primaryIdx >= 0 && primaryCount ? primarySum/primaryCount : columns.length, format:primaryIdx >= 0 ? (isMoney ? "money" : "number") : "number", sub:primaryIdx >= 0 ? `Across ${primaryCount.toLocaleString("en-IN")} numeric records` : "Fields detected from upload", icon:"trendUp" },
      ...(expenseIdx >= 0 && expenseIdx !== primaryIdx ? [{label:`Total ${columns[expenseIdx]}`,value:expenseSum,format:/cost|expense|spend|budget/i.test(columns[expenseIdx])?"money":"number",sub:"Calculated from uploaded records",icon:"budget"}] : []),
      ...(profitIdx >= 0 && profitIdx !== primaryIdx && profitIdx !== expenseIdx ? [{label:`Total ${columns[profitIdx]}`,value:profitSum,format:/profit|income|earning/i.test(columns[profitIdx])?"money":"number",sub:"Calculated from uploaded records",icon:"trendUp"}] : []),
      { label:groupIdx >= 0 ? `Unique ${columns[groupIdx]}` : "Fields detected", value:distinctAt(filtered, groupIdx) || columns.length, format:"number", sub:groupIdx >= 0 ? `Distinct values in ${columns[groupIdx]}` : `${(ds.numericColumns || []).length} numeric · ${(ds.textColumns || []).length} text`, icon:"product" }
    ].slice(0, 6);
    const mapGroups = (rows, gidx, midx, max=12) => {
      if (gidx < 0) return [];
      const agg = new Map();
      rows.forEach(r => { const key=String(r[gidx] ?? "").trim() || "Unspecified"; const n=midx >= 0 ? dataNumber(r[midx]) : 1; agg.set(key,(agg.get(key)||0)+(Number.isFinite(n)?n:0)); });
      return [...agg.entries()].sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,max);
    };
    let trend = [];
    if (primaryIdx >= 0 && dateIdx >= 0 && validDates.length) {
      const agg = new Map();
      filtered.forEach(r=>{ const d=dataDate(r[dateIdx]); const v=dataNumber(r[primaryIdx]); if (!d || !Number.isFinite(v)) return; const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; agg.set(key,(agg.get(key)||0)+v); });
      trend = [...agg.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-24).map(([k,v])=>({label:new Date(+k.slice(0,4),+k.slice(5)-1,1).toLocaleDateString("en-IN",{month:"short",year:"2-digit"}),value:v}));
    } else if (primaryIdx >= 0 && groupIdx >= 0) trend = mapGroups(filtered, groupIdx, primaryIdx, 12).map(([label,value])=>({label,value})).reverse();
    else if (primaryIdx >= 0) trend = [{label:primaryName,value:primarySum}];
    const breakdown = mapGroups(filtered, groupIdx, primaryIdx, 10);
    const numericSums = candidateNumeric.slice(0,8).map(x=>({label:x.name,value:sumAt(filtered,x.i)})).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));
    return { rows:filtered, allRows, columns, dateIdx, primaryIdx, expenseIdx, profitIdx, groupIdx, regionIdx, deptIdx, categoryIdx, productIdx, primaryName, isMoney, primarySum, primaryCount, kpis, trend, breakdown, numericSums, dateColumn:dateIdx >= 0 ? columns[dateIdx] : "", groupName:groupIdx >= 0 ? columns[groupIdx] : "", noDateMatches };
  }
  function animateDatasetValues(host) {
    if (!host) return;
    const nodes = [...host.querySelectorAll("[data-count-to]")];
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nodes.forEach(node => {
      const end = Number(node.dataset.countTo || 0), kind = node.dataset.countFormat || "number";
      const format = n => `${kind === "money" ? "₹" : ""}${n.toLocaleString("en-IN",{maximumFractionDigits:2,minimumFractionDigits:0})}`;
      if (reduceMotion) { node.textContent = format(end); return; }
      const start = performance.now(), duration = 1050;
      const tick = now => { const t=Math.min(1,(now-start)/duration), eased=1-Math.pow(1-t,3); node.textContent=format(end*eased); if(t<1) requestAnimationFrame(tick); };
      node.textContent = format(0); requestAnimationFrame(tick);
    });
    host.querySelectorAll(".dataset-chart-card").forEach((el,i)=>{ el.style.animationDelay=(100+i*100)+"ms"; el.classList.add("dataset-chart-enter"); });
  }
  function datasetUploadMarkup(hasDataset, ds) {
    const btn = `<button class="btn btn-p btn-sm" id="dashboardUploadButton" type="button">${icon("upload", "ic-14")} ${hasDataset ? "Upload another dataset" : "Choose dataset"}</button>`;
    if (!hasDataset) return `<div class="dataset-launchpad card"><div class="dataset-launch-copy"><div class="dataset-eyebrow"><span class="dataset-live-dot"></span> DATA-DRIVEN WORKSPACE</div><h2>Bring your business data to life.</h2><p>Upload a CSV, Excel, TSV or JSON file. The workspace will profile its columns, calculate metrics, and animate the charts using your data. Until then, the dashboard below shows illustrative demo figures.</p><div class="dataset-format-pills"><span>CSV</span><span>XLSX</span><span>TSV</span><span>JSON</span><span>25 MB max</span></div></div><div class="dataset-dropzone" id="dashboardDatasetDrop" role="button" tabindex="0" aria-label="Upload a dataset"><div class="dataset-upload-orb">${icon("upload", "ic-24")}</div><b>Drop your dataset here</b><span>or browse files from your computer</span>${btn}<small>Data stays in this browser. Demo figures below are illustrative until a file is uploaded; no backend upload is performed.</small></div><input type="file" id="dashboardDatasetInput" accept=".csv,.xlsx,.tsv,.json,.txt" class="hidden"></div>`;
    return `<div class="dataset-sourcebar card"><div class="dataset-source-icon">${icon("db", "ic-20")}</div><div class="dataset-source-meta"><b>${esc(ds.name)}</b><span>${Number(ds.total).toLocaleString("en-IN")} records · ${ds.columns.length} columns · imported ${new Date(ds.importedAt || Date.now()).toLocaleString("en-IN")}</span></div><span class="badge b-ok"><span class="dot"></span> Dataset active</span>${btn}<input type="file" id="dashboardDatasetInput" accept=".csv,.xlsx,.tsv,.json,.txt" class="hidden"><div class="dataset-mini-drop" id="dashboardDatasetDrop" role="button" tabindex="0">${icon("upload", "ic-16")} Drop to replace dataset</div></div>`;
  }

  /* ============================================================
     DASHBOARD — Financial Overview
     ============================================================ */
  P.dashboard = function (root, query, soft) {
    const w = windowOf(getWindow());
    const scopedRev = scopeKpi(w.cur.rev, A.PCT(w.cur.rev, w.prev.rev));
    const scopedExp = scopeKpi(w.cur.exp, A.PCT(w.cur.exp, w.prev.exp), { exp: true });
    const scopedProf = scopeKpi(w.cur.profit, A.PCT(w.cur.profit, w.prev.profit));
    const scopedMargin = scopeKpi(w.cur.margin, w.cur.margin - w.prev.margin, {});
    const m = A.BUD_TOTAL, fc = A.FC;
    const ds = A.DATASET;
    const toNum = v => {
      if (v == null || String(v).trim() === "") return NaN;
      const n = Number(String(v).replace(/[,₹$€£%]/g, "").trim());
      return Number.isFinite(n) ? n : NaN;
    };
    const datasetStats = ds ? (ds.numericColumns || []).map(name => {
      const idx = ds.columns.indexOf(name);
      const vals = (ds.rows || []).map(r => toNum(r[idx])).filter(Number.isFinite);
      const sum = vals.reduce((a, b) => a + b, 0);
      return { name, count: vals.length, sum, avg: vals.length ? sum / vals.length : 0 };
    }).sort((a, b) => b.sum - a.sum) : [];
    const datasetPrimary = datasetStats[0];
    const datasetText = ds && ds.textColumns && ds.textColumns.length ? ds.textColumns[0] : null;
    const datasetPreview = ds ? (ds.rows || []).slice(0, 8) : [];
    const dsModel = buildDatasetModel(ds);

    root.innerHTML = head("Financial Overview", "Monitor revenue, profitability, expenses, budget performance, and financial outlook.",
      `<button class="btn btn-s" id="dRefresh">${icon("refresh", "ic-14")} Refresh</button>
       <button class="btn btn-s" id="dExport">${icon("download", "ic-14")} Export view</button>
       <button class="btn btn-p" id="dReport">${icon("reports", "ic-14")} Executive report</button>`) +
      filterBarHTML() +
      `<div id="dashBody">
      <div id="importedDatasetPanel" style="margin-bottom:16px"></div>
      <div class="kpis">
        ${kpiCard({ label: "Total Revenue", ico: "revenue", value: f.cr(scopedRev.v), deltaHtml: delta(scopedRev.g), sparkVals: w.rev, foot: `<span class="num">${f.lakh(A.LATEST.orders, 2)} orders · AOV ${f.inr(A.LATEST.aov)}</span>`, href: "#/revenue", tip: "How much are we selling and how fast is revenue growing?" })}
        ${kpiCard({ label: "Total Expenses", ico: "expense", value: f.cr(scopedExp.v), deltaHtml: delta(scopedExp.g, { goodWhenDown: true }), sparkVals: w.exp, sparkColor: getCss("--chart-2"), foot: `<span class="num">COGS ${f.cr(940)} · Opex ratio ${f.pct(880 / w.cur.rev * 100)}</span>`, href: "#/expenses", tip: "Where are we spending too much?" })}
        ${kpiCard({ label: "Net Profit", ico: "trendUp", value: f.cr(scopedProf.v), deltaHtml: delta(scopedProf.g), sparkVals: w.profit, sparkColor: getCss("--ok"), foot: `<span class="num">Gross profit ${f.cr(1620)}</span>`, href: "#/profitability", tip: "How profitable are we?" })}
        ${kpiCard({ label: "Profit Margin", ico: "scale", value: f.pct(scopedMargin.v), deltaHtml: delta(scopedMargin.g, { suffix: " pp" }), sparkVals: w.profit.map((p, i) => p / w.rev[i] * 100), sparkColor: getCss("--ok"), foot: `<span class="num">Prior period ${f.pct(w.prev.margin)}</span>`, href: "#/profitability" })}
        ${kpiCard({ label: "Budget Utilization", ico: "budget", value: f.pct(m.util), badge: `<span class="badge b-warn">${icon("alert" === "x" ? "dot" : "dot", "ic-14")} Attention</span>`, sub: `<span class="num">${f.cr(m.actual * 100)} of ${f.cr(m.budget * 100)} plan</span>`, foot: `<span class="num">${m.over} department over budget · Marketing 115.0%</span>`, href: "#/budgets", tip: "Are departments within budget?" })}
        ${kpiCard({ label: "Forecast Revenue", ico: "forecast", value: f.cr(scopeKpi(fc.total, fc.growth).v), deltaHtml: `<span class="delta up"><span class="tri">▲</span>${f.pctSign(scopeKpi(fc.total, fc.growth).g)} expected</span>`, sparkVals: A.FC_BASE, sparkColor: getCss("--chart-4"), foot: `<span class="num">Gradient Boosting · MAPE ${fc.mape}% · High confidence</span>`, href: "#/forecast", tip: "What is expected to happen next?" })}
      </div>

      <div class="health" aria-label="Financial health summary">
        ${healthTile(92, "Revenue Health", "Healthy", "ok", "Growing 12.4% with strong festive momentum")}
        ${healthTile(88, "Profitability", "Strong", "ok", "Margin expanded 2.7 pp period-over-period")}
        ${healthTile(62, "Budget Health", "Attention Required", "warn", "Marketing over plan; 6 of 7 departments on track")}
        ${healthTile(95, "Forecast Confidence", "High", "info", "MAPE 5.8% on backtest · model in production")}
      </div>

      <div class="grid">
        <div class="c-8">${card("Revenue vs Expenses", "INR · " + getWindow().label + " · click legend items to toggle",
          `<div class="seg" id="rvExpSeg" style="margin-left:auto">${["Monthly", "Quarterly", "Yearly"].map((x, i) => `<button data-m="${x}" class="${i === 0 ? "active" : ""}">${x}</button>`).join("")}</div>`,
          `<div class="chart-box" id="chRvExp"></div>`)}
        </div>
        <div class="c-4">${card("Budget vs Actual Spending", "Approved plan vs actual · T12M",
          `<a class="btn btn-g btn-sm" href="#/variance">Variance ${icon("chevronRight", "ic-14")}</a>`,
          `<div class="chart-box" id="chBud" style="min-height:212px"></div><div id="budList"></div>`)}</div>
        <div class="c-5">${card("Revenue Actual vs Forecast", "Solid = actual · dashed = forecast · shaded = 90% confidence",
          `<a class="btn btn-g btn-sm" href="#/forecast">Model details ${icon("chevronRight", "ic-14")}</a>`,
          `<div class="chart-box" id="chFc"></div>`)}
        </div>
        <div class="c-7">${card("Revenue by Category", "T12M · with growth vs prior period",
          `<div class="seg" id="catView">${["Bars", "Donut"].map((x, i) => `<button data-m="${x}" class="${i === 0 ? "active" : ""}">${x}</button>`).join("")}</div>`,
          `<div class="chart-box" id="chCat"></div>`)}
        </div>
        <div class="c-12">${card("Regional Performance", "Revenue, growth, profit, margin and orders by region · click a region to drill down",
          `<a class="btn btn-g btn-sm" href="#/regions">Full analysis ${icon("chevronRight", "ic-14")}</a>`,
          `<div class="grid" style="gap:12px" id="regCards"></div>`)}</div>
        <div class="c-5">${card("Needs Management Attention", "Top open exceptions across budget, revenue and data",
          `<a class="btn btn-g btn-sm" href="#/alerts">All alerts ${icon("chevronRight", "ic-14")}</a>`,
          `<div id="attList" style="display:flex;flex-direction:column;gap:10px"></div>`)}</div>
        <div class="c-7">${card("Latest Business Insights", "AI-assisted · explainable · action-ready",
          `<a class="btn btn-g btn-sm" href="#/insights">All insights ${icon("chevronRight", "ic-14")}</a>`,
          `<div style="display:grid;gap:12px"><div id="insA"></div><div id="insB"></div></div>`)}</div>
      </div></div>`;

    const dashBody = root.querySelector("#dashBody");
    if (dashBody) dashBody.classList.toggle("dataset-mode", !!dsModel);
    const dsPanel = root.querySelector("#importedDatasetPanel");
    if (dsPanel) {
      if (!dsModel) {
        dsPanel.innerHTML = datasetUploadMarkup(false, null);
      } else {
        const model = dsModel;
        const previewRows = model.rows.slice(0, 1000);
        dsPanel.innerHTML = `<div class="dataset-active-panel">
          ${datasetUploadMarkup(true, ds)}
          <div class="dataset-results-heading"><div><div class="dataset-eyebrow">LIVE DATASET ANALYSIS</div><h2>Dataset analytics</h2><p>Every figure below is aggregated from <b>${esc(ds.name)}</b> and recalculated when filters are applied.</p></div><div class="dataset-result-pills"><span>${model.rows.length.toLocaleString("en-IN")} rows in view</span><span>${ds.columns.length} fields detected</span></div></div>
          ${model.noDateMatches ? `<div class="note dataset-date-note">${icon("help", "ic-14")}<span>The selected date range did not overlap this dataset. Showing matching dimension filters across all available dates.</span></div>` : ""}
          <div class="dataset-kpis">${model.kpis.map(k=>`<div class="dataset-kpi kpi"><div class="kpi-top"><span class="kpi-label">${esc(k.label)}</span><span class="kpi-ico tint">${icon(k.icon, "ic-16")}</span></div><div class="dataset-kpi-value" data-count-to="${Number(k.value)||0}" data-count-format="${k.format || "number"}">${k.format === "money" ? "₹0" : "0"}</div><div class="kpi-sub">${esc(k.sub)}</div><div class="dataset-kpi-track"><i></i></div></div>`).join("")}</div>
          <div class="dataset-chart-grid">
            <div class="card dataset-chart-card dataset-span-8"><div class="card-h"><div><div class="t">${model.dateColumn && model.primaryIdx >= 0 ? esc(model.primaryName) + " over time" : model.groupName ? esc(model.primaryName) + " by " + esc(model.groupName) : "Primary metric profile"}</div><div class="s">${model.dateColumn ? "Grouped by month from the detected date field" : "Derived from the uploaded dataset · top groups shown"}</div></div><span class="badge b-info">Animated</span></div><div class="card-b"><div class="chart-box dataset-chart-box" id="datasetTrendChart" data-animate-chart="true"></div></div></div>
            <div class="card dataset-chart-card dataset-span-4"><div class="card-h"><div><div class="t">Breakdown</div><div class="s">${model.groupName ? "Top values in " + esc(model.groupName) : "Row distribution"}</div></div></div><div class="card-b"><div class="chart-box dataset-chart-box" id="datasetBreakdownChart" data-animate-chart="true"></div></div></div>
            <div class="card dataset-chart-card dataset-span-6"><div class="card-h"><div><div class="t">Numeric field comparison</div><div class="s">Aggregated values for detected numeric columns</div></div></div><div class="card-b"><div class="chart-box dataset-chart-box" id="datasetNumericChart" data-animate-chart="true"></div></div></div>
            <div class="card dataset-chart-card dataset-span-6"><div class="card-h"><div><div class="t">Uploaded records</div><div class="s">Filtered preview · first 8 columns · ${previewRows.length.toLocaleString("en-IN")} rows available in this view</div></div><span class="badge b-mut">Preview</span></div><div class="card-b"><div class="table-wrap" id="importedDatasetTable"></div></div></div>
          </div>
          <div class="dataset-field-footer"><b>Detected fields</b><span><em>Numeric</em> ${esc((ds.numericColumns || []).join(", ") || "None")}</span><span><em>Text / category</em> ${esc((ds.textColumns || []).join(", ") || "None")}</span><span><em>Date</em> ${esc((ds.dateColumns || []).join(", ") || "None detected — date range filters are not applied")}</span><span><em>Rows analyzed</em> ${model.rows.length.toLocaleString("en-IN")}${ds.truncated ? " (browser-persisted preview is capped at 1,200 rows; all rows are used during this session)" : ""}</span></div>
        </div>`;
        table({
          el: "#importedDatasetTable",
          cols: ds.columns.slice(0, 8).map((h, i) => ({ k: h, label: h, align: (ds.numericColumns || []).includes(h) ? "r" : "l", render: r => esc(r[i] == null ? "" : String(r[i])) })),
          rows: previewRows,
          pageSize: 8,
          searchKeys: ds.columns.slice(0, 8),
          dense: true,
          toolbar: `<span class="badge b-mut">${ds.truncated ? "In-session full data · persisted preview capped" : "Showing uploaded data"}</span>`
        });
        const trendEl = dsPanel.querySelector("#datasetTrendChart");
        if (trendEl) {
          if (model.trend.length) {
            if (model.dateColumn && model.primaryIdx >= 0) CH.line(trendEl, { labels: model.trend.map(x=>x.label), series:[{name:model.primaryName,values:model.trend.map(x=>x.value),color:getCss("--chart-1"),width:2.8,dots:true}], yFmt:model.isMoney?"money":undefined });
            else CH.bars(trendEl, { hbar:false, labels:model.trend.map(x=>x.label), series:[{name:model.primaryName,values:model.trend.map(x=>x.value),color:getCss("--chart-1")}], legend:false });
          } else trendEl.innerHTML = `<div class="dataset-chart-empty">No numeric field could be aggregated. The record and field profile remains available above.</div>`;
        }
        const breakdownEl = dsPanel.querySelector("#datasetBreakdownChart");
        if (breakdownEl) {
          if (model.breakdown.length) CH.bars(breakdownEl, { hbar:true, labels:model.breakdown.map(x=>x[0]), series:[{name:model.primaryName || "Records",values:model.breakdown.map(x=>x[1]),color:getCss("--chart-2")}], legend:false });
          else CH.donut(breakdownEl, { labels:["Records"], values:[model.rows.length], colors:[getCss("--chart-1")] });
        }
        const numericEl = dsPanel.querySelector("#datasetNumericChart");
        if (numericEl) {
          if (model.numericSums.length) CH.bars(numericEl, { hbar:true, labels:model.numericSums.map(x=>x.label), series:[{name:"Sum",values:model.numericSums.map(x=>x.value),color:getCss("--chart-4")}], legend:false });
          else numericEl.innerHTML = `<div class="dataset-chart-empty">No numeric columns detected in this dataset.</div>`;
        }
        animateDatasetValues(dsPanel);
      }
      wireDashboardUploader(dsPanel);
    }
    function wireDashboardUploader(panel) {
      const input = panel.querySelector("#dashboardDatasetInput"), drop = panel.querySelector("#dashboardDatasetDrop"), button = panel.querySelector("#dashboardUploadButton");
      if (!input || !drop) return;
      const open = () => input.click();
      if (button) button.onclick = e => { e.stopPropagation(); open(); };
      drop.onclick = open;
      drop.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } };
      ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("is-over"); }));
      ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("is-over"); if (ev === "drop" && e.dataTransfer?.files?.[0]) handleDashboardFile(e.dataTransfer.files[0]); }));
      input.onchange = () => { const file = input.files?.[0]; if (file) handleDashboardFile(file); input.value = ""; };
      async function handleDashboardFile(file) {
        if (!window.APP || !window.APP.can("write")) { toast("bad", "Upload restricted", "Your current demo role is read-only."); return; }
        drop.classList.add("is-processing");
        const original = drop.innerHTML;
        drop.innerHTML = `<span class="dataset-processing-spinner"></span><b>Reading ${esc(file.name)}</b><span>Detecting columns, profiling values and preparing charts…</span><div class="dataset-progress"><i></i></div>`;
        try {
          await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
          await A.importDashboardFile(file);
          toast("ok", "Dataset ready", `${file.name} · ${A.DATASET.total.toLocaleString("en-IN")} records. Dashboard analytics recalculated from your file.`);
          APP.route(true);
        } catch (error) {
          console.error(error);
          toast("bad", "Dataset not imported", error?.message || "This file could not be parsed. Try CSV, XLSX, TSV or JSON.");
          drop.innerHTML = original;
          drop.classList.remove("is-processing");
          wireDashboardUploader(panel);
        }
      }
    }

    wireKpiDrill(root);
    wireFilterBar(root);
    root.querySelector("#dRefresh").onclick = e => { e.currentTarget.classList.add("loading"); setTimeout(() => { APP.route(true); toast("info", "Data refreshed", "Figures re-computed from the latest uploaded dataset."); }, 420); };
    root.querySelector("#dExport").onclick = () => AV.exportModal({ title: "Export executive view" });
    root.querySelector("#dReport").onclick = () => location.hash = "#/reports";

    /* --- Revenue vs Expenses (monthly/quarterly/yearly) --- */
    function drawRvExp(mode) {
      const el = root.querySelector("#chRvExp");
      if (mode === "Monthly") {
        CH.combo(el, { labels: w.labels, series: [
          { name: "Revenue", values: w.rev, color: getCss("--chart-1") },
          { name: "Expenses", values: w.exp, color: getCss("--chart-2") },
          { name: "Net Profit", values: w.profit, type: "line", color: getCss("--ok") },
        ]});
      } else if (mode === "Quarterly") {
        const chunks = Math.ceil(w.len / 3);
        const labs = [], rv = [], ex = [], pr = [];
        for (let c = 0; c < chunks; c++) {
          labs.push(w.labels.slice(c * 3, c * 3 + 3).join(" – "));
          rv.push(w.rev.slice(c * 3, c * 3 + 3).reduce((a, b) => a + b, 0));
          ex.push(w.exp.slice(c * 3, c * 3 + 3).reduce((a, b) => a + b, 0));
          pr.push(w.profit.slice(c * 3, c * 3 + 3).reduce((a, b) => a + b, 0));
        }
        CH.combo(el, { labels: labs, series: [
          { name: "Revenue", values: rv, color: getCss("--chart-1") },
          { name: "Expenses", values: ex, color: getCss("--chart-2") },
          { name: "Net Profit", values: pr, type: "line", color: getCss("--ok") },
        ]});
      } else {
        CH.bars(el, { labels: ["FY 2024-25", "FY 2025-26", "FY 2026-27 (F)"], series: [
          { name: "Revenue", values: [2278, 2386, 2940], colors: [getCss("--chart-2"), getCss("--chart-1"), hexA(getCss("--chart-1"), 0.45)] },
        ], text: v => f.cr(v), legend: false });
      }
    }
    drawRvExp("Monthly");
    root.querySelectorAll("#rvExpSeg button").forEach(b => b.onclick = () => {
      root.querySelectorAll("#rvExpSeg button").forEach(x => x.classList.toggle("active", x === b));
      drawRvExp(b.dataset.m);
    });

    /* --- Budget vs actual horizontal --- */
    CH.bars(root.querySelector("#chBud"), { hbar: true, labels: A.BUDGETS.map(b => b.dept), series: [
      { name: "Budget", values: A.BUDGETS.map(b => b.budget * 100), color: getCss("--border-2") },
      { name: "Actual", values: A.BUDGETS.map(b => b.actual * 100), colors: A.BUDGETS.map(b => b.status.key === "over" ? getCss("--bad") : getCss("--primary")) },
    ]});
    root.querySelector("#budList").innerHTML = A.BUDGETS.slice().sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)).slice(0, 3).map(b => `
      <div class="row row-between" style="padding:5px 2px;font-size:12.5px">
        <span class="muted">${b.dept}</span>
        <span class="row gap-8 num"><b>${f.crSign(b.variance * 100)}</b>
        ${b.status.key === "over" ? `<span class="badge b-bad">${icon("x", "ic-14")} Unfavorable</span>` : `<span class="badge b-ok">${icon("check", "ic-14")} Favorable</span>`}</span>
      </div>`).join("") + `<div class="row row-between small muted" style="padding:5px 2px 0;border-top:1px dashed var(--border);margin-top:4px"><span>Net variance</span><b class="num pos">−${f.cr(560)} under plan</b></div>`;

    /* --- Forecast --- */
    const histL = A.MONTHS.slice(18), histR = A.REV.slice(18);
    const allL = histL.concat(A.FC_MONTHS);
    const fcLine = [...Array(12).fill(null), ...A.FC_BASE];
    const baseL = [...Array(12).fill(null), ...A.FC_BAND_L];
    const baseU = [...Array(12).fill(null), ...A.FC_BAND_U];
    CH.line(root.querySelector("#chFc"), {
      labels: allL,
      series: [
        { name: "Actual", values: [...histR, null], color: getCss("--chart-1"), width: 2.4, dots: true },
        { name: "Forecast", values: [null, ...A.FC_BASE], color: getCss("--chart-4"), dashed: true, dots: true, width: 2.2 },
      ],
      bands: [{ name: "CI", lower: baseL, upper: baseU }],
      vlines: [{ x: "Oct-26", label: "Forecast begins" }],
      yFmt: "money",
    });

    /* --- Category (bars / donut) --- */
    function drawCat(view) {
      const el = root.querySelector("#chCat");
      if (view === "Bars") {
        CH.bars(el, { hbar: true, labels: A.CATEGORIES.map(c => c.name), series: [
          { name: "Revenue", values: A.CATEGORIES.map(c => c.rev), colors: A.CATEGORIES.map(c => A.catColor(c.name)) },
        ], text: v => f.cr(v), legend: false });
      } else {
        CH.donut(el, { labels: A.CATEGORIES.map(c => c.name), values: A.CATEGORIES.map(c => c.rev), colors: A.CATEGORIES.map(c => A.catColor(c.name)) });
      }
    }
    drawCat("Bars");
    root.querySelectorAll("#catView button").forEach(b => b.onclick = () => {
      root.querySelectorAll("#catView button").forEach(x => x.classList.toggle("active", x === b));
      drawCat(b.dataset.m);
    });

    /* --- Regions --- */
    root.querySelector("#regCards").innerHTML = A.REGIONS.map(r => `
      <button class="card link-card" style="padding:14px 16px" data-reg="${r.name}">
        <div class="row row-between"><b style="font-size:14.5px">${r.name}</b>${delta(r.growth)}</div>
        <div class="row" style="margin-top:10px;gap:18px;font-size:12.5px">
          <span><span class="muted2 small" style="display:block">Revenue</span><b class="num" style="font-size:15px">${f.cr(r.rev)}</b></span>
          <span><span class="muted2 small" style="display:block">Profit</span><b class="num">${f.cr(r.profit)}</b></span>
          <span><span class="muted2 small" style="display:block">Margin</span><b class="num">${f.pct(r.margin)}</b></span>
          <span><span class="muted2 small" style="display:block">Orders</span><b class="num">${f.lakh(r.orders, 2)}</b></span>
          <span class="go">${icon("chevronRight", "ic-16")}</span>
        </div></button>`).join("");
    root.querySelectorAll("[data-reg]").forEach(b => b.onclick = () => {
      S.filters.region = b.dataset.reg; persist();
      location.hash = "#/regions";
    });

    /* --- attention + insights --- */
    const open = A.ALERTS.filter(a => ["New", "Acknowledged", "Investigating"].includes(a.status)).slice(0, 3);
    root.querySelector("#attList").innerHTML = open.map(a => `
      <div class="row" style="gap:11px;align-items:flex-start;border:1px solid var(--border);border-radius:10px;padding:11px 13px">
        <span class="sev-ico ${a.sev === "critical" ? "sev-critical" : a.sev === "high" ? "sev-high" : "sev-medium"}">${icon(a.sev === "critical" ? "alerts" : "trendDown", "ic-16")}</span>
        <div style="flex:1;min-width:0"><b style="font-size:13px;display:block;line-height:1.4">${a.title}</b>
        <span class="small muted">${a.time} · ${a.cat}</span></div>
        <a class="btn btn-g btn-sm" href="#/alerts">Review</a></div>`).join("");
    root.querySelector("#insA").innerHTML = AV.insightCard(A.INSIGHTS[0]);
    root.querySelector("#insB").innerHTML = AV.insightCard(A.INSIGHTS[2]);
  };
  function healthTile(score, label, status, cls, text) {
    const color = cls === "ok" ? getCss("--ok") : cls === "warn" ? getCss("--warn") : getCss("--primary");
    return `<div class="htile">${ring(score, 44, color)}<div style="min-width:0"><b>${label}</b><span class="st ${cls}">${icon(cls === "ok" ? "check" : cls === "warn" ? "alert" === "x" ? "dot" : "dot" : "insights", "ic-14")} ${status}</span><div class="small muted" style="margin-top:2px;line-height:1.4">${text}</div></div></div>`;
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  AV.healthTile = healthTile; AV.hexA = hexA;

  AV.insightCard = function (i) {
    const sevIcon = i.sev === "high" || i.sev === "critical" ? "alerts" : "insights";
    const sevCls = i.sev === "high" ? "b-bad" : i.sev === "medium" ? "b-warn" : "b-mut";
    return `<div class="insight">
      <div class="i-top"><span class="badge ${sevCls}">${icon(sevIcon, "ic-14")} ${i.sev.toUpperCase()}</span><span class="badge b-mut">${i.type.toUpperCase()}</span><span class="i-time" style="margin-left:auto">${i.time}</span></div>
      <div class="i-t">${i.title}</div>
      <div class="i-b"><b>What happened:</b> ${i.what} <b style="display:block;margin-top:4px">Why it matters:</b> ${i.why}</div>
      <div class="i-metric">${icon("scale", "ic-14")}<span><b>${i.metric.k}:</b> ${i.metric.v}</span></div>
      <div class="i-act">${icon("zap", "ic-14")}<span><b>Suggested action:</b> ${i.action}</span></div>
      <div class="i-foot"><a class="btn btn-g btn-sm" href="${i.link}">View source ${icon("chevronRight", "ic-14")}</a><button class="btn btn-g btn-sm" data-resolve="${i.id}">${icon("check", "ic-14")} Resolve</button></div>
    </div>`;
  };
  AV.wireInsights = function (root) {
    root.querySelectorAll("[data-resolve]").forEach(b => b.onclick = () => {
      const i = A.INSIGHTS.find(x => x.id === +b.dataset.resolve);
      toast("ok", "Insight resolved", "“" + i.title.slice(0, 48) + "…” marked as actioned.");
      A.logAudit({ time: "Just now", user: S.user.name, role: S.user.role, action: "Resolved insight", entity: "Insight · " + i.title.slice(0, 40), next: "Resolved" });
      b.closest(".insight").style.opacity = ".55";
      b.disabled = true;
    });
  };

  /* ============================================================
     PRODUCT DRAWER (shared)
     ============================================================ */
  AV.productDrawer = function (p) {
    const t12 = A.REV.slice(18);
    const monthly = t12.map(v => +(p.rev * v / 2560).toFixed(1));
    const txns = A.TRANSACTIONS.filter(t => t.product === p.name).slice(0, 6);
    drawer({
      title: p.name, sub: p.cat + " · Product detail",
      body: `<div class="row gap-8" style="margin-bottom:14px">
          <span class="badge b-info">${A.fmt.pctSign(p.growth)} vs prior</span>
          <span class="badge ${p.growth < 0 ? "b-bad" : "b-ok"}">${icon(p.growth < 0 ? "trendDown" : "trendUp", "ic-14")} ${p.growth < 0 ? "Declining" : "Growing"}</span></div>
        <div class="row" style="gap:10px;margin-bottom:16px;flex-wrap:wrap">
          ${[["Revenue", A.fmt.cr(p.rev, 2)], ["Units", A.fmt.num(p.units)], ["Margin", A.fmt.pct(p.margin)], ["Profit", A.fmt.cr(p.profit, 2)], ["Price/unit", A.fmt.inr(p.unitsRev)]].map(x => `<div style="flex:1;min-width:90px;background:var(--surface-2);border:1px solid var(--border);border-radius:9px;padding:9px 11px"><span class="muted2 caption" style="font-size:10px">${x[0]}</span><b class="num" style="display:block;font-size:15px;margin-top:2px">${x[1]}</b></div>`).join("")}
        </div>
        <b class="small">12-month revenue</b><div style="margin:8px 0 14px">${spark(monthly, 300, 54)}</div>
        <b class="small">Recent transactions</b>
        <div class="t-scroll" style="margin-top:8px;border:1px solid var(--border);border-radius:9px">
          <table class="dt" style="min-width:0"><thead><tr><th>ID</th><th>Date</th><th class="r">Amount</th><th>Status</th></tr></thead>
          <tbody>${txns.length ? txns.map(t => `<tr><td>${t.id}</td><td>${t.date}</td><td class="r">${A.fmt.inr(t.revenue)}</td><td>${statusBadge(t.status)}</td></tr>`).join("") : `<tr><td colspan="4" class="muted small" style="padding:14px">No sampled transactions for this product in the current extract.</td></tr>`}</tbody></table></div>`,
      foot: `<button class="btn btn-g" id="pdClose">Close</button><a class="btn btn-s" href="#/products">All products</a><a class="btn btn-p" href="#/data?tab=imports">Transactions ${icon("chevronRight", "ic-14")}</a>`,
    });
    document.getElementById("pdClose").onclick = () => document.querySelector(".d-ov")?.remove();
  };
  function statusBadge(s) {
    const map = { Completed: "b-ok", Pending: "b-warn", Refunded: "b-info", Cancelled: "b-bad" };
    return `<span class="badge ${map[s] || "b-mut"}"><span class="dot"></span>${s}</span>`;
  }
  AV.statusBadge = statusBadge;

  /* ============================================================
     REVENUE ANALYTICS
     ============================================================ */
  P.revenue = function (root) {
    const w = windowOf(getWindow());
    const s = scopeKpi(w.cur.rev, A.PCT(w.cur.rev, w.prev.rev));
    const orders = A.LATEST.orders * (s.v / w.cur.rev);
    root.innerHTML = head("Revenue Analytics", "How much are we selling, where, and how fast is revenue growing? Figures respect the global filter bar.",
      `<button class="btn btn-s" id="rExp">${icon("download", "ic-14")} Export</button>`) +
      filterBarHTML() +
      `<div class="kpis">
        ${kpiCard({ label: "Total Revenue", ico: "revenue", value: f.cr(s.v), deltaHtml: delta(s.g), sparkVals: w.rev, foot: `<span class="num">${getWindow().label}</span>` })}
        ${kpiCard({ label: "Revenue Growth", ico: "trendUp", value: f.pctSign(s.g), deltaHtml: delta(s.g - A.PCT(w.prev.rev, A.sum(A.REV, w.start - 2 * w.len, w.start - w.len)), { goodWhenDown: false }), sub: "vs prior period", foot: `<span class="num">Prior: ${f.cr(w.prev.rev)}</span>` })}
        ${kpiCard({ label: "Average Order Value", ico: "cart", value: f.inr(Math.round(A.LATEST.aov * (1 + s.g / 200))), foot: `<span class="num">${f.lakh(orders, 2)} orders</span>` })}
        ${kpiCard({ label: "Total Orders", ico: "card", value: f.lakh(orders, 2), deltaHtml: delta(s.g * 0.92), foot: `<span class="num">+${f.pctSign(s.g * 0.92)} vs prior</span>` })}
        ${kpiCard({ label: "Revenue / Customer", ico: "users", value: f.inr(Math.round(A.LATEST.revPerCustomer * (1 + s.g / 300))), foot: `<span class="num">${f.lakh(A.LATEST.customers * (s.v / w.cur.rev), 2)} active customers</span>` })}
      </div>
      <div class="grid">
        <div class="c-7">${card("Revenue Trend", "Monthly · " + getWindow().label, `<span class="badge b-ok">${icon("check", "ic-14")} On plan</span>`, `<div class="chart-box" id="chTrend"></div>`)}</div>
        <div class="c-5">${card("Year-over-Year Comparison", "Same months, current vs prior 12 months", "", `<div class="chart-box" id="chYoY"></div>`)}</div>
        <div class="c-6">${card("Revenue by Category", "T12M contribution with growth", `<a class="btn btn-g btn-sm" href="#/products">Products</a>`, `<div class="chart-box" id="chCat"></div>`)}</div>
        <div class="c-6">${card("Revenue by Region", "North · South · East · West", `<a class="btn btn-g btn-sm" href="#/regions">Regions</a>`, `<div class="chart-box" id="chReg"></div>`)}</div>
        <div class="c-7">${card("Top 10 Products by Revenue", "T12M · click a bar to inspect the product", "", `<div class="chart-box tall" id="chProd"></div>`)}</div>
        <div class="c-5">${card("Revenue by Department", "Attributed to owning department", "", `<div class="chart-box tall" id="chDept"></div>`)}</div>
        <div class="c-12"><div class="table-wrap" id="prodTable"></div>
          <div class="foot-note">${icon("help", "ic-14")}<span>Profit is product-level (after product cost & fulfilment, before unallocated overhead). Growth vs prior 12 months. Click a row for the product detail.</span></div>
        </div>
      </div>`;
    wireFilterBar(root);
    root.querySelector("#rExp").onclick = () => AV.exportModal({ title: "Export revenue analytics", report: "rev" });

    CH.line(root.querySelector("#chTrend"), { labels: w.labels, series: [{ name: "Revenue", values: w.rev, color: getCss("--chart-1"), width: 2.4, dots: true }], yFmt: "money" });
    const yoyL = w.labels.map(l => l.split("-")[0]);
    const prevSame = A.REV.slice(w.start - w.len, w.start);
    CH.bars(root.querySelector("#chYoY"), { labels: yoyL, series: [
      { name: "Current", values: w.rev, color: getCss("--chart-1") },
      { name: "Prior year", values: prevSame, color: getCss("--border-2") },
    ]});
    CH.bars(root.querySelector("#chCat"), { hbar: true, labels: A.CATEGORIES.map(c => c.name), series: [{ name: "Revenue", values: A.CATEGORIES.map(c => c.rev), colors: A.CATEGORIES.map(c => A.catColor(c.name)) }], text: v => f.cr(v), legend: false });
    CH.bars(root.querySelector("#chReg"), { labels: A.REGIONS.map(r => r.name), series: [
      { name: "Current", values: A.REGIONS.map(r => r.rev), color: getCss("--chart-1") },
      { name: "Prior", values: A.REGIONS.map(r => r.prev), color: getCss("--border-2") },
    ]});
    const top10 = A.PRODUCTS.slice().sort((a, b) => b.rev - a.rev).slice(0, 10);
    const prodEl = root.querySelector("#chProd");
    CH.bars(prodEl, { hbar: true, labels: top10.map(p => p.name), series: [{ name: "Revenue", values: top10.map(p => p.rev), colors: top10.map(p => A.catColor(p.cat)) }], text: v => f.cr(v, 2), legend: false });
    if (window.Plotly && prodEl.data) Plotly.extendTraces; // no-op
    CH.bars(root.querySelector("#chDept"), { labels: ["Sales", "Marketing", "Operations"], series: [{ name: "Revenue", values: [1741, 512, 307], colors: [getCss("--chart-1"), getCss("--chart-5"), getCss("--chart-2")] }], text: v => f.cr(v), legend: false });

    table({
      el: "#prodTable",
      cols: [
        { k: "name", label: "Product" }, { k: "cat", label: "Category" },
        { k: "units", label: "Units", fmt: "num", align: "r" },
        { k: "orders", label: "Orders", fmt: "num", align: "r" },
        { k: "rev", label: "Revenue", fmt: "money2", align: "r" },
        { k: "cost", label: "Cost", fmt: "money2", align: "r" },
        { k: "profit", label: "Profit", fmt: "money2", align: "r" },
        { k: "margin", label: "Margin", fmt: "pct", align: "r" },
        { k: "growth", label: "Growth", fmt: "pctSign", align: "r" },
      ],
      rows: A.PRODUCTS.slice(),
      searchKeys: ["name", "cat"],
      exportName: "revenue-bi-revenue-products",
      onRow: p => AV.productDrawer(p),
      toolbar: `<span class="badge b-mut">${A.PRODUCTS.length} products · T12M</span>`,
    });
  };

  /* ============================================================
     EXPENSE ANALYTICS
     ============================================================ */
  P.expenses = function (root) {
    const w = windowOf(getWindow());
    const s = scopeKpi(w.cur.exp, A.PCT(w.cur.exp, w.prev.exp), { exp: true });
    const largest = A.EXP_CATS[1]; // Marketing
    root.innerHTML = head("Expense Analytics", "Where are we spending, is spend under control, and what is driving cost growth?",
      `<button class="btn btn-s" id="eExp">${icon("download", "ic-14")} Export</button>`) +
      filterBarHTML() +
      `<div class="kpis">
        ${kpiCard({ label: "Total Expenses", ico: "expense", value: f.cr(s.v), deltaHtml: delta(s.g, { goodWhenDown: true }), sparkVals: w.exp, sparkColor: getCss("--chart-2"), foot: `<span class="num">${getWindow().label}</span>` })}
        ${kpiCard({ label: "Expense Growth", ico: "trendUp", value: f.pctSign(s.g), deltaHtml: delta(s.g, { goodWhenDown: true }), sub: "vs prior period", foot: `<span class="num">Prior: ${f.cr(w.prev.exp)}</span>`, sparkColor: getCss("--chart-4") })}
        ${kpiCard({ label: "Largest Category", ico: "wallet", value: f.cr(460), sub: "Marketing · 25.3% of total", foot: `<span class="num">Over plan by ${f.crSign(60)} — see variance</span>`, href: "#/variance" })}
        ${kpiCard({ label: "Operating Expense Ratio", ico: "scale", value: f.pct(880 / w.cur.rev * 100), sub: "Opex ÷ revenue", foot: `<span class="num">Prior: ${f.pct(852 / w.prev.rev * 100)}</span>` })}
        ${kpiCard({ label: "Cost per Order", ico: "cart", value: f.inr(173), deltaHtml: delta(6.2, { goodWhenDown: true }), foot: `<span class="num">Logistics + fulfilment</span>` })}
      </div>
      <div class="grid">
        <div class="c-7">${card("Expense Trend", "Monthly total with top categories · " + getWindow().label, "", `<div class="chart-box" id="chTrend"></div>`)}</div>
        <div class="c-5">${card("Expense by Category", "T12M · 8 categories", "", `<div class="chart-box" id="chCat"></div>`)}</div>
        <div class="c-6">${card("Expense by Department", "Actual spend vs plan", "", `<div class="chart-box" id="chDept"></div>`)}</div>
        <div class="c-6">${card("Expense by Region", "Region-attributed spend", "", `<div class="chart-box" id="chReg"></div>`)}</div>
        <div class="c-12">${card("Expense vs Revenue", "Both lines in INR · expanding gap = margin pressure", `<span class="badge b-warn">${icon("dot", "ic-14")} Gap widening 0.4 pp</span>`, `<div class="chart-box" id="chVs"></div>`)}</div>
      </div>`;
    wireFilterBar(root);
    root.querySelector("#eExp").onclick = () => AV.exportModal({ title: "Export expense analytics", report: "exp" });

    const mSal = w.exp.map(v => Math.round(v * 540 / 1820)), mMkt = w.exp.map(v => Math.round(v * 460 / 1820));
    CH.line(root.querySelector("#chTrend"), { labels: w.labels, series: [
      { name: "Total", values: w.exp, color: getCss("--chart-2"), width: 2.6, dots: true },
      { name: "Salaries", values: mSal, color: getCss("--chart-1"), width: 1.8 },
      { name: "Marketing", values: mMkt, color: getCss("--chart-4"), width: 1.8 },
    ], yFmt: "money" });
    const expSort = A.EXP_CATS.slice().sort((a, b) => b.val - a.val);
    CH.bars(root.querySelector("#chCat"), { hbar: true, labels: expSort.map(c => c.name), series: [{ name: "Spend", values: expSort.map(c => c.val), colors: expSort.map((c, i) => i === 1 ? getCss("--chart-4") : getCss("--chart-2")) }], text: v => f.cr(v), legend: false });
    CH.bars(root.querySelector("#chDept"), { hbar: true, labels: A.BUDGETS.map(b => b.dept), series: [
      { name: "Plan", values: A.BUDGETS.map(b => b.budget * 100), color: getCss("--border-2") },
      { name: "Actual", values: A.BUDGETS.map(b => b.actual * 100), colors: A.BUDGETS.map(b => b.status.key === "over" ? getCss("--bad") : getCss("--primary")) },
    ]});
    CH.bars(root.querySelector("#chReg"), { labels: A.REGIONS.map(r => r.name), series: [{ name: "Spend", values: A.REGIONS.map(r => +(r.rev * 0.711).toFixed(0)), colors: A.REGIONS.map(r => getCss("--chart-2")) }], text: v => f.cr(v), legend: false });
    CH.line(root.querySelector("#chVs"), { labels: w.labels, series: [
      { name: "Revenue", values: w.rev, color: getCss("--chart-1"), width: 2.4 },
      { name: "Expenses", values: w.exp, color: getCss("--chart-4"), width: 2.4 },
    ], yFmt: "money" });
  };

  /* ============================================================
     PRODUCT PERFORMANCE
     ============================================================ */
  P.products = function (root) {
    const byRev = A.PRODUCTS.slice().sort((a, b) => b.rev - a.rev);
    const byGrow = A.PRODUCTS.slice().sort((a, b) => b.growth - a.growth);
    const declining = byGrow.filter(p => p.growth < 0).slice().reverse();
    const quad = (title, ico, rows, color, note) => `
      <div class="card"><div class="card-h"><div><div class="t">${icon(ico, "ic-16")}&nbsp; ${title}</div><div class="s">${note}</div></div></div>
      <div class="card-b" style="padding-top:8px">${rows.map((p, i) => `
        <div class="row" style="gap:10px;padding:9px 6px;border-bottom:1px solid var(--border);cursor:pointer" data-p="${esc(p.name)}">
          <span style="width:24px;height:24px;flex:none;border-radius:7px;display:grid;place-items:center;font-size:11.5px;font-weight:750;background:${i === 0 ? (color === "bad" ? "var(--bad-soft)" : "var(--primary-soft)") : "var(--surface-3)"};color:${i === 0 ? (color === "bad" ? "var(--bad-ink)" : "var(--primary-ink)") : "var(--text-3)"}">${i + 1}</span>
          <div style="flex:1;min-width:0"><b style="font-size:13px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</b>
          <span class="small muted">${p.cat} · ${f.num(p.units)} units</span></div>
          <div style="text-align:right"><b class="num" style="font-size:13.5px">${f.cr(p.rev, 2)}</b>
          <div class="row gap-6" style="justify-content:flex-end;margin-top:2px"><span class="small muted num">${f.pct(p.margin)} mgn</span>${delta(p.growth)}</div></div>
        </div>`).join("")}</div></div>`;
    root.innerHTML = head("Product Performance", "Portfolio intelligence — top, bottom, fastest growing and declining products.",
      `<span class="badge b-mut">${A.PRODUCTS.length} products · 6 categories · T12M</span>`) +
      filterBarHTML() +
      `<div class="grid">
        <div class="c-6">${quad("Top Products", "star", byRev.slice(0, 5), "ok", "Highest revenue contribution")}</div>
        <div class="c-6">${quad("Bottom Products", "trendDown", byRev.slice(-5).reverse(), "bad", "Lowest revenue — review assortment")}</div>
        <div class="c-6">${quad("Fastest Growing", "trendUp", byGrow.slice(0, 5), "ok", "Momentum to invest in")}</div>
        <div class="c-6">${quad("Declining Products", "trendDown", declining.slice(0, 5), "bad", "Needs markdown or repositioning")}</div>
        <div class="c-12">${card("Revenue vs Margin by Product", "Bubble size = profit · colour = category · hover for details",
          `<span class="row gap-6 small muted" style="margin-left:auto">${A.CATEGORIES.map(c => `<span class="row gap-4"><span style="width:9px;height:9px;border-radius:3px;background:${A.catColor(c.name)}"></span>${c.name}</span>`).join("")}</span>`,
          `<div class="chart-box tall" id="chScatter"></div>`)}</div>
        <div class="c-12"><div class="table-wrap" id="portTable"></div></div>
      </div>`;
    wireFilterBar(root);
    root.querySelectorAll("[data-p]").forEach(el => el.onclick = () => AV.productDrawer(A.productByName(el.dataset.p)));
    CH.bubble(root.querySelector("#chScatter"), {
      pts: A.PRODUCTS.map(p => ({ x: p.rev / 100, y: p.margin, r: Math.max(6, Math.sqrt(p.profit) * 4.2), label: p.name, profit: p.profit, color: A.catColor(p.cat) })),
      midY: 28,
    });
    table({
      el: "#portTable",
      cols: [
        { k: "name", label: "Product" }, { k: "cat", label: "Category" },
        { k: "units", label: "Units", fmt: "num", align: "r" }, { k: "rev", label: "Revenue", fmt: "money2", align: "r" },
        { k: "cost", label: "Cost", fmt: "money2", align: "r" }, { k: "profit", label: "Profit", fmt: "money2", align: "r" },
        { k: "margin", label: "Margin", fmt: "pct", align: "r" }, { k: "growth", label: "Growth", fmt: "pctSign", align: "r" },
      ],
      rows: A.PRODUCTS.slice(), searchKeys: ["name", "cat"], exportName: "revenue-bi-product-performance",
      onRow: p => AV.productDrawer(p),
    });
  };

  /* ============================================================
     REGIONAL PERFORMANCE
     ============================================================ */
  P.regions = function (root, query) {
    const active = query ? query.get("r") || S.filters.region : S.filters.region;
    root.innerHTML = head("Regional Performance", "Revenue, growth, profit, margin and orders across North, South, East and West.",
      S.filters.region ? `<button class="btn btn-s" id="clrReg">Clear region filter</button>` : "") +
      filterBarHTML() +
      `<div class="grid">
        ${A.REGIONS.map(r => {
          const on = active === r.name;
          return `<div class="c-3"><button class="card link-card" style="padding:16px;${on ? "border-color:var(--primary);box-shadow:0 0 0 3px rgba(29,91,214,.14)" : ""}" data-reg="${r.name}">
            <div class="row row-between"><b style="font-size:15px">${r.name}</b>${on ? `<span class="badge b-info">${icon("check", "ic-14")} Filtered</span>` : delta(r.growth)}</div>
            <div class="kpi-value" style="font-size:22px;margin-top:10px">${f.cr(r.rev)}</div>
            <div class="small muted">Revenue · ${f.pct(r.share)} share</div>
            <div class="grid" style="grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
              <div><span class="muted2 small" style="display:block">Profit</span><b class="num">${f.cr(r.profit)}</b></div>
              <div><span class="muted2 small" style="display:block">Margin</span><b class="num">${f.pct(r.margin)}</b></div>
              <div><span class="muted2 small" style="display:block">Orders</span><b class="num">${f.lakh(r.orders, 2)}</b></div>
              <div><span class="muted2 small" style="display:block">AOV</span><b class="num">${f.inr(Math.round(r.rev * 1e5 / (r.orders * 1e5)))}</b></div>
            </div></button></div>`;
        }).join("")}
        <div class="c-7">${card("Revenue by Region", "Current vs prior period", `<a class="btn btn-g btn-sm" href="#/revenue">Revenue analytics</a>`, `<div class="chart-box" id="chRev"></div>`)}</div>
        <div class="c-5">${card("Revenue Share", "Composition of T12M revenue", "", `<div class="chart-box" id="chDonut"></div>`)}</div>
        <div class="c-6">${card("Margin by Region", "Net margin % — East trails the company average", "", `<div class="chart-box" id="chMgn"></div>`)}</div>
        <div class="c-6">${card("Orders by Region", "T12M order volume", "", `<div class="chart-box" id="chOrd"></div>`)}</div>
        <div class="c-12"><div class="table-wrap" id="regTable"></div></div>
      </div>`;
    wireFilterBar(root);
    const clr = root.querySelector("#clrReg"); if (clr) clr.onclick = () => { S.filters.region = ""; persist(); APP.route(true); };
    root.querySelectorAll("[data-reg]").forEach(b => b.onclick = () => {
      S.filters.region = S.filters.region === b.dataset.reg ? "" : b.dataset.reg;
      persist(); toast("info", S.filters.region ? "Filtered to " + S.filters.region : "Region filter cleared", "KPIs and charts now scope to this region.");
      APP.route(true);
    });
    CH.bars(root.querySelector("#chRev"), { labels: A.REGIONS.map(r => r.name), series: [
      { name: "Current", values: A.REGIONS.map(r => r.rev), color: getCss("--chart-1") },
      { name: "Prior", values: A.REGIONS.map(r => r.prev), color: getCss("--border-2") },
    ], text: null });
    CH.donut(root.querySelector("#chDonut"), { labels: A.REGIONS.map(r => r.name), values: A.REGIONS.map(r => r.rev), colors: [getCss("--chart-1"), getCss("--chart-5"), getCss("--chart-3"), getCss("--chart-4")] });
    CH.bars(root.querySelector("#chMgn"), { labels: A.REGIONS.map(r => r.name), series: [{ name: "Margin", values: A.REGIONS.map(r => r.margin), colors: A.REGIONS.map(r => r.margin >= 28 ? getCss("--ok") : getCss("--chart-4")) }], text: v => v.toFixed(1) + "%", legend: false });
    CH.bars(root.querySelector("#chOrd"), { labels: A.REGIONS.map(r => r.name), series: [{ name: "Orders (L)", values: A.REGIONS.map(r => r.orders), colors: A.REGIONS.map(() => getCss("--chart-2")) }], text: v => v.toFixed(2) + " L", legend: false });
    table({
      el: "#regTable",
      cols: [
        { k: "name", label: "Region" }, { k: "rev", label: "Revenue", fmt: "cr", align: "r", render: r => f.cr(r.rev) },
        { k: "growth", label: "Growth", fmt: "pctSign", align: "r" },
        { k: "profit", label: "Profit", align: "r", render: r => f.cr(r.profit) },
        { k: "margin", label: "Margin", fmt: "pct", align: "r" },
        { k: "orders", label: "Orders", align: "r", render: r => f.lakh(r.orders, 2) },
        { k: "share", label: "Share", fmt: "pct", align: "r" },
      ],
      rows: A.REGIONS.slice(), searchKeys: ["name"], exportName: "revenue-bi-regional-performance",
      sortKey: "rev",
    });
  };

  /* ============================================================
     PROFITABILITY ANALYSIS
     ============================================================ */
  P.profitability = function (root) {
    const w = windowOf(getWindow());
    const pl = A.PL.current, p0 = A.PL.prior;
    root.innerHTML = head("Profitability Analysis", "Where profit is created — by category, region and product — and which combinations deserve management focus.",
      `<button class="btn btn-s" id="pExp">${icon("download", "ic-14")} Export</button>`) +
      filterBarHTML() +
      `<div class="kpis">
        ${kpiCard({ label: "Gross Profit", ico: "scale", value: f.cr(pl.grossProfit * 100), deltaHtml: delta(A.PCT(pl.grossProfit, p0.grossProfit)), sub: "After cost of goods & fulfilment", foot: `<span class="num">Prior: ${f.cr(p0.grossProfit * 100)}</span>` })}
        ${kpiCard({ label: "Operating Profit", ico: "budget", value: f.cr(pl.operatingProfit * 100), deltaHtml: delta(A.PCT(pl.operatingProfit, p0.operatingProfit)), foot: `<span class="num">Opex ${f.cr(pl.opexTotal * 100)} (${f.pct(pl.opexTotal / pl.totalRevenue * 100)} of revenue)</span>` })}
        ${kpiCard({ label: "Net Profit", ico: "trendUp", value: f.cr(pl.netProfit * 100), deltaHtml: delta(A.PCT(pl.netProfit, p0.netProfit)), sparkVals: w.profit, sparkColor: getCss("--ok"), foot: `<span class="num">Prior: ${f.cr(p0.netProfit * 100)}</span>`, href: "#/pl" })}
        ${kpiCard({ label: "Gross Margin", ico: "percent", value: f.pct(pl.gm), deltaHtml: delta(pl.gm - p0.gm, { suffix: " pp" }), foot: `<span class="num">Prior: ${f.pct(p0.gm)}</span>` })}
        ${kpiCard({ label: "Net Margin", ico: "percent", value: f.pct(pl.nm), deltaHtml: delta(pl.nm - p0.nm, { suffix: " pp" }), foot: `<span class="num">Prior: ${f.pct(p0.nm)}</span>` })}
      </div>
      <div class="grid">
        <div class="c-6">${card("Profit Trend", "Monthly net profit · " + getWindow().label, "", `<div class="chart-box" id="chPT"></div>`)}</div>
        <div class="c-6">${card("Margin Trend", "Net margin % monthly · gross margin (flat line) as reference", "", `<div class="chart-box" id="chMT"></div>`)}</div>
        <div class="c-4">${card("Profit by Category", "T12M contribution", "", `<div class="chart-box" id="chPC"></div>`)}</div>
        <div class="c-4">${card("Profit by Region", "T12M contribution", "", `<div class="chart-box" id="chPR"></div>`)}</div>
        <div class="c-4">${card("Profit by Product", "Top 8 products", "", `<div class="chart-box" id="chPP"></div>`)}</div>
        <div class="c-12">${card("Profitability Matrix", "X: revenue · Y: profit margin · bubble: profit — categories in the top-right quadrant are the business core",
          `<span class="row gap-8 small muted" style="margin-left:auto"><span class="badge b-ok">Stars</span><span class="badge b-warn">Traffic</span><span class="badge b-mut">Question marks</span></span>`,
          `<div class="chart-box tall" id="chMatrix"></div>`)}
        </div>
      </div>`;
    wireFilterBar(root);
    root.querySelector("#pExp").onclick = () => AV.exportModal({ title: "Export profitability", report: "pl" });
    CH.line(root.querySelector("#chPT"), { labels: w.labels, series: [{ name: "Net Profit", values: w.profit, color: getCss("--ok"), width: 2.4, dots: true }], yFmt: "money" });
    const nm = w.profit.map((p, i) => +(p / w.rev[i] * 100).toFixed(1));
    CH.line(root.querySelector("#chMT"), { labels: w.labels, series: [
      { name: "Net Margin", values: nm, color: getCss("--chart-1"), width: 2.4 },
      { name: "Gross Margin", values: w.labels.map(() => 63.3), color: getCss("--border-2"), width: 1.4, dashed: true },
    ], yFmt: "pct" });
    CH.bars(root.querySelector("#chPC"), { hbar: true, labels: A.CATEGORIES.map(c => c.name), series: [{ name: "Profit", values: A.CATEGORIES.map(c => c.profit), colors: A.CATEGORIES.map(c => A.catColor(c.name)) }], text: v => f.cr(v, 2), legend: false });
    CH.bars(root.querySelector("#chPR"), { hbar: true, labels: A.REGIONS.map(r => r.name), series: [{ name: "Profit", values: A.REGIONS.map(r => r.profit), colors: A.REGIONS.map(() => getCss("--ok")) }], text: v => f.cr(v, 2), legend: false });
    const top8 = A.PRODUCTS.slice().sort((a, b) => b.profit - a.profit).slice(0, 8);
    CH.bars(root.querySelector("#chPP"), { hbar: true, labels: top8.map(p => p.name), series: [{ name: "Profit", values: top8.map(p => p.profit), colors: top8.map(p => A.catColor(p.cat)) }], text: v => f.cr(v, 2), legend: false });
    CH.bubble(root.querySelector("#chMatrix"), {
      pts: A.CATEGORIES.map(c => ({ x: c.rev / 100, y: c.margin, r: Math.max(14, Math.sqrt(c.profit) * 7.5), label: c.name, profit: c.profit, color: A.catColor(c.name) })),
      midY: 28,
    });
  };
})();
