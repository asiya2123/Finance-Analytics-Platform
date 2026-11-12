/* ============================================================
   DATASET-AWARE BUSINESS MODULES
   Shared browser-side data model for Analytics, Planning, Reporting,
   Intelligence and Data. No sample financial values are presented
   when an uploaded dataset is active.
   ============================================================ */
(function () {
  "use strict";
  const A = window.AV, P = A.pages, UI = window.UI;
  const { icon, toast, esc, CH, downloadFile, state: S } = UI;

  const PAGES = {
    revenue: { title: "Revenue Analytics", group: "Analytics", icon: "revenue", subtitle: "Revenue trends and sales drivers calculated from the active dataset.", metric: "revenue", chart: "trend" },
    expenses: { title: "Expense Analytics", group: "Analytics", icon: "expense", subtitle: "Understand costs and expense drivers found in the uploaded data.", metric: "expense", chart: "breakdown" },
    products: { title: "Product Performance", group: "Analytics", icon: "product", subtitle: "Rank products or comparable entities using the selected business metric.", metric: "revenue", groupBy: "product", chart: "breakdown" },
    regions: { title: "Regional Performance", group: "Analytics", icon: "region", subtitle: "Compare market or location performance using observed dataset values.", metric: "revenue", groupBy: "region", chart: "breakdown" },
    profitability: { title: "Profitability", group: "Analytics", icon: "scale", subtitle: "Assess profit and margin where revenue and cost fields are available.", metric: "profit", chart: "breakdown" },
    budgets: { title: "Budget Management", group: "Planning", icon: "budget", subtitle: "Review actuals against budget only when matching columns are present.", metric: "actual", chart: "budget" },
    variance: { title: "Variance Analysis", group: "Planning", icon: "variance", subtitle: "Analyze actual-versus-plan variance where the data supports it.", metric: "actual", chart: "variance" },
    forecast: { title: "Forecasting", group: "Planning", icon: "forecast", subtitle: "A transparent directional projection from historical dataset values.", metric: "revenue", chart: "forecast" },
    reports: { title: "Financial Reports", group: "Reporting", icon: "reports", subtitle: "Explore and export the current filtered dataset without fabricated totals.", metric: "revenue", chart: "report" },
    pl: { title: "Profit & Loss", group: "Reporting", icon: "scale", subtitle: "Summarize sales, expenses and profit using detected source fields.", metric: "profit", chart: "pl" },
    insights: { title: "Business Insights", group: "Intelligence", icon: "insights", subtitle: "Evidence-led observations generated from the uploaded dataset.", metric: "revenue", chart: "insights" },
    alerts: { title: "Alerts & Exceptions", group: "Intelligence", icon: "alerts", subtitle: "Data-quality and numeric exceptions identified in the active dataset.", metric: "revenue", chart: "alerts" },
    data: { title: "Data Management", group: "Data", icon: "data", subtitle: "Inspect, replace, and export the source records powering this workspace.", metric: "revenue", chart: "data" },
    quality: { title: "Data Quality", group: "Data", icon: "quality", subtitle: "Profile completeness, duplicate rows, numeric coverage and date coverage.", metric: "revenue", chart: "quality" }
  };

  const normalize = v => String(v == null ? "" : v).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  function number(v) {
    if (v == null || String(v).trim() === "") return NaN;
    let s = String(v).trim().replace(/[₹$€£,%\s]/g, "").replace(/,/g, "");
    if (/^\(.*\)$/.test(s)) s = "-" + s.slice(1, -1);
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  function dateValue(v) {
    if (v == null || String(v).trim() === "") return null;
    const s = String(v).trim();
    let d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
    const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (m) {
      let y = +m[3]; if (y < 100) y += y < 50 ? 2000 : 1900;
      d = new Date(y, +m[1] - 1, +m[2]);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
  }
  function csvCell(value) { const s = value == null ? "" : String(value); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function sum(values) { return values.reduce((a, v) => a + (Number.isFinite(v) ? v : 0), 0); }
  const fmt = (v, money) => (money ? "₹" : "") + Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 });

  function buildModel() {
    const ds = A.DATASET;
    if (!ds || !Array.isArray(ds.columns) || !Array.isArray(ds.rows)) return null;
    const columns = ds.columns.map(String);
    const allRows = Array.isArray(A.DASHBOARD_ALL_ROWS) && A.DASHBOARD_ALL_ROWS.length ? A.DASHBOARD_ALL_ROWS : ds.rows;
    const normalized = columns.map(normalize);
    const idx = (re) => normalized.findIndex(n => re.test(n));
    const numericIdx = [];
    columns.forEach((col, i) => {
      const populated = allRows.map(r => r && r[i]).filter(v => v != null && String(v).trim() !== "");
      const nums = populated.filter(v => Number.isFinite(number(v))).length;
      if ((ds.numericColumns || []).includes(col) || (populated.length > 0 && nums / populated.length >= .78 && !/(^|\b)(date|timestamp|year|month|period)(\b|$)/i.test(normalized[i]))) numericIdx.push(i);
    });
    const hasNum = (re) => numericIdx.find(i => re.test(normalized[i])) ?? -1;
    const pick = (re, numsOnly = false) => {
      const i = normalized.findIndex((n, ix) => re.test(n) && (!numsOnly || numericIdx.includes(ix)));
      return i;
    };
    let dateIdx = (ds.dateColumns || []).map(c => columns.indexOf(c)).find(i => i >= 0);
    if (dateIdx == null || dateIdx < 0) {
      dateIdx = pick(/(^|\b)(date|order date|transaction date|invoice date|created at|updated at|timestamp|ship date|delivery date|month|period)(\b|$)/i);
      if (dateIdx >= 0 && !allRows.some(r => dateValue(r[dateIdx]))) dateIdx = -1;
    }
    const revenueIdx = hasNum(/(^|\b)(revenue|sales|net sales|gross sales|sales amount|total sales|turnover|gmv|amount|order value|total amount|net amount)(\b|$)/i);
    const expenseIdx = hasNum(/(^|\b)(expenses?|cost|total cost|spend|cogs|purchase cost|operating expenses?|expenditure|shipping cost|marketing spend)(\b|$)/i);
    const profitIdx = hasNum(/(^|\b)(net profit|gross profit|profit|earnings|net income|operating income)(\b|$)/i);
    const budgetIdx = hasNum(/(^|\b)(budget|planned amount|plan amount|target|forecast budget|budgeted cost)(\b|$)/i);
    const actualIdx = hasNum(/(^|\b)(actual|actual amount|actual spend|actual cost|actual revenue)(\b|$)/i);
    const regionIdx = pick(/(^|\b)(region|territory|market|state|country|zone|location|sales area|geography)(\b|$)/i);
    const deptIdx = pick(/(^|\b)(department|dept|business unit|team|function|division)(\b|$)/i);
    const categoryIdx = pick(/(^|\b)(category|product category|segment|class|product type)(\b|$)/i);
    const productIdx = pick(/(^|\b)(product|item|sku|product name|item name|description|stock keeping unit)(\b|$)/i);
    const groupCandidates = [categoryIdx, productIdx, regionIdx, deptIdx, ...columns.map((_, i) => i).filter(i => !numericIdx.includes(i) && i !== dateIdx)];
    const groupIdx = groupCandidates.find(i => i >= 0 && !numericIdx.includes(i) && i !== dateIdx) ?? -1;
    // Avoid treating row IDs, ZIP codes, phone numbers, or identifiers as the main business measure.
    const idLike = /(^|\b)(id|row id|record id|customer id|client id|employee id|transaction id|order id|invoice id|account number|phone|telephone|postal code|zip code|sku|year|month number)(\b|$)/i;
    const measureCandidates = numericIdx.filter(i => !idLike.test(normalized[i]));
    const usableMeasures = measureCandidates.length ? measureCandidates : numericIdx;
    const metricIdxCandidates = usableMeasures.map(i => ({
      i,
      total: Math.abs(sum(allRows.map(r => number(r[i])))),
      coverage: allRows.filter(r => Number.isFinite(number(r[i]))).length,
      semantic: /(^|\b)(revenue|sales|amount|value|price|cost|expense|spend|profit|income|budget|actual|quantity|qty|units|orders|count|salary|margin|balance|payment|returns)(\b|$)/i.test(normalized[i]) ? 2 : 0
    }));
    metricIdxCandidates.sort((a, b) => b.semantic - a.semantic || b.coverage - a.coverage || b.total - a.total);
    const primaryIdx = revenueIdx >= 0 ? revenueIdx : (metricIdxCandidates[0]?.i ?? -1);
    const secondaryIdx = expenseIdx >= 0 ? expenseIdx : (metricIdxCandidates.find(x => x.i !== primaryIdx)?.i ?? -1);
    const filters = S.filters || {};
    const unique = i => i < 0 ? [] : [...new Set(allRows.map(r => String(r?.[i] ?? "").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).slice(0,250);
    const dims = { region: regionIdx, dept: deptIdx, category: categoryIdx, product: productIdx };
    const validDates = dateIdx >= 0 ? allRows.map(r => dateValue(r[dateIdx])).filter(Boolean).sort((a,b)=>a-b) : [];
    const latest = validDates.length ? validDates[validDates.length - 1] : null;
    function dateMatches(row) {
      if (dateIdx < 0 || !latest) return true;
      const d = dateValue(row[dateIdx]); if (!d) return false;
      const maxYear = latest.getFullYear(), maxMonth = latest.getMonth();
      const fiscalStartYear = maxMonth >= 3 ? maxYear : maxYear - 1;
      let start, end;
      if (filters.quarter === "q1") { start = new Date(fiscalStartYear, 3, 1); end = new Date(fiscalStartYear, 6, 1); }
      else if (filters.quarter === "q2") { start = new Date(fiscalStartYear, 6, 1); end = new Date(fiscalStartYear, 9, 1); }
      else if (filters.quarter === "q3") { start = new Date(fiscalStartYear, 9, 1); end = new Date(fiscalStartYear + 1, 0, 1); }
      else if (filters.quarter === "q4") { start = new Date(fiscalStartYear + 1, 0, 1); end = new Date(fiscalStartYear + 1, 3, 1); }
      else if (S.period === "t6m") { start = new Date(maxYear, maxMonth - 5, 1); end = new Date(maxYear, maxMonth + 1, 1); }
      else if (S.period === "t3m") { start = new Date(maxYear, maxMonth - 2, 1); end = new Date(maxYear, maxMonth + 1, 1); }
      else if (S.period === "fy26") { start = new Date(fiscalStartYear, 3, 1); end = new Date(maxYear, maxMonth + 1, 1); }
      else if (S.period === "fy25") { start = new Date(fiscalStartYear - 1, 3, 1); end = new Date(fiscalStartYear, 3, 1); }
      else { start = new Date(maxYear, maxMonth - 11, 1); end = new Date(maxYear, maxMonth + 1, 1); }
      return d >= start && d < end;
    }
    const isApplicableFilter = (key, idxValue) => idxValue >= 0 && unique(idxValue).some(v => v.toLowerCase() === String(filters[key] || "").toLowerCase());
    let filtered = allRows.filter(row => {
      const matches = key => !filters[key] || !isApplicableFilter(key, dims[key]) || String(row?.[dims[key]] ?? "").trim().toLowerCase() === String(filters[key]).trim().toLowerCase();
      return matches("region") && matches("dept") && matches("category") && matches("product") && dateMatches(row);
    });
    // If the selected time window has no overlap, keep dimensions honoured and say so explicitly.
    const noDateMatches = filtered.length === 0 && allRows.length > 0 && dateIdx >= 0 && validDates.length > 0;
    if (noDateMatches) filtered = allRows.filter(row => Object.entries(dims).every(([key, i]) => !filters[key] || !isApplicableFilter(key, i) || String(row?.[i] ?? "").trim().toLowerCase() === String(filters[key]).trim().toLowerCase()));
    const valuesAt = (rows, i) => i < 0 ? [] : rows.map(r => number(r?.[i])).filter(Number.isFinite);
    const sumAt = (rows, i) => sum(valuesAt(rows, i));
    const avgAt = (rows, i) => valuesAt(rows, i).length ? sumAt(rows, i) / valuesAt(rows, i).length : 0;
    const distinctAt = (rows, i) => i < 0 ? 0 : new Set(rows.map(r => String(r?.[i] ?? "").trim()).filter(Boolean)).size;
    const groupValues = (rows, group, measure, max = 10) => {
      if (group < 0) return [];
      const map = new Map();
      rows.forEach(r => {
        const label = String(r?.[group] ?? "").trim() || "Unspecified";
        let v = measure >= 0 ? number(r?.[measure]) : 1;
        if (!Number.isFinite(v)) v = 0;
        map.set(label, (map.get(label) || 0) + v);
      });
      return [...map.entries()].sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,max);
    };
    const monthly = (rows, metric) => {
      if (dateIdx < 0 || metric < 0) return [];
      const map = new Map();
      rows.forEach(r => { const d = dateValue(r[dateIdx]), v = number(r[metric]); if (!d || !Number.isFinite(v)) return; const k = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0"); map.set(k,(map.get(k)||0)+v); });
      return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-24).map(([k,value])=>({ key:k,label:new Date(+k.slice(0,4),+k.slice(5)-1,1).toLocaleDateString("en-IN",{month:"short",year:"2-digit"}),value }));
    };
    return { ds, columns, allRows, rows: filtered, numericIdx, dateIdx, revenueIdx, expenseIdx, profitIdx, budgetIdx, actualIdx, regionIdx, deptIdx, categoryIdx, productIdx, primaryIdx, secondaryIdx, groupIdx, dims, unique, valuesAt, sumAt, avgAt, distinctAt, groupValues, monthly, noDateMatches, latest, validDates, primaryName: primaryIdx >= 0 ? columns[primaryIdx] : "Records", isMoney: primaryIdx >= 0 && /revenue|sales|amount|cost|expense|profit|income|price|turnover|gmv|budget|spend|value/i.test(columns[primaryIdx]) };
  }

  function makeOptions(values, current, allLabel) {
    return `<option value="">${esc(allLabel)}</option>` + values.map(v => `<option value="${esc(v)}" ${String(v) === String(current || "") ? "selected" : ""}>${esc(v)}</option>`).join("");
  }
  function safeFilterMarkup(m) {
    const fl=S.filters||{};
    const defs=[["region","Region",m.regionIdx],["dept","Department",m.deptIdx],["category","Category",m.categoryIdx],["product","Product",m.productIdx]].filter(x=>x[2]>=0);
    const latestYear = m.latest ? m.latest.getFullYear() : new Date().getFullYear();
    const fyStart = m.latest ? (m.latest.getMonth() >= 3 ? latestYear : latestYear - 1) : (new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1);
    const fyLabel = y => `FY ${y}-${String((y + 1) % 100).padStart(2,"0")}`;
    const period = m.dateIdx>=0 ? `<label class="bi-filter-field"><span>Date range / financial year</span><select data-bi-filter="period"><option value="t12m" ${S.period==='t12m'?'selected':''}>Last 12 months</option><option value="t6m" ${S.period==='t6m'?'selected':''}>Last 6 months</option><option value="t3m" ${S.period==='t3m'?'selected':''}>Last quarter</option><option value="fy26" ${S.period==='fy26'?'selected':''}>${esc(fyLabel(fyStart))} (YTD)</option><option value="fy25" ${S.period==='fy25'?'selected':''}>${esc(fyLabel(fyStart-1))}</option></select></label>` : "";
    const quarter = m.dateIdx>=0 ? `<label class="bi-filter-field"><span>Quarter</span><select data-bi-filter="quarter"><option value="" ${!fl.quarter?'selected':''}>All quarters</option><option value="q1" ${fl.quarter==='q1'?'selected':''}>Q1 · Apr–Jun</option><option value="q2" ${fl.quarter==='q2'?'selected':''}>Q2 · Jul–Sep</option><option value="q3" ${fl.quarter==='q3'?'selected':''}>Q3 · Oct–Dec</option><option value="q4" ${fl.quarter==='q4'?'selected':''}>Q4 · Jan–Mar</option></select></label>` : "";
    return `<div class="bi-filterbar glass-panel"><div class="bi-filter-title">${icon("filter","ic-14")} Dataset filters</div>${period}${quarter}${defs.map(([key,label,i])=>`<label class="bi-filter-field"><span>${label}</span><select data-bi-filter="${key}">${makeOptions(m.unique(i),fl[key],"All "+label.toLowerCase()+"s")}</select></label>`).join("")}<div class="bi-filter-actions"><button class="btn btn-s btn-sm" data-bi-action="apply">Apply</button><button class="btn btn-g btn-sm" data-bi-action="reset">Reset</button></div></div>`;
  }
  function uploadMarkup(m) {
    const ds = m?.ds;
    return `<section class="bi-upload glass-panel" id="biUploadDrop"><div class="bi-upload-orb">${icon("upload","ic-24")}</div><div class="bi-upload-copy"><span class="bi-eyebrow">DATA WORKSPACE · BROWSER-LOCAL IMPORT</span><h2>${ds ? "Replace or refresh your active dataset" : "Start with your own business data"}</h2><p>Upload CSV, XLSX, TSV or JSON. Every analytics module will recalculate from the imported rows and detected columns.</p><div class="bi-format-chips"><span>CSV</span><span>XLSX</span><span>TSV</span><span>JSON</span><span>25 MB limit</span></div></div><div class="bi-upload-actions"><button class="btn btn-p" id="biChooseFile">${icon("upload","ic-14")} ${ds ? "Upload another dataset" : "Choose dataset"}</button><small>${ds ? esc(ds.name) + " · " + Number(ds.total || m.rows.length).toLocaleString("en-IN") + " source records" : "No dataset loaded yet"}</small></div><input type="file" id="biFileInput" class="hidden" accept=".csv,.xlsx,.tsv,.json,.txt"></section>`;
  }
  function kpi(label, value, sub, money, symbol) {
    return `<article class="bi-kpi clay-panel"><div class="bi-kpi-top"><span>${esc(label)}</span><span class="bi-kpi-icon">${icon(symbol || "trendUp","ic-16")}</span></div><div class="bi-kpi-value" data-bi-count="${Number.isFinite(value)?value:0}" data-bi-money="${money?"1":"0"}">${fmt(value,money)}</div><p>${esc(sub || "Calculated from active dataset")}</p><div class="bi-kpi-meter"><i></i></div></article>`;
  }
  function chartCard(title, sub, id, span = "6") {
    return `<section class="card bi-chart-card dataset-chart-card dataset-span-${span}"><div class="card-h"><div><div class="t">${esc(title)}</div><div class="s">${esc(sub || "Aggregated from uploaded records")}</div></div><span class="badge b-info">Live data</span></div><div class="card-b"><div class="chart-box dataset-chart-box" id="${id}" data-animate-chart="true"></div></div></section>`;
  }
  function alertCount(m) {
    let missing = 0, negative = 0, duplicates = 0;
    const seen = new Set();
    m.rows.forEach(r => {
      const key = JSON.stringify(r); if (seen.has(key)) duplicates++; else seen.add(key);
      m.columns.forEach((c,i)=>{ const v=r?.[i]; if(v==null||String(v).trim()==="") missing++; else if(m.numericIdx.includes(i)&&number(v)<0) negative++; });
    });
    return { missing, negative, duplicates, total: missing + negative + duplicates, rows: m.rows.length };
  }
  A.getDatasetAlertCount = function () { const m = buildModel(); if (!m) return 0; const a = alertCount(m); return (a.missing ? 1 : 0) + (a.negative ? 1 : 0) + (a.duplicates ? 1 : 0); };

  function pageModel(id, m) {
    const cfg = PAGES[id];
    const pageMetric = cfg.metric;
    let metric = m.primaryIdx, label = m.primaryName, money = m.isMoney, derived = false;
    if (pageMetric === "revenue") { metric = m.revenueIdx >= 0 ? m.revenueIdx : m.primaryIdx; }
    if (pageMetric === "expense") { metric = m.expenseIdx >= 0 ? m.expenseIdx : (m.secondaryIdx >= 0 ? m.secondaryIdx : m.primaryIdx); }
    if (pageMetric === "actual") { metric = m.actualIdx >= 0 ? m.actualIdx : (m.expenseIdx >= 0 ? m.expenseIdx : m.primaryIdx); }
    if (pageMetric === "profit") {
      if (m.profitIdx >= 0) metric = m.profitIdx;
      else if (m.revenueIdx >= 0 && m.expenseIdx >= 0) { metric = -2; derived = true; label = "Derived profit (revenue − expense)"; money = true; }
      else metric = m.primaryIdx;
    }
    if (metric >= 0) { label = m.columns[metric]; money = /revenue|sales|amount|cost|expense|profit|income|price|turnover|gmv|budget|spend|value/i.test(label); }
    const valueRows = m.rows.map(r => {
      if (derived) { const a = number(r[m.revenueIdx]), b = number(r[m.expenseIdx]); return Number.isFinite(a) && Number.isFinite(b) ? a - b : NaN; }
      return metric >= 0 ? number(r[metric]) : NaN;
    }).filter(Number.isFinite);
    const total = sum(valueRows), average = valueRows.length ? total / valueRows.length : 0;
    const groupIdx = cfg.groupBy === "product" ? (m.productIdx >= 0 ? m.productIdx : m.groupIdx) : cfg.groupBy === "region" ? (m.regionIdx >= 0 ? m.regionIdx : m.groupIdx) : m.groupIdx;
    const groupName = groupIdx >= 0 ? m.columns[groupIdx] : "Records";
    let grouped = [];
    if (derived) {
      const map = new Map(); m.rows.forEach(r => { const name=groupIdx>=0 ? String(r[groupIdx]||"Unspecified") : "All records"; const a=number(r[m.revenueIdx]),b=number(r[m.expenseIdx]); if(!Number.isFinite(a)||!Number.isFinite(b))return; map.set(name,(map.get(name)||0)+a-b); });
      grouped=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12);
    } else grouped = m.groupValues(m.rows, groupIdx, metric, 12);
    const monthly = derived ? [] : m.monthly(m.rows, metric);
    const budgetMetric = m.budgetIdx;
    const actualMetric = m.actualIdx >= 0 ? m.actualIdx : (m.expenseIdx >= 0 ? m.expenseIdx : -1);
    const budgetTotal = m.sumAt(m.rows,budgetMetric), actualTotal = m.sumAt(m.rows,actualMetric);
    return { cfg, metric, label, money, derived, valueRows, total, average, groupIdx, groupName, grouped, monthly, budgetMetric, actualMetric, budgetTotal, actualTotal };
  }
  function animateCounts(root) {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.querySelectorAll("[data-bi-count]").forEach(el => {
      const end = Number(el.dataset.biCount || 0), money = el.dataset.biMoney === "1";
      const set = n => { el.textContent = fmt(n, money); };
      if (reduce) { set(end); return; }
      const start = performance.now(), duration = 850;
      function tick(now) { const t=Math.min(1,(now-start)/duration), eased=1-Math.pow(1-t,3); set(end*eased); if(t<1) requestAnimationFrame(tick); }
      set(0); requestAnimationFrame(tick);
    });
    root.querySelectorAll(".bi-chart-card").forEach((el,i)=>{ el.style.animationDelay=(i*75)+"ms"; el.classList.add("dataset-chart-enter"); });
  }
  function addTable(root, m) {
    const host = root.querySelector("#biRecordsTable"); if (!host) return;
    const displayCols = m.columns.slice(0, Math.min(10,m.columns.length));
    const rows = m.rows.slice(0, 3000).map(r => { const o={}; displayCols.forEach((c,i)=>{o[c]=r[i] == null ? "" : r[i];}); return o; });
    if (!rows.length) { host.innerHTML = `<div class="bi-empty">No rows match the active filters. Reset filters or choose a different date range.</div>`; return; }
    UI.table({
      el: "#biRecordsTable",
      cols: displayCols.map((c,i)=>({k:c,label:c,align:m.numericIdx.includes(i)?"r":"l",render:r=>esc(String(r[c] ?? ""))})),
      rows, pageSize: 8, searchKeys: displayCols, exportName: "uploaded-dataset-preview", dense: true,
      toolbar: `<span class="badge b-mut">${m.rows.length.toLocaleString("en-IN")} filtered rows · source: ${esc(m.ds.name)}</span>`
    });
  }
  function renderDatasetPage(root, id) {
    const m = buildModel(); if (!m) return;
    const cfg = PAGES[id], pm = pageModel(id,m), anomalies = alertCount(m);
    const uniqueGroup = pm.grouped.length;
    const isData = id === "data";
    const isQuality = id === "quality";
    const isAlerts = id === "alerts";
    const isInsights = id === "insights";
    const isReports = id === "reports";
    const isPL = id === "pl";
    const isBudget = id === "budgets";
    const isVariance = id === "variance";
    const isForecast = id === "forecast";
    const primaryTotal = pm.total;
    const actualAvailable = pm.actualMetric >= 0;
    const budgetAvailable = pm.budgetMetric >= 0;
    const revenue = m.sumAt(m.rows,m.revenueIdx), expenses = m.sumAt(m.rows,m.expenseIdx), profit = m.profitIdx >= 0 ? m.sumAt(m.rows,m.profitIdx) : (m.revenueIdx >= 0 && m.expenseIdx >= 0 ? revenue-expenses : NaN);
    const rowShare = m.allRows.length ? m.rows.length/m.allRows.length*100 : 0;
    const dateMessage = m.dateIdx < 0 ? `No date field was identified, so time-period filters are not applied to this dataset.` : `${m.columns[m.dateIdx]} is used for the active date range. Latest source date: ${m.latest ? m.latest.toLocaleDateString("en-IN") : "not detected"}.`;

    let kpis = [];
    if (isQuality) {
      const allCells = m.rows.length*m.columns.length;
      const missingPct = allCells ? (1-anomalies.missing/allCells)*100 : 0;
      const uniqueRows = new Set(m.rows.map(r=>JSON.stringify(r))).size;
      kpis = [kpi("Rows analyzed",m.rows.length,"Rows after active filters",false,"db"),kpi("Fields detected",m.columns.length,`${m.numericIdx.length} numeric · ${m.columns.length-m.numericIdx.length} other`,false,"data"),kpi("Completeness (%)",missingPct,`${anomalies.missing.toLocaleString("en-IN")} empty cells`,false,"check"),kpi("Duplicate rows",anomalies.duplicates,`${uniqueRows.toLocaleString("en-IN")} distinct records`,false,"copy")];
    } else if (isAlerts) {
      kpis=[kpi("Exception types",A.getDatasetAlertCount(),"Missing, negative or duplicate values",false,"alerts"),kpi("Missing cells",anomalies.missing,"Blank cells in filtered rows",false,"data"),kpi("Negative numeric values",anomalies.negative,"Review whether negatives are valid",false,"variance"),kpi("Duplicate rows",anomalies.duplicates,"Exact duplicate records",false,"copy")];
    } else if (isBudget || isVariance) {
      if (budgetAvailable && actualAvailable) {
        kpis=[kpi("Budget / Plan",pm.budgetTotal,"Summed from detected budget field",true,"budget"),kpi("Actual",pm.actualTotal,"Summed from detected actual field",true,"expense"),kpi("Variance",pm.actualTotal-pm.budgetTotal,"Actual minus plan · positive = over plan",true,"variance"),kpi("Utilization (%)",pm.budgetTotal?pm.actualTotal/pm.budgetTotal*100:0,"Actual ÷ budget",false,"trendUp")];
      } else {
        kpis=[kpi("Rows analyzed",m.rows.length,"Filtered dataset records",false,"db"),kpi(`Total ${pm.label}`,pm.total,"Observed aggregate only",pm.money,"trendUp"),kpi(`Average ${pm.label}`,pm.average,"Average across valid numeric values",pm.money,"scale"),kpi("Plan fields",0,"No budget/plan and actual field pair detected",false,"budget")];
      }
    } else if (isPL && m.revenueIdx >= 0 && m.expenseIdx >= 0) {
      kpis=[kpi("Revenue / Sales",revenue,`Source field: ${m.columns[m.revenueIdx]}`,true,"revenue"),kpi("Expenses",expenses,`Source field: ${m.columns[m.expenseIdx]}`,true,"expense"),kpi("Profit",profit,"Source profit field or revenue minus expenses",true,"scale"),kpi("Margin (%)",revenue?profit/revenue*100:0,"Profit ÷ revenue",false,"trendUp")];
    } else {
      kpis=[kpi("Rows in view",m.rows.length,`${m.allRows.length.toLocaleString("en-IN")} rows in source file`,false,"db"),kpi(`Total ${pm.label}`,primaryTotal,pm.derived?"Derived from revenue minus cost":"Aggregated from uploaded records",pm.money,"trendUp"),kpi(`Average ${pm.label}`,pm.average,`${pm.valueRows.length.toLocaleString("en-IN")} numeric values`,pm.money,"scale"),kpi(`Unique ${pm.groupName}`,m.distinctAt(m.rows,pm.groupIdx)||m.columns.length,pm.groupIdx>=0?`Distinct values in ${pm.groupName}`:"Fields detected",false,"product")];
    }

    let notes = [];
    if (m.noDateMatches) notes.push("The active date window did not overlap the file; dimension filters were retained and available dates are shown.");
    if (isBudget && !(budgetAvailable&&actualAvailable)) notes.push("The upload does not contain both a budget/plan field and an actual field. Budget-specific values are intentionally not invented.");
    if (isVariance && !(budgetAvailable&&actualAvailable)) notes.push("A true budget variance needs matching budget/plan and actual columns. The page is showing observed dataset totals until those fields exist.");
    if (isForecast && m.dateIdx < 0) notes.push("No usable date field was detected. The chart ranks observed groups instead of projecting a time series.");
    if (isForecast && m.monthly(m.rows,pm.metric).length < 3) notes.push("Fewer than three time periods are available. Any projection should be treated as directional, not a validated forecast.");
    if (isQuality && !m.rows.length) notes.push("No rows remain after filtering. Clear filters to assess the full uploaded dataset.");

    const trend = pm.monthly;
    const trendChartTitle = trend.length ? `${pm.label} over time` : `${pm.label} by ${pm.groupName}`;
    let chartMarkup = "";
    if (isData) {
      chartMarkup = `<div class="bi-section-head"><div><h2>Source records</h2><p>Rows below are from the active upload and reflect the current filters.</p></div><button class="btn btn-s btn-sm" data-bi-action="export">${icon("download","ic-14")} Export filtered rows</button></div><div class="card bi-table-card"><div class="card-b"><div class="table-wrap" id="biRecordsTable"></div></div></div><div class="bi-field-footer"><b>Detected schema</b><span>Numeric: ${esc(m.numericIdx.map(i=>m.columns[i]).join(", ") || "none")}</span><span>Date: ${esc(m.dateIdx>=0?m.columns[m.dateIdx]:"none")}</span><span>Source records: ${m.allRows.length.toLocaleString("en-IN")}</span></div>`;
    } else if (isQuality) {
      const qualityRows = m.columns.map((c,i)=>{const missing=m.rows.filter(r=>r[i]==null||String(r[i]).trim()==="").length;const completeness=m.rows.length?(1-missing/m.rows.length)*100:0;const type=m.numericIdx.includes(i)?"Numeric":i===m.dateIdx?"Date":"Text / category";return {field:c,type,filled:m.rows.length-missing,missing,completeness};}).sort((a,b)=>a.completeness-b.completeness);
      chartMarkup = `<div class="grid"><div class="c-7"><div class="card bi-table-card"><div class="card-h"><div><div class="t">Field-level quality</div><div class="s">Completeness is calculated over the filtered source rows</div></div></div><div class="card-b"><div class="table-wrap" id="biQualityTable"></div></div></div></div><div class="c-5"><div class="card bi-insight-card"><div class="card-h"><div><div class="t">Quality assessment</div><div class="s">Observed issues in uploaded records</div></div></div><div class="card-b"><div class="bi-insight-list">${[["Empty cells",anomalies.missing,"warn"],["Exact duplicate rows",anomalies.duplicates,anomalies.duplicates?"warn":"ok"],["Negative numeric cells",anomalies.negative,anomalies.negative?"warn":"ok"],["Date field",m.dateIdx>=0?m.columns[m.dateIdx]:"Not detected",m.dateIdx>=0?"ok":"warn"]].map(([l,v,st])=>`<div class="bi-insight-row"><span class="bi-status ${st}"></span><div><b>${esc(l)}</b><small>${esc(String(v))}</small></div></div>`).join("")}</div></div></div></div></div>`;
    } else if (isAlerts) {
      const items = [
        { title:"Missing values", count:anomalies.missing, text:"Blank cells found across the active filtered rows.", level:anomalies.missing?"Review":"Clear" },
        { title:"Negative numeric values", count:anomalies.negative, text:"Negative numbers can be valid returns or adjustments; verify by field context.", level:anomalies.negative?"Review":"Clear" },
        { title:"Duplicate records", count:anomalies.duplicates, text:"Exact row-level duplicates detected in the active view.", level:anomalies.duplicates?"Review":"Clear" }
      ];
      chartMarkup = `<div class="card bi-table-card"><div class="card-h"><div><div class="t">Dataset exceptions</div><div class="s">Generated from data quality checks — not static demo alerts</div></div><button class="btn btn-s btn-sm" data-bi-action="export">${icon("download","ic-14")} Export rows</button></div><div class="card-b"><div class="bi-alert-list">${items.map(it=>`<article class="bi-alert-row"><div class="bi-alert-mark ${it.count?"warn":"ok"}">${icon(it.count?"alerts":"check","ic-16")}</div><div class="bi-alert-copy"><b>${esc(it.title)}</b><p>${esc(it.text)}</p></div><div class="bi-alert-count"><strong>${Number(it.count).toLocaleString("en-IN")}</strong><span>${it.level}</span></div></article>`).join("")}</div></div></div>`;
    } else if (isInsights) {
      const top = pm.grouped[0]; const low = pm.grouped.length ? pm.grouped[pm.grouped.length-1] : null;
      const findings = [
        ["Coverage",`${m.rows.length.toLocaleString("en-IN")} records are included in the current view (${rowShare.toFixed(1)}% of source rows).`,"db"],
        ["Metric profile",`${pm.label} aggregates to ${fmt(pm.total,pm.money)} with an average of ${fmt(pm.average,pm.money)}.`,"trendUp"],
        [top?`Leading ${pm.groupName}`:"Group comparison",top?`${top[0]} has the largest observed aggregate (${fmt(top[1],pm.money)}).`:"No categorical column was detected to support a grouped comparison.","product"],
        [low?"Comparison point":"Data limitation",low?`${low[0]} is the smallest of the currently displayed groups (${fmt(low[1],pm.money)}).`:"Upload a category, region or product field to create group-level insights.","insights"]
      ];
      chartMarkup = `<div class="bi-insight-grid">${findings.map(([t,d,i])=>`<article class="bi-insight-card glass-panel"><span class="bi-insight-icon">${icon(i,"ic-18")}</span><b>${esc(t)}</b><p>${esc(d)}</p><small>Computed from current filtered records</small></article>`).join("")}</div><div class="bi-footnote">These are descriptive statistics, not an AI-generated causal explanation. Interpret them alongside business context.</div>`;
    } else if (isReports) {
      chartMarkup = `<div class="bi-section-head"><div><h2>${id === "pl" ? "P&L details" : "Source report"}</h2><p>Export uses the current filtered rows and the uploaded headers.</p></div><button class="btn btn-p btn-sm" data-bi-action="export">${icon("download","ic-14")} Export CSV</button></div><div class="card bi-table-card"><div class="card-b"><div class="table-wrap" id="biRecordsTable"></div></div></div>`;
    } else if (isForecast) {
      chartMarkup = `${chartCard(trendChartTitle,trend.length?`Monthly aggregates from ${m.columns[m.dateIdx]}`:`Top group totals · no date series detected`,"biChartA","8")}${chartCard("Projection method","Linear trend across available monthly aggregates","biChartB","4")}<div class="bi-footnote">Projection uses a simple least-squares trend on historical aggregates. It is a directional baseline, not a guaranteed outcome or a substitute for a validated forecasting model.</div>`;
    } else if (isBudget || isVariance) {
      chartMarkup = `${chartCard(budgetAvailable&&actualAvailable?"Actual vs budget by group":"Observed metric by group",budgetAvailable&&actualAvailable?"Grouped sums of uploaded plan and actual fields":"No plan/actual pair detected; displaying only observed values","biChartA","8")}${chartCard("Field coverage","Numeric measures available in this dataset","biChartB","4")}`;
    } else if (isPL) {
      chartMarkup = `${chartCard("P&L components","Revenue, expense and profit fields where detected","biChartA","8")}${chartCard("Metric breakdown","Top groups based on the selected profit metric","biChartB","4")}`;
    } else {
      chartMarkup = `${chartCard(trendChartTitle,trend.length?`Monthly aggregates from ${m.dateIdx>=0?m.columns[m.dateIdx]:"detected date field"}`:`Top ${pm.groupName} values by ${pm.label}`,"biChartA","8")}${chartCard(`Breakdown by ${pm.groupName}`,"Highest aggregate groups in the current view","biChartB","4")}`;
    }

    root.innerHTML = `<main class="bi-dataset-page">
      <div class="bi-hero"><div class="bi-hero-copy"><div class="bi-eyebrow"><span class="bi-live-dot"></span>${esc(cfg.group)} / DATASET VIEW</div><h1>${esc(cfg.title)}</h1><p>${esc(cfg.subtitle)}</p><div class="bi-source-line"><span class="bi-source-chip">${icon("db","ic-14")} ${esc(m.ds.name)}</span><span>${m.rows.length.toLocaleString("en-IN")} rows in view</span><span>${m.columns.length} fields</span></div></div><div class="bi-hero-actions"><button class="btn btn-s btn-sm" data-bi-action="refresh">${icon("refresh","ic-14")} Refresh</button>${!isData&&!isQuality&&!isAlerts?`<button class="btn btn-g btn-sm" data-bi-action="export">${icon("download","ic-14")} Export view</button>`:""}</div></div>
      ${isData?uploadMarkup(m):""}
      ${safeFilterMarkup(m)}
      ${notes.map(t=>`<div class="note bi-note">${icon("help","ic-14")}<span>${esc(t)}</span></div>`).join("")}
      <div class="bi-kpi-grid">${kpis.join("")}</div>
      ${chartMarkup}
      ${!isData&&!isQuality&&!isAlerts&&!isInsights&&!isReports ? `<div class="bi-section-head"><div><h2>Supporting records</h2><p>Data source: ${esc(m.ds.name)}. Values are calculated from currently matching rows.</p></div><button class="btn btn-s btn-sm" data-bi-action="export">${icon("download","ic-14")} Export filtered rows</button></div><div class="card bi-table-card"><div class="card-b"><div class="table-wrap" id="biRecordsTable"></div></div></div>` : ""}
      <footer class="bi-field-footer"><b>Data provenance</b><span>${esc(dateMessage)}</span><span>${m.numericIdx.length} numeric fields</span><span>${m.columns.length-m.numericIdx.length} other fields</span><span>Calculated in this browser</span></footer>
    </main>`;

    // Bind filters. Each navigation module reads the same shared selection state.
    root.querySelectorAll("[data-bi-filter]").forEach(sel=>sel.addEventListener("change",()=>{
      const k=sel.dataset.biFilter;
      if(k === "period") { S.period = sel.value || "t12m"; S.filters.quarter = ""; }
      else if(k === "quarter") { S.filters.quarter = sel.value; if(sel.value) S.period = "t12m"; }
      else S.filters[k]=sel.value;
      UI.persist();
    }));
    root.querySelectorAll('[data-bi-action="apply"]').forEach(b=>b.onclick=()=>window.APP.route(true));
    root.querySelectorAll('[data-bi-action="reset"]').forEach(b=>b.onclick=()=>{ S.filters={...S.filters,region:"",dept:"",category:"",product:"",quarter:""}; S.period="t12m"; UI.persist(); window.APP.route(true); });
    root.querySelectorAll('[data-bi-action="refresh"]').forEach(b=>b.onclick=()=>window.APP.route(true));
    root.querySelectorAll('[data-bi-action="export"]').forEach(b=>b.onclick=()=>{
      const csv=[m.columns.map(csvCell).join(","),...m.rows.map(r=>m.columns.map((_,i)=>csvCell(r?.[i])).join(","))].join("\r\n");
      downloadFile(`${id}-${(m.ds.name||"dataset").replace(/[^a-z0-9._-]+/gi,"-")}.csv`,csv,"text/csv;charset=utf-8");
      toast("ok","Export ready",`${m.rows.length.toLocaleString("en-IN")} filtered rows exported as CSV.`);
    });
    if (isData) wireUpload(root);
    animateCounts(root);
    // All numeric values and graph series below are based on the same filtered model.
    if (isQuality) {
      const qHost=root.querySelector("#biQualityTable");
      if(qHost){ const cols=[{k:"field",label:"Field"},{k:"type",label:"Detected type"},{k:"filled",label:"Filled",align:"r"},{k:"missing",label:"Missing",align:"r"},{k:"completeness",label:"Completeness",align:"r",render:r=>`${r.completeness.toFixed(1)}%`}];const rows=m.columns.map((c,i)=>{const missing=m.rows.filter(r=>r[i]==null||String(r[i]).trim()==="").length;return {field:c,type:m.numericIdx.includes(i)?"Numeric":i===m.dateIdx?"Date":"Text / category",filled:m.rows.length-missing,missing,completeness:m.rows.length?(1-missing/m.rows.length)*100:0};}).sort((a,b)=>a.completeness-b.completeness);UI.table({el:"#biQualityTable",cols,rows,pageSize:10,searchKeys:["field","type"],dense:true}); }
    } else if (!isData && !isReports && !isInsights && !isAlerts) {
      const chA=root.querySelector("#biChartA"), chB=root.querySelector("#biChartB");
      if (chA) {
        if ((isBudget||isVariance) && budgetAvailable && actualAvailable) {
          const planMap=new Map(),actualMap=new Map(); m.rows.forEach(r=>{const k=pm.groupIdx>=0?String(r[pm.groupIdx]||"Unspecified"):"All rows";planMap.set(k,(planMap.get(k)||0)+(number(r[budgetMetricIndex(m)] )||0));actualMap.set(k,(actualMap.get(k)||0)+(number(r[actualMetricIndex(m)])||0));});
          const labels=[...new Set([...planMap.keys(),...actualMap.keys()])].slice(0,10);
          if(labels.length) CH.bars(chA,{labels,series:[{name:"Budget / plan",values:labels.map(l=>planMap.get(l)||0),color:UI.getCss("--chart-2")},{name:"Actual",values:labels.map(l=>actualMap.get(l)||0),color:UI.getCss("--chart-1")}],legend:true,yFmt:"money"});
          else chA.innerHTML='<div class="bi-empty">Not enough group data to compare plan and actual.</div>';
        } else if (isPL && m.revenueIdx>=0 && m.expenseIdx>=0) {
          const pValue=m.profitIdx>=0?m.sumAt(m.rows,m.profitIdx):revenue-expenses;
          CH.bars(chA,{labels:["Revenue","Expenses","Profit"],series:[{name:"Amount",values:[revenue,expenses,pValue],color:UI.getCss("--chart-1")}],legend:false,yFmt:"money"});
        } else if (isForecast && trend.length >= 2) {
          const vals=trend.map(x=>x.value), n=vals.length, meanX=(n-1)/2, meanY=sum(vals)/n;
          let num=0, den=0; vals.forEach((v,i)=>{num+=(i-meanX)*(v-meanY);den+=(i-meanX)**2;}); const slope=den?num/den:0;
          const future=[1,2,3].map(k=>Math.max(0,vals[n-1]+slope*k));
          const labels=[...trend.map(x=>x.label),...future.map((_,i)=>`Forecast +${i+1}`)];
          const hist=vals.concat([null,null,null]); const proj=Array(n).fill(null); if(n) proj[n-1]=vals[n-1]; proj.push(...future);
          CH.line(chA,{labels,series:[{name:pm.label,values:hist,color:UI.getCss("--chart-1"),dots:true},{name:"Directional forecast",values:proj,color:UI.getCss("--chart-4"),dashed:true,dots:true}],legend:true,yFmt:pm.money?"money":"number"});
        } else if (trend.length) {
          CH.line(chA,{labels:trend.map(x=>x.label),series:[{name:pm.label,values:trend.map(x=>x.value),color:UI.getCss("--chart-1"),dots:true,width:2.8}],legend:false,yFmt:pm.money?"money":"number"});
        } else if (pm.grouped.length) {
          CH.bars(chA,{hbar:false,labels:pm.grouped.map(x=>x[0]),series:[{name:pm.label,values:pm.grouped.map(x=>x[1]),color:UI.getCss("--chart-1")}],legend:false,yFmt:pm.money?"money":"number"});
        } else chA.innerHTML='<div class="bi-empty">No compatible numeric series was detected. Records and schema are still available.</div>';
      }
      if (chB) {
        if ((isBudget||isVariance) && budgetAvailable && actualAvailable) {
          const diff=pm.actualTotal-pm.budgetTotal;
          CH.donut(chB,{labels:["Actual",diff<0?"Remaining plan":"Over plan"],values:[Math.abs(pm.actualTotal),Math.abs(diff)],colors:[UI.getCss("--chart-1"),diff>0?UI.getCss("--bad"):UI.getCss("--chart-3")]});
        } else if (isPL && m.revenueIdx>=0 && m.expenseIdx>=0) {
          const profitVal=m.profitIdx>=0?m.sumAt(m.rows,m.profitIdx):revenue-expenses;
          CH.bars(chB,{labels:["Revenue","Expenses","Profit"],series:[{name:"Amount",values:[revenue,expenses,profitVal],color:UI.getCss("--chart-3")}],legend:false,yFmt:"money"});
        } else if (pm.grouped.length) CH.bars(chB,{hbar:true,labels:pm.grouped.map(x=>x[0]),series:[{name:pm.label,values:pm.grouped.map(x=>x[1]),color:UI.getCss("--chart-2")}],legend:false,yFmt:pm.money?"money":"number"});
        else {
          const sums=m.numericIdx.slice(0,8).map(i=>({label:m.columns[i],value:m.sumAt(m.rows,i)})).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).slice(0,8);
          if(sums.length)CH.bars(chB,{hbar:true,labels:sums.map(x=>x.label),series:[{name:"Sum",values:sums.map(x=>x.value),color:UI.getCss("--chart-4")}],legend:false,yFmt:pm.money?"money":"number"});
          else chB.innerHTML='<div class="bi-empty">No numeric fields are available for this comparison.</div>';
        }
      }
    }
    if (root.querySelector("#biRecordsTable")) addTable(root,m);
  }
  function budgetMetricIndex(m){return m.budgetIdx;}
  function actualMetricIndex(m){return m.actualIdx>=0?m.actualIdx:m.expenseIdx;}

  function wireUpload(root) {
    const drop=root.querySelector("#biUploadDrop"), input=root.querySelector("#biFileInput"), button=root.querySelector("#biChooseFile"); if(!drop||!input)return;
    const open=()=>{if(window.APP?.can("write"))input.click();else toast("bad","Upload restricted","This demo role is read-only.");};
    button.onclick=e=>{e.stopPropagation();open();}; drop.addEventListener("click",e=>{if(!e.target.closest("button"))open();});
    drop.addEventListener("dragover",e=>{e.preventDefault();drop.classList.add("is-over");});
    drop.addEventListener("dragleave",()=>drop.classList.remove("is-over"));
    drop.addEventListener("drop",e=>{e.preventDefault();drop.classList.remove("is-over");if(e.dataTransfer?.files?.[0])handle(e.dataTransfer.files[0]);});
    input.onchange=()=>{if(input.files?.[0])handle(input.files[0]);input.value="";};
    async function handle(file){
      if(!window.APP?.can("write")){toast("bad","Upload restricted","This demo role is read-only.");return;}
      drop.classList.add("is-processing");
      const before=drop.innerHTML; drop.innerHTML=`<div class="dataset-processing-spinner"></div><div class="bi-upload-copy"><b>Processing ${esc(file.name)}</b><p>Detecting fields and preparing the dataset-driven workspace…</p><div class="dataset-progress"><i></i></div></div>`;
      try { await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); await A.importDashboardFile(file); toast("ok","Dataset loaded",`${file.name} · ${Number(A.DATASET.total).toLocaleString("en-IN")} rows imported. Recalculating all modules.`); window.APP.route(true); }
      catch(e){console.error(e);toast("bad","Upload failed",e?.message||"Unable to process the selected file.");drop.innerHTML=before;drop.classList.remove("is-processing");wireUpload(root);}
    }
  }

  // Preserve the default demo pages until the user imports a dataset. Once data is active,
  // all business sections are switched to shared dataset-derived modules.
  Object.keys(PAGES).forEach(id => {
    const original=P[id];
    P[id]=function(root,query,soft){ if(!A.DATASET || !Array.isArray(A.DATASET.rows)) return original ? original(root,query,soft) : undefined; return renderDatasetPage(root,id); };
  });
})();
