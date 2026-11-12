/* ============================================================
   FINANCE SUITE — pages for the enterprise Finance Analytics &
   Revenue Forecasting platform. Every figure is computed from the
   active dataset (uploaded file, or the built-in demo) by FSE.
   ============================================================ */
(function () {
  "use strict";
  const A = window.AV, P = A.pages, UI = window.UI, E = window.FSE;
  const { icon, toast, esc, S, downloadFile } = UI;
  const getCss = UI.getCss;

  /* ---------------- persisted settings ---------------- */
  const DEFAULTS = { range: "12m", from: "", to: "", fy: "", q: "", region: "", dept: "", category: "", product: "", cur: "INR", scale: 1, fyStart: 3, thr: 0.10, budgets: {}, fixedShare: null, mapping: null, mapSig: "", useDemo: false, dim: "", bdim: "", fcScenario: "base", pnlGran: "month", stressRev: 0, stressCost: 0, read: {} };
  let fs;
  try { fs = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem("av.fs") || "{}")); } catch (e) { fs = Object.assign({}, DEFAULTS); }
  // One-time migration for older builds: remove stale filter/currency settings that
  // could leave the budget screen pinned to an old year, region, or currency.
  // Keep the user's uploaded dataset intact; use the current built-in demo until
  // they explicitly switch back to their dataset from the Data page.
  try {
    if (localStorage.getItem("av.finance-current-defaults-v2") !== "1") {
      fs.range = "12m"; fs.from = ""; fs.to = ""; fs.fy = ""; fs.q = "";
      fs.region = ""; fs.dept = ""; fs.category = ""; fs.product = "";
      fs.cur = "INR"; fs.fyStart = 3; fs.useDemo = true;
      fs.mapping = null; fs.mapSig = ""; fs.budgets = {};
      localStorage.setItem("av.finance-current-defaults-v2", "1");
    }
  } catch (e) { /* private browsing may block localStorage */ }
  function save() { try { localStorage.setItem("av.fs", JSON.stringify(fs)); } catch (e) { /* ignore quota */ } }
  const route = () => window.APP.route(true);

  /* ---------------- model + context ---------------- */
  let demoCache = null, modelCache = null, ctxCache = null, modelSeq = 0;
  function rawData() {
    const ds = A.DATASET;
    if (ds && Array.isArray(ds.columns) && Array.isArray(ds.rows) && !fs.useDemo) {
      const rows = Array.isArray(A.DASHBOARD_ALL_ROWS) && A.DASHBOARD_ALL_ROWS.length ? A.DASHBOARD_ALL_ROWS : ds.rows;
      return { name: ds.name || "Uploaded dataset", columns: ds.columns.map(String), rows, demo: false };
    }
    return demoCache || (demoCache = E.demoData());
  }
  function getModel() {
    const raw = rawData();
    const sig = raw.name + "|" + raw.columns.join(",");
    if (fs.mapSig !== sig || !fs.mapping) { fs.mapping = E.autoMap(raw.columns, raw.rows); fs.mapSig = sig; fs.region = fs.dept = fs.category = fs.product = ""; fs.fy = ""; fs.q = ""; fs.dim = ""; fs.bdim = ""; fs.budgets = {}; save(); }
    const key = [sig, raw.rows.length, raw.rows, JSON.stringify(fs.mapping), fs.scale, fs.fyStart];
    if (modelCache && modelCache.key.every((k, i) => k === key[i])) return modelCache.M;
    const M = E.normalize(raw, fs.mapping, { fyStart: fs.fyStart, scale: fs.scale });
    modelCache = { key, M, id: ++modelSeq }; ctxCache = null;
    return M;
  }
  const memo = fn => { let done = false, v; return () => { if (!done) { v = fn(); done = true; } return v; }; };
  const money = (v, dp) => E.money(v, fs.cur, 1, dp);
  const pct = E.pct, pctSign = E.pctSign;

  function buildCtx() {
    const M = getModel(); M.currency = fs.cur;
    const ckey = JSON.stringify([modelCache.id, fs.range, fs.from, fs.to, fs.fy, fs.q, fs.region, fs.dept, fs.category, fs.product, fs.cur, fs.thr, fs.fixedShare, fs.budgets, fs.bdim]);
    if (ctxCache && ctxCache.key === ckey) return ctxCache;
    const spec = E.filterSpec(M, fs);
    const recs = E.select(M, spec), dimRecs = E.select(M, spec, true);
    const prior = E.priorRecs(M, spec);
    const c = { key: ckey, M, spec, recs, dimRecs, prior, agg: E.agg(recs), priorAgg: prior ? E.agg(prior) : null, series: E.monthly(recs), fullSeries: E.monthly(dimRecs) };
    const entCache = {};
    c.ents = k => entCache[k] || (entCache[k] = E.entityStats(M, spec, k, { noForecast: true }));
    c.forecast = memo(() => c.fullSeries.length >= 3 ? E.forecastSeries(c.fullSeries, 12, "rev") : null);
    c.forecastCost = memo(() => c.fullSeries.length >= 3 && M.has.hasPL ? E.forecastSeries(c.fullSeries, 12, "cost") : null);
    c.strategy = memo(() => E.strategy(M, spec, { total: c.agg }));
    c.be = memo(() => M.has.hasPL && c.recs.length ? E.breakEven(c.recs, fs.fixedShare) : null);
    c.bdim = () => fs.bdim && M.has[fs.bdim] ? fs.bdim : (["dept", "category", "region", "product"].find(k => M.has[k] && !spec[k]) || "");
    c.budget = memo(() => E.budgetTable(M, spec, c.bdim(), fs.budgets, fs.thr));
    c.growth = memo(() => E.growthOf(c.fullSeries, M.maxYM, M.minYM).g);
    c.stability = memo(() => {
      const ser = c.series.length >= 6 ? c.series : c.fullSeries;
      const re = M.has.region ? c.ents("region").ents : null, pe = M.has.product ? c.ents("product").ents : (M.has.category ? c.ents("category").ents : null);
      let bv = null; try { bv = c.budget().avgAbsVar; } catch (e) { /* no budget */ }
      return E.stability({ agg: c.agg, prior: c.priorAgg, series: ser, be: c.be(), regionEnts: re, productEnts: pe, budgetVar: bv, hasBudget: M.has.budget, hasPL: M.has.hasPL, growth: c.growth() });
    });
    c.alerts = memo(() => E.buildAlerts(M, spec, { budget: c.budget(), agg: c.agg, prior: c.priorAgg, strategy: c.strategy(), forecast: c.forecast(), stability: c.stability(), be: c.be() }));
    ctxCache = c; return c;
  }

  /* ---------------- chart helpers ---------------- */
  const palette = () => [getCss("--chart-1"), getCss("--chart-2"), getCss("--chart-3"), getCss("--chart-4"), getCss("--chart-5"), getCss("--chart-6"), "#0EA5A4", "#E11D48", "#9333EA", "#CA8A04", "#64748B", "#16A34A"];
  function merge(a, b) { for (const k in b) { if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k] && typeof a[k] === "object") merge(a[k], b[k]); else a[k] = b[k]; } return a; }
  function baseLayout() {
    const grid = getCss("--grid"), txt = getCss("--text-3");
    return { paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { family: "Inter, system-ui, -apple-system, Segoe UI, sans-serif", size: 12, color: txt }, margin: { l: 56, r: 14, t: 8, b: 36 }, showlegend: true, legend: { orientation: "h", y: 1.13, x: 0, font: { size: 11.5 } }, xaxis: { gridcolor: grid, zerolinecolor: grid, automargin: true, linecolor: grid }, yaxis: { gridcolor: grid, zerolinecolor: grid, automargin: true }, hoverlabel: { bgcolor: getCss("--surface"), bordercolor: getCss("--border"), font: { size: 12, color: getCss("--text-1") } }, hovermode: "closest" };
  }
  const chartResizeObservers = new WeakMap();
  function plot(id, traces, layout, onClick) {
    const el = document.getElementById(id); if (!el) return null;
    if (!window.Plotly) { el.innerHTML = `<div class="fs-empty-chart">Chart library unavailable.</div>`; return null; }
    // Keep the Plotly node alive so data changes animate rather than flash.
    if (!el.classList.contains("js-plotly-plot")) el.innerHTML = "";
    const finalLayout = merge(baseLayout(), layout || {});
    finalLayout.autosize = true;
    delete finalLayout.width; // Never preserve a stale width from a previous sidebar/window size.
    finalLayout.margin = Object.assign({ l: 58, r: 20, t: 34, b: 48 }, finalLayout.margin || {});
    finalLayout.transition = Object.assign({ duration: 650, easing: "cubic-in-out" }, finalLayout.transition || {});
    Plotly.react(el, traces, finalLayout, { displayModeBar: false, responsive: true, scrollZoom: false, doubleClick: "reset" })
      .then(() => { if (el.isConnected && el.clientWidth > 0) Plotly.Plots.resize(el); })
      .catch(() => { /* A route change may remove a chart while it is rendering. */ });
    // Grid/flex panels and sidebar toggles can change width without a window resize.
    if (window.ResizeObserver && !chartResizeObservers.has(el)) {
      let resizeFrame = 0;
      const observer = new ResizeObserver(() => {
        if (!el.isConnected || !el.classList.contains("js-plotly-plot")) return;
        if (resizeFrame) cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          if (el.isConnected && el.clientWidth > 0) Plotly.Plots.resize(el);
        });
      });
      observer.observe(el); chartResizeObservers.set(el, observer);
    }
    if (onClick) { if (el.removeAllListeners) el.removeAllListeners("plotly_click"); el.on("plotly_click", ev => { if (ev && ev.points && ev.points[0]) onClick(ev.points[0]); }); }
    return el;
  }
  function emptyChart(id, msg) { const el = document.getElementById(id); if (el) el.innerHTML = `<div class="fs-empty-chart">${esc(msg)}</div>`; }
  function niceTicks(min, max, n) {
    n = n || 5; if (!(max > min)) { max = min + 1; }
    const raw = (max - min) / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag, step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
    const vals = []; for (let v = Math.floor(min / step) * step; v <= max + step * 0.5; v += step) vals.push(+v.toPrecision(12));
    return vals;
  }
  const tickText = v => E.money(v, fs.cur, 1, 1).replace(/\.0(?= |$)/, "").replace(/\.00(?= |$)/, "");
  function moneyAxis(vals, extra, n) { const f = vals.filter(Number.isFinite); if (!f.length) return {}; let lo = Math.min(0, ...f), hi = Math.max(0, ...f); if (hi === lo) hi = lo + 1; /* Always reserve headroom so tallest bars and outside labels are not clipped. */ const pad = Math.max((hi - lo) * 0.14, Math.abs(hi) * 0.08, 0.01); hi += pad; const t = niceTicks(lo, hi, n || 5); return Object.assign({ tickvals: t, ticktext: t.map(tickText), range: [Math.min(lo, t[0]), t[t.length - 1]], autorange: false, automargin: true, rangemode: "tozero" }, extra || {}); }
  const monthTicks = (yms) => yms.map(E.monthLabel);
  const fmtHover = vals => vals.map(v => money(v));

  /* ---------------- shared markup ---------------- */
  function delta(cur, prev, opts) {
    opts = opts || {}; if (prev == null || !Number.isFinite(prev) || prev === 0 || !Number.isFinite(cur)) return `<span class="fs-delta flat">vs prior period: n/a</span>`;
    const g = opts.pp ? cur - prev : (cur - prev) / Math.abs(prev); const up = g >= 0; const good = opts.invert ? !up : up;
    return `<span class="fs-delta ${Math.abs(g) < 0.0005 ? "flat" : good ? "good" : "bad"}"><i>${up ? "▲" : "▼"}</i>${opts.pp ? Math.abs(g * 100).toFixed(1) + " pp" : Math.abs(g * 100).toFixed(1) + "%"} <em>vs prior period</em></span>`;
  }
  function kpi(o) {
    return `<article class="fs-kpi ${o.tone ? "t-" + o.tone : ""}"><div class="fs-kpi-top"><span>${esc(o.label)}</span><span class="fs-kpi-ico">${icon(o.icon || "trendUp", "ic-16")}</span></div><div class="fs-kpi-val" data-count="${Number.isFinite(o.raw) ? o.raw : ""}" data-kind="${o.kind || ""}">${o.value}</div><div class="fs-kpi-sub">${o.sub || ""}</div></article>`;
  }
  function card(title, sub, body, o) {
    o = o || {};
    return `<section class="fs-card fs-s${o.span || 6}" ${o.id ? `id="${o.id}"` : ""}><div class="fs-card-h"><div><div class="t">${title}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div>${o.right ? `<div class="fs-card-r">${o.right}</div>` : ""}</div><div class="fs-card-b">${body}</div></section>`;
  }
  const chartBox = (id, h) => `<div class="fs-chart" id="${id}" style="min-height:${h || 300}px"></div>`;
  const seg = (name, items, cur) => `<div class="seg" data-seg="${name}">${items.map(([v, l]) => `<button data-v="${esc(v)}" class="${String(v) === String(cur) ? "active" : ""}">${esc(l)}</button>`).join("")}</div>`;
  const badge = (tone, text) => `<span class="badge b-${tone}">${esc(text)}</span>`;
  const emptyState = (t, p, btn) => `<div class="fs-empty"><div class="e-ico">${icon("data", "ic-24")}</div><b>${esc(t)}</b><p>${p}</p>${btn || ""}</div>`;
  const DIM_LABEL = { region: "Region", dept: "Department", category: "Category", product: "Product" };
  const DIM_PLURAL = { region: "Regions", dept: "Departments", category: "Categories", product: "Products" };
  const availDims = M => ["product", "region", "category", "dept"].filter(k => M.has[k]);
  function curDim(M, ctx) { const a = availDims(M).filter(k => !(ctx && ctx.spec[k])); const all = availDims(M); if (fs.dim && M.has[fs.dim]) return fs.dim; return a[0] || all[0] || ""; }

  /* ---------------- header + filter bar ---------------- */
  function head(c, eyebrow, title, subtitle, extra) {
    const M = c.M;
    return `<div class="fs-head"><div class="fs-head-copy"><div class="fs-eyebrow"><span class="fs-live"></span>${esc(eyebrow)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p>
      <div class="fs-source"><span class="fs-chip">${icon("db", "ic-14")} ${esc(M.name)}</span><span>${M.quality.rows.toLocaleString("en-IN")} source rows</span><span>${c.recs.length.toLocaleString("en-IN")} in view</span><span>${esc(c.spec.label)}</span>${M.demo ? badge("info", "Demo data") : badge("ok", "Your dataset")}</div></div>
      <div class="fs-actions">${extra || ""}<label class="btn btn-p btn-sm fs-upload-btn" tabindex="0" id="fsUploadBtn">${icon("upload", "ic-14")} ${M.demo ? "Upload your data" : "Replace dataset"}<input type="file" id="fsUploadInput" accept=".csv,.xlsx,.tsv,.json,.txt" hidden></label>
      <button class="btn btn-g btn-sm" data-fsa="export">${icon("download", "ic-14")} Export view</button></div></div>
      ${M.demo ? `<div class="fs-note">${icon("help", "ic-14")}<span>You're viewing a synthetic <b>global enterprise</b> dataset so every feature is live. Upload any CSV / XLSX / JSON with revenue, cost and (optionally) date, region, department, category, product, budget, role and salary columns — the platform auto-maps your columns and rebuilds every chart, forecast and recommendation.</span></div>` : ""}
      ${M.quality.revenueFallback ? `<div class="fs-note warn">${icon("alerts", "ic-14")}<span>No revenue-like column was found, so <b>${esc(M.columns[M.mapping.revenue])}</b> is being used as the primary measure. Fix this in <a href="#/data">Data Import → Column setup</a>.</span></div>` : ""}`;
  }
  function filterBar(c) {
    const M = c.M, f = fs; const opt = (v, l, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? "selected" : ""}>${esc(l)}</option>`;
    const date = M.has.date ? `<label class="fs-f"><span>Date range</span><select data-fs="range">${[["all", "All time"], ["12m", "Last 12 months"], ["6m", "Last 6 months"], ["3m", "Last 3 months"], ["ytd", "Fiscal year to date"], ["custom", "Custom…"]].map(([v, l]) => opt(v, l, f.range)).join("")}</select></label>
      ${f.range === "custom" ? `<label class="fs-f"><span>From</span><input type="date" data-fs="from" value="${esc(f.from)}"></label><label class="fs-f"><span>To</span><input type="date" data-fs="to" value="${esc(f.to)}"></label>` : ""}
      <label class="fs-f"><span>Financial year</span><select data-fs="fy">${opt("", "All years", f.fy)}${M.fys.map(y => opt(y, E.fyLabel(y, M.fyStart), f.fy)).join("")}</select></label>
      <label class="fs-f"><span>Quarter</span><select data-fs="q">${opt("", "All quarters", f.q)}${[1, 2, 3, 4].map(q => opt(q, "Q" + q + " · " + E.qMonths(q, M.fyStart), f.q)).join("")}</select></label>` : "";
    const dims = ["region", "dept", "category", "product"].filter(k => M.has[k]).map(k => `<label class="fs-f"><span>${DIM_LABEL[k]}</span><select data-fs="${k}">${opt("", "All " + DIM_PLURAL[k].toLowerCase(), f[k])}${M.dims[k].map(v => opt(v, v, f[k])).join("")}</select></label>`).join("");
    const active = ["region", "dept", "category", "product", "fy", "q"].filter(k => f[k] !== "" && f[k] != null).length + (f.range !== "all" && M.has.date ? 1 : 0);
    return `<div class="fs-bar"><div class="fs-bar-title">${icon("filter", "ic-14")} Filters${active ? `<em>${active}</em>` : ""}</div>${date}${dims}
      <label class="fs-f fs-f-sm"><span>Currency</span><select data-fs="cur">${Object.entries(E.CURRENCIES).map(([k, v]) => opt(k, k + " " + v.sym, f.cur)).join("")}</select></label>
      <div class="fs-bar-actions"><button class="btn btn-g btn-sm" data-fsa="refresh">${icon("refresh", "ic-14")}</button><button class="btn btn-s btn-sm" data-fsa="reset">Reset</button></div></div>`;
  }
  function noData(c) {
    return `<div class="fs-card fs-s12"><div class="fs-card-b">${emptyState("No records match these filters", "Try widening the date range, financial year or quarter, or clear a region / department / category / product filter.", `<button class="btn btn-p btn-sm" data-fsa="reset">Reset filters</button>`)}</div></div>`;
  }

  /* ---------------- wiring shared by all pages ---------------- */
  function exportView(c) {
    const M = c.M, cols = ["Date", "Region", "Department", "Category", "Product", "Role", "Revenue", "Cost", "Profit", "Budget", "Units", "Salary", "Headcount"];
    const q = v => { const s = v == null ? "" : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = c.recs.map(r => [Number.isFinite(r.t) ? new Date(r.t).toISOString().slice(0, 10) : "", r.region, r.dept, r.category, r.product, r.role, Math.round(r.rev / M.scale), Math.round(r.cost / M.scale), Math.round(r.profit / M.scale), Math.round(r.budget / M.scale), r.units, Math.round(r.salary / M.scale), r.hc]);
    downloadFile("finance-view-" + (M.name || "data").replace(/[^a-z0-9]+/gi, "-").slice(0, 40) + ".csv", [cols.join(","), ...rows.map(r => r.map(q).join(","))].join("\r\n"), "text/csv;charset=utf-8");
    toast("ok", "Export ready", c.recs.length.toLocaleString("en-IN") + " filtered rows exported as CSV (normalised schema).");
  }
  async function handleFile(file) {
    if (!file) return;
    if (!window.APP.can("write")) { toast("bad", "Upload restricted", "This demo role is read-only. Sign in as CFO, Finance Manager, Analyst or Admin."); return; }
    toast("info", "Reading " + file.name, "Detecting columns and rebuilding analytics…");
    try { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); await A.importDashboardFile(file); fs.useDemo = false; fs.mapSig = ""; fs.mapping = null; fs.range = "all"; save(); modelCache = null; ctxCache = null; const M = getModel(); toast("ok", "Dataset loaded", file.name + " · " + M.quality.rows.toLocaleString("en-IN") + " rows · " + Object.keys(M.mapping).filter(k => M.has[k]).length + " fields auto-mapped."); route(); }
    catch (e) { console.error(e); toast("bad", "Upload failed", e && e.message ? e.message : "Unable to read this file."); }
  }
  function wire(root, c) {
    root.querySelectorAll("[data-fs]").forEach(sel => sel.addEventListener("change", () => {
      const k = sel.dataset.fs; let v = sel.value; if (["scale", "fyStart", "thr"].includes(k)) v = +v;
      fs[k] = v;
      if (k === "fy" && v !== "") { fs.range = "all"; }
      if (k === "range" && v !== "custom") { fs.from = ""; fs.to = ""; }
      if (k === "range" && v !== "all") { fs.fy = ""; }
      save(); route();
    }));
    root.querySelectorAll('[data-fsa="reset"]').forEach(b => b.onclick = () => { Object.assign(fs, { range: "12m", from: "", to: "", fy: "", q: "", region: "", dept: "", category: "", product: "" }); save(); toast("info", "Filters reset", "Showing the last 12 months, all segments."); route(); });
    root.querySelectorAll('[data-fsa="refresh"]').forEach(b => b.onclick = () => { ctxCache = null; route(); toast("info", "Recalculated", "All figures recomputed from the active dataset."); });
    root.querySelectorAll('[data-fsa="export"]').forEach(b => b.onclick = () => exportView(c));
    const inp = root.querySelector("#fsUploadInput"); if (inp) inp.onchange = () => { const f = inp.files && inp.files[0]; inp.value = ""; handleFile(f); };
    const lab = root.querySelector("#fsUploadBtn"); if (lab) lab.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inp.click(); } };
    root.querySelectorAll("[data-seg]").forEach(sg => sg.querySelectorAll("button").forEach(b => b.onclick = () => { const k = sg.dataset.seg; fs[k === "pdim" ? "dim" : k] = b.dataset.v; save(); route(); }));
    root.querySelectorAll("[data-drill]").forEach(b => b.onclick = () => { const [k, v] = b.dataset.drill.split("::"); fs[k] = v; save(); toast("ok", "Filtered to " + v, "Every chart and KPI now reflects " + v + ". Use Reset to clear."); route(); });
    countUp(root);
  }
  function countUp(root) {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.querySelectorAll(".fs-kpi-val[data-count]").forEach(el => {
      const raw = el.dataset.count; if (raw === "" || reduce) return; const end = +raw, kind = el.dataset.kind, final = el.textContent;
      const fmtN = n => kind === "money" ? money(n) : kind === "pct" ? pct(n) : kind === "int" ? Math.round(n).toLocaleString("en-IN") : final;
      if (!kind) return; const t0 = performance.now();
      (function tick(now) { const t = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - t, 3); el.textContent = t < 1 ? fmtN(end * e) : final; if (t < 1) requestAnimationFrame(tick); })(t0);
    });
  }
  function shell(root, c, eyebrow, title, subtitle, body, extra) {
    root.innerHTML = `<main class="fs-page">${head(c, eyebrow, title, subtitle, extra)}${filterBar(c)}${c.recs.length ? body : noData(c)}</main>`;
    wire(root, c);
  }
  const needsPL = c => !c.M.has.hasPL ? `<div class="fs-card fs-s12"><div class="fs-card-b">${emptyState("Cost or profit data not detected", `This view needs a <b>revenue</b> column plus a <b>cost</b> or <b>profit</b> column. Map them in <a href="#/data">Data Import → Column setup</a> (current revenue column: <b>${c.M.mapping.revenue >= 0 ? esc(c.M.columns[c.M.mapping.revenue]) : "none"}</b>).`, `<a class="btn btn-p btn-sm" href="#/data">Open column mapping</a>`)}</div></div>` : "";
  const tableHost = id => `<div class="table-wrap" id="${id}"></div>`;
  const bindFocus = (host, handler) => { const el = typeof host === "string" ? document.querySelector(host) : host; if (el) el.addEventListener("click", e => { const b = e.target.closest("[data-focus]"); if (b) handler(b.dataset.focus); }); };
  const focusBtn = (dimKey, name) => `<button class="btn btn-g btn-sm" data-focus="${esc(dimKey + "::" + name)}">Focus</button>`;
  const applyFocus = v => { const [k, n] = v.split("::"); fs[k] = n; save(); route(); };
  const trendPill = g => !Number.isFinite(g) ? `<span class="pos-neg flat">n/a</span>` : `<span class="pos-neg ${g > 0.001 ? "pos" : g < -0.001 ? "neg" : "flat"}">${pctSign(g)}</span>`;
  const quadTone = q => ({ "Invest & expand": "ok", "Grow, fix margin": "warn", "Defend & harvest": "info", "Reassess": "bad" }[q] || "mut");

  /* ---------------- reusable chart builders ---------------- */
  function piePlot(id, ents, key, onClick, title) {
    const list = ents.filter(e => e[key] > 0).slice(0, 8); const rest = ents.filter(e => e[key] > 0).slice(8); const others = rest.reduce((s, e) => s + e[key], 0);
    const labels = list.map(e => e.name), vals = list.map(e => e[key]); if (others > 0) { labels.push("Others (" + rest.length + ")"); vals.push(others); }
    if (!vals.length) return emptyChart(id, "No positive values to show.");
    plot(id, [{ type: "pie", labels, values: vals, hole: 0.58, sort: false, textinfo: "percent", textposition: "inside", marker: { colors: palette(), line: { color: getCss("--surface"), width: 2 } }, customdata: vals.map(v => money(v)), hovertemplate: "<b>%{label}</b><br>" + (title || "Value") + ": %{customdata}<br>%{percent}<extra></extra>" }],
      { margin: { l: 4, r: 4, t: 4, b: 4 }, legend: { orientation: "v", x: 1.02, y: 0.5, font: { size: 11.5 } } }, onClick ? (pt => { if (!/^Others/.test(pt.label)) onClick(pt.label); }) : null);
  }
  function hbarPlot(id, ents, key, onClick, color) {
    const list = ents.slice(0, 10).reverse(); if (!list.length) return emptyChart(id, "No data for this breakdown.");
    const vals = list.map(e => e[key]);
    plot(id, [{ type: "bar", orientation: "h", y: list.map(e => e.name), x: vals, marker: { color: vals.map(v => v < 0 ? getCss("--bad") : (color || getCss("--chart-1"))), cornerradius: 3 }, customdata: fmtHover(vals), hovertemplate: "<b>%{y}</b><br>%{customdata}<extra></extra>", text: fmtHover(vals), textposition: "outside", cliponaxis: false, textfont: { size: 11 } }],
      { showlegend: false, margin: { l: 155, r: 112, t: 18, b: 42 }, xaxis: Object.assign(moneyAxis(vals, null, 4), { automargin: true }), yaxis: { automargin: true, tickfont: { size: 12 } }, bargap: 0.28 }, onClick ? (pt => onClick(pt.y)) : null);
  }
  function trendPlot(id, c) {
    const s = c.series; if (s.length < 2) return emptyChart(id, c.M.has.date ? "At least two periods are needed for a trend." : "No date column mapped — map one in Data to unlock trends.");
    const x = monthTicks(s.map(m => m.ym)); const pl = c.M.has.hasPL;
    // Derive the plotted profit from the same monthly revenue/expense totals shown
    // in this chart, avoiding mismatched or stale source profit fields.
    const monthlyProfit = s.map(m => m.rev - m.cost);
    const tr = [{ type: "scatter", mode: "lines", name: "Revenue", x, y: s.map(m => m.rev), line: { color: getCss("--chart-1"), width: 2.8, shape: "linear" }, marker: { size: 5, color: getCss("--chart-1") }, customdata: fmtHover(s.map(m => m.rev)), hovertemplate: "Revenue: <b>%{customdata}</b><extra></extra>" }];
    if (pl) {
      tr.push({ type: "scatter", mode: "lines", name: "Expenses", x, y: s.map(m => m.cost), line: { color: getCss("--chart-2"), width: 2.2, shape: "linear" }, marker: { size: 4, color: getCss("--chart-4") }, customdata: fmtHover(s.map(m => m.cost)), hovertemplate: "Expenses: <b>%{customdata}</b><extra></extra>" });
      tr.push({ type: "bar", name: "Profit", x, y: monthlyProfit, marker: { color: monthlyProfit.map(v => v >= 0 ? "rgba(23,138,80,0.68)" : "rgba(200,40,40,0.68)"), cornerradius: 3 }, customdata: fmtHover(monthlyProfit), hovertemplate: "Profit: <b>%{customdata}</b><extra></extra>" });
    }
    plot(id, tr, { hovermode: "x unified", barmode: "group", yaxis: moneyAxis(s.flatMap((m, i) => [m.rev, m.cost, monthlyProfit[i]])), xaxis: { type: "category", nticks: 10, automargin: true }, bargap: 0.42, margin: { l: 78, r: 30, t: 28, b: 62 }, transition: { duration: 650, easing: "cubic-in-out" } });
  }
  function forecastPlot(id, c, opts) {
    opts = opts || {}; const f = c.forecast(); if (!f) return emptyChart(id, "Forecasting needs a date column with at least 3 periods of revenue.");
    const hist = f.hist.slice(-(opts.hist || 36)); const hx = monthTicks(hist.map(h => h.ym)), fx = monthTicks(f.fc.map(h => h.ym));
    const lastH = hist[hist.length - 1];
    const tr = [
      { type: "scatter", mode: "lines", x: fx, y: f.fc.map(h => h.hi90), line: { width: 0 }, showlegend: false, hoverinfo: "skip" },
      { type: "scatter", mode: "lines", x: fx, y: f.fc.map(h => h.lo90), line: { width: 0 }, fill: "tonexty", fillcolor: "rgba(122,90,248,0.14)", name: "90% range", hoverinfo: "skip" },
      { type: "scatter", mode: "lines", name: "Actual", x: hx, y: hist.map(h => h.v), line: { color: getCss("--chart-1"), width: 2.8, shape: "spline", smoothing: 0.3 }, customdata: fmtHover(hist.map(h => h.v)), hovertemplate: "Actual: <b>%{customdata}</b><extra></extra>" },
    ];
    const sc = opts.scenario || "base";
    const addScn = (key, name, color, dash) => tr.push({ type: "scatter", mode: "lines+markers", name, x: [E.monthLabel(lastH.ym)].concat(fx), y: [lastH.v].concat(f.fc.map(h => h[key])), line: { color, width: 2.4, dash: dash || "dash" }, marker: { size: 4 }, customdata: fmtHover([lastH.v].concat(f.fc.map(h => h[key]))), hovertemplate: name + ": <b>%{customdata}</b><extra></extra>" });
    if (sc === "base" || sc === "all") addScn("base", "Base forecast", getCss("--chart-3"));
    if (sc === "opt" || sc === "all") addScn("opt", "Optimistic", getCss("--ok"), "dot");
    if (sc === "cons" || sc === "all") addScn("cons", "Conservative", getCss("--bad"), "dot");
    const allY = hist.map(h => h.v).concat(f.fc.flatMap(h => [h.hi90, h.lo90]));
    plot(id, tr, { hovermode: "x unified", yaxis: moneyAxis(allY), xaxis: { type: "category", categoryorder: "array", categoryarray: hx.concat(fx), nticks: 12 }, shapes: [{ type: "line", xref: "x", x0: E.monthLabel(lastH.ym), x1: E.monthLabel(lastH.ym), yref: "paper", y0: 0, y1: 1, line: { color: getCss("--text-4"), width: 1, dash: "dot" } }] });
  }
  function focusCards(st, key, limit) {
    const d = st.dims[key]; if (!d) return `<div class="fs-empty-chart">Map a ${DIM_LABEL[key] || key} column to unlock market scoring.</div>`;
    return `<div class="fs-focus">${d.focus.slice(0, limit || 3).map((e, i) => `<article class="fs-focus-card"><div class="fs-rank">${i + 1}</div><div class="fs-focus-main"><b>${esc(e.name)}</b><span>${esc(e.reason || "")}</span></div><div class="fs-score" title="Market attractiveness score"><strong>${e.score}</strong><small>score</small></div><button class="btn btn-g btn-sm" data-drill="${esc(key + "::" + e.name)}">Drill in</button></article>`).join("")}</div>`;
  }
  function alertList(list, limit) {
    if (!list.length) return `<div class="fs-empty-chart ok">${icon("check", "ic-16")} No exceptions — budgets, margins and forecast are within thresholds.</div>`;
    return `<div class="fs-alerts">${list.slice(0, limit || 5).map(a => `<a class="fs-alert sev-${a.sev}" href="${a.link}"><span class="fs-alert-ic">${icon(a.icon || "alerts", "ic-16")}</span><div><b>${esc(a.title)}</b><p>${esc(a.body)}</p></div><span class="badge b-${a.sev === "high" ? "bad" : a.sev === "med" ? "warn" : "mut"}">${a.sev === "high" ? "High" : a.sev === "med" ? "Medium" : "Low"}</span></a>`).join("")}</div>`;
  }
  function ringHTML(score, size) {
    const tone = score == null ? "mut" : score >= 80 ? "ok" : score >= 65 ? "info" : score >= 50 ? "warn" : "bad";
    return `<div class="fs-ring t-${tone}" style="--p:${score == null ? 0 : score};--s:${size || 132}px"><div><strong>${score == null ? "—" : score}</strong><small>/ 100</small></div></div>`;
  }

  /* ============================================================
     OVERVIEW
     ============================================================ */
  P.dashboard = function (root) {
    const c = buildCtx(), M = c.M, a = c.agg, p = c.priorAgg, pl = M.has.hasPL;
    const fc = c.forecast(), st = c.stability(), be = c.be(), bud = (M.has.budget || Object.keys(fs.budgets).length || c.bdim()) && c.bdim() ? c.budget() : null;
    const k = [];
    k.push(kpi({ label: "Total revenue", value: money(a.rev), raw: a.rev, kind: "money", icon: "revenue", sub: delta(a.rev, p && p.rev) }));
    if (pl) {
      k.push(kpi({ label: "Total expenses", value: money(a.cost), raw: a.cost, kind: "money", icon: "expense", sub: delta(a.cost, p && p.cost, { invert: true }) }));
      k.push(kpi({ label: "Net profit", value: money(a.profit), raw: a.profit, kind: "money", icon: "trendUp", tone: a.profit < 0 ? "bad" : "", sub: delta(a.profit, p && p.profit) }));
      k.push(kpi({ label: "Profit margin", value: pct(a.margin), raw: a.margin, kind: "pct", icon: "scale", sub: delta(a.margin, p && p.margin, { pp: true }) }));
    } else {
      k.push(kpi({ label: "Records in view", value: a.count.toLocaleString("en-IN"), raw: a.count, kind: "int", icon: "db", sub: `<span class="fs-delta flat">of ${M.quality.rows.toLocaleString("en-IN")} source rows</span>` }));
      k.push(kpi({ label: "Average per record", value: money(a.count ? a.rev / a.count : 0), icon: "scale", sub: `<span class="fs-delta flat">revenue ÷ records</span>` }));
      k.push(kpi({ label: "Units", value: Math.round(a.units).toLocaleString("en-IN"), icon: "product", sub: `<span class="fs-delta flat">${M.has.units ? "from units column" : "no units column"}</span>` }));
    }
    if (bud && bud.total.util != null) { const t = bud.total; k.push(kpi({ label: "Budget utilisation", value: pct(t.util), raw: t.util, kind: "pct", icon: "budget", tone: t.util - 1 > fs.thr ? "bad" : t.util > 1 ? "warn" : "", sub: `<span class="fs-delta flat">${money(t.actual)} of ${money(t.planned)} plan</span>` })); }
    else k.push(kpi({ label: "Budget utilisation", value: "—", icon: "budget", sub: `<span class="fs-delta flat">needs cost + a grouping column</span>` }));
    k.push(kpi({ label: "Next-12M forecast", value: fc ? money(fc.total12) : "—", raw: fc ? fc.total12 : NaN, kind: "money", icon: "forecast", tone: fc && fc.growth < 0 ? "bad" : "", sub: fc ? `<span class="fs-delta ${fc.growth >= 0 ? "good" : "bad"}"><i>${fc.growth >= 0 ? "▲" : "▼"}</i>${Math.abs(fc.growth * 100).toFixed(1)}% <em>vs last 12M · ${esc(fc.model.confidence)} confidence</em></span>` : `<span class="fs-delta flat">needs a date column</span>` }));
    k.push(kpi({ label: "Stability score", value: st.score == null ? "—" : st.score + " / 100", icon: "shield", tone: st.score == null ? "" : st.score >= 65 ? "" : st.score >= 50 ? "warn" : "bad", sub: `<span class="fs-delta flat">${esc(st.rating)} · ${st.factors.length} factors</span>` }));
    k.push(kpi({ label: "Break-even safety", value: be && be.marginOfSafety != null ? pct(be.marginOfSafety) : "—", icon: "scale", tone: be && be.marginOfSafety != null && be.marginOfSafety < 0.1 ? "warn" : "", sub: be ? `<span class="fs-delta flat">BE revenue ${money(be.breakEvenRevenue)}</span>` : `<span class="fs-delta flat">needs revenue + cost</span>` }));
    const dims = availDims(M), pieDims = ["region", "category", "dept"].filter(d => M.has[d] && !c.spec[d]);
    const hasPay = M.has.payroll && M.has.role;
    const body = `<div class="fs-kpis">${k.join("")}</div>
      ${pl ? "" : needsPL(c)}
      <div class="fs-grid">
        ${card("Revenue, expenses & profit", esc(c.spec.label) + " · monthly · green = revenue, blue = expenses, purple = profit", chartBox("chTrend", 340), { span: 12 })}
        ${card("Financial stability", "Composite of profitability, growth, volatility, concentration, budget & break-even", `<div class="fs-stab"><div>${ringHTML(st.score, 124)}<div class="fs-stab-r">${badge(st.score == null ? "mut" : st.score >= 80 ? "ok" : st.score >= 65 ? "info" : st.score >= 50 ? "warn" : "bad", st.rating)}</div></div><ul class="fs-flags">${(st.flags.length ? st.flags.slice(0, 3) : ["No factor below the risk threshold."]).map(f => `<li>${esc(f)}</li>`).join("")}</ul></div><a class="btn btn-g btn-sm" href="#/stability">Stability & break-even ${icon("chevronRight", "ic-14")}</a>`, { span: 4 })}
        ${pieDims[0] ? card("Revenue by " + DIM_LABEL[pieDims[0]].toLowerCase(), "Click a slice to drill in", chartBox("chPie1", 290), { span: 4 }) : ""}
        ${pieDims[1] ? card("Revenue by " + DIM_LABEL[pieDims[1]].toLowerCase(), "Click a slice to drill in", chartBox("chPie2", 290), { span: 4 }) : ""}
        ${M.has.product ? card("Top products by revenue", "Click a bar to filter", chartBox("chProd", 290), { span: pieDims.length >= 2 ? 4 : (pieDims.length ? 8 : 12) }) : (!pieDims.length ? card("Segments", "No region, category, department or product column mapped", `<div class="fs-empty-chart">Map dimension columns in <a href="#/data">Data</a> to unlock breakdowns.</div>`, { span: 12 }) : "")}
        ${card("Where to focus — market attractiveness", "Ranked by forecast growth, margin, scale, stability & momentum", `<div id="ovFocus"></div>`, { span: 6, right: `<a class="btn btn-g btn-sm" href="#/insights">Market strategy ${icon("chevronRight", "ic-14")}</a>` })}
        ${card("Needs attention", "Generated from budgets, margins, forecast, stability & data quality", `<div id="ovAlerts"></div>`, { span: 6, right: `<a class="btn btn-g btn-sm" href="#/alerts">All alerts ${icon("chevronRight", "ic-14")}</a>` })}
        ${bud ? card("Budget vs actual by " + DIM_LABEL[c.bdim()].toLowerCase(), "Plan " + (bud.hasBudgetCol ? "from your dataset" : "is editable in Budget Control"), chartBox("chBud", 280), { span: 6, right: `<a class="btn btn-g btn-sm" href="#/budgets">Budget control ${icon("chevronRight", "ic-14")}</a>` }) : ""}
        ${card("Revenue forecast", fc ? esc(fc.model.method) + " · MAPE " + (fc.model.mape == null ? "n/a" : pct(fc.model.mape)) : "12-month outlook", chartBox("chFc", 280), { span: bud ? 6 : 12, right: `<a class="btn btn-g btn-sm" href="#/forecast">Forecast ${icon("chevronRight", "ic-14")}</a>` })}
        ${hasPay ? card("Average salary by role", "Top roles · payroll in the filtered view", chartBox("chRoles", 300), { span: 12, right: `<a class="btn btn-g btn-sm" href="#/people">People & payroll ${icon("chevronRight", "ic-14")}</a>` }) : ""}
      </div>`;
    shell(root, c, "Executive overview", "Financial Overview", "Revenue, profitability, budget health, forecast and market focus — recalculated from the active dataset and filters.", body);
    if (!c.recs.length) return;
    trendPlot("chTrend", c);
    if (pieDims[0]) piePlot("chPie1", c.ents(pieDims[0]).ents, "rev", n => applyFocus(pieDims[0] + "::" + n), "Revenue");
    if (pieDims[1]) piePlot("chPie2", c.ents(pieDims[1]).ents, "rev", n => applyFocus(pieDims[1] + "::" + n), "Revenue");
    if (M.has.product) hbarPlot("chProd", c.ents("product").ents, "rev", n => applyFocus("product::" + n));
    const strat = c.strategy(); const fk = ["region", "category", "product"].find(d => strat.dims[d]);
    const ovf = root.querySelector("#ovFocus"); if (ovf) { ovf.innerHTML = fk ? focusCards(strat, fk, 3) : `<div class="fs-empty-chart">Add a region, category or product column to rank where to invest.</div>`; ovf.querySelectorAll("[data-drill]").forEach(b => b.onclick = () => applyFocus(b.dataset.drill)); }
    const ova = root.querySelector("#ovAlerts"); if (ova) ova.innerHTML = alertList(c.alerts(), 5);
    if (bud) budgetBars("chBud", bud);
    forecastPlot("chFc", c, { scenario: "base", hist: 24 });
    if (hasPay) { const pay = E.payroll(c.recs); const r = pay.roles.slice(0, 10).reverse(); plot("chRoles", [{ type: "bar", orientation: "h", y: r.map(x => x.name), x: r.map(x => x.avg), marker: { color: getCss("--chart-3"), cornerradius: 3 }, customdata: fmtHover(r.map(x => x.avg)), hovertemplate: "<b>%{y}</b><br>Avg monthly pay: %{customdata}<extra></extra>", text: fmtHover(r.map(x => x.avg)), textposition: "outside", cliponaxis: false }], { showlegend: false, margin: { l: 160, r: 100, t: 6, b: 28 }, xaxis: moneyAxis(r.map(x => x.avg), null, 4) }); }
  };

  /* ============================================================
     PERFORMANCE — products · regions · categories · departments
     ============================================================ */
  P.products = function (root) {
    const c = buildCtx(), M = c.M, dims = availDims(M);
    if (!dims.length) { shell(root, c, "Performance", "Performance", "Compare products, regions, categories and departments.", `<div class="fs-card fs-s12"><div class="fs-card-b">${emptyState("No grouping columns detected", `Map at least one of <b>Product, Region, Category or Department</b> in <a href="#/data">Data Import → Column setup</a> to compare performance.`, `<a class="btn btn-p btn-sm" href="#/data">Open column mapping</a>`)}</div></div>`); return; }
    const dim = curDim(M, c); const { ents, total } = c.ents(dim); const list = ents;
    const pl = M.has.hasPL; const top3 = list.slice(0, 3).reduce((s, e) => s + e.share, 0);
    const best = pl ? list.slice().sort((x, y) => y.margin - x.margin).find(e => e.rev > total.rev * 0.01) : null;
    const growers = list.filter(e => Number.isFinite(e.growth)).sort((x, y) => y.growth - x.growth)[0];
    const body = `<div class="fs-seg-row">${seg("pdim", dims.map(d => [d, DIM_PLURAL[d]]), dim)}<span class="fs-hint">Click any chart element to filter the whole platform.</span></div>
      <div class="fs-kpis fs-kpis-4">
        ${kpi({ label: DIM_PLURAL[dim] + " in view", value: String(list.length), icon: "product", sub: `<span class="fs-delta flat">top 3 = ${pct(top3)} of revenue</span>` })}
        ${kpi({ label: "Leader", value: list[0] ? esc(list[0].name) : "—", icon: "star", sub: `<span class="fs-delta flat">${list[0] ? money(list[0].rev) + " · " + pct(list[0].share) : ""}</span>` })}
        ${kpi({ label: pl ? "Best margin" : "Fastest growth", value: pl ? (best ? esc(best.name) : "—") : (growers ? esc(growers.name) : "—"), icon: "scale", sub: `<span class="fs-delta flat">${pl ? (best ? pct(best.margin) + " margin" : "") : (growers ? pctSign(growers.growth) : "")}</span>` })}
        ${kpi({ label: "Fastest growing", value: growers ? esc(growers.name) : "—", icon: "trendUp", tone: "", sub: `<span class="fs-delta ${growers && growers.growth >= 0 ? "good" : "flat"}">${growers ? pctSign(growers.growth) + " recent growth" : "needs a date column"}</span>` })}
      </div>
      <div class="fs-grid">
        ${card("Revenue by " + DIM_LABEL[dim].toLowerCase(), "Top 10 · click to filter", chartBox("chPerfBar", 330), { span: 6 })}
        ${card("Revenue share", "Share of total in view", chartBox("chPerfPie", 330), { span: 6 })}
        ${pl ? card("Profit by " + DIM_LABEL[dim].toLowerCase(), "Net profit after expenses · red bars indicate a loss", chartBox("chPerfProfit", 330), { span: 6 }) : ""}
        ${pl ? card("Profit margin by " + DIM_LABEL[dim].toLowerCase(), "Net profit as a percentage of revenue", chartBox("chPerfMargin", 330), { span: 6 }) : ""}
        ${M.has.region && M.has.category ? card("Region × category heatmap", "Revenue in the filtered view", chartBox("chHeat", 330), { span: 12 }) : ""}
        ${card("All " + DIM_PLURAL[dim].toLowerCase(), "Sortable · searchable · exportable", tableHost("perfTable"), { span: 12 })}
      </div>`;
    shell(root, c, "Performance analytics", "Performance", "Products, regions, categories and departments ranked by revenue, profit, margin and growth.", body);
    if (!c.recs.length) return;
    const click = n => applyFocus(dim + "::" + n);
    hbarPlot("chPerfBar", list, "rev", click); piePlot("chPerfPie", list, "rev", click, "Revenue");
    if (pl) {
      const l = list.slice(0, 12);
      plot("chPerfProfit", [{ type: "bar", name: "Net profit", x: l.map(e => e.name), y: l.map(e => e.profit), marker: { color: l.map(e => e.profit >= 0 ? "#16A34A" : "#DC2626"), cornerradius: 4 }, customdata: fmtHover(l.map(e => e.profit)), text: fmtHover(l.map(e => e.profit)), textposition: "outside", cliponaxis: false, hovertemplate: "<b>%{x}</b><br>Net profit: %{customdata}<extra></extra>" }],
        { showlegend: false, yaxis: moneyAxis(l.map(e => e.profit)), xaxis: { automargin: true, tickangle: -25 }, margin: { l: 76, r: 34, t: 38, b: 92 }, hovermode: "closest" }, pt => click(pt.x));
      plot("chPerfMargin", [{ type: "bar", name: "Profit margin", x: l.map(e => e.name), y: l.map(e => e.margin * 100), marker: { color: l.map(e => e.margin >= 0 ? "#7C3AED" : "#DC2626"), cornerradius: 4 }, text: l.map(e => (e.margin * 100).toFixed(1) + "%"), textposition: "outside", cliponaxis: false, customdata: l.map(e => pct(e.margin)), hovertemplate: "<b>%{x}</b><br>Profit margin: %{customdata}<extra></extra>" }],
        { showlegend: false, yaxis: { ticksuffix: "%", rangemode: "tozero", automargin: true, zeroline: true, zerolinecolor: getCss("--grid") }, xaxis: { automargin: true, tickangle: -25 }, margin: { l: 60, r: 28, t: 38, b: 92 }, hovermode: "closest" }, pt => click(pt.x));
    }
    if (M.has.region && M.has.category && document.getElementById("chHeat")) {
      const rs = c.ents("region").ents.map(e => e.name), cs = c.ents("category").ents.map(e => e.name), mat = rs.map(() => cs.map(() => 0));
      c.recs.forEach(r => { const i = rs.indexOf(r.region), j = cs.indexOf(r.category); if (i >= 0 && j >= 0) mat[i][j] += r.rev; });
      plot("chHeat", [{ type: "heatmap", x: cs, y: rs, z: mat, colorscale: [[0, getCss("--surface-3")], [1, getCss("--chart-1")]], showscale: false, text: mat.map(r => r.map(v => money(v))), texttemplate: "%{text}", textfont: { size: 11 }, hovertemplate: "<b>%{y} × %{x}</b><br>%{text}<extra></extra>", xgap: 3, ygap: 3 }], { showlegend: false, margin: { l: 120, r: 10, t: 6, b: 40 }, yaxis: { autorange: "reversed", automargin: true } });
    }
    const cols = [{ k: "name", label: DIM_LABEL[dim] }, { k: "rev", label: "Revenue", align: "r", render: r => money(r.rev) }, { k: "share", label: "Share", align: "r", render: r => pct(r.share) }];
    if (pl) cols.push({ k: "cost", label: "Cost", align: "r", render: r => money(r.cost) }, { k: "profit", label: "Profit", align: "r", render: r => `<span class="${r.profit < 0 ? "neg-text" : ""}">${money(r.profit)}</span>` }, { k: "margin", label: "Margin", align: "r", render: r => pct(r.margin) });
    cols.push({ k: "growth", label: "Growth", align: "r", render: r => trendPill(r.growth) });
    if (M.has.units) cols.push({ k: "units", label: "Units", align: "r", render: r => Math.round(r.units).toLocaleString("en-IN") });
    cols.push({ k: "act", label: "", sort: false, render: r => focusBtn(dim, r.name) });
    UI.table({ el: "#perfTable", cols, rows: list, pageSize: 10, searchKeys: ["name"], exportName: "performance-" + dim, dense: true });
    bindFocus("#perfTable", applyFocus);
  };
  P.revenue = P.regions = P.profitability = P.products;

  /* ============================================================
     PROFIT & LOSS
     ============================================================ */
  function periodRows(recs, gran, M) {
    const map = new Map(); const fyShort = fy => M.fyStart === 0 ? "FY" + String(fy).slice(2) : "FY" + String(fy).slice(2) + "-" + String((fy + 1) % 100).padStart(2, "0");
    recs.forEach(r => {
      if (!Number.isFinite(r.ym)) return; let key, label;
      if (gran === "month") { key = r.ym; label = E.monthLabel(r.ym); } else if (gran === "quarter") { key = r.fy * 4 + r.q - 1; label = "Q" + r.q + " " + fyShort(r.fy); } else { key = r.fy; label = E.fyLabel(r.fy, M.fyStart); }
      let o = map.get(key); if (!o) { o = { key, label, rev: 0, cost: 0, profit: 0, budget: 0, salary: 0, units: 0 }; map.set(key, o); }
      o.rev += r.rev; o.cost += r.cost; o.profit += r.profit; o.budget += r.budget; o.salary += r.salary; o.units += r.units;
    });
    return [...map.values()].sort((a, b) => a.key - b.key);
  }
  P.expenses = function (root) {
    const c = buildCtx(), M = c.M, a = c.agg, p = c.priorAgg; const gran = fs.pnlGran || "month";
    if (!M.has.hasPL) { shell(root, c, "Finance", "Profit & Loss", "Statement of revenue, expenses and profit.", needsPL(c)); return; }
    const costDim = ["dept", "category", "region", "product"].find(k => M.has[k] && !c.spec[k]);
    const dim = curDim(M, c);
    let periods = M.has.date ? periodRows(c.recs, gran, M) : [{ key: 0, label: "Total", rev: a.rev, cost: a.cost, profit: a.profit, budget: a.budget, salary: a.salary, units: a.units }];
    periods = periods.slice(-(gran === "month" ? 12 : gran === "quarter" ? 8 : 6));
    const money1 = v => money(v, 1);
    const row = (label, fn, cls) => `<tr class="${cls || ""}"><th>${label}</th>${periods.map((q, i) => `<td>${fn(q, i)}</td>`).join("")}</tr>`;
    const cell = v => `<span class="${v < 0 ? "neg-text" : ""}">${money1(v)}</span>`;
    const stmt = `<div class="fs-stmt-wrap"><table class="fs-stmt"><thead><tr><th>Line item</th>${periods.map(q => `<th>${esc(q.label)}</th>`).join("")}</tr></thead><tbody>
      ${row("Revenue", q => cell(q.rev), "strong")}
      ${row("Total expenses", q => cell(-q.cost))}
      ${row("Net profit / (loss)", q => cell(q.profit), "strong total")}
      ${row("Profit margin", q => pct(q.rev ? q.profit / q.rev : 0))}
      ${row("Revenue growth", (q, i) => i ? trendPill(periods[i - 1].rev ? q.rev / periods[i - 1].rev - 1 : NaN) : "—")}
      ${row("Profit growth", (q, i) => i ? trendPill(periods[i - 1].profit > 0 ? q.profit / periods[i - 1].profit - 1 : NaN) : "—")}
      ${M.has.budget ? row("Budget (plan)", q => money1(q.budget), "sep") + row("Spend variance vs plan", q => { const v = q.cost - q.budget; return `<span class="${v > 0 ? "neg-text" : "pos-text"}">${v > 0 ? "+" : "−"}${money1(Math.abs(v))}</span>`; }) : ""}
      ${M.has.salary ? row("Payroll", q => money1(q.salary), "sep") + row("Payroll % of revenue", q => pct(q.rev ? q.salary / q.rev : 0)) : ""}
      </tbody></table></div>`;
    const be = c.be();
    const body = `<div class="fs-kpis fs-kpis-4">
        ${kpi({ label: "Revenue", value: money(a.rev), raw: a.rev, kind: "money", icon: "revenue", sub: delta(a.rev, p && p.rev) })}
        ${kpi({ label: "Total expenses", value: money(a.cost), raw: a.cost, kind: "money", icon: "expense", sub: delta(a.cost, p && p.cost, { invert: true }) })}
        ${kpi({ label: "Net profit", value: money(a.profit), raw: a.profit, kind: "money", icon: "trendUp", tone: a.profit < 0 ? "bad" : "", sub: delta(a.profit, p && p.profit) })}
        ${kpi({ label: "Break-even revenue", value: be ? money(be.breakEvenRevenue) : "—", icon: "scale", sub: `<span class="fs-delta flat">${be && be.marginOfSafety != null ? "margin of safety " + pct(be.marginOfSafety) : ""}</span>` })}
      </div>
      <div class="fs-grid">
        ${card("Income statement", "Revenue → expenses → net profit by period", stmt, { span: 12, right: (M.has.date ? seg("pnlGran", [["month", "Monthly"], ["quarter", "Quarterly"], ["year", "Fiscal year"]], gran) : "") + `<button class="btn btn-g btn-sm" id="pnlExport">${icon("download", "ic-14")} CSV</button>` })}
        ${card("Revenue to profit bridge", esc(c.spec.label), chartBox("chWater", 300), { span: 5 })}
        ${costDim ? card("Where the money goes", "Expenses by " + DIM_LABEL[costDim].toLowerCase(), chartBox("chCostMix", 300), { span: 7 }) : ""}
        ${M.has.date ? card("Margin trend", "Monthly profit margin vs period average", chartBox("chMargin", 280), { span: 6 }) : ""}
        ${dim ? card("Profit by " + DIM_LABEL[dim].toLowerCase(), "Green = profit · red = loss", chartBox("chProfDim", 280), { span: M.has.date ? 6 : 12 }) : ""}
        ${dim ? card("P&L by " + DIM_LABEL[dim].toLowerCase(), "Choose the dimension on the Performance page", tableHost("pnlDimTable"), { span: 12, right: seg("pdim", availDims(M).map(d => [d, DIM_PLURAL[d]]), dim) }) : ""}
      </div>`;
    shell(root, c, "Finance", "Profit & Loss", "Income statement, cost mix, margin trend and profit by segment for the selected period.", body);
    if (!c.recs.length) return;
    plot("chWater", [{ type: "waterfall", orientation: "v", measure: ["absolute", "relative", "total"], x: ["Revenue", "Expenses", "Net profit"], y: [a.rev, -a.cost, 0], text: [money(a.rev), "−" + money(a.cost), money(a.profit)], textposition: "outside", connector: { line: { color: getCss("--border") } }, increasing: { marker: { color: getCss("--chart-5") } }, decreasing: { marker: { color: getCss("--chart-4") } }, totals: { marker: { color: a.profit >= 0 ? getCss("--chart-1") : getCss("--bad") } }, hoverinfo: "x+text" }], { showlegend: false, yaxis: moneyAxis([a.rev, 0, a.profit]), margin: { l: 70, r: 10, t: 24, b: 36 } });
    if (costDim) piePlot("chCostMix", c.ents(costDim).ents, "cost", n => applyFocus(costDim + "::" + n), "Expenses");
    if (M.has.date && c.series.length > 1) { const s = c.series; plot("chMargin", [{ type: "scatter", mode: "lines+markers", name: "Margin", x: monthTicks(s.map(m => m.ym)), y: s.map(m => m.margin * 100), line: { color: getCss("--chart-1"), width: 2.6, shape: "spline" }, marker: { size: 4 }, hovertemplate: "Margin: <b>%{y:.1f}%</b><extra></extra>" }, { type: "scatter", mode: "lines", name: "Period average", x: monthTicks(s.map(m => m.ym)), y: s.map(() => a.margin * 100), line: { color: getCss("--text-4"), dash: "dot", width: 1.5 }, hoverinfo: "skip" }], { yaxis: { ticksuffix: "%" }, xaxis: { type: "category", nticks: 8 }, hovermode: "x unified" }); }
    else if (M.has.date) emptyChart("chMargin", "Need at least two periods for a margin trend.");
    if (dim) { const ents = c.ents(dim).ents.slice().sort((x, y) => y.profit - x.profit); hbarPlot("chProfDim", ents, "profit", n => applyFocus(dim + "::" + n), getCss("--chart-5"));
      UI.table({ el: "#pnlDimTable", cols: [{ k: "name", label: DIM_LABEL[dim] }, { k: "rev", label: "Revenue", align: "r", render: r => money(r.rev) }, { k: "cost", label: "Expenses", align: "r", render: r => money(r.cost) }, { k: "profit", label: "Net profit", align: "r", render: r => `<span class="${r.profit < 0 ? "neg-text" : ""}">${money(r.profit)}</span>` }, { k: "margin", label: "Margin", align: "r", render: r => pct(r.margin) }, { k: "share", label: "Revenue share", align: "r", render: r => pct(r.share) }, { k: "growth", label: "Growth", align: "r", render: r => trendPill(r.growth) }], rows: ents.slice().sort((x, y) => y.rev - x.rev), pageSize: 10, searchKeys: ["name"], exportName: "pnl-by-" + dim, dense: true }); }
    const ex = root.querySelector("#pnlExport"); if (ex) ex.onclick = () => { const lines = [["Line item", ...periods.map(q => q.label)], ["Revenue", ...periods.map(q => Math.round(q.rev))], ["Total expenses", ...periods.map(q => Math.round(q.cost))], ["Net profit", ...periods.map(q => Math.round(q.profit))], ["Margin %", ...periods.map(q => q.rev ? (q.profit / q.rev * 100).toFixed(2) : "")]]; downloadFile("profit-and-loss-" + gran + ".csv", lines.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(",")).join("\r\n"), "text/csv;charset=utf-8"); toast("ok", "P&L exported", "Statement downloaded as CSV (" + (M.scale === 1 ? "full units" : "scaled units") + ")."); };
  };
  P.pl = P.expenses;

  /* ============================================================
     BUDGET CONTROL — live budget tracking
     ============================================================ */
  function budgetBars(id, b) {
    const r = b.rows.slice(0, 10); if (!r.length) return emptyChart(id, "No budget data to show.");
    plot(id, [{ type: "bar", name: "Plan", x: r.map(x => x.name), y: r.map(x => x.planned), marker: { color: getCss("--chart-2"), cornerradius: 3 }, customdata: fmtHover(r.map(x => x.planned)), hovertemplate: "<b>%{x}</b><br>Plan: %{customdata}<extra></extra>" },
      { type: "bar", name: "Actual", x: r.map(x => x.name), y: r.map(x => x.actual), marker: { color: r.map(x => x.tone === "bad" ? getCss("--bad") : x.tone === "warn" ? getCss("--warn") : getCss("--chart-1")), cornerradius: 3 }, customdata: r.map(x => [money(x.actual), x.util == null ? "n/a" : pct(x.util)]), hovertemplate: "<b>%{x}</b><br>Actual: %{customdata[0]}<br>Utilisation: %{customdata[1]}<extra></extra>" }],
      { barmode: "group", bargap: 0.28, bargroupgap: 0.12, yaxis: moneyAxis(r.flatMap(x => [x.planned, x.actual])), xaxis: { automargin: true, tickangle: r.length > 5 ? -20 : 0, tickfont: { size: 11 } }, margin: { l: 76, r: 28, t: 42, b: r.length > 5 ? 90 : 62 } });
  }
  P.budgets = P.variance = function (root) {
    const c = buildCtx(), M = c.M;
    if (!M.has.hasPL && !M.has.cost) { shell(root, c, "Finance", "Budget Control", "Track spend against plan.", needsPL(c)); return; }
    const dims = ["dept", "category", "region", "product"].filter(k => M.has[k]); const bd = c.bdim(); const b = c.budget(), t = b.total;
    const unitDiv = fs.cur === "INR" ? 1e7 : 1e6, unitName = fs.cur === "INR" ? "₹ Cr" : E.CURRENCIES[fs.cur].sym + " M";
    const overs = b.rows.filter(r => r.tone === "bad"), watch = b.rows.filter(r => r.tone === "warn");
    const projTot = b.rows.reduce((s, r) => s + (Number.isFinite(r.proj) ? r.proj : 0), 0), annTot = b.rows.reduce((s, r) => s + (Number.isFinite(r.annual) ? r.annual : 0), 0);
    const risks = b.rows.filter(r => Number.isFinite(r.projVar) && r.annual && r.projVar / r.annual > 0.02).sort((x, y) => y.projVar - x.projVar).slice(0, 3);
    const body = `<div class="fs-kpis fs-kpis-4">
        ${kpi({ label: "Budget (period)", value: money(t.planned), raw: t.planned, kind: "money", icon: "budget", sub: `<span class="fs-delta flat">${b.hasBudgetCol ? "from your Budget column" : "editable baseline"}</span>` })}
        ${kpi({ label: "Actual spend", value: money(t.actual), raw: t.actual, kind: "money", icon: "expense", sub: `<span class="fs-delta flat">${esc(c.spec.label)}</span>` })}
        ${kpi({ label: "Variance", value: (t.variance > 0 ? "+" : t.variance < 0 ? "−" : "") + money(Math.abs(t.variance)), icon: "variance", tone: t.util != null && t.util - 1 > fs.thr ? "bad" : t.util > 1 ? "warn" : "", sub: `<span class="fs-delta ${t.variance > 0 ? "bad" : "good"}">${t.util == null ? "" : pctSign(t.util - 1) + (t.variance > 0 ? " over plan" : " under plan")}</span>` })}
        ${kpi({ label: "Utilisation", value: t.util == null ? "—" : pct(t.util), raw: t.util, kind: "pct", icon: "scale", tone: t.util != null && t.util - 1 > fs.thr ? "bad" : t.util > 1 ? "warn" : "", sub: `<span class="fs-delta flat">${overs.length} over · ${watch.length} watch · ${b.rows.length - overs.length - watch.length} on track</span>` })}
      </div>
      <div class="fs-grid">
        ${card(b.fy != null && b.elapsed ? "Year-end outlook · " + E.fyLabel(b.fy, M.fyStart) : "Year-end outlook", "Run-rate projection of full-year spend vs full-year plan", `<div class="fs-outlook"><div><small>Projected full-year spend</small><strong>${Number.isFinite(projTot) && projTot ? money(projTot) : "—"}</strong></div><div><small>Full-year plan</small><strong>${annTot ? money(annTot) : "—"}</strong></div><div><small>Projected variance</small><strong class="${projTot > annTot ? "neg-text" : "pos-text"}">${annTot && projTot ? (projTot > annTot ? "+" : "−") + money(Math.abs(projTot - annTot)) : "—"}</strong></div></div>
          ${risks.length ? `<ul class="fs-flags">${risks.map(r => `<li><b>${esc(r.name)}</b> is on course to overspend its full-year plan by ${money(r.projVar)} (${pctSign(r.projVar / r.annual)}).</li>`).join("")}</ul>` : `<p class="fs-hint">No ${DIM_LABEL[bd] ? DIM_LABEL[bd].toLowerCase() : "segment"} is projected to exceed its full-year plan by more than 2%.</p>`}`, { span: 5 })}
        ${card("Budget vs actual", "Grouped by " + (bd ? DIM_LABEL[bd].toLowerCase() : "company") + " · red = over threshold", chartBox("chBudGroup", 360), { span: 7, right: dims.length > 1 ? seg("bdim", dims.map(d => [d, DIM_PLURAL[d]]), bd) : "" })}
        ${M.has.date ? card("Cumulative burn", "Cumulative actual spend vs cumulative plan across the period", chartBox("chBurn", 320), { span: 12 }) : ""}
        ${card("Budget guardrails", "Flag a group when spend exceeds plan by more than the threshold", `<div class="fs-guard"><label class="fs-f"><span>Variance threshold</span><select data-fs="thr">${[0.05, 0.10, 0.15, 0.20, 0.25].map(v => `<option value="${v}" ${Math.abs(fs.thr - v) < 1e-9 ? "selected" : ""}>${Math.round(v * 100)}% over plan</option>`).join("")}</select></label>
          <div class="fs-legend"><span>${badge("ok", "On track")} ≤ plan</span><span>${badge("warn", "Watch")} above plan, within threshold</span><span>${badge("bad", "Over budget")} beyond threshold</span><span>${badge("info", "Under-utilised")} well below plan</span></div></div>
          ${b.rows.filter(r => r.tone === "bad" || r.tone === "warn").length ? `<ul class="fs-flags">${b.rows.filter(r => r.tone === "bad" || r.tone === "warn").slice(0, 4).map(r => `<li><b>${esc(r.name)}</b> — ${pct(r.util)} of plan (${pctSign(r.util - 1)}). ${r.tone === "bad" ? "Escalate and re-forecast." : "Monitor run-rate."}</li>`).join("")}</ul>` : `<p class="fs-hint">All groups are within plan.</p>`}`, { span: M.has.date ? 6 : 12 })}
        ${card("Budget tracker", b.hasBudgetCol ? "Plan is taken from your Budget column" : `No Budget column found — enter annual budgets below (${unitName}); defaults are an auto-baseline of trailing-12-month spend +5%`, tableHost("budTable"), { span: 12, right: !b.hasBudgetCol ? `<button class="btn btn-g btn-sm" id="budReset">Reset to auto-baseline</button>` : "" })}
      </div>`;
    shell(root, c, "Finance", "Budget Control", "Track actual spend against plan, see run-rate projections and get guardrail alerts before overruns land.", body);
    if (!c.recs.length) return;
    budgetBars("chBudGroup", b);
    if (document.getElementById("chBurn")) { const cm = b.cum; if (cm.length < 2) emptyChart("chBurn", "Need at least two periods."); else plot("chBurn", [{ type: "scatter", mode: "lines", name: "Plan", x: monthTicks(cm.map(m => m.ym)), y: cm.map(m => m.budget), line: { color: getCss("--chart-2"), width: 2.4, dash: "dash" }, customdata: fmtHover(cm.map(m => m.budget)), hovertemplate: "Plan: <b>%{customdata}</b><extra></extra>" }, { type: "scatter", mode: "lines", name: "Actual", x: monthTicks(cm.map(m => m.ym)), y: cm.map(m => m.actual), line: { color: getCss("--chart-1"), width: 2.8 }, fill: "tonexty", fillcolor: "rgba(200,60,60,0.08)", customdata: fmtHover(cm.map(m => m.actual)), hovertemplate: "Actual: <b>%{customdata}</b><extra></extra>" }], { hovermode: "x unified", yaxis: moneyAxis(cm.flatMap(m => [m.budget, m.actual])), xaxis: { type: "category", nticks: 8 } }); }
    const canEdit = !b.hasBudgetCol && window.APP.can("write");
    UI.table({ el: "#budTable", cols: [{ k: "name", label: bd ? DIM_LABEL[bd] : "Scope" }, { k: "planned", label: "Plan (period)", align: "r", render: r => money(r.planned) }, { k: "actual", label: "Actual", align: "r", render: r => money(r.actual) },
      { k: "variance", label: "Variance", align: "r", render: r => `<span class="${r.variance > 0 ? "neg-text" : "pos-text"}">${r.variance > 0 ? "+" : "−"}${money(Math.abs(r.variance))}</span>` },
      { k: "util", label: "Utilisation", align: "r", render: r => r.util == null ? "—" : `<div class="fs-util"><i style="width:${Math.min(100, r.util * 100)}%" class="t-${r.tone}"></i><span>${pct(r.util)}</span></div>` },
      { k: "burn", label: "Monthly burn", align: "r", render: r => money(r.burn) },
      { k: "proj", label: "Projected FY spend", align: "r", render: r => Number.isFinite(r.proj) ? money(r.proj) : "—" },
      { k: "status", label: "Status", render: r => badge(r.tone, r.status) },
      ...(!b.hasBudgetCol ? [{ k: "annual", label: "Annual budget (" + unitName + ")", sort: false, render: r => `<input type="number" step="0.01" min="0" class="fs-input" data-bud="${esc(r.name)}" value="${Number.isFinite(r.annual) ? (r.annual / unitDiv).toFixed(2) : ""}" ${canEdit ? "" : "disabled"}>` }] : [])],
      rows: b.rows, pageSize: 10, searchKeys: ["name"], exportName: "budget-tracker", dense: true });
    const host = root.querySelector("#budTable"); if (host) host.addEventListener("change", e => { const i = e.target.closest("[data-bud]"); if (!i) return; const v = parseFloat(i.value); if (Number.isFinite(v) && v >= 0) { fs.budgets[i.dataset.bud] = v * unitDiv; save(); toast("ok", "Budget updated", i.dataset.bud + " annual budget set to " + money(v * unitDiv) + "."); route(); } });
    const rs = root.querySelector("#budReset"); if (rs) rs.onclick = () => { fs.budgets = {}; save(); route(); };
  };

  /* ============================================================
     FORECAST
     ============================================================ */
  P.forecast = function (root) {
    const c = buildCtx(), M = c.M;
    if (!M.has.date) { shell(root, c, "Planning", "Revenue Forecast", "12-month revenue outlook.", `<div class="fs-card fs-s12"><div class="fs-card-b">${emptyState("A date column is required to forecast", `Map a date / month / period column in <a href="#/data">Data Import → Column setup</a>.`, `<a class="btn btn-p btn-sm" href="#/data">Open column mapping</a>`)}</div></div>`); return; }
    const f = c.forecast(), fcost = c.forecastCost(); const sc = fs.fcScenario || "base";
    if (!f) { shell(root, c, "Planning", "Revenue Forecast", "12-month revenue outlook.", `<div class="fs-card fs-s12"><div class="fs-card-b">${emptyState("Not enough history to forecast", "At least 3 periods of dated revenue are needed for the selected segments.", "")}</div></div>`); return; }
    const sum = k => f.fc.reduce((s, x) => s + x[k], 0); const m = f.model;
    const fProfit = fcost ? sum("base") - fcost.fc.reduce((s, x) => s + x.base, 0) : null;
    const tone = m.confidence === "High" ? "ok" : m.confidence === "Medium" ? "warn" : m.confidence === "Low" ? "bad" : "mut";
    const strat = c.strategy(); const rk = ["region", "category", "product", "dept"].find(k => strat.dims[k]);
    const body = `<div class="fs-seg-row">${seg("fcScenario", [["base", "Base"], ["opt", "Optimistic"], ["cons", "Conservative"], ["all", "All scenarios"]], sc)}<span class="fs-hint">Date filters are ignored here — the model uses the full history of the selected segments.</span></div>
      <div class="fs-kpis fs-kpis-4">
        ${kpi({ label: "Next-12M revenue (base)", value: money(f.total12), raw: f.total12, kind: "money", icon: "forecast", sub: `<span class="fs-delta ${f.growth >= 0 ? "good" : "bad"}"><i>${f.growth >= 0 ? "▲" : "▼"}</i>${Math.abs(f.growth * 100).toFixed(1)}% <em>vs last 12M (${money(f.last12)})</em></span>` })}
        ${kpi({ label: "Scenario range", value: money(sum("cons")) + " – " + money(sum("opt")), icon: "variance", sub: `<span class="fs-delta flat">conservative → optimistic (interquartile)</span>` })}
        ${kpi({ label: "Forecast profit (base)", value: fProfit == null ? "—" : money(fProfit), raw: fProfit == null ? NaN : fProfit, kind: "money", icon: "trendUp", tone: fProfit != null && fProfit < 0 ? "bad" : "", sub: `<span class="fs-delta flat">${fProfit == null ? "needs a cost column" : "implied margin " + pct(fProfit / sum("base"))}</span>` })}
        ${kpi({ label: "Model confidence", value: m.confidence, icon: "shield", tone: tone === "bad" ? "bad" : tone === "warn" ? "warn" : "", sub: `<span class="fs-delta flat">${m.mape == null ? "needs ≥12 months to backtest" : "backtest MAPE " + pct(m.mape)}</span>` })}
      </div>
      <div class="fs-grid">
        ${card("Revenue forecast", esc(m.method) + " · shaded = 90% range", chartBox("chForecast", 340), { span: 8 })}
        ${card("Model card", "Evaluation metrics — not guarantees", `<dl class="fs-dl"><dt>Method</dt><dd>${esc(m.method)}</dd><dt>History used</dt><dd>${m.n} months${m.interpolated ? " (" + m.interpolated + " gap months interpolated)" : ""}</dd><dt>Seasonality</dt><dd>${m.seasonal ? "Detected (12-month index)" : "Not modelled (needs 24+ months)"}</dd>${m.params ? `<dt>Smoothing (α / β / φ)</dt><dd>${m.params.alpha} / ${m.params.beta} / ${m.params.phi}</dd>` : ""}<dt>Holdout backtest</dt><dd>${m.mape == null ? "n/a" : m.holdout + " months"}</dd><dt>MAPE</dt><dd>${m.mape == null ? "n/a" : pct(m.mape)}</dd><dt>MAE / RMSE</dt><dd>${m.mae == null ? "n/a" : money(m.mae) + " / " + money(m.rmse)}</dd><dt>Confidence</dt><dd>${badge(tone, m.confidence)}</dd></dl><p class="fs-hint">Metrics come from forecasting the last ${m.holdout || "few"} known months and comparing with actuals. Real outcomes depend on pricing, demand shocks and decisions the data cannot see.</p>`, { span: 4 })}
        ${rk ? card("Next 12 months by " + DIM_LABEL[rk].toLowerCase(), "Last 12M actual vs next 12M forecast · label = growth", chartBox("chFcDim", 300), { span: 7 }) : ""}
        ${m.seasonalIdx ? card("Seasonality", "Index by calendar month (1.00 = average)", chartBox("chSeason", 300), { span: 5 }) : ""}
        ${card("Monthly forecast", "Base, scenarios and implied profit", tableHost("fcTable"), { span: 12 })}
      </div>`;
    shell(root, c, "Planning", "Revenue Forecast", "A transparent 12-month outlook with scenarios, confidence bands and a backtested accuracy score.", body);
    forecastPlot("chForecast", c, { scenario: sc, hist: 36 });
    if (rk) { const ents = strat.dims[rk].ents.filter(e => Number.isFinite(e.fcTotal)).slice(0, 10); if (ents.length) plot("chFcDim", [{ type: "bar", name: "Last 12M", x: ents.map(e => e.name), y: ents.map(e => e.fcLast), marker: { color: getCss("--chart-2"), cornerradius: 3 }, customdata: fmtHover(ents.map(e => e.fcLast)), hovertemplate: "<b>%{x}</b><br>Last 12M: %{customdata}<extra></extra>" }, { type: "bar", name: "Next 12M (forecast)", x: ents.map(e => e.name), y: ents.map(e => e.fcTotal), marker: { color: getCss("--chart-3"), cornerradius: 3 }, text: ents.map(e => pctSign(e.fcGrowth, 0)), textposition: "outside", cliponaxis: false, customdata: fmtHover(ents.map(e => e.fcTotal)), hovertemplate: "<b>%{x}</b><br>Forecast: %{customdata}<extra></extra>" }], { barmode: "group", yaxis: moneyAxis(ents.flatMap(e => [e.fcLast, e.fcTotal])), xaxis: { automargin: true, tickangle: ents.length > 5 ? -20 : 0 } }); else emptyChart("chFcDim", "Not enough history per segment."); }
    if (m.seasonalIdx) plot("chSeason", [{ type: "bar", x: E.MONTHS.map(s => s[0].toUpperCase() + s.slice(1)), y: E.MONTHS.map((_, i) => m.seasonalIdx[i]), marker: { color: E.MONTHS.map((_, i) => m.seasonalIdx[i] >= 1 ? getCss("--chart-5") : getCss("--chart-2")), cornerradius: 3 }, hovertemplate: "<b>%{x}</b>: %{y:.2f}×<extra></extra>" }], { showlegend: false, yaxis: { range: [Math.min(0.85, ...m.seasonalIdx) - 0.03, Math.max(1.15, ...m.seasonalIdx) + 0.03] }, shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 1, y1: 1, line: { color: getCss("--text-4"), dash: "dot" } }] });
    const costBase = fcost ? fcost.fc : null;
    UI.table({ el: "#fcTable", cols: [{ k: "label", label: "Month" }, { k: "cons", label: "Conservative", align: "r", render: r => money(r.cons) }, { k: "base", label: "Base", align: "r", render: r => `<b>${money(r.base)}</b>` }, { k: "opt", label: "Optimistic", align: "r", render: r => money(r.opt) }, { k: "lo", label: "90% low", align: "r", render: r => money(r.lo) }, { k: "hi", label: "90% high", align: "r", render: r => money(r.hi) }, ...(costBase ? [{ k: "cost", label: "Forecast cost", align: "r", render: r => money(r.cost) }, { k: "profit", label: "Forecast profit", align: "r", render: r => `<span class="${r.profit < 0 ? "neg-text" : ""}">${money(r.profit)}</span>` }] : [])],
      rows: f.fc.map((x, i) => ({ label: E.monthLabel(x.ym), cons: x.cons, base: x.base, opt: x.opt, lo: x.lo90, hi: x.hi90, cost: costBase ? costBase[i].base : 0, profit: costBase ? x.base - costBase[i].base : 0 })), pageSize: 12, sortable: false, exportName: "revenue-forecast", dense: true });
  };

  /* ============================================================
     MARKET STRATEGY — where to focus, with reasons
     ============================================================ */
  const ACTION = { "Invest & expand": "Increase investment and sales capacity", "Grow, fix margin": "Fix pricing / cost-to-serve before adding spend", "Defend & harvest": "Defend share; use cash flow to fund growth", "Reassess": "Reassess commitment or restructure costs" };
  function allocationFor(d, key) {
    if (!d || d.ents.length < 4) return null; const s = d.ents.slice().sort((a, b) => b.score - a.score), q = Math.max(1, Math.floor(s.length / 4)), hi = s.slice(0, q), lo = s.slice(-q);
    const sm = (a, f) => a.reduce((t, x) => t + f(x), 0); const pool = sm(lo, x => x.cost) * 0.10; const effHi = sm(hi, x => x.rev) / Math.max(1, sm(hi, x => x.cost)), effLo = sm(lo, x => x.rev) / Math.max(1, sm(lo, x => x.cost));
    return { from: lo.map(x => x.name), to: hi.map(x => x.name), shift: pool, effHi, effLo, revDelta: pool * (effHi - effLo) };
  }
  function narrative(c, d, key) {
    const co = c.agg, L = DIM_LABEL[key].toLowerCase(), out = [];
    const why = e => [Number.isFinite(e.fcGrowth) ? `forecast ${pctSign(e.fcGrowth)} over the next 12 months` : Number.isFinite(e.growth) ? `${pctSign(e.growth)} recent growth` : null, c.M.has.hasPL ? `${pct(e.margin)} margin vs ${pct(co.margin)} company average` : null, `${pct(e.share)} of revenue`].filter(Boolean).join(", ");
    const e0 = d.focus[0]; if (e0) { const up = Number.isFinite(e0.fcTotal) && Number.isFinite(e0.fcLast) ? e0.fcTotal - e0.fcLast : null; out.push(`<b>Focus on ${esc(e0.name)}.</b> It scores ${e0.score}/100 for market attractiveness — ${esc(why(e0))}.` + (up != null && up > 0 ? ` The forecast adds about ${money(up)} of revenue here over the next 12 months, the opportunity to prioritise.` : "")); }
    if (d.focus[1]) out.push(`<b>Second priority: ${esc(d.focus[1].name)}</b> — ${esc(why(d.focus[1]))}.`);
    if (d.fix[0]) out.push(`<b>Fix before scaling: ${esc(d.fix[0].name)}.</b> Growing faster than the median ${L} but at ${pct(d.fix[0].margin)} margin — improve pricing or cost-to-serve so extra revenue turns into profit.`);
    if (d.harvest[0]) out.push(`<b>Defend & harvest: ${esc(d.harvest[0].name)}.</b> Above-median margin (${pct(d.harvest[0].margin)}) with slower growth — protect share and use its cash flow to fund growth ${L}s.`);
    if (d.avoid[0]) out.push(`<b>Reassess: ${esc(d.avoid[0].name)}.</b> Below-median growth <i>and</i> margin — avoid new investment until the cost base or offer is fixed.`);
    return out;
  }
  P.insights = function (root) {
    const c = buildCtx(), M = c.M, st = c.strategy(); const keys = ["region", "category", "product", "dept"].filter(k => st.dims[k]);
    if (!keys.length) { shell(root, c, "Intelligence", "Market Strategy", "Where to invest, what to fix, what to defend.", `<div class="fs-card fs-s12"><div class="fs-card-b">${emptyState("Not enough segments to compare", `Market scoring needs at least two values of a <b>Region, Category, Product or Department</b> column${["region", "dept", "category", "product"].some(k => c.spec[k]) ? " — you currently have a filter applied, so reset it" : ""}. Map columns in <a href="#/data">Data</a>.`, `<button class="btn btn-p btn-sm" data-fsa="reset">Reset filters</button>`)}</div></div>`); return; }
    const key = fs.sdim && keys.includes(fs.sdim) ? fs.sdim : keys[0]; const d = st.dims[key]; const al = allocationFor(d, key); const nar = narrative(c, d, key);
    const ents = d.top; const pl = M.has.hasPL;
    const body = `<div class="fs-seg-row">${seg("sdim", keys.map(k => [k, DIM_PLURAL[k]]), key)}<span class="fs-hint">Scores blend forecast & historical growth (35%), margin (25%), scale (15%), stability (15%) and profit momentum (10%).</span></div>
      <div class="fs-grid">
        ${card("Executive recommendation", "Auto-generated from the filtered dataset, " + esc(c.spec.label), `<ul class="fs-narr">${nar.map(t => `<li>${t}</li>`).join("")}</ul>`, { span: 12, right: `<button class="btn btn-s btn-sm" id="stBrief">${icon("download", "ic-14")} Download strategy brief</button>` })}
        ${card("Priority " + DIM_PLURAL[key].toLowerCase() + " to invest in", "Highest market-attractiveness scores with positive growth", focusCards(st, key, 3), { span: 12 })}
        ${card("Growth vs margin map", "Bubble size = revenue · dashed lines = medians", chartBox("chQuad", 340), { span: 7 })}
        ${card("Revenue opportunity — next 12 months", "Forecast revenue minus last-12-month actual", chartBox("chOpp", 340), { span: 5 })}
        ${al ? card("Illustrative budget reallocation", "A what-if, not a guarantee", `<div class="fs-alloc"><p>Shift <b>10% of spend</b> (${money(al.shift)}) from the lowest-scoring ${DIM_PLURAL[key].toLowerCase()} <b>${esc(al.from.join(", "))}</b> to the highest-scoring <b>${esc(al.to.join(", "))}</b>.</p><div class="fs-outlook"><div><small>Revenue per ${fs.cur === "INR" ? "₹" : E.CURRENCIES[fs.cur].sym}1 spent — receiving</small><strong>${al.effHi.toFixed(2)}</strong></div><div><small>Revenue per ${fs.cur === "INR" ? "₹" : E.CURRENCIES[fs.cur].sym}1 spent — donating</small><strong>${al.effLo.toFixed(2)}</strong></div><div><small>Illustrative revenue uplift</small><strong class="${al.revDelta >= 0 ? "pos-text" : "neg-text"}">${al.revDelta >= 0 ? "+" : "−"}${money(Math.abs(al.revDelta))}</strong></div></div><p class="fs-hint">Assumes the receiving segments keep their current revenue-per-spend ratio (linear returns). Real returns diminish — pilot before committing.</p></div>`, { span: 12 }) : ""}
        ${card("Full scorecard", "Sorted by market-attractiveness score", tableHost("stratTable"), { span: 12 })}
      </div>`;
    shell(root, c, "Intelligence", "Market Strategy", "Where to focus for profit: scored, forecast-backed recommendations by region, category, product and department.", body);
    const fc = root.querySelectorAll("[data-drill]"); fc.forEach(b => b.onclick = () => applyFocus(b.dataset.drill));
    const colorOf = q => ({ "Invest & expand": getCss("--ok"), "Grow, fix margin": getCss("--warn"), "Defend & harvest": getCss("--info"), "Reassess": getCss("--bad") }[q]);
    const pts = ents.filter(e => Number.isFinite(e.blendGrowth) && e.rev > 0);
    if (pts.length) {
      const mx = Math.max(...pts.map(e => e.rev)); const xs = pts.map(e => (pl ? e.margin : e.share) * 100);
      plot("chQuad", [{ type: "scatter", mode: "markers+text", x: xs, y: pts.map(e => e.blendGrowth * 100), text: pts.map(e => e.name), textposition: "top center", textfont: { size: 10.5 }, marker: { size: pts.map(e => 16 + 44 * Math.sqrt(e.rev / mx)), color: pts.map(e => colorOf(e.quadrant)), opacity: 0.8, line: { color: getCss("--surface"), width: 1.5 } }, customdata: pts.map(e => [e.quadrant, e.score, pctSign(e.blendGrowth), pct(e.margin), money(e.rev)]), hovertemplate: "<b>%{text}</b><br>%{customdata[0]} · score %{customdata[1]}<br>Growth: %{customdata[2]}<br>Margin: %{customdata[3]}<br>Revenue: %{customdata[4]}<extra></extra>" }],
        { showlegend: false, xaxis: { title: { text: pl ? "Profit margin %" : "Revenue share %" }, ticksuffix: "%" }, yaxis: { title: { text: "Growth (forecast + recent) %" }, ticksuffix: "%" }, margin: { l: 58, r: 20, t: 10, b: 48 }, shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: d.med.medG * 100, y1: d.med.medG * 100, line: { color: getCss("--text-4"), dash: "dash", width: 1 } }, ...(pl ? [{ type: "line", yref: "paper", y0: 0, y1: 1, x0: d.med.medM * 100, x1: d.med.medM * 100, line: { color: getCss("--text-4"), dash: "dash", width: 1 } }] : [])] }, pt => applyFocus(key + "::" + pt.text));
    } else emptyChart("chQuad", "Growth needs a date column with 6+ months of history.");
    const opp = ents.filter(e => Number.isFinite(e.fcTotal) && Number.isFinite(e.fcLast)).map(e => ({ name: e.name, v: e.fcTotal - e.fcLast })).sort((a, b) => b.v - a.v).slice(0, 8);
    if (opp.length) hbarPlot("chOpp", opp.map(o => ({ name: o.name, v: o.v })), "v", n => applyFocus(key + "::" + n), getCss("--chart-5")); else emptyChart("chOpp", "Forecast unavailable for these segments.");
    UI.table({ el: "#stratTable", cols: [{ k: "name", label: DIM_LABEL[key] }, { k: "score", label: "Score", align: "r", render: r => `<div class="fs-util"><i style="width:${r.score}%" class="t-${r.score >= 65 ? "ok" : r.score >= 45 ? "warn" : "bad"}"></i><span>${r.score}</span></div>` }, { k: "quadrant", label: "Verdict", render: r => badge(quadTone(r.quadrant), r.quadrant) }, { k: "rev", label: "Revenue", align: "r", render: r => money(r.rev) }, { k: "share", label: "Share", align: "r", render: r => pct(r.share) }, { k: "growth", label: "Recent growth", align: "r", render: r => trendPill(r.growth) }, { k: "fcGrowth", label: "Forecast growth", align: "r", render: r => trendPill(r.fcGrowth) }, ...(pl ? [{ k: "margin", label: "Margin", align: "r", render: r => pct(r.margin) }] : []), { k: "confidence", label: "Confidence", render: r => r.confidence ? badge(r.confidence === "High" ? "ok" : r.confidence === "Medium" ? "warn" : "mut", r.confidence) : "—" }, { k: "act", label: "Recommended action", sort: false, render: r => `<span class="fs-act">${esc(ACTION[r.quadrant] || "")}</span>` }, { k: "go", label: "", sort: false, render: r => focusBtn(key, r.name) }],
      rows: ents, pageSize: 10, searchKeys: ["name", "quadrant"], exportName: "market-scorecard-" + key, dense: true });
    bindFocus("#stratTable", applyFocus);
    const br = root.querySelector("#stBrief"); if (br) br.onclick = () => {
      const strip = h => h.replace(/<[^>]+>/g, "");
      const lines = ["MARKET STRATEGY BRIEF", "Dataset: " + M.name, "Period: " + c.spec.label, "Segment: " + DIM_PLURAL[key], "", "RECOMMENDATIONS", ...nar.map(n => "- " + strip(n)), "", "SCORECARD (score | verdict | revenue | growth | margin)", ...ents.map(e => `${e.name} | ${e.score} | ${e.quadrant} | ${money(e.rev)} | ${pctSign(e.blendGrowth)} | ${pct(e.margin)}`), "", "Method: score = 35% growth (forecast+recent), 25% margin, 15% scale, 15% stability, 10% profit momentum (percentile ranks). Forecasts are statistical projections, not guarantees."];
      downloadFile("market-strategy-brief.txt", lines.join("\n"), "text/plain;charset=utf-8"); toast("ok", "Brief downloaded", "Plain-text strategy brief saved.");
    };
  };

  /* ============================================================
     STABILITY & BREAK-EVEN
     ============================================================ */
  P.stability = function (root) {
    const c = buildCtx(), M = c.M;
    if (!M.has.hasPL) { shell(root, c, "Risk", "Stability & Break-even", "Financial resilience, break-even point and stress tests.", needsPL(c)); return; }
    const st = c.stability(), be = c.be(), a = c.agg; const tone = st.score == null ? "mut" : st.score >= 80 ? "ok" : st.score >= 65 ? "info" : st.score >= 50 ? "warn" : "bad";
    const fixedPct = Math.round((be ? be.fixedShare : 0.35) * 100);
    const body = `<div class="fs-grid">
        ${card("Financial stability score", "Weighted composite · " + st.factors.length + " factors measured from your data", `<div class="fs-stab-big">${ringHTML(st.score, 160)}<div><div class="fs-rating">${badge(tone, st.rating)}</div><p class="fs-hint">80+ Strong · 65–79 Stable · 50–64 Watch · below 50 At risk</p>${st.flags.length ? `<ul class="fs-flags">${st.flags.slice(0, 3).map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : `<p class="fs-hint">No factor is below the risk threshold.</p>`}</div></div>`, { span: 4 })}
        ${card("Score drivers", "Each bar is 0–100; the weight shows influence on the total", `<div class="fs-factors">${st.factors.map(f => `<div class="fs-factor"><div class="fs-factor-top"><b>${esc(f.label)}</b><span>${esc(f.value)}</span><em>${Math.round(f.weight * 100)}% weight</em></div><div class="fs-bar-track"><i class="t-${f.score >= 75 ? "ok" : f.score >= 50 ? "warn" : "bad"}" style="width:${f.score}%"></i></div><small>${esc(f.text)} · ${f.score}/100</small></div>`).join("")}</div>`, { span: 8 })}
        ${card("Break-even analysis", "Revenue needed to cover all costs · " + esc(c.spec.label), chartBox("chBE", 340), { span: 8 })}
        ${card("The break-even point", "How the numbers add up", be ? `<dl class="fs-dl"><dt>Break-even revenue</dt><dd><b>${money(be.breakEvenRevenue)}</b> (${money(be.breakEvenMonthly)} / month)</dd><dt>Actual revenue</dt><dd>${money(be.revenue)}</dd><dt>Margin of safety</dt><dd><b class="${be.marginOfSafety < 0.1 ? "neg-text" : "pos-text"}">${pct(be.marginOfSafety)}</b> — revenue can fall this much before losses</dd><dt>Contribution margin</dt><dd>${pct(be.contributionRatio)} of each revenue unit after variable costs</dd><dt>Operating leverage</dt><dd>${be.dol == null ? "n/a" : be.dol.toFixed(2) + "× (profit moves " + be.dol.toFixed(1) + "% per 1% revenue change)"}</dd><dt>Cost structure</dt><dd>${pct(be.fixedShare, 0)} fixed · ${pct(1 - be.fixedShare, 0)} variable ${badge(be.method === "regression" ? "ok" : be.method === "manual" ? "info" : "warn", be.method === "regression" ? "measured" : be.method === "manual" ? "manual" : "assumed")}</dd>${be.breakEvenUnits ? `<dt>Break-even units</dt><dd>${Math.round(be.breakEvenUnits).toLocaleString("en-IN")} units (actual ${Math.round(be.units).toLocaleString("en-IN")})</dd>` : ""}</dl>
          <div class="fs-slider"><label for="fxSlider">Fixed share of costs: <b id="fxVal">${fixedPct}%</b></label><input type="range" id="fxSlider" min="0" max="90" step="1" value="${fixedPct}"><div class="fs-slider-r"><button class="btn btn-g btn-sm" id="fxAuto">Auto-detect</button><small>${be.method === "regression" ? `Measured by regressing monthly cost on revenue (R² ${be.r2 ? be.r2.toFixed(2) : "n/a"}).` : be.method === "assumed" ? "Not enough signal to measure — assumed 35% fixed. Adjust if you know better." : "Manual override active."}</small></div></div>` : "", { span: 4 })}
        ${card("Stress test", "What happens to profit if revenue or costs move?", be ? `<div class="fs-stress"><div class="fs-stress-in"><label>Revenue change <b id="srVal">${fs.stressRev > 0 ? "+" : ""}${fs.stressRev}%</b><input type="range" id="srSlider" min="-40" max="40" step="1" value="${fs.stressRev}"></label><label>Cost inflation <b id="scVal">${fs.stressCost > 0 ? "+" : ""}${fs.stressCost}%</b><input type="range" id="scSlider" min="-20" max="30" step="1" value="${fs.stressCost}"></label></div><div class="fs-stress-out" id="stressOut"></div></div>` : "", { span: 12 })}
      </div>`;
    shell(root, c, "Risk & resilience", "Stability & Break-even", "How resilient is the business? Stability score, break-even point, margin of safety and stress tests — all from your data.", body);
    if (!c.recs.length || !be) return;
    const maxX = Math.max(be.revenue, Number.isFinite(be.breakEvenRevenue) ? be.breakEvenRevenue * 1.4 : 0) * 1.25; const xs = Array.from({ length: 41 }, (_, i) => maxX * i / 40);
    const FC = be.fixedCost, v = be.varRatio;
    plot("chBE", [{ type: "scatter", mode: "lines", name: "Revenue", x: xs, y: xs, line: { color: getCss("--chart-1"), width: 2.8 }, customdata: fmtHover(xs), hovertemplate: "Revenue: <b>%{customdata}</b><extra></extra>" }, { type: "scatter", mode: "lines", name: "Total cost", x: xs, y: xs.map(x => FC + v * x), line: { color: getCss("--chart-4"), width: 2.8 }, customdata: fmtHover(xs.map(x => FC + v * x)), hovertemplate: "Total cost: <b>%{customdata}</b><extra></extra>" }, { type: "scatter", mode: "lines", name: "Fixed cost", x: xs, y: xs.map(() => FC), line: { color: getCss("--text-4"), width: 1.8, dash: "dot" }, hoverinfo: "skip" },
      ...(Number.isFinite(be.breakEvenRevenue) ? [{ type: "scatter", mode: "markers+text", name: "Break-even", x: [be.breakEvenRevenue], y: [be.breakEvenRevenue], text: ["Break-even " + money(be.breakEvenRevenue)], textposition: "top left", marker: { size: 13, color: getCss("--warn"), line: { color: "#fff", width: 2 } }, hoverinfo: "skip" }] : []),
      { type: "scatter", mode: "markers+text", name: "You are here", x: [be.revenue], y: [be.cost], text: ["Actual " + money(be.revenue)], textposition: "bottom left", marker: { size: 13, color: be.profit >= 0 ? getCss("--ok") : getCss("--bad"), line: { color: "#fff", width: 2 } }, hoverinfo: "skip" }],
      { hovermode: "x unified", xaxis: Object.assign({ title: { text: "Revenue" } }, moneyAxis([0, maxX])), yaxis: moneyAxis([0, FC + v * maxX, maxX]), margin: { l: 70, r: 20, t: 10, b: 46 } });
    const out = root.querySelector("#stressOut"), sr = root.querySelector("#srSlider"), sc = root.querySelector("#scSlider");
    function stress() {
      const r = +sr.value, k = +sc.value; fs.stressRev = r; fs.stressCost = k; save();
      root.querySelector("#srVal").textContent = (r > 0 ? "+" : "") + r + "%"; root.querySelector("#scVal").textContent = (k > 0 ? "+" : "") + k + "%";
      const cur = { revenue: be.revenue, cost: be.cost, profit: be.profit, margin: be.revenue ? be.profit / be.revenue : 0 }, s = E.pnlAt(be, 1 + r / 100, 1 + k / 100);
      const dP = cur.profit ? (s.profit - cur.profit) / Math.abs(cur.profit) : null; const bad = s.profit < 0;
      out.innerHTML = [["Revenue", cur.revenue, s.revenue], ["Expenses", cur.cost, s.cost], ["Net profit", cur.profit, s.profit]].map(([l, x, y]) => `<div class="fs-stress-card"><small>${l}</small><strong class="${l === "Net profit" && y < 0 ? "neg-text" : ""}">${money(y)}</strong><span>was ${money(x)}</span></div>`).join("") + `<div class="fs-stress-card"><small>Margin</small><strong>${pct(s.margin)}</strong><span>was ${pct(cur.margin)}</span></div><div class="fs-stress-verdict ${bad ? "bad" : "ok"}">${icon(bad ? "alerts" : "check", "ic-16")}<span>${bad ? "<b>Loss-making</b> under this scenario" : "<b>Still profitable</b>"}${dP != null ? (Math.abs(dP) < 0.005 ? " — profit unchanged" : " — profit " + (dP >= 0 ? "up " : "down ") + Math.abs(dP * 100).toFixed(0) + "%") : ""}. ${s.revenue < be.breakEvenRevenue * (1 + k / 100) ? "Revenue falls below the (cost-adjusted) break-even level." : "Revenue stays above break-even."}</span></div>`;
    }
    sr.oninput = sc.oninput = stress; stress();
    const fx = root.querySelector("#fxSlider"); if (fx) { fx.oninput = () => root.querySelector("#fxVal").textContent = fx.value + "%"; fx.onchange = () => { fs.fixedShare = +fx.value / 100; save(); route(); }; }
    const au = root.querySelector("#fxAuto"); if (au) au.onclick = () => { fs.fixedShare = null; save(); route(); };
  };

  /* ============================================================
     PEOPLE & PAYROLL — roles and salaries
     ============================================================ */
  P.people = function (root) {
    const c = buildCtx(), M = c.M;
    if (!M.has.salary && !M.has.role) { shell(root, c, "People", "People & Payroll", "Roles, salaries and payroll efficiency.", `<div class="fs-card fs-s12"><div class="fs-card-b">${emptyState("No role or salary columns detected", `Add a <b>Role / Designation</b> and a <b>Salary / Payroll</b> column (optionally <b>Headcount</b>) — or map them in <a href="#/data">Data Import → Column setup</a>.`, `<a class="btn btn-p btn-sm" href="#/data">Open column mapping</a>`)}</div></div>`); return; }
    const pay = E.payroll(c.recs), a = c.agg; const months = Math.max(1, new Set(c.recs.map(r => r.ym).filter(Number.isFinite)).size); const avgHC = a.hc / months;
    const avgPay = a.hc ? a.salary / a.hc : 0; const perHead = avgHC ? a.rev / avgHC : 0; const roleAvgAll = pay.roles.length ? avgPay : 0;
    const body = `<div class="fs-kpis fs-kpis-4">
        ${kpi({ label: "Total payroll", value: money(a.salary), raw: a.salary, kind: "money", icon: "users", sub: `<span class="fs-delta flat">${a.rev ? pct(a.salary / a.rev) + " of revenue" : ""}</span>` })}
        ${kpi({ label: "Average headcount", value: Math.round(avgHC).toLocaleString("en-IN"), raw: avgHC, kind: "int", icon: "users", sub: `<span class="fs-delta flat">${M.has.headcount ? "from Headcount column" : "one record = one person"}</span>` })}
        ${kpi({ label: "Average pay per head", value: money(avgPay), icon: "scale", sub: `<span class="fs-delta flat">per record period · in your Salary column's units</span>` })}
        ${kpi({ label: "Revenue per head", value: money(perHead), icon: "revenue", sub: `<span class="fs-delta flat">revenue ÷ average headcount</span>` })}
      </div>
      <div class="fs-grid">
        ${M.has.role ? card("Average pay by role", "Highest to lowest · click to filter", `<div class="fs-chart" id="chPayRole" style="min-height:360px"></div>`, { span: 7 }) : ""}
        ${card("Payroll mix", M.has.dept ? "Payroll by department" : "Payroll by role", chartBox("chPayMix", 360), { span: M.has.role ? 5 : 12 })}
        ${M.has.date ? card("Payroll vs revenue", "Payroll as % of revenue, monthly", chartBox("chPayTrend", 280), { span: 7 }) : ""}
        ${M.has.region ? card("Payroll by region", "Where the payroll is concentrated", chartBox("chPayReg", 280), { span: M.has.date ? 5 : 12 }) : ""}
        ${M.has.role ? card("Role scorecard", "Average pay, headcount and share of payroll", tableHost("roleTable"), { span: 12 }) : ""}
      </div>`;
    shell(root, c, "People", "People & Payroll", "Roles, salaries, headcount and payroll efficiency for the filtered view.", body);
    if (!c.recs.length) return;
    if (M.has.role) { const r = pay.roles.slice(0, 12).reverse(); plot("chPayRole", [{ type: "bar", orientation: "h", y: r.map(x => x.name), x: r.map(x => x.avg), marker: { color: getCss("--chart-3"), cornerradius: 3 }, customdata: fmtHover(r.map(x => x.avg)), hovertemplate: "<b>%{y}</b><br>Avg pay: %{customdata}<extra></extra>", text: fmtHover(r.map(x => x.avg)), textposition: "outside", cliponaxis: false }], { showlegend: false, margin: { l: 170, r: 100, t: 6, b: 28 }, xaxis: moneyAxis(r.map(x => x.avg), null, 4) }, pt => applyFocus && toast("info", pt.y, "Average pay " + money(pt.x))); }
    const mix = M.has.dept ? pay.depts.map(x => ({ name: x.name, v: x.salary })).sort((p, q) => q.v - p.v) : pay.roles.map(x => ({ name: x.name, v: x.salary })).sort((p, q) => q.v - p.v);
    piePlot("chPayMix", mix, "v", M.has.dept ? (n => applyFocus("dept::" + n)) : null, "Payroll");
    if (M.has.date && c.series.length > 1) { const s = c.series; plot("chPayTrend", [{ type: "bar", name: "Payroll", x: monthTicks(s.map(m => m.ym)), y: s.map(m => m.salary), marker: { color: "rgba(122,90,248,0.45)", cornerradius: 3 }, customdata: fmtHover(s.map(m => m.salary)), hovertemplate: "Payroll: <b>%{customdata}</b><extra></extra>" }, { type: "scatter", mode: "lines+markers", name: "Payroll % of revenue", yaxis: "y2", x: monthTicks(s.map(m => m.ym)), y: s.map(m => m.rev ? m.salary / m.rev * 100 : 0), line: { color: getCss("--chart-4"), width: 2.4 }, marker: { size: 4 }, hovertemplate: "%{y:.1f}% of revenue<extra></extra>" }], { yaxis: moneyAxis(s.map(m => m.salary)), yaxis2: { overlaying: "y", side: "right", ticksuffix: "%", showgrid: false, automargin: true }, xaxis: { type: "category", nticks: 8 }, hovermode: "x unified" }); } else if (M.has.date) emptyChart("chPayTrend", "Need at least two periods.");
    if (M.has.region) { const r = pay.regions.map(x => ({ name: x.name, v: x.salary })).sort((p, q) => q.v - p.v); hbarPlot("chPayReg", r, "v", n => applyFocus("region::" + n), getCss("--chart-3")); }
    if (M.has.role) { const tot = pay.roles.reduce((s, r) => s + r.salary, 0); UI.table({ el: "#roleTable", cols: [{ k: "name", label: "Role" }, { k: "avg", label: "Average pay", align: "r", render: r => money(r.avg) }, { k: "hc", label: "Avg headcount", align: "r", render: r => Math.round(r.hc / months).toLocaleString("en-IN") }, { k: "salary", label: "Total payroll", align: "r", render: r => money(r.salary) }, { k: "share", label: "Share of payroll", align: "r", render: r => pct(r.share) }, { k: "idx", label: "vs company average", align: "r", render: r => roleAvgAll ? `<span class="pos-neg ${r.idx >= 1 ? "pos" : "neg"}">${(r.idx).toFixed(2)}×</span>` : "—" }], rows: pay.roles.map(r => Object.assign({}, r, { share: tot ? r.salary / tot : 0, idx: roleAvgAll ? r.avg / roleAvgAll : 0 })), pageSize: 10, searchKeys: ["name"], exportName: "role-scorecard", dense: true }); }
  };

  /* ============================================================
     DATA — upload, column mapping, quality
     ============================================================ */
  function sampleCSV() {
    const d = E.demoData(); const q = v => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return [d.columns.join(","), ...d.rows.map(r => r.map(q).join(","))].join("\n");
  }
  P.data = P.quality = function (root) {
    const c = buildCtx(), M = c.M, raw = rawData(); const hasUser = !!(A.DATASET && Array.isArray(A.DATASET.rows));
    const colOpts = key => `<option value="-1">— not mapped —</option>` + raw.columns.map((n, i) => `<option value="${i}" ${M.mapping[key] === i ? "selected" : ""}>${esc(n)}</option>`).join("");
    const sample = i => { const set = []; for (const r of raw.rows) { const v = r[i]; if (v != null && String(v).trim() !== "" && !set.includes(String(v))) { set.push(String(v)); if (set.length >= 3) break; } } return set.map(x => esc(x.slice(0, 18))).join(" · "); };
    const q = M.quality; const dr = M.minYM != null ? E.monthLabel(M.minYM) + " → " + E.monthLabel(M.maxYM) : "no date column";
    const mapRows = E.FIELD_DEFS.map(def => `<tr><td><b>${esc(def.label)}</b><small>${def.key === "revenue" || def.key === "cost" ? "core" : "optional"}</small></td><td><select class="fs-sel" data-map="${def.key}">${colOpts(def.key)}</select></td><td>${M.mapping[def.key] >= 0 ? sample(M.mapping[def.key]) : "<span class=\"muted2\">—</span>"}</td><td>${M.mapping[def.key] >= 0 ? badge("ok", "mapped") : badge(def.key === "revenue" ? "bad" : "mut", def.key === "revenue" ? "needed" : "unmapped")}</td></tr>`).join("");
    const body = `<div class="fs-grid">
      ${card("Bring your own dataset", "CSV, XLSX, TSV or JSON · up to 25 MB · processed in your browser", `<div class="fs-drop" id="fsDrop" tabindex="0" role="button" aria-label="Upload dataset"><div class="fs-drop-ic">${icon("upload", "ic-24")}</div><div><b>Drag & drop a file here, or click to browse</b><p>The platform detects date, revenue, cost, profit, budget, units, region, department, category, product, role and salary columns automatically — then rebuilds every chart, forecast and recommendation. Works with any company or schema: finance ledgers, sales exports, ERP extracts, HR payroll files.</p></div></div>
        <div class="fs-data-actions"><button class="btn btn-g btn-sm" id="fsSample">${icon("download", "ic-14")} Download sample CSV</button><button class="btn btn-g btn-sm" id="fsLoadSample">Load the sample as an upload</button>${hasUser ? `<button class="btn ${fs.useDemo ? "btn-p" : "btn-g"} btn-sm" id="fsToggleDemo">${fs.useDemo ? "Switch to my dataset" : "Preview demo data"}</button>` : ""}</div><input type="file" id="fsDropInput" accept=".csv,.xlsx,.tsv,.json,.txt" hidden>`, { span: 12 })}
      ${card("Reporting settings", "Controls how amounts and fiscal periods are interpreted", `<div class="fs-settings"><label class="fs-f"><span>Currency</span><select data-fs="cur">${Object.entries(E.CURRENCIES).map(([k, v]) => `<option value="${k}" ${fs.cur === k ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select></label>
        <label class="fs-f"><span>Amounts in your file are in</span><select data-fs="scale">${[[1, "Full units"], [1000, "Thousands"], [1e6, "Millions"], [1e7, "Crores (10M)"], [1e5, "Lakhs (100K)"]].map(([v, l]) => `<option value="${v}" ${fs.scale === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="fs-f"><span>Fiscal year starts</span><select data-fs="fyStart">${[[0, "January — Google, Amazon, Meta"], [3, "April — Infosys, TCS, Wipro"], [6, "July — Microsoft"], [9, "October — Apple (late Sept)"]].map(([v, l]) => `<option value="${v}" ${fs.fyStart === v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>`, { span: 5 })}
      ${card("Data health", esc(M.name), `<dl class="fs-dl"><dt>Rows × columns</dt><dd>${q.rows.toLocaleString("en-IN")} × ${q.cols}</dd><dt>Completeness</dt><dd>${pct(q.completeness)} ${q.completeness < 0.9 ? badge("warn", "review") : badge("ok", "good")}</dd><dt>Duplicate rows</dt><dd>${q.duplicates.toLocaleString("en-IN")} ${q.duplicates ? badge("warn", "review") : badge("ok", "none")}</dd><dt>Date coverage</dt><dd>${esc(dr)}</dd><dt>Rows without a valid date</dt><dd>${M.has.date ? q.badDates.toLocaleString("en-IN") : "n/a"}</dd><dt>Fiscal years found</dt><dd>${M.fys.length ? M.fys.map(y => E.fyLabel(y, M.fyStart)).join(", ") : "—"}</dd><dt>Unlocked</dt><dd>${[["P&L", M.has.hasPL], ["Forecast", M.has.date], ["Budget", M.has.cost || M.has.hasPL], ["Market scoring", availDims(M).length > 0], ["Payroll", M.has.payroll]].map(([l, ok]) => badge(ok ? "ok" : "mut", l)).join(" ")}</dd></dl>`, { span: 7 })}
      ${card("Column mapping", "Auto-detected — override any column and everything recalculates instantly", `<div class="table-wrap"><table class="fs-map"><thead><tr><th>Platform field</th><th>Your column</th><th>Sample values</th><th>Status</th></tr></thead><tbody>${mapRows}</tbody></table></div>`, { span: 12, right: `<button class="btn btn-s btn-sm" id="fsRemap">${icon("refresh", "ic-14")} Re-run auto-detect</button>` })}
      ${card("Source records", "First 200 rows exactly as uploaded", tableHost("rawTable"), { span: 12 })}
    </div>`;
    shell(root, c, "Data", "Data Import & Setup", "Upload any dataset, confirm how columns are interpreted, and check data quality.", body);
    const drop = root.querySelector("#fsDrop"), inp = root.querySelector("#fsDropInput");
    if (drop) { drop.onclick = () => inp.click(); drop.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inp.click(); } }; drop.ondragover = e => { e.preventDefault(); drop.classList.add("is-over"); }; drop.ondragleave = () => drop.classList.remove("is-over"); drop.ondrop = e => { e.preventDefault(); drop.classList.remove("is-over"); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleFile(f); }; inp.onchange = () => { const f = inp.files && inp.files[0]; inp.value = ""; handleFile(f); }; }
    const sm = root.querySelector("#fsSample"); if (sm) sm.onclick = () => { downloadFile("sample-global-enterprise.csv", sampleCSV(), "text/csv;charset=utf-8"); toast("ok", "Sample downloaded", "Open it, edit it, or upload it back to see the full pipeline."); };
    const ls = root.querySelector("#fsLoadSample"); if (ls) ls.onclick = () => handleFile(new File([sampleCSV()], "sample-global-enterprise.csv", { type: "text/csv" }));
    const td = root.querySelector("#fsToggleDemo"); if (td) td.onclick = () => { fs.useDemo = !fs.useDemo; fs.mapSig = ""; fs.mapping = null; save(); modelCache = null; route(); };
    root.querySelectorAll("[data-map]").forEach(s => s.addEventListener("change", () => { fs.mapping = Object.assign({}, fs.mapping, { [s.dataset.map]: +s.value }); delete fs.mapping._revenueFallback; save(); toast("ok", "Mapping updated", DIM_LABEL[s.dataset.map] || s.dataset.map + " now uses " + (+s.value >= 0 ? raw.columns[+s.value] : "no column") + ". Recalculated."); route(); }));
    const rm = root.querySelector("#fsRemap"); if (rm) rm.onclick = () => { fs.mapping = E.autoMap(raw.columns, raw.rows); save(); toast("info", "Auto-detect re-run", "Column mapping reset to detected values."); route(); };
    UI.table({ el: "#rawTable", cols: raw.columns.map((n, i) => ({ k: "c" + i, label: n, sort: false, render: r => esc(String(r["c" + i] == null ? "" : r["c" + i]).slice(0, 40)) })).slice(0, 14), rows: raw.rows.slice(0, 200).map(r => { const o = {}; r.forEach((v, i) => o["c" + i] = v); return o; }), pageSize: 8, dense: true });
  };

  /* ============================================================
     ALERTS
     ============================================================ */
  P.alerts = function (root) {
    const c = buildCtx(), al = c.alerts();
    const body = `<div class="fs-grid">${card("Open exceptions", al.length + " generated from the active dataset and filters", alertList(al, 50), { span: 12 })}</div>`;
    shell(root, c, "Intelligence", "Alerts & Exceptions", "Budget overruns, margin erosion, declining segments, forecast risk and data-quality issues — computed live, not canned.", body);
  };
  P.reports = P.expenses;

  /* ============================================================
     shell integration
     ============================================================ */
  function syncNotifs() {
    try {
      const c = buildCtx(); const list = c.alerts();
      A.NOTIFS = list.slice(0, 8).map((a, i) => { const n = { id: i + 1, type: a.sev === "high" ? "bad" : a.sev === "med" ? "warn" : "info", icon: a.icon || "alerts", title: esc(a.title), body: esc(a.body), time: c.spec.label, link: a.link }; Object.defineProperty(n, "read", { enumerable: true, get() { return !!fs.read[a.id]; }, set(v) { fs.read[a.id] = !!v; save(); } }); return n; });
    } catch (e) { console.warn("Notification sync failed", e); A.NOTIFS = A.NOTIFS || []; }
  }
  function searchIndex() {
    const c = buildCtx(), M = c.M; const pages = [["Overview", "#/dashboard"], ["Performance", "#/products"], ["Profit & Loss", "#/expenses"], ["Budget Control", "#/budgets"], ["Forecast", "#/forecast"], ["Market Strategy", "#/insights"], ["Stability & Break-even", "#/stability"], ["People & Payroll", "#/people"], ["Alerts", "#/alerts"], ["Data Import & Setup", "#/data"]];
    const groups = [{ name: "Pages", icon: "reports", items: pages.map(([t, h]) => ({ title: t, meta: "Page", hash: h })) }];
    ["region", "category", "dept", "product"].forEach(k => { if (M.has[k]) groups.push({ name: DIM_PLURAL[k], icon: k === "region" ? "region" : k === "product" ? "product" : "users", items: M.dims[k].slice(0, 60).map(v => ({ title: v, meta: DIM_LABEL[k] + " · filter the platform", hash: "#/dashboard", focus: k + "::" + v })) }); });
    groups.push({ name: "Alerts", icon: "alerts", items: c.alerts().slice(0, 8).map(a => ({ title: a.title, meta: a.sev, hash: a.link })) });
    return groups;
  }
    function openViews() {
      fs.views = fs.views || {};
      const presets = { "Executive · last 12 months": { range: "12m" }, "Current fiscal year": { range: "ytd" }, "Last quarter": { range: "3m" }, "All time": { range: "all" } };
      const all = Object.assign({}, presets, fs.views); const keys = ["range", "from", "to", "fy", "q", "region", "dept", "category", "product"];
      const m = UI.modal({ title: "Saved filter views", sub: "One-click presets for date range, year, quarter and segment", size: "sm", body: `<div class="saved-views" style="flex-direction:column;align-items:stretch">${Object.keys(all).map(k => `<button class="view-chip" data-v="${esc(k)}" style="text-align:left;padding:10px 13px;border-radius:10px">${esc(k)}</button>`).join("")}<div class="row" style="margin-top:10px"><button class="btn btn-g btn-sm" id="vSave">${icon("plus", "ic-14")} Save current filters as a view</button></div></div>` });
      m.body.querySelectorAll("[data-v]").forEach(b => b.onclick = () => { const v = all[b.dataset.v]; keys.forEach(k => fs[k] = ""); fs.range = "all"; Object.assign(fs, v); save(); m.close(); toast("ok", b.dataset.v + " applied", "Filters updated across the platform."); route(); });
      m.body.querySelector("#vSave").onclick = () => { const name = prompt("Name this view:", "My view"); if (!name) return; fs.views[name] = Object.fromEntries(keys.map(k => [k, fs[k]])); save(); toast("ok", "View saved", "“" + name + "” added."); m.close(); };
    }
  window.FSUI = { openViews, syncNotifs, searchIndex, getCtx: buildCtx, fs: () => fs, focus(v) { applyFocus(v); } };
})();
