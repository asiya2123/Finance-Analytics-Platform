/* ============================================================
   REVENUE FORECASTING & BUSINESS INTELLIGENCE — pages B: planning · reporting · intelligence
   data · administration
   ============================================================ */
(function () {
  "use strict";
  const { icon, toast, modal, drawer, menu, delta, spark, ring, CH, table, skeletons, esc, S, persist, getCss } = window.UI;
  const A = window.AV;
  const P = window.AV.pages;
  const f = A.fmt;
  function card(t, s, acts, body, cls, foot, h) {
    return `<div class="card ${cls || ""}"><div class="card-h"><div style="min-width:0"><div class="t">${t}</div>${s ? `<div class="s">${s}</div>` : ""}</div>${acts ? `<div class="acts">${acts}</div>` : ""}</div><div class="card-b" style="${h ? "min-height:" + h + "px" : ""}">${body}</div>${foot ? `<div class="card-f">${foot}</div>` : ""}</div>`;
  }
  A.draftBudgets = [];
  const savedImports = (() => { try { return JSON.parse(localStorage.getItem("av.imports") || "null"); } catch { return null; } })();
  A.IMPORTS = Array.isArray(savedImports) && savedImports.length ? savedImports : [
    { file: "revenue-fy26-27-h1.csv", type: "Revenue", date: "Sep 28, 2026", by: "A. Reddy", records: 12450, valid: 12210, status: "Success" },
    { file: "erp-expenses-sep.xlsx", type: "Expenses", date: "Sep 25, 2026", by: "R. Mehta", records: 8240, valid: 8202, status: "Success" },
    { file: "product-master-v9.csv", type: "Products", date: "Sep 18, 2026", by: "A. Reddy", records: 1284, valid: 1284, status: "Success" },
  ];
  A.DATASET = (() => { try { return JSON.parse(localStorage.getItem("av.latestDataset") || "null"); } catch { return null; } })();
  A.DASHBOARD_ALL_ROWS = null;
  function dashboardHeaderList(headers) {
    const seen = Object.create(null);
    return headers.map((h, i) => {
      const base = String(h ?? "").trim().replace(/\s+/g, " ") || `Column ${i + 1}`;
      const key = base.toLowerCase(); seen[key] = (seen[key] || 0) + 1;
      return seen[key] > 1 ? `${base} (${seen[key]})` : base;
    });
  }
  function dashboardParseDelimited(text, delimiter) {
    const out = [], row = []; let cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
        else cell += ch;
      } else if (ch === '"' && cell === "") quoted = true;
      else if (ch === delimiter) { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); out.push(row.splice(0)); cell = ""; }
      else cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell.replace(/\r$/, "")); out.push(row); }
    if (!out.length || !out[0].some(v => String(v ?? "").trim())) throw new Error("The dataset is empty or has no header row.");
    const head = dashboardHeaderList(out.shift());
    const rows = out.filter(r => r.some(v => String(v ?? "").trim() !== ""));
    rows.forEach(r => { while (r.length < head.length) r.push(""); if (r.length > head.length) r.length = head.length; });
    return { head, rows };
  }
  function dashboardDecodeXml(s) { return String(s).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"); }
  function dashboardColumnIndex(ref) { const letters = (String(ref).match(/[A-Z]+/i) || ["A"])[0].toUpperCase(); let n = 0; for (const c of letters) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; }
  async function dashboardParseXlsx(buffer) {
    if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot unpack XLSX files. Save the workbook as CSV and upload it again.");
    const bytes = new Uint8Array(buffer), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), files = {};
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("Invalid XLSX file. Try saving it again from Excel.");
    const count = view.getUint16(eocd + 10, true), cdOffset = view.getUint32(eocd + 16, true), decoder = new TextDecoder("utf-8");
    let pos = cdOffset;
    for (let i = 0; i < count; i++) {
      if (view.getUint32(pos, true) !== 0x02014b50) break;
      const method = view.getUint16(pos + 10, true), csize = view.getUint32(pos + 20, true), nlen = view.getUint16(pos + 28, true), xlen = view.getUint16(pos + 30, true), clen = view.getUint16(pos + 32, true), local = view.getUint32(pos + 42, true);
      const name = decoder.decode(bytes.slice(pos + 46, pos + 46 + nlen));
      const ln = view.getUint16(local + 26, true), lx = view.getUint16(local + 28, true), start = local + 30 + ln + lx, compressed = bytes.slice(start, start + csize);
      files[name] = async () => {
        if (method === 0) return decoder.decode(compressed);
        if (method !== 8) throw new Error("Unsupported XLSX compression method. Save as CSV or XLSX using a standard Excel export.");
        const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return decoder.decode(new Uint8Array(await new Response(stream).arrayBuffer()));
      };
      pos += 46 + nlen + xlen + clen;
    }
    const sharedXml = files["xl/sharedStrings.xml"] ? await files["xl/sharedStrings.xml"]() : "";
    const shared = [...sharedXml.matchAll(/<si[\s\S]*?<\/si>/g)].map(m => [...m[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => dashboardDecodeXml(x[1])).join(""));
    const workbook = files["xl/workbook.xml"] ? await files["xl/workbook.xml"]() : "";
    const rels = files["xl/_rels/workbook.xml.rels"] ? await files["xl/_rels/workbook.xml.rels"]() : "";
    const rid = workbook.match(/<sheet\b[^>]*r:id="([^"]+)"[^>]*>/)?.[1] || "";
    let target = rid ? rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"[^>]*/>`))?.[1] : "";
    target = target ? (target.startsWith("/") ? target.slice(1) : target.startsWith("xl/") ? target : `xl/${target.replace(/^\//, "")}`) : "";
    const sheetPath = (target && files[target]) ? target : (files["xl/worksheets/sheet1.xml"] ? "xl/worksheets/sheet1.xml" : Object.keys(files).find(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)));
    if (!sheetPath) throw new Error("The Excel workbook has no readable worksheet.");
    const xml = await files[sheetPath](), out = [];
    for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const arr = [];
      for (const cm of rm[1].matchAll(/<c\s+([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = cm[1], body = cm[2], ref = attrs.match(/\br="([^"]+)"/i)?.[1] || `A${arr.length + 1}`, type = attrs.match(/\bt="([^"]+)"/i)?.[1] || "";
        let val = body.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "";
        if (type === "s") val = shared[Number(val)] ?? val;
        else if (type === "inlineStr") val = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => dashboardDecodeXml(x[1])).join("");
        else if (type === "b") val = val === "1" ? "TRUE" : "FALSE";
        else val = dashboardDecodeXml(val);
        arr[dashboardColumnIndex(ref)] = val;
      }
      out.push(arr);
    }
    if (!out.length) throw new Error("The Excel workbook is empty.");
    const head = dashboardHeaderList(out[0] || []), rows = out.slice(1).filter(r => r && r.some(v => String(v ?? "").trim() !== ""));
    rows.forEach(r => { while (r.length < head.length) r.push(""); if (r.length > head.length) r.length = head.length; });
    return { head, rows };
  }
  function dashboardNumber(v) {
    if (v == null || String(v).trim() === "") return NaN;
    const raw = String(v).trim().replace(/[₹$€£,%\s]/g, "").replace(/,/g, "");
    if (/^\(.*\)$/.test(raw)) return -Number(raw.slice(1, -1));
    const n = Number(raw); return Number.isFinite(n) ? n : NaN;
  }
  function dashboardProfile(head, rows) {
    const numericColumns = [], dateColumns = [], textColumns = []; let missing = 0;
    head.forEach((name, i) => {
      const values = rows.map(r => r[i]).filter(v => v != null && String(v).trim() !== "");
      const numeric = values.filter(v => Number.isFinite(dashboardNumber(v))).length;
      const date = values.filter(v => !Number.isNaN(Date.parse(String(v))) && /[-/]/.test(String(v))).length;
      if (values.length && numeric / values.length >= .78) numericColumns.push(name);
      else if (values.length && date / values.length >= .78) dateColumns.push(name);
      else textColumns.push(name);
      missing += rows.reduce((n, r) => n + (r[i] == null || String(r[i]).trim() === "" ? 1 : 0), 0);
    });
    return { numericColumns, dateColumns, textColumns, missing };
  }
  A.importDashboardFile = async function (file) {
    if (!file) throw new Error("Choose a file to upload.");
    if (file.size > 25 * 1024 * 1024) throw new Error("File exceeds 25 MB. Please upload a smaller dataset.");
    const ext = (file.name.split(".").pop() || "").toLowerCase(); let parsed;
    if (ext === "xlsx") parsed = await dashboardParseXlsx(await file.arrayBuffer());
    else if (ext === "xls") throw new Error("Legacy .xls is not supported by the dashboard uploader. Save it as .xlsx or CSV and upload again.");
    else if (ext === "json") {
      let data; try { data = JSON.parse(await file.text()); } catch { throw new Error("Invalid JSON file."); }
      if (!Array.isArray(data)) data = Array.isArray(data.data) ? data.data : [data];
      if (!data.length || typeof data[0] !== "object") throw new Error("JSON must contain an array of record objects.");
      const rawHead = [...new Set(data.flatMap(r => r && typeof r === "object" ? Object.keys(r) : []))];
      const head = dashboardHeaderList(rawHead);
      parsed = { head, rows: data.map(r => rawHead.map(h => r?.[h] ?? "")) };
    } else {
      const text = await file.text();
      const first = text.split(/\r?\n/).find(x => x.trim()) || "";
      const counts = [",", "\t", ";", "|"].map(d => { let n = 0, q = false; for (const ch of first) { if (ch === '"') q = !q; else if (!q && ch === d) n++; } return [d, n]; }).sort((a,b) => b[1]-a[1]);
      const delimiter = ext === "tsv" ? "\t" : counts[0]?.[0] || ",";
      parsed = dashboardParseDelimited(text, delimiter);
    }
    if (!parsed.head.length || !parsed.rows.length) throw new Error("The uploaded dataset contains no data rows.");
    // Excel stores many date cells as serial day numbers. Normalize them when the column
    // header identifies a date/time field so date-range filters and monthly trends still work.
    const dateColumns = parsed.head.map((h, i) => ({ h: String(h).replace(/[_-]+/g, " "), i }))
      .filter(x => /\b(date|order date|transaction date|invoice date|created at|updated at|timestamp|ship date|delivery date|month|period)\b/i.test(x.h))
      .map(x => x.i);
    dateColumns.forEach(i => parsed.rows.forEach(row => {
      const raw = String(row[i] ?? "").trim(), serial = Number(raw);
      if (/^\d+(?:\.\d+)?$/.test(raw) && serial >= 20000 && serial <= 90000) {
        row[i] = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000).toISOString().slice(0, 10);
      }
    }));
    const profile = dashboardProfile(parsed.head, parsed.rows);
    const payload = {
      name: file.name, type: ext.toUpperCase() === "TSV" ? "TSV" : ext.toUpperCase(), importedAt: new Date().toISOString(),
      total: parsed.rows.length, valid: parsed.rows.length, errors: 0, warnings: profile.missing ? 1 : 0, missing: profile.missing,
      columns: parsed.head, rows: parsed.rows.slice(0, 1200).map(r => r.slice()), numericColumns: profile.numericColumns,
      dateColumns: profile.dateColumns, textColumns: profile.textColumns, primaryKey: "", truncated: parsed.rows.length > 1200,
    };
    A.DATASET = payload;
    A.DASHBOARD_ALL_ROWS = parsed.rows.map(r => r.slice());
    try { localStorage.setItem("av.latestDataset", JSON.stringify(payload)); } catch (e) { console.warn("Dataset too large for localStorage; keeping all uploaded rows in memory for this session.", e); }
    A.IMPORTS = Array.isArray(A.IMPORTS) ? A.IMPORTS : [];
    A.IMPORTS.unshift({ file: file.name, type: payload.type, date: "Just now", by: window.UI?.S?.user?.name || "Current user", records: payload.total, valid: payload.valid, status: "Success" });
    try { localStorage.setItem("av.imports", JSON.stringify(A.IMPORTS.slice(0, 50))); } catch {}
    if (typeof A.logAudit === "function" && window.UI?.S?.user) A.logAudit({ time: "Just now", user: window.UI.S.user.name, role: window.UI.S.user.role, action: "Imported dataset from dashboard", entity: "Data · " + file.name, next: payload.total.toLocaleString("en-IN") + " records" });
    return payload;
  };
  if (A.DATASET && Array.isArray(A.DATASET.rows)) A.DASHBOARD_ALL_ROWS = A.DATASET.rows;
  function persistImportState() {
    try { localStorage.setItem("av.imports", JSON.stringify(A.IMPORTS.slice(0, 50))); } catch (e) { console.warn("Could not persist import history", e); }
  }
  function persistLatestDataset(p, v) {
    // Keep a bounded browser copy: enough for dashboard previews/analytics without exhausting localStorage.
    const maxRows = 1200;
    const sample = p.rows.slice(0, maxRows).map(r => r.slice(0, p.head.length));
    const payload = {
      name: p.name, type: p.type, importedAt: new Date().toISOString(),
      total: v.total, valid: v.valid, errors: v.errors, warnings: v.warnings, missing: v.missing,
      columns: p.head, rows: sample, numericColumns: v.numericColumns, dateColumns: v.dateColumns,
      textColumns: v.textColumns, primaryKey: v.primaryKey, truncated: p.rows.length > maxRows
    };
    A.DATASET = payload;
    A.DASHBOARD_ALL_ROWS = p.rows.map(r => r.slice());
    try { localStorage.setItem("av.latestDataset", JSON.stringify(payload)); } catch (e) { console.warn("Dataset too large for browser storage; dashboard keeps it in memory for this session.", e); }
  }
  const locked = () => !window.APP || !window.APP.can("write");

  /* ============================================================
     BUDGET MANAGEMENT
     ============================================================ */
  function bcardHTML(b) {
    const w = Math.min(b.util, 130);
    const cls = b.status.key === "over" ? "bad" : b.status.key === "watch" ? "warn" : b.util > 80 ? "info" : "ok";
    return `<div class="card bcard" data-dept="${b.dept}">
      <div class="bc-top"><b class="bc-name">${b.dept}</b><span class="badge b-${b.status.cls}" style="margin-left:auto">${icon(b.status.key === "over" ? "x" : b.status.key === "watch" ? "dot" : "check", "ic-14")} ${b.status.label}</span>
      <button class="btn-icon bc-menu" aria-label="Budget actions">${icon("more", "ic-16")}</button></div>
      <div class="bc-vals">
        <div class="bc-v"><span>Budget</span><b>${f.cr(b.budget * 100)}</b></div>
        <div class="bc-v"><span>Actual</span><b>${f.cr(b.actual * 100)}</b></div>
        <div class="bc-v"><span>Variance</span><b class="${b.variance > 0 ? "neg" : "pos"}">${f.crSign(b.variance * 100)}</b></div>
      </div>
      <div><div class="row row-between small" style="margin-bottom:5px"><span class="muted">Utilization</span><b class="num">${f.pct(b.util)}</b></div>
      <div class="prog ${cls}"><i style="width:${Math.min(w, 100)}%"></i></div></div>
      <div class="bc-foot">${icon("trendUp", "ic-14")}<span>${f.pctSign(A.PCT(b.actual, b.prev))} spend vs prior · <a href="#/variance">variance</a></span></div>
    </div>`;
  }
  P.budgets = function (root) {
    const t = A.BUD_TOTAL;
    root.innerHTML = head() +
      `<div class="kpis">
        ${kpi({ label: "Total Budget", ico: "budget", value: f.cr(t.budget * 100), sub: "Approved plan · T12M envelope", foot: `<span class="num">7 departments</span>` })}
        ${kpi({ label: "Actual Spending", ico: "expense", value: f.cr(t.actual * 100), deltaHtml: delta(A.PCT(t.actual, 1684), { goodWhenDown: true }), foot: `<span class="num">Prior period ${f.cr(1684)}</span>` })}
        ${kpi({ label: "Remaining Budget", ico: "piggy", value: f.cr(t.remaining * 100), sub: "Available to spend", sparkColor: getCss("--ok"), foot: `<span class="num">~${f.cr(t.remaining * 100 / 3)} / month to stay on plan</span>` })}
        ${kpi({ label: "Budget Utilization", ico: "percent", value: f.pct(t.util), sub: f.cr(t.actual * 100) + " of " + f.cr(t.budget * 100), foot: `<span class="num">On pace · no action needed company-wide</span>` })}
        ${kpi({ label: "Over-Budget Departments", ico: "alerts", value: String(t.over), badge: t.over ? `<span class="badge b-bad">${icon("x", "ic-14")} Action</span>` : `<span class="badge b-ok">${icon("check", "ic-14")} Clear</span>`, sub: "Marketing at 115.0%", foot: `<a href="#/variance" style="font-weight:600">Review variance →</a>` })}
      </div>
      <div class="row row-between" style="margin-bottom:14px;flex-wrap:wrap;gap:10px">
        <div class="row gap-8">
          <button class="btn btn-p" id="bAdd" ${locked() ? "disabled title='Your role (Viewer) cannot modify budgets'" : ""}>${icon("plus", "ic-14")} Add Budget</button>
          <button class="btn btn-s" id="bImp" ${locked() ? "disabled" : ""}>${icon("upload", "ic-14")} Import</button>
          <button class="btn btn-s" id="bExp">${icon("download", "ic-14")} Export</button>
        </div>
        <span class="small muted">Budget envelope: approved 12-month cost plan · actuals: trailing 12 months</span>
      </div>
      <div id="drafts"></div>
      <div class="grid" style="margin-bottom:16px">${A.BUDGETS.map(b => `<div class="c-4">${bcardHTML(b)}</div>`).join("")}
        <div class="c-4"><div class="card bcard" style="border-style:dashed;align-items:center;justify-content:center;min-height:150px">
          <button class="row gap-8" style="color:var(--text-3)" id="bAdd2" ${locked() ? "disabled" : ""}>${icon("plus", "ic-24")}<span style="font-weight:600">Add budget line</span></button>
          <span class="small muted">Supports any department · FY 2025-26 → 2027-28</span></div></div>
      </div>
      <div class="grid">
        <div class="c-7">${card("Monthly Spend vs Plan Run-Rate", "Actual monthly spend (bars) vs straight-line plan (line) · last 12 months", "", `<div class="chart-box" id="chBurn"></div>`)}</div>
        <div class="c-5">${card("Utilization by Department", "Actual ÷ budget", "", `<div class="chart-box" id="chUtil"></div>`)}</div>
        <div class="c-12"><div class="table-wrap" id="budTable"></div></div>
      </div>`;
    wire(root);
    function wire(root) {
      root.querySelectorAll(".bc-menu").forEach(btn => btn.onclick = e => {
        e.stopPropagation();
        const dept = btn.closest(".bcard").dataset.dept;
        menu(btn.parentElement, [
          { id: "edit", icon: "edit", label: "Edit budget", action: () => budgetWizard(dept) },
          { id: "dup", icon: "copy", label: "Duplicate to FY 2027-28", action: () => { A.draftBudgets.push({ dept, budget: deptBudget(dept), status: "Draft" }); toast("ok", "Duplicated", dept + " budget copied to FY 2027-28 as a draft."); renderDrafts(); } },
          { id: "exp", icon: "download", label: "Export (CSV)", action: () => AV.downloadBudgetCSV() },
          "hr",
          { id: "del", icon: "trash", label: "Delete budget", danger: true, action: () => UI.confirm({ title: "Delete budget?", danger: true, okLabel: "Delete", body: `This removes the <b>${dept}</b> budget line from the current envelope. Department actuals are kept for reporting. This action is logged in the audit trail.`, onOk: () => toast("bad", "Budget deleted", dept + " removed — audit log updated.") }) },
        ], "right");
      });
      const add = root.querySelector("#bAdd"); if (add) add.onclick = () => budgetWizard();
      const add2 = root.querySelector("#bAdd2"); if (add2) add2.onclick = () => budgetWizard();
      root.querySelector("#bExp").onclick = () => AV.downloadBudgetCSV();
      root.querySelector("#bImp").onclick = () => {
        const m = modal({ title: "Import budget plan", size: "sm", body: `<div class="note">${icon("info", "ic-14")}<span>Upload an approved plan (CSV/XLSX) with columns <b>department, category, month, amount</b>. The import runs the same validation as data imports.</span></div>
          <div class="dz" id="bimpDz" style="margin-top:12px"><span class="dz-ico">${icon("upload")}</span><b>Drag & drop CSV or Excel</b><p>or <u>browse files</u> · max 5 MB</p></div>` });
        const dz = m.el.querySelector("#bimpDz");
        const go = () => { m.el.querySelector(".dz").innerHTML = `<span class="dz-ico">${icon("refresh")}</span><b>Validating plan…</b>`; setTimeout(() => { m.close(); toast("ok", "Budget plan imported", "7 departments · 84 lines · 0 errors."); A.logAudit({ time: "Just now", user: S.user.name, role: S.user.role, action: "Imported budget plan", entity: "Budget · FY 2027-28", next: "84 lines" }); }, 900); };
        dz.onclick = go; dz.ondragover = e => { e.preventDefault(); dz.classList.add("over"); }; dz.ondragleave = () => dz.classList.remove("over"); dz.ondrop = e => { e.preventDefault(); go(); };
      };
      CH.combo(root.querySelector("#chBurn"), {
        labels: A.MONTHS.slice(18),
        series: [
          { name: "Actual spend", values: A.EXP.slice(18), color: getCss("--chart-2") },
          { name: "Plan run-rate", values: A.MONTHS.slice(18).map(() => Math.round(2380 / 12)), type: "line", color: getCss("--chart-4") },
        ]});
      CH.bars(root.querySelector("#chUtil"), { hbar: true, labels: A.BUDGETS.map(b => b.dept), series: [{ name: "Utilization %", values: A.BUDGETS.map(b => +b.util.toFixed(1)), colors: A.BUDGETS.map(b => b.util > 100 ? getCss("--bad") : b.util >= 95 ? getCss("--warn") : getCss("--ok")) }], text: v => v.toFixed(1) + "%", legend: false });
      table({
        el: "#budTable",
        cols: [
          { k: "dept", label: "Department" },
          { k: "budget", label: "Budget", align: "r", render: r => f.cr(r.budget * 100) },
          { k: "actual", label: "Actual", align: "r", render: r => f.cr(r.actual * 100) },
          { k: "variance", label: "Variance", align: "r", render: r => `<span class="pos-neg ${r.variance > 0 ? "neg" : "pos"}">${f.crSign(r.variance * 100)}</span>` },
          { k: "util", label: "Utilization", align: "r", render: r => `<span class="num" style="font-weight:640">${f.pct(r.util)}</span>` },
          { k: "status", label: "Status", render: r => `<span class="badge b-${r.status.cls}">${icon(r.status.key === "over" ? "x" : "check", "ic-14")} ${r.status.label}</span>` },
        ],
        rows: A.BUDGETS.slice(), searchKeys: ["dept"], exportName: "revenue-bi-budget-summary", sortKey: "util",
        toolbar: `<span class="badge b-mut">Envelope ${f.cr(t.budget * 100)} · Actual ${f.cr(t.actual * 100)}</span>`,
      });
    }
    function renderDrafts() {
      const el = root.querySelector("#drafts");
      el.innerHTML = A.draftBudgets.length ? `<div class="card" style="margin-bottom:16px"><div class="card-h"><div class="t">Pending approval</div><div class="s">Budgets submitted from the creation flow — awaiting CFO approval</div></div><div class="card-b">${A.draftBudgets.map(d => `<div class="row row-between" style="padding:9px 4px;border-bottom:1px solid var(--border)"><span class="row gap-8">${icon("budget", "ic-16")} <b>${d.dept}</b><span class="muted small">FY 2027-28</span></span><span class="row gap-8"><span class="badge b-warn"><span class="dot"></span> ${d.status}</span><button class="btn btn-g btn-sm" data-approv="${d.dept}">Approve</button></span></div>`).join("")}</div></div>` : "";
      el.querySelectorAll("[data-approv]").forEach(b => b.onclick = () => {
        const d = A.draftBudgets.find(x => x.dept === b.dataset.approv); d.status = "Approved";
        toast("ok", "Budget approved", d.dept + " · FY 2027-28 added to the plan.");
        A.logAudit({ time: "Just now", user: S.user.name, role: S.user.role, action: "Approved budget", entity: "Budget · " + d.dept + " FY 2027-28", next: f.cr(d.budget * 100) });
        renderDrafts();
      });
    }
    renderDrafts(); // show pending-approval budgets submitted from the wizard
  };
  function head(t, s, acts) { return `<div class="page-head"><div style="min-width:0"><h1>${t || "Budget Management"}</h1><div class="sub">${s || "Own the cost plan — approve budgets, track spend against plan, and keep every department accountable."}</div></div><div class="actions">${acts || ""}</div></div>`; }
  function kpi(o) {
    return `<div class="kpi"><div class="kpi-top"><span class="kpi-label">${o.label}</span>${o.badge || ""}<span class="kpi-ico tint">${icon(o.ico)}</span></div>
      <div class="kpi-value">${o.value}</div><div class="kpi-mid">${o.deltaHtml || ""}${o.sub ? `<div class="kpi-sub" style="margin-top:5px">${o.sub}</div>` : ""}</div>${o.foot ? `<div class="kpi-foot">${o.foot}</div>` : ""}</div>`;
  }
  function deptBudget(d) { const b = A.BUDGETS.find(x => x.dept === d); return b ? b.budget : 1.0; }

  /* ---------- budget creation wizard (8 steps) ---------- */
  function budgetWizard(editDept) {
    const st = { fy: "FY 2027-28", dept: editDept || "", category: "Headcount", annual: "", monthly: Array(12).fill(0), touched: false };
    const steps = ["Financial year", "Department", "Category", "Annual budget", "Monthly allocation", "Review", "Submit", "Confirmation"];
    let step = editDept ? 1 : 0;
    const m = modal({
      title: editDept ? "Edit budget · " + editDept : "Create budget",
      sub: "7-step workflow with validation · changes are logged",
      size: "md",
      body: `<div class="w-steps" id="wzSteps"></div><div id="wzBody"></div>`,
      foot: `<button class="btn btn-g" id="wzBack">Back</button><span class="grow"></span><span class="small muted" id="wzHint"></span><button class="btn btn-p" id="wzNext">Continue</button>`,
      closable: false,
    });
    let dirty = false;
    function markDirty() { dirty = true; }
    function guardClose() {
      if (step === 7 || !dirty) { m.close(); return; }
      UI.confirm({ title: "Discard unsaved changes?", danger: true, okLabel: "Discard", body: "Your budget draft has unsaved changes. If you close now, the draft will be lost.", onOk: () => m.close() });
    }
    const stepEl = () => m.el.querySelector("#wzSteps");
    const bodyEl = () => m.el.querySelector("#wzBody");
    function renderSteps() {
      stepEl().innerHTML = steps.map((s, i) => `<div class="w-step ${i === step ? "active" : i < step ? "done" : ""}"><span class="n">${i < step ? icon("check", "ic-14") : i + 1}</span>${s}${i < steps.length - 1 ? `<span class="line"></span>` : ""}</div>`).join("");
    }
    function field(id, label, inner) { return `<div class="field" style="margin-bottom:14px"><span class="f-label" for="${id}">${label}</span>${inner}<div class="f-err hidden" id="${id}err"></div></div>`; }
    function showErr(id, msg) { const e = bodyEl().querySelector("#" + id + "err"); if (e) { e.textContent = msg; e.classList.remove("hidden"); } bodyEl().querySelector("#" + id)?.classList.add("bad"); }
    function clearErr(id) { const e = bodyEl().querySelector("#" + id + "err"); if (e) e.classList.add("hidden"); const i = bodyEl().querySelector("#" + id); if (i) i.classList.remove("bad"); }
    function render() {
      renderSteps();
      const b = bodyEl();
      m.el.querySelector("#wzBack").style.visibility = step === 0 || step === 7 ? "hidden" : "visible";
      const next = m.el.querySelector("#wzNext");
      next.textContent = step === 5 ? "Submit for approval" : step === 6 ? "Submit" : step === 7 ? "Done" : "Continue";
      if (step === 0) b.innerHTML = field("wfy", "Financial year", `<select class="select" id="wfy">${["FY 2026-27", "FY 2027-28", "FY 2028-29"].map(x => `<option ${x === st.fy ? "selected" : ""}>${x}</option>`).join("")}</select>`) +
        `<div class="note">${icon("calendar", "ic-14")}<span>Financial years run April – March. Budgets submitted for the current FY (2026-27) require CFO approval if they change the approved envelope.</span></div>`;
      if (step === 1) b.innerHTML = field("wdept", "Department", `<select class="select" id="wdept"><option value="">Select department…</option>${A.BUDGETS.map(x => `<option ${x.dept === st.dept ? "selected" : ""}>${x.dept}</option>`).join("")}</select>`);
      if (step === 2) b.innerHTML = field("wcat", "Budget category", `<select class="select" id="wcat">${["Headcount", "Technology & Tools", "Marketing & Campaigns", "Infrastructure", "Travel & Events", "Other"].map(x => `<option ${x === st.category ? "selected" : ""}>${x}</option>`).join("")}</select>`) +
        (st.dept ? `<div class="kv" style="margin-top:14px"><dt>${st.dept} current plan</dt><dd>${f.cr(deptBudget(st.dept) * 100)} · actuals ${f.cr((A.BUDGETS.find(x => x.dept === st.dept)?.actual || 0) * 100)}</dd><dt>Recommended annual</dt><dd>${f.cr(Math.round(deptBudget(st.dept) * 1.08 * 100) / 100 * 100)} (prior plan + 8%)</dd></div>` : "");
      if (step === 3) {
        const refDept = st.dept || editDept || "HR";
        const refB = A.BUDGETS.find(x => x.dept === refDept);
        const priorActual = refB ? refB.actual : deptBudget(refDept);
        b.innerHTML = field("wamt", "Annual budget (₹ in lakh)", `<input class="input num" id="wamt" type="number" min="1" step="5" placeholder="e.g. 500 (= ₹5.0 Cr)" value="${st.annual || (editDept ? Math.round(deptBudget(editDept) * 100) : "")}">`) +
          `<div class="note">${icon("insights", "ic-14")}<span>Benchmarks — ${refDept} prior year actual: <b>${f.cr(priorActual * 100)}</b> · recommended: prior plan + 8% = <b>${f.cr(Math.round(deptBudget(refDept) * 108) / 100 * 100)}</b>.</span></div>`;
      }
      if (step === 4) {
        b.innerHTML = field("walloc", "Monthly allocation (₹ in lakh)", `<div class="alloc-grid">${["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"].map((mo, i) => `<div class="field"><label class="f-label" style="font-size:11px">${mo}</label><input class="input num" id="wm${i}" type="number" min="0" step="1" value="${st.monthly[i] || ""}"></div>`).join("")}</div>`) +
          `<div class="row row-between" style="margin-top:10px"><span class="row gap-8"><span class="badge ${allocSum() && Math.abs(allocSum() - (parseFloat(st.annual) || 0)) <= (parseFloat(st.annual) || 0) * 0.02 ? "b-ok" : "b-warn"}" id="allocBadge">Allocated: —</span><span class="muted small" id="allocDiff"></span></span><button class="btn btn-g btn-sm" id="wEven">${icon("refresh", "ic-14")} Distribute evenly</button></div>`;
        bodyEl().querySelectorAll("#wm0,#wm1,#wm2,#wm3,#wm4,#wm5,#wm6,#wm7,#wm8,#wm9,#wm10,#wm11").forEach(inp => inp.oninput = () => { markDirty(); syncAlloc(); });
        bodyEl().querySelector("#wEven").onclick = () => {
          const ann = parseFloat(st.annual) || 0;
          st.monthly = Array(12).fill(+(ann / 12).toFixed(1));
          markDirty(); syncAlloc();
          for (let i = 0; i < 12; i++) bodyEl().querySelector("#wm" + i).value = st.monthly[i];
        };
        syncAlloc();
      }
      if (step === 5) b.innerHTML = `<b class="small">Review</b><dl class="kv" style="margin-top:10px">
          <dt>Financial year</dt><dd>${st.fy}</dd><dt>Department</dt><dd>${st.dept}</dd><dt>Category</dt><dd>${st.category}</dd>
          <dt>Annual budget</dt><dd>${f.crExact(parseFloat(st.annual))}</dd>
          <dt>Monthly allocation</dt><dd>${f.crExact(allocSum())} (${Math.abs(allocSum() - parseFloat(st.annual)) < 0.05 ? "matches annual" : "differs from annual by " + f.crSign(allocSum() - parseFloat(st.annual))})</dd>
          <dt>vs current plan</dt><dd>${((parseFloat(st.annual) / (deptBudget(st.dept) * 100) * 100)).toFixed(1)}% of ${f.crExact(deptBudget(st.dept) * 100)}</dd></dl>
        <div class="note" style="margin-top:12px">${icon("shield", "ic-14")}<span>On submit this budget goes to the <b>approval queue</b>. The change is written to the audit log with the previous and new values.</span></div>`;
      if (step === 6) b.innerHTML = `<div class="empty" style="padding:30px"><div class="e-ico" style="background:var(--info-soft);color:var(--info)">${icon("clock")}</div><b>Ready to submit</b><p>${st.fy} · ${st.dept} · ${st.category} · ${f.crExact(parseFloat(st.annual))}</p><p class="muted2 small">Submitting marks this budget as “Pending approval” and notifies the CFO office.</p></div>`;
      if (step === 7) b.innerHTML = `<div class="empty" style="padding:30px"><div class="e-ico" style="background:var(--ok-soft);color:var(--ok-ink)">${icon("check", "ic-24")}</div><b>Budget submitted</b><p>${st.dept} · ${st.fy} · ${f.crExact(parseFloat(st.annual))} — now in the approval queue as reference <b>BUD-${2026 + A.draftBudgets.length + 1}0${String(31 + A.draftBudgets.length)}</b>.</p></div>`;
      // wire values back
      const wfy = bodyEl().querySelector("#wfy"); if (wfy) wfy.onchange = () => { st.fy = wfy.value; markDirty(); };
      const wd = bodyEl().querySelector("#wdept"); if (wd) wd.onchange = () => { st.dept = wd.value; markDirty(); };
      const wc = bodyEl().querySelector("#wcat"); if (wc) wc.onchange = () => { st.category = wc.value; markDirty(); };
      const wa = bodyEl().querySelector("#wamt"); if (wa) wa.oninput = () => { st.annual = wa.value; clearErr("wamt"); markDirty(); };
      syncAlloc();
    }
    function allocSum() { let s = 0; for (let i = 0; i < 12; i++) s += parseFloat(bodyEl().querySelector("#wm" + i)?.value) || 0; return +s.toFixed(1); }
    function syncAlloc() {
      const badge = bodyEl().querySelector("#allocBadge"), diff = bodyEl().querySelector("#allocDiff");
      if (!badge) return;
      const s = allocSum(), ann = parseFloat(st.annual) || 0;
      badge.textContent = "Allocated: " + f.crExact(s / 100 * 100) + " of " + f.crExact(ann / 100 * 100);
      if (ann && Math.abs(s - ann) > ann * 0.02) { badge.className = "badge b-bad"; diff.textContent = "Allocation differs from annual by " + f.crSign((s - ann) / 100 * 100) + " — must be within 2%."; diff.style.color = "var(--bad-ink)"; }
      else { badge.className = "badge b-ok"; diff.textContent = ann ? "Within tolerance" : "Enter the annual budget in the previous step first."; diff.style.color = "var(--text-3)"; }
    }
    function validate() {
      if (step === 1 && !st.dept) { showErr("wdept", "Select a department."); return false; }
      if (step === 3) {
        const v = parseFloat(st.annual);
        if (!v || v <= 0) { showErr("wamt", "Enter a budget greater than zero."); return false; }
        if (v > 5000) { showErr("wamt", "Amounts above ₹50 Cr require group approval — check with the CFO office."); return false; }
      }
      if (step === 4) {
        const s = allocSum(), ann = parseFloat(st.annual) || 0;
        if (!ann) { showErr("walloc", "Set the annual budget first."); return false; }
        if (Math.abs(s - ann) > ann * 0.02) { showErr("walloc", "Monthly allocation must total within 2% of the annual budget. Use “Distribute evenly” or adjust months."); return false; }
      }
      return true;
    }
    m.el.querySelector("#wzNext").onclick = () => {
      if (step === 7) { m.close(); if (window.APP && window.APP.route) window.APP.route(true); return; }
      if (step === 5) {
        m.el.querySelector("#wzNext").classList.add("loading");
        setTimeout(() => {
          m.el.querySelector("#wzNext").classList.remove("loading");
          A.draftBudgets.push({ dept: st.dept, budget: parseFloat(st.annual) / 100, status: "Pending approval" });
          A.logAudit({ time: "Just now", user: S.user.name, role: S.user.role, action: "Submitted budget", entity: "Budget · " + st.dept + " " + st.fy, prev: editDept ? f.cr(deptBudget(editDept) * 100) : "—", next: f.crExact(parseFloat(st.annual)) });
          toast("ok", "Budget submitted", st.dept + " · " + f.crExact(parseFloat(st.annual)) + " → approval queue");
          step = 7; render();
          if (window.APP && window.APP.route) window.APP.route(true); // refresh drafts list behind the modal
        }, 900);
        return;
      }
      if (!validate()) return;
      if (step === 3) st.monthly = Array(12).fill(+(parseFloat(st.annual) / 12).toFixed(1));
      step++; render();
    };
    m.el.querySelector("#wzBack").onclick = () => { if (step > 0 && step < 7) { step--; render(); } };
    // intercept close (X / esc) with dirty guard
    const origClose = m.close.bind(m);
    m.close = function () { if (step < 7 && dirty) { UI.confirm({ title: "Discard unsaved changes?", danger: true, okLabel: "Discard", body: "Your budget draft has unsaved changes.", onOk: () => origClose() }); return; } origClose(); };
    render();
  }
  AV.downloadBudgetCSV = function () {
    const rows = [["Department", "Budget (INR Cr)", "Actual (INR Cr)", "Variance (INR Cr)", "Utilization (%)", "Status"], ...A.BUDGETS.map(b => [b.dept, b.budget, b.actual, b.variance, b.util.toFixed(1), b.status.label])];
    window.UI.downloadFile("revenue-bi-budgets.csv", rows.map(r => r.join(",")).join("\n"), "text/csv");
    toast("ok", "Export ready", "revenue-bi-budgets.csv downloaded.");
  };

  /* ============================================================
     VARIANCE ANALYSIS
     ============================================================ */
  P.variance = function (root) {
    let statusFilter = "all";
    root.innerHTML = head2("Variance Analysis", "Actual vs budget by department — what moved, by how much, and which variances need action.",
      `<button class="btn btn-s" id="vExp">${icon("download", "ic-14")} Export</button>`) +
      `<div class="kpis">
        ${vtile("Favorable", A.BUDGETS.filter(b => b.variance < 0).length + " departments", "ok", "Actual below budget — capacity or timing", icon("check"))}
        ${vtile("Neutral", "0 · within ±5% threshold", "info", "No material deviation at the plan level", icon("dot"))}
        ${vtile("Unfavorable", A.BUDGETS.filter(b => b.variance > 0).length + " department", "bad", "Marketing +₹0.6 Cr over plan", icon("x"))}
        ${vtile("Net variance", "−" + f.cr(560) + " under plan", "ok", "Company-wide spend is 23.6% under the envelope", icon("scale"))}
      </div>
      <div class="grid" style="margin-bottom:16px">
        <div class="c-4"><div class="card" style="padding:14px 16px"><span class="badge b-ok" style="margin-bottom:8px">${icon("check", "ic-14")} Favorable</span><p class="small muted" style="line-height:1.55">Actual spend <b>below</b> budget. Good — but check for deferred projects or one-off timing.</p></div></div>
        <div class="c-4"><div class="card" style="padding:14px 16px"><span class="badge b-info" style="margin-bottom:8px">${icon("dot", "ic-14")} Neutral</span><p class="small muted" style="line-height:1.55">Within the acceptable threshold of <b>±5%</b> (configurable in Settings). No action required.</p></div></div>
        <div class="c-4"><div class="card" style="padding:14px 16px"><span class="badge b-bad" style="margin-bottom:8px">${icon("x", "ic-14")} Unfavorable</span><p class="small muted" style="line-height:1.55">Actual spend <b>above</b> budget beyond threshold. Investigate drivers and re-forecast if structural.</p></div></div>
      </div>
      <div class="grid">
        <div class="c-7"><div class="table-wrap" id="varTable"></div></div>
        <div class="c-5">${card("Variance Trend", "Monthly actual vs plan run-rate (₹ L) · last 12 months", "", `<div class="chart-box" id="chVT"></div>`)}
          ${card("Largest Variances", "Absolute variance by department", "", `<div class="chart-box" id="chLV" style="min-height:190px"></div>`, "", `<a href="#/budgets">Open budget management →</a>`)}
        </div>
      </div>`;
    root.querySelector("#vExp").onclick = () => AV.exportModal({ title: "Export variance analysis", report: "dpt" });
    const rows = A.BUDGETS.map(b => ({ ...b, varPct: (b.actual - b.budget) / b.budget * 100 }));
    const t = table({
      el: "#varTable",
      cols: [
        { k: "dept", label: "Department" },
        { k: "budget", label: "Budget", align: "r", render: r => f.cr(r.budget * 100) },
        { k: "actual", label: "Actual", align: "r", render: r => f.cr(r.actual * 100) },
        { k: "variance", label: "Variance", align: "r", render: r => `<span class="pos-neg ${r.variance > 0 ? "neg" : "pos"}">${f.crSign(r.variance * 100)}</span>` },
        { k: "varPct", label: "Variance %", align: "r", render: r => `<span class="pos-neg ${r.variance > 0 ? "neg" : "pos"}">${f.pctSign(r.varPct)}</span>` },
        { k: "status", label: "Status", render: r => `<span class="badge b-${r.status.cls}">${icon(r.status.key === "over" ? "x" : r.status.key === "watch" ? "dot" : "check", "ic-14")} ${r.status.label}</span>` },
        { k: "dept", label: "Trend", sort: false, render: r => spark(r.trend, 72, 22, r.variance > 0 ? getCss("--bad") : getCss("--ok")) },
      ],
      rows, searchKeys: ["dept"], exportName: "revenue-bi-variance", sortKey: "variance",
      toolbar: `<select class="select" id="vStatus" style="height:32px;font-size:12.5px"><option value="all">All statuses</option><option value="ok">Favorable</option><option value="watch">Neutral / Watch</option><option value="over">Unfavorable</option></select>`,
      onRow: r => location.hash = "#/expenses",
    });
    root.querySelector("#vStatus").onchange = e => {
      statusFilter = e.target.value;
      const key = statusFilter === "over" ? "over" : statusFilter === "watch" ? "watch" : statusFilter === "ok" ? "ok" : null;
      t.rowsOverride = key ? rows.filter(r => r.status.key === key) : rows;
      t.setRows(t.rowsOverride);
    };
    const mv = A.EXP.slice(18).map(v => +(v - 2380 / 12).toFixed(1));
    CH.bars(root.querySelector("#chVT"), { labels: A.MONTHS.slice(18), series: [{ name: "Variance (actual − plan)", values: mv, colors: mv.map(v => v > 0 ? getCss("--bad") : getCss("--ok")) }], legend: false });
    CH.bars(root.querySelector("#chLV"), { hbar: true, labels: rows.slice().sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)).slice(0, 5).map(r => r.dept), series: [{ name: "|Variance|", values: rows.slice().sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)).slice(0, 5).map(r => Math.round(Math.abs(r.variance) * 100)), colors: rows.map(r => r.variance > 0 ? getCss("--bad") : getCss("--ok")).sort((a, b) => 0) }], text: v => f.cr(Math.abs(v)), legend: false });
  };
  function head2(t, s, acts) { return `<div class="page-head"><div style="min-width:0"><h1>${t}</h1><div class="sub">${s}</div></div><div class="actions">${acts || ""}</div></div>`; }
  function vtile(label, value, cls, text, ico) {
    return `<div class="kpi"><div class="kpi-top"><span class="kpi-label">${label}</span><span class="kpi-ico ${cls === "bad" ? "" : "tint"}" style="${cls === "bad" ? "background:var(--bad-soft);color:var(--bad-ink)" : ""}">${icon(ico)}</span></div>
      <div class="kpi-value" style="font-size:20px">${value}</div><div class="kpi-sub">${text}</div></div>`;
  }

  /* ============================================================
     REVENUE FORECASTING
     ============================================================ */
  P.forecast = function (root) {
    let horizon = 12, show = { Base: true, Optimistic: false, Conservative: false };
    root.innerHTML = head2("Revenue Forecasting", "Predict future revenue using historical financial data and machine learning.",
      `<span class="badge b-ok">${icon("check", "ic-14")} Model in production</span>`) +
      `<div class="filterbar" style="margin-bottom:16px">
        <div class="fb-field"><label for="fcFY">Financial year (Apr–Mar)</label><select class="select" id="fcFY"><option value="2026" selected>FY 2026–27</option><option value="2027">FY 2027–28 (requires next-year data)</option></select></div><div class="fb-field"><label for="fcH">Forecast horizon</label><select class="select" id="fcH"><option value="6">6 months</option><option value="12" selected>12 months</option></select></div>
        <div class="fb-field"><label for="fcP">Product</label><select class="select" id="fcP"><option>All products</option></select></div>
        <div class="fb-field"><label for="fcC">Category</label><select class="select" id="fcC"><option>All categories</option>${A.CATEGORIES.map(c => `<option>${c.name}</option>`).join("")}</select></div>
        <div class="fb-field"><label for="fcR">Region</label><select class="select" id="fcR"><option>All regions</option>${A.REGIONS.map(r => `<option>${r.name}</option>`).join("")}</select></div>
        <div class="fb-field"><label for="fcD">Department</label><select class="select" id="fcD"><option>All departments</option>${A.BUDGETS.map(b => `<option>${b.dept}</option>`).join("")}</select></div>
        <div class="fb-field"><label for="fcM">Model</label><select class="select" id="fcM"><option selected>Gradient Boosting v4.2</option><option>Seasonal ARIMA (baseline)</option></select></div>
        <div class="fb-actions"><span class="small muted" id="fcScope">Scope: Company-wide · 12 months</span></div>
      </div>
      <div class="kpis">
        ${fkpi("Forecast Revenue", f.cr(A.FC.total), `<span class="delta up"><span class="tri">▲</span>+${A.FC.growth.toFixed(1)}% vs T12M</span>`, "Next 12 months · base case", "₹2.94 Cr expected in Oct 2026")}
        ${fkpi("Expected Growth", "+" + A.FC.growth.toFixed(1) + "%", `<span class="badge b-ok"><span class="dot"></span> Above plan</span>`, "vs trailing 12 months", "Plan growth was +11.0%")}
        ${fkpi("Forecast Accuracy", A.FC.mape + "%", `<span class="badge b-mut">MAPE · backtest</span>`, "Evaluation metric on holdout data", "MAE ₹0.9 L · RMSE ₹1.4 L")}
        ${fkpi("Confidence Range", f.cr(A.FC.confRange[0]) + " – " + f.cr(A.FC.confRange[1]), `<span class="badge b-info">90% interval</span>`, "Full 12-month forecast", "Widens to ±10% by Mar-27")}
      </div>
      <div class="grid">
        <div class="c-8">${card("Historical Revenue + Forecast", "Green = observed revenue · blue dashed = cost estimate using current cost ratio · purple dashed = revenue forecast · shaded = 90% confidence interval",
          `<div class="row gap-6" id="fcScen">${["Base", "Optimistic", "Conservative"].map(s => `<label class="chk" style="font-size:12.5px"><input type="checkbox" data-s="${s}" ${show[s] ? "checked" : ""}> ${s}</label>`).join("")}</div>`,
          `<div class="chart-box tall" id="chFcMain"></div>`)}</div>
        <div class="c-4"><div class="card" style="position:sticky;top:80px"><div class="card-h"><div><div class="t">Model · Directional forecast</div><div class="s">v4.2 · retrained weekly</div></div><span class="badge b-ok" style="margin-left:auto">${icon("check", "ic-14")} Baseline estimate</span></div>
          <div class="card-b">
            <dl class="kv" style="grid-template-columns:1fr 1fr;font-size:13px">
              <dt>MAE</dt><dd class="num">${A.FC.mae}</dd><dt>RMSE</dt><dd class="num">${A.FC.rmse}</dd>
              <dt>MAPE</dt><dd class="num">${A.FC.mape}%</dd><dt>Backtest</dt><dd>3 months holdout</dd>
              <dt>Training period</dt><dd style="grid-column:1/-1">${A.FC.train}</dd>
              <dt>Forecast period</dt><dd style="grid-column:1/-1">FY 2026–27 · Apr 2026–Mar 2027 financial year; model data extends to Sep 2027</dd>
            </dl>
            <div class="row" style="margin-top:14px;flex-wrap:wrap">
              <button class="btn btn-p" id="fcRun">${icon("zap", "ic-14")} Run Forecast</button>
              <button class="btn btn-s" id="fcDet">View Model Details</button>
            </div>
            <div class="foot-note">${icon("shield", "ic-14")}<span>Metrics are <b>model evaluation metrics</b> from backtesting — they measure past out-of-sample error, not a guarantee of future performance.</span></div>
          </div></div></div>
        <div class="c-12">${card("Scenario Analysis", "Possible financial outcomes under different business assumptions",
          `<span class="small muted">All scenarios share the same historical baseline</span>`,
          `<div class="t-scroll" style="margin-top:6px"><table class="dt"><thead><tr><th>Scenario</th><th>Assumptions</th><th class="r">FY forecast</th><th class="r">Growth vs T12M</th><th class="r">H2 (Oct 26 – Mar 27)</th><th class="r">Probability (qual.)</th></tr></thead>
          <tbody>
            <tr style="background:var(--primary-soft)"><td><b>Base Case</b></td><td>Expected business conditions; festive season in line with FY 26 plan; no material macro shocks.</td><td class="r"><b>${f.cr(A.FC.total)}</b></td><td class="r"><b>${f.pctSign(A.FC.growth)}</b></td><td class="r">${f.cr(A.FC.h2)}</td><td class="r"><span class="badge b-info">Most likely</span></td></tr>
            <tr><td><b>Optimistic</b></td><td>Electronics +35% growth; East region margin recovers to 27%; marketing CAC improves 8%.</td><td class="r">${f.cr(A.FC.optTotal)}</td><td class="r">${f.pctSign(A.PCT(A.FC.optTotal, A.LATEST.revenue))}</td><td class="r">${f.cr(A.FC.optTotal - 1288)}</td><td class="r"><span class="badge b-ok">Upside</span></td></tr>
            <tr><td><b>Conservative</b></td><td>Category growth halves; logistics costs +6%; festive demand −10% YoY.</td><td class="r">${f.cr(A.FC.conTotal)}</td><td class="r">${f.pctSign(A.PCT(A.FC.conTotal, A.LATEST.revenue))}</td><td class="r">${f.cr(A.FC.conTotal - 1244)}</td><td class="r"><span class="badge b-warn">Downside</span></td></tr>
          </tbody></table></div>`)}</div>
      </div>`;
    const scopeSel = () => {
      const p = root.querySelector("#fcP").selectedIndex > 0 ? root.querySelector("#fcP").value : null;
      const c = root.querySelector("#fcC").value !== "All categories" ? root.querySelector("#fcC").value : null;
      const r = root.querySelector("#fcR").value !== "All regions" ? root.querySelector("#fcR").value : null;
      const d = root.querySelector("#fcD").value !== "All departments" ? root.querySelector("#fcD").value : null;
      const parts = [p, c, r, d].filter(Boolean);
      let factor = 1, label = "Company-wide";
      if (c) { const cc = A.CATEGORIES.find(x => x.name === c); factor *= cc.share / 100; label = cc.name; }
      if (r) { const rr = A.REGIONS.find(x => x.name === r); factor *= rr.share / 100; label = r + (label !== "Company-wide" ? " · " + r : r); }
      if (d) factor *= 0.4; label = (label === "Company-wide" ? "" : label + " · ") + d;
      if (p) { const pp = A.productByName(p); factor = pp.rev / A.LATEST.revenue; label = pp.name; }
      root.querySelector("#fcScope").textContent = "Scope: " + (parts.length ? label : "Company-wide") + " · " + horizon + " months";
      return factor;
    };
    function draw() {
      const k = scopeSel();
      const h = +horizon;
      const histL = A.MONTHS.slice(18), histR = A.REV.slice(18).map(v => +(v * k).toFixed(1));
      const fL = A.FC_MONTHS.slice(0, h);
      const costRatio = (A.PL.current.cogs + A.PL.current.opexTotal) / A.PL.current.totalRevenue;
      const histCost = histR.map(v => +(v * costRatio).toFixed(1));
      const forecastCost = A.FC_BASE.slice(0, h).map(v => +(v * k * costRatio).toFixed(1));
      const series = [{ name: "Actual revenue", values: [...histR, ...Array(fL.length).fill(null)], color: "#16803C", width: 2.6, dots: true }, { name: "Estimated total cost", values: [...histCost, ...forecastCost], color: "#2563EB", width: 2.2, dots: true, dashed: true }];
      if (show.Base) series.push({ name: "Revenue forecast", values: [...Array(histL.length).fill(null), ...A.FC_BASE.slice(0, h).map(v => +(v * k).toFixed(1))], color: "#7C3AED", dashed: true, width: 2.4 });
      if (show.Optimistic) series.push({ name: "Optimistic", values: [null, ...A.FC_OPT.slice(0, h).map(v => +(v * k).toFixed(1))], color: getCss("--ok"), dashed: true, width: 1.6 });
      if (show.Conservative) series.push({ name: "Conservative", values: [null, ...A.FC_CON.slice(0, h).map(v => +(v * k).toFixed(1))], color: getCss("--chart-6"), dashed: true, width: 1.6 });
      const bands = show.Base ? [{ name: "CI", lower: [...Array(histL.length).fill(null), ...A.FC_BAND_L.slice(0, h).map(v => +(v * k).toFixed(1))], upper: [...Array(histL.length).fill(null), ...A.FC_BAND_U.slice(0, h).map(v => +(v * k).toFixed(1))] }] : [];
      CH.line(root.querySelector("#chFcMain"), { labels: histL.concat(fL), series, bands, vlines: [{ x: fL[0], label: "Forecast begins" }], yFmt: "money" });
    }
    draw();
    ["fcP", "fcC", "fcR", "fcD"].forEach(id => { const el = root.querySelector("#" + id); if (id === "fcP") el.innerHTML = "<option>All products</option>" + A.PRODUCTS.map(p => `<option>${p.name}</option>`).join(""); el.onchange = draw; });
    root.querySelector("#fcH").onchange = e => { horizon = e.target.value; draw(); };
    root.querySelector("#fcFY").onchange = e => { if (e.target.value === "2027") { toast("warn", "Forecast not available", "FY 2027–28 requires validated historical data beyond Sep 2027. Showing FY 2026–27 instead."); e.target.value = "2026"; } draw(); };
    root.querySelectorAll("[data-s]").forEach(cb => cb.onchange = () => { show[cb.dataset.s] = cb.checked; draw(); });
    root.querySelector("#fcRun").onclick = e => {
      const b = e.currentTarget; b.classList.add("loading");
      setTimeout(() => {
        b.classList.remove("loading");
        toast("ok", "Forecast updated", "Re-ran at 10:42 IST · point forecast for Oct 2026: ₹2.78 Cr (CI ±5%).");
        A.logAudit({ time: "Just now", user: S.user.name, role: S.user.role, action: "Re-ran forecast", entity: "Forecast · Gradient Boosting v4.2", next: "MAPE 5.8%" });
      }, 1400);
    };
    root.querySelector("#fcDet").onclick = () => drawer({
      title: "Model details · Gradient Boosting v4.2", sub: "Explainability & evaluation",
      body: `<b class="small">Feature importance</b>
        <div style="margin:10px 0 16px">${[["Revenue seasonality", 32], ["Promo & festive calendar", 21], ["Category mix", 17], ["Region mix", 14], ["Price changes", 9], ["Macro / holidays", 7]].map(x => `<div class="row" style="gap:10px;padding:4px 0;font-size:12.5px"><span style="width:150px" class="muted">${x[0]}</span><div class="prog info" style="flex:1;height:8px"><i style="width:${x[1] * 3}%"></i></div><b class="num" style="width:34px;text-align:right">${x[1]}%</b></div>`).join("")}</div>
        <b class="small">Backtest (holdout: Jul–Sep 2026)</b>
        <dl class="kv" style="margin-top:8px;font-size:13px"><dt>MAE</dt><dd>₹0.9 L</dd><dt>RMSE</dt><dd>₹1.4 L</dd><dt>MAPE</dt><dd>5.8%</dd><dt>Max monthly deviation</dt><dd>9.2% (Jul-26, festive pre-slow)</dd></dl>
        <div class="note" style="margin-top:12px">${icon("shield", "ic-14")}<span>Model evaluation metrics measure <b>past</b> out-of-sample error. Forecasts are planning estimates — treat confidence intervals, not point values, as the decision input.</span></div>`,
    });
  };
  function fkpi(label, value, sub, note, foot) {
    return `<div class="kpi"><div class="kpi-top"><span class="kpi-label">${label}</span><span class="kpi-ico tint">${icon("forecast")}</span></div><div class="kpi-value" style="font-size:23px">${value}</div><div class="kpi-mid">${sub}<div class="kpi-sub" style="margin-top:5px">${note}</div></div><div class="kpi-foot">${foot}</div></div>`;
  }

  /* ============================================================
     FINANCIAL REPORTS
     ============================================================ */
  P.reports = function (root) {
    const tints = { navy: ["var(--navy)", "#fff"], blue: ["var(--primary-soft)", "var(--primary)"], amber: ["var(--warn-soft)", "var(--warn-ink)"], green: ["var(--ok-soft)", "var(--ok-ink)"], violet: ["#EFE9FD", "#6B46E5"], teal: ["#DFF3F0", "#0F766E"] };
    root.innerHTML = head2("Financial Reports", "Management-ready reports — generate, preview and export in PDF, Excel or CSV.",
      `<span class="badge b-mut">7 report types · generated on demand</span>`) +
      `<div class="grid">${A.REPORTS.map(r => {
        const [bg, fg] = tints[r.tint];
        return `<div class="c-4"><div class="card report-card">
          <div class="rc-top"><span class="rc-ico" style="background:${bg};color:${fg}">${icon(r.icon)}</span><div><div class="rc-t">${r.name}</div><div class="small muted">${r.fmt}</div></div></div>
          <div class="rc-d">${r.desc}</div>
          <div class="rc-meta"><span>${icon("clock", "ic-14")} Last: ${r.last}</span><span>${icon("users", "ic-14")} ${r.owner}</span></div>
          <div class="rc-acts">
            <a class="btn btn-s btn-sm" href="${r.view}">${icon("eye", "ic-14")} View</a>
            <button class="btn btn-p btn-sm" data-gen="${r.id}">${icon("zap", "ic-14")} Generate</button>
            <button class="btn btn-g btn-sm" data-pdf="${r.id}">PDF</button>
            <button class="btn btn-g btn-sm" data-xls="${r.id}">Excel</button>
          </div></div></div>`; }).join("")}
        <div class="c-12"><div class="table-wrap" id="expTable"></div>
          <div class="foot-note">${icon("info", "ic-14")}<span>Exports are generated server-side in production (FastAPI). In this demo, CSV/Excel downloads are real files; “PDF” opens the print dialog with a print-optimized layout.</span></div>
        </div></div>`;
    root.querySelectorAll("[data-gen]").forEach(b => b.onclick = () => AV.exportModal({ title: "Generate report", report: b.dataset.gen }));
    root.querySelectorAll("[data-pdf]").forEach(b => b.onclick = () => { toast("info", "Preparing PDF", A.REPORTS.find(r => r.id === b.dataset.pdf).name + " — opening print layout."); setTimeout(() => window.print(), 600); });
    root.querySelectorAll("[data-xls]").forEach(b => b.onclick = () => { const r = A.REPORTS.find(x => x.id === b.dataset.xls); if (r) AV.downloadSampleCSV(r); });
    table({
      el: "#expTable",
      cols: [
        { k: "name", label: "Report" }, { k: "fmt", label: "Format" }, { k: "by", label: "Generated by" },
        { k: "time", label: "When" }, { k: "scope", label: "Scope" }, { k: "size", label: "Size", align: "r" },
        { k: "name", label: "", sort: false, render: () => `<button class="btn btn-g btn-sm dl-x">${icon("download", "ic-14")}</button>` },
      ],
      rows: [
        { name: "Executive Summary · Oct-26", fmt: "PDF", by: "Ananya Iyer", time: "Today, 08:15", scope: "FY 26-27 YTD", size: "1.2 MB" },
        { name: "September P&L", fmt: "PDF", by: "Rohit Mehta", time: "Sep 30, 17:40", scope: "FY 2025-26", size: "0.8 MB" },
        { name: "Revenue by Category", fmt: "XLSX", by: "Kavya Nair", time: "Sep 29, 11:02", scope: "T12M", size: "0.4 MB" },
        { name: "Budget Variance Pack", fmt: "XLSX", by: "Rohit Mehta", time: "Sep 28, 15:31", scope: "T12M · 7 depts", size: "0.6 MB" },
        { name: "Regional Performance", fmt: "CSV", by: "Kavya Nair", time: "Sep 27, 09:58", scope: "T12M · 4 regions", size: "0.1 MB" },
      ],
      searchKeys: ["name", "by", "fmt"], pageSize: 5,
      toolbar: `<span class="badge b-mut">Recent exports</span>`,
    });
    setTimeout(() => root.querySelectorAll(".dl-x").forEach(b => b.onclick = () => toast("ok", "Download started", "Export re-generated (demo file).")), 50);
  };

  /* ============================================================
     PROFIT & LOSS
     ============================================================ */
  P.pl = function (root) {
    const c = A.PL.current, p = A.PL.prior;
    const row = (label, cur, prev, { ind = false, cost = false, kind = "row", pct = false } = {}) => {
      const d = prev ? (cur - prev) / Math.abs(prev) * 100 : null;
      const dCls = d == null ? "flat" : (cost ? d > 0 ? "neg" : "pos" : d > 0 ? "pos" : "neg");
      const fmtV = v => pct ? f.pct(v) : (v < 0 ? `(${Math.abs(v).toFixed(2)})` : v.toFixed(2));
      return `<div class="pl-row ${kind}"><span class="pl-l ${ind ? "ind" : ""}">${label}</span><span class="v">${fmtV(cur)}</span><span class="v">${fmtV(prev)}</span><span class="d ${dCls}">${d == null ? "—" : f.pctSign(d)}</span></div>`;
    };
    root.innerHTML = head2("Profit & Loss Statement", "Accounting-style statement with period comparison. All figures in ₹ crore (Cr).",
      `<select class="select" id="plPeriod" style="height:36px;font-size:13px"><option selected>Trailing 12 months (Oct 25 – Sep 26)</option><option>FY 2025-26 (Apr 25 – Mar 26)</option><option>FY 2024-25 (Apr 24 – Mar 25)</option></select>
       <button class="btn btn-s" id="plPdf">${icon("download", "ic-14")} Export PDF</button>
       <button class="btn btn-s" id="plXls">${icon("file", "ic-14")} Export Excel</button>`) +
      `<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
        ${mini("Gross Profit", f.cr(c.grossProfit * 100), f.pct(c.gm) + " GM", A.PCT(c.grossProfit, p.grossProfit))}
        ${mini("Operating Profit", f.cr(c.operatingProfit * 100), f.pct(c.operatingProfit / c.totalRevenue * 100) + " of revenue", A.PCT(c.operatingProfit, p.operatingProfit))}
        ${mini("Net Profit", f.cr(c.netProfit * 100), f.pct(c.nm) + " net margin", A.PCT(c.netProfit, p.netProfit))}
        ${mini("Revenue", f.cr(c.totalRevenue * 100), "Product 22.40 · Service 1.80 · Other 1.40", A.PCT(c.totalRevenue, p.totalRevenue))}
      </div>
      <div class="grid"><div class="c-12"><div class="card"><div class="card-h"><div><div class="t">Statement of Profit &amp; Loss</div><div class="s">Finance Analytics Platform · Retail &amp; E-Commerce · ₹ crore · indirect method</div></div>
        <span class="badge b-mut" style="margin-left:auto">Period: T12M vs prior T12M</span></div>
        <div class="card-b" style="padding-top:10px">
          <div class="pl-head"><span>Line item</span><span>Current (Cr)</span><span>Prior (Cr)</span><span>Change</span></div>
          <div class="pl-sec">Revenue</div>
          ${row("Product Revenue", c.revenue.v, p.revenue.v, { ind: true })}
          ${row("Service Revenue", c.service.v, p.service.v, { ind: true })}
          ${row("Other Revenue", c.other.v, p.other.v, { ind: true })}
          ${row("Total Revenue", c.totalRevenue, p.totalRevenue, { kind: "sub" })}
          <div class="pl-sec">Cost of Revenue</div>
          ${row("Cost of Goods & Fulfilment", -c.cogs, -p.cogs, { ind: true, cost: true })}
          ${row("Gross Profit", c.grossProfit, p.grossProfit, { kind: "sub" })}
          <div class="pl-row" style="padding:4px 4px 0"><span class="pl-l ind small muted">Gross margin</span><span class="v small num">${f.pct(c.gm)}</span><span class="v small num">${f.pct(p.gm)}</span><span class="d pos small">${A.fmt.pp(c.gm - p.gm, 1)}</span></div>
          <div class="pl-sec">Operating Expenses</div>
          ${row("Marketing", -c.opex["Marketing"], -p.opex["Marketing"], { ind: true, cost: true })}
          ${row("Technology", -c.opex["Technology"], -p.opex["Technology"], { ind: true, cost: true })}
          ${row("HR", -c.opex["HR"], -p.opex["HR"], { ind: true, cost: true })}
          ${row("Administration", -c.opex["Administration"], -p.opex["Administration"], { ind: true, cost: true })}
          ${row("Finance", -c.opex["Finance"], -p.opex["Finance"], { ind: true, cost: true })}
          ${row("Total Operating Expenses", -c.opexTotal, -p.opexTotal, { kind: "sub", cost: true })}
          ${row("Operating Profit", c.operatingProfit, p.operatingProfit, { kind: "sub" })}
          <div class="pl-sec">Other Income &amp; Expenses</div>
          ${row("Other Income (interest)", c.otherIncome, p.otherIncome, { ind: true })}
          ${row("Other Expenses (provisions)", -c.otherExpense, -p.otherExpense, { ind: true, cost: true })}
          <div class="pl-hero" style="border-radius:10px;padding:6px 10px;margin-top:10px">
            ${row("Net Profit", c.netProfit, p.netProfit, { kind: "pl-total" })}
            <div class="pl-row"><span class="pl-l ind">Net margin</span><span class="v">${f.pct(c.nm)}</span><span class="v">${f.pct(p.nm)}</span><span class="d pos">${A.fmt.pp(c.nm - p.nm, 1)}</span></div>
          </div>
        </div>
        <div class="card-f">${icon("shield", "ic-14")}<span>Basis of preparation: T12M Oct 2025 – Sep 2026 vs prior 12 months. Cost of goods & fulfilment (₹9.40 Cr) is attributed across Operations, Logistics and Technology in the departmental P&amp;L; see Variance Analysis for the department mapping. Demo figures — fictional company.</span></div>
      </div></div></div>`;
    root.querySelector("#plPdf").onclick = () => { toast("info", "Preparing PDF", "Opening print-optimized statement…"); setTimeout(() => window.print(), 500); };
    root.querySelector("#plXls").onclick = () => AV.downloadSampleCSV(A.REPORTS.find(r => r.id === "pl"));
  };
  function mini(label, value, sub, d) {
    return `<div class="kpi"><div class="kpi-top"><span class="kpi-label">${label}</span></div><div class="kpi-value" style="font-size:21px">${value}</div><div class="kpi-mid">${delta(d)}</div><div class="kpi-sub">${sub}</div></div>`;
  }

  /* ============================================================
     BUSINESS INSIGHTS
     ============================================================ */
  P.insights = function (root) {
    let sev = "all";
    const groups = { revenue: "Revenue Insights", expense: "Expense Insights", budget: "Budget Alerts", forecast: "Forecast Insights", product: "Product Insights", regional: "Regional Insights", data: "Data Quality" };
    function render() {
      const list = A.INSIGHTS.filter(i => sev === "all" || i.sev === sev);
      root.querySelector("#insBody").innerHTML = list.length ? Object.entries(groups).map(([k, label]) => {
        const items = list.filter(i => i.type === k);
        if (!items.length) return "";
        return `<div style="margin-bottom:20px"><div class="row" style="margin-bottom:10px"><h3 style="font-size:15px">${icon(k === "budget" ? "alerts" : k === "revenue" ? "revenue" : k === "expense" ? "expense" : k === "forecast" ? "forecast" : k === "product" ? "product" : k === "regional" ? "region" : "data", "ic-16")}&nbsp; ${label}</h3><span class="badge b-mut">${items.length}</span></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px">${items.map(i => AV.insightCard(i)).join("")}</div></div>`;
      }).join("") : `<div class="empty" style="padding:50px"><div class="e-ico">${icon("insights")}</div><b>No ${sev} insights right now</b><p>Insights appear here when the engine detects a material, explainable change.</p><button class="btn btn-s btn-sm" id="insClr">Show all</button></div>`;
      const clr = root.querySelector("#insClr"); if (clr) clr.onclick = () => { sev = "all"; render(); root.querySelectorAll("[data-sev]").forEach(b => b.classList.toggle("active", b.dataset.sev === "all")); };
      AV.wireInsights(root);
    }
    root.innerHTML = head2("Business Intelligence", "AI-assisted insights — every insight states what happened, why it matters, the supporting metric and a suggested action.",
      `<span class="badge b-info">${icon("insights", "ic-14")} Explainable · metric-backed</span>`) +
      `<div class="row" style="margin-bottom:16px;flex-wrap:wrap;gap:7px" id="sevChips">
        ${["all", "critical", "high", "medium", "low"].map(s => `<button class="view-chip ${s === "all" ? "active" : ""}" data-sev="${s}">${s === "all" ? "All severities" : s[0].toUpperCase() + s.slice(1)}</button>`).join("")}
      </div><div id="insBody"></div>`;
    root.querySelectorAll("[data-sev]").forEach(b => b.onclick = () => { sev = b.dataset.sev; root.querySelectorAll("[data-sev]").forEach(x => x.classList.toggle("active", x === b)); render(); });
    render();
  };

  /* ============================================================
     ALERTS & EXCEPTIONS
     ============================================================ */
  P.alerts = function (root) {
    let tab = "All";
    const TEAM = ["Rohit Mehta", "Kavya Nair", "Ananya Iyer", "Arjun Reddy"];
    const sevB = s => s === "critical" ? `<span class="badge b-bad">${icon("alerts", "ic-14")} Critical</span>` : s === "high" ? `<span class="badge b-bad">${icon("alert" === "x" ? "dot" : "dot", "ic-14")} High</span>` : s === "medium" ? `<span class="badge b-warn">${icon("dot", "ic-14")} Medium</span>` : `<span class="badge b-mut">${icon("dot", "ic-14")} Low</span>`;
    const stB = s => s === "New" ? `<span class="badge b-bad"><span class="dot"></span> New</span>` : s === "Acknowledged" ? `<span class="badge b-info"><span class="dot"></span> Acknowledged</span>` : s === "Investigating" ? `<span class="badge b-warn"><span class="dot"></span> Investigating</span>` : `<span class="badge b-ok"><span class="dot"></span> Resolved</span>`;
    function render() {
      const counts = ["New", "Acknowledged", "Investigating", "Resolved"].map(s => A.ALERTS.filter(a => a.status === s).length);
      root.querySelector("#alCounts").innerHTML = counts.map((c, i) => `<div class="kpi" style="padding:11px 14px"><div class="row gap-8"><span class="kpi-label" style="text-transform:none;font-size:12px">${["New", "Acknowledged", "Investigating", "Resolved"][i]}</span></div><div class="kpi-value" style="font-size:22px">${c}</div></div>`).join("");
      const rows = A.ALERTS.filter(a => tab === "All" || a.status === tab);
      table({
        el: "#alTable",
        cols: [
          { k: "id", label: "ID" }, { k: "sev", label: "Severity", render: r => sevB(r.sev) },
          { k: "cat", label: "Category" }, { k: "title", label: "Title", render: r => `<b style="color:var(--text-1)">${r.title}</b>` },
          { k: "time", label: "Raised" }, { k: "status", label: "Status", render: r => stB(r.status) }, { k: "owner", label: "Owner" },
          { k: "id", label: "Actions", sort: false, render: r => `<div class="row gap-4">
              <button class="btn btn-g btn-sm" data-a="view" data-id="${r.id}">View</button>
              <button class="btn btn-g btn-sm" data-a="assign" data-id="${r.id}" ${locked() ? "disabled" : ""}>Assign</button>
              ${r.status === "New" ? `<button class="btn btn-t btn-sm" data-a="ack" data-id="${r.id}" ${locked() ? "disabled" : ""}>Acknowledge</button>` : ""}
              ${r.status !== "Resolved" ? `<button class="btn btn-t btn-sm" data-a="res" data-id="${r.id}" ${locked() ? "disabled" : ""}>Resolve</button>` : ""}</div>` },
        ],
        rows, searchKeys: ["id", "title", "cat", "owner"], exportName: "revenue-bi-alerts", pageSize: 10,
        toolbar: `<span class="badge b-mut">${rows.length} of ${A.ALERTS.length} alerts</span>`,
      });
      root.querySelectorAll("[data-a='view']").forEach(b => b.onclick = () => viewAlert(b.dataset.id));
      root.querySelectorAll("[data-a='assign']").forEach(b => b.onclick = e => {
        e.stopPropagation();
        menu(b, TEAM.map(t => ({ id: t, icon: "users", label: t, action: () => { const a = A.ALERTS.find(x => x.id === b.dataset.id); a.owner = t; toast("ok", "Alert assigned", a.id + " → " + t); A.logAudit({ time: "Just now", user: S.user.name, role: S.user.role, action: "Assigned alert", entity: a.id, next: t }); render(); } })), "right");
      });
      root.querySelectorAll("[data-a='ack']").forEach(b => b.onclick = e => { e.stopPropagation(); const a = A.ALERTS.find(x => x.id === b.dataset.id); a.status = "Acknowledged"; toast("ok", "Acknowledged", a.id + " marked as acknowledged."); A.logAudit({ time: "Just now", user: S.user.name, role: S.user.role, action: "Acknowledged alert", entity: a.id, prev: "New", next: "Acknowledged" }); render(); });
      root.querySelectorAll("[data-a='res']").forEach(b => b.onclick = e => { e.stopPropagation(); const a = A.ALERTS.find(x => x.id === b.dataset.id); a.status = "Resolved"; toast("ok", "Resolved", a.id + " closed. Resolution is recorded in the audit log."); A.logAudit({ time: "Just now", user: S.user.name, role: S.user.role, action: "Resolved alert", entity: a.id, prev: a.status, next: "Resolved" }); render(); });
    }
    function viewAlert(id) {
      const a = A.ALERTS.find(x => x.id === id);
      const ins = A.INSIGHTS.find(i => i.cat === a.cat || i.type === a.cat.toLowerCase()) || A.INSIGHTS[0];
      drawer({
        title: a.id + " · " + a.title, sub: a.cat + " alert · raised " + a.time,
        body: `<div class="row gap-8" style="margin-bottom:12px">${sevB(a.sev)}${stB(a.status)}</div>
          <p class="small" style="line-height:1.6;margin-bottom:14px">${a.desc}</p>
          <div class="kv" style="font-size:13px;margin-bottom:14px"><dt>Owner</dt><dd>${a.owner}</dd><dt>Category</dt><dd>${a.cat}</dd><dt>Raised</dt><dd>${a.time}</dd></div>
          <b class="small">Related insight & suggested action</b>
          <div style="margin-top:8px">${AV.insightCard(ins)}</div>`,
        foot: `<button class="btn btn-g" id="alClose">Close</button>${a.status !== "Resolved" ? `<button class="btn btn-p" id="alRes2" ${locked() ? "disabled" : ""}>Mark resolved</button>` : ""}`,
      });
      document.getElementById("alClose").onclick = () => document.querySelector(".d-ov")?.remove();
      const r2 = document.getElementById("alRes2");
      if (r2) r2.onclick = () => { a.status = "Resolved"; toast("ok", "Resolved", a.id + " closed."); A.logAudit({ time: "Just now", user: S.user.name, role: S.user.role, action: "Resolved alert", entity: a.id, prev: a.status, next: "Resolved" }); document.querySelector(".d-ov")?.remove(); render(); };
    }
    root.innerHTML = head2("Alerts & Exceptions", "Financial exceptions across budget, revenue, expense, margin, forecast and data quality — triage, assign and resolve.",
      locked() ? `<span class="badge b-mut">${icon("lock", "ic-14")} Viewer role — actions disabled</span>` : "") +
      `<div class="kpis" id="alCounts" style="margin-bottom:16px"></div>
      <div class="tabs">${["All", "New", "Acknowledged", "Investigating", "Resolved"].map(t => `<button class="tab ${t === tab ? "active" : ""}" data-t="${t}">${t}<span class="cnt">${t === "All" ? A.ALERTS.length : A.ALERTS.filter(a => a.status === t).length}</span></button>`).join("")}</div>
      <div class="table-wrap" id="alTable"></div>`;
    root.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { tab = b.dataset.t; root.querySelectorAll("[data-t]").forEach(x => x.classList.toggle("active", x === b)); render(); });
    render();
  };

  /* ============================================================
     DATA MANAGEMENT
     ============================================================ */
  function makeSampleCSV() {
    const rows = [["txn_id", "date", "product", "category", "region", "revenue", "cost", "status"]];
    for (let i = 0; i < 300; i++) {
      const p = A.PRODUCTS[i % A.PRODUCTS.length];
      let id = "TXN-" + (20000 + i), date = "2026-09-" + String(1 + (i % 28)).padStart(2, "0"), rev = (1500 + (i * 137) % 42000), cost = Math.round(rev * 0.66), status = "Completed", region = "South";
      if (i === 57) id = "TXN-20041";         // exact duplicate
      if (i === 120) id = "TXN-20099";        // near-dup pattern (same as 121)
      if (i === 121) id = "TXN-20099";
      if (i % 37 === 0) region = "";          // missing region (warnings)
      if (i === 88) date = "31/09/2026";      // bad date format (error)
      if (i === 143) rev = -2300;             // negative revenue (error)
      if (i === 201) status = "Refunded";
      rows.push([id, date, p.name, p.cat, region, rev, cost, status].join(","));
    }
    return rows.join("\n");
  }
  P.data = function (root, query) {
    const tab0 = (query && query.get("tab")) || "overview";
    let tab = tab0;
    // import state
    let file = null, parsed = null;
    function renderTabs() {
      root.querySelector("#dtTabs").innerHTML = [["overview", "Overview", "data"], ["upload", "Upload & Import", "upload"], ["imports", "Imports", "db"], ["quality", "Data Quality", "quality"]].map(([id, label, ico]) => `<button class="tab ${tab === id ? "active" : ""}" data-dt="${id}">${icon(ico, "ic-14")}&nbsp; ${label}</button>`).join("");
      root.querySelectorAll("[data-dt]").forEach(b => b.onclick = () => { tab = b.dataset.dt; renderTabs(); renderBody(); });
    }
    function renderBody() {
      const b = root.querySelector("#dtBody");
      if (tab === "overview") b.innerHTML = `
        <div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
          ${dkpi("Total records", "1.28 M", "Across 6 sources", "db")}
          ${dkpi("Valid records", "99.5%", "After validation & dedup", "check")}
          ${dkpi("Last import", A.DATASET ? Number(A.DATASET.total).toLocaleString("en-IN") : "12,210", A.DATASET ? `${A.DATASET.type} · ${A.DATASET.name}` : "Revenue · Sep 28 · A. Reddy", "upload")}
          ${dkpi("Next sync", "06:00 IST", "Nightly batch · all sources", "clock")}
        </div>
        <div class="grid">${A.SOURCES.map(s => `<div class="c-4"><div class="card src-card">
          <div class="s-top"><span class="src-ico">${icon(s.icon)}</span><div><b>${s.name}</b><span class="s-meta">${s.desc}</span></div>
          <span class="badge ${s.fresh === "ok" ? "b-ok" : s.fresh === "warn" ? "b-warn" : "b-bad"}" style="margin-left:auto"><span class="dot"></span> ${s.fresh === "ok" ? "Fresh" : s.fresh === "warn" ? "Stale" : "Sync failed"}</span></div>
          <div class="row" style="gap:16px;font-size:12.5px"><span class="muted">Records</span><b class="num">${s.records}</b><span class="muted">Last sync</span><b>${s.last}</b></div>
          <div class="row" style="justify-content:flex-end;gap:6px"><button class="btn btn-g btn-sm" data-sync="${s.name}" ${locked() ? "disabled" : ""}>${icon("refresh", "ic-14")} Sync now</button></div>
        </div></div>`).join("")}</div>`;
      b.querySelectorAll("[data-sync]").forEach(btn => btn.onclick = () => {
        const src = A.SOURCES.find(s => s.name === btn.dataset.sync);
        if (src.fresh === "bad") { UI.confirm({ title: "Retry failed sync?", body: `The <b>${src.name}</b> gateway has been failing since Sep 29. Retrying now will re-pull the last 7 days.`, okLabel: "Retry sync", onOk: () => { toast("info", "Sync started", src.name + " — pulling last 7 days…"); setTimeout(() => { src.fresh = "ok"; src.last = "Just now"; toast("ok", "Sync complete", src.name + " is fresh again — 4,118 records reconciled."); A.logAudit({ time: "Just now", user: S.user.name, role: S.user.role, action: "Retried source sync", entity: "Source · " + src.name, prev: "Failed", next: "Success" }); renderBody(); }, 1600); } }); return; }
        toast("info", "Sync started", src.name + " — running incremental pull…");
        setTimeout(() => { src.last = "Just now"; toast("ok", "Sync complete", src.name + " is up to date."); renderBody(); }, 1100);
      });

      if (tab === "upload") { b.innerHTML = `
        <div class="card" style="margin-bottom:16px"><div class="card-h"><div><div class="t">Import financial data</div><div class="s">Upload → Validate → Preview → Import · validations run automatically, flagged rows are quarantined</div></div><span class="badge b-mut" style="margin-left:auto">CSV or XLSX · max 25 MB</span></div>
        <div class="card-b">
          <div class="stepper" id="impSteps"></div>
          <div id="impBody"></div>
        </div></div>`;
        setStep(0);
      }

      if (tab === "imports") b.innerHTML = `<div class="table-wrap" id="impTable"></div>
        <div class="foot-note">${icon("shield", "ic-14")}<span>Every import is versioned and reversible. Error reports are kept for 90 days for audit.</span></div>`;
      table({
        el: "#impTable",
        cols: [
          { k: "file", label: "File" }, { k: "type", label: "Type" }, { k: "date", label: "Imported" },
          { k: "by", label: "By" }, { k: "records", label: "Records", fmt: "num", align: "r" },
          { k: "valid", label: "Valid", fmt: "num", align: "r" },
          { k: "status", label: "Status", render: r => `<span class="badge b-ok"><span class="dot"></span> ${r.status}</span>` },
          { k: "file", label: "", sort: false, render: r => `<div class="row gap-4"><button class="btn btn-g btn-sm" data-pv="${r.file}">${icon("eye", "ic-14")}</button><button class="btn btn-g btn-sm" data-er="${r.file}">${icon("file", "ic-14")}</button><button class="btn btn-g btn-sm" data-del="${r.file}" ${locked() ? "disabled" : ""}>${icon("trash", "ic-14")}</button></div>` },
        ],
        rows: A.IMPORTS.slice(), searchKeys: ["file", "type", "by"], exportName: "revenue-bi-imports",
        toolbar: `<span class="badge b-mut">${A.IMPORTS.length} imports (last 30 days)</span>`,
      });
      setTimeout(() => {
        b.querySelectorAll("[data-pv]").forEach(x => x.onclick = () => toast("info", "Preview", x.dataset.pv + " — opening record preview (demo)."));
        b.querySelectorAll("[data-er]").forEach(x => x.onclick = () => { window.UI.downloadFile("error-report-" + x.dataset.er + ".csv", "row,line,issue,action\n7,date,invalid format 31/09/2026,quarantined\n34,revenue,negative value -2300,quarantined\n102,region,missing value,defaulted from shipping address", "text/csv"); toast("ok", "Error report downloaded", "Quarantined rows with suggested fixes."); });
        b.querySelectorAll("[data-del]").forEach(x => x.onclick = () => UI.confirm({ title: "Delete import?", danger: true, okLabel: "Delete", body: "This removes the import record (data already merged is kept).", onOk: () => { A.IMPORTS = A.IMPORTS.filter(i => i.file !== x.dataset.del); persistImportState(); toast("bad", "Import deleted", x.dataset.del + " removed from history."); renderBody(); } }));
      }, 50);

      if (tab === "quality") b.innerHTML = `
        <div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
          ${qtile("Completeness", 99.4, "Ok")}${qtile("Accuracy", 98.9, "Ok")}${qtile("Freshness", 97.2, "Watch")}${qtile("Consistency", 99.8, "Ok")}
        </div>
        <div class="grid">
          <div class="c-7"><div class="table-wrap" id="dqTable"></div></div>
          <div class="c-5">${card("Source health", "POS Gateway (legacy) sync failing since Sep 29", `<span class="badge b-bad">${icon("x", "ic-14")} 1 failing</span>`,
            `<div style="display:flex;flex-direction:column;gap:9px">${A.SOURCES.map(s => `<div class="row" style="gap:10px;border:1px solid var(--border);border-radius:10px;padding:10px 12px"><span class="src-ico" style="width:32px;height:32px">${icon(s.icon, "ic-16")}</span><div style="flex:1;min-width:0"><b class="small">${s.name}</b><div class="small muted">${s.last}</div></div><span class="badge ${s.fresh === "ok" ? "b-ok" : s.fresh === "warn" ? "b-warn" : "b-bad"}"><span class="dot"></span> ${s.fresh === "ok" ? "OK" : s.fresh === "warn" ? "Stale" : "Failed"}</span>${s.fresh === "bad" ? `<button class="btn btn-s btn-sm" id="dqRetry" ${locked() ? "disabled" : ""}>Retry</button>` : ""}</div>`).join("")}</div>`)}
          ${card("Validation rules", "Rules applied on every import", "", `<ul style="list-style:none;display:flex;flex-direction:column;gap:8px;font-size:12.5px;color:var(--text-2)">${[["Unique key", "txn_id must be unique — exact duplicates quarantined"], ["Date format", "YYYY-MM-DD, must fall within ±2 days of file date"], ["Numeric ranges", "revenue & cost ≥ 0, cost ≤ revenue × 1.5 sanity cap"], ["Referential integrity", "product must exist in Product Master; region ∈ {North, South, East, West}"], ["Missing values", "region/customer_id may default from address lookup (warning)"], ["Dedup", "near-duplicates (same id + amount ±1%) flagged for review"]].map(x => `<li class="row" style="gap:8px;align-items:flex-start">${icon("check", "ic-14")}<span><b>${x[0]}:</b> ${x[1]}</span></li>`).join("")}</ul>`)}
        </div>`;
      table({
        el: "#dqTable",
        cols: [
          { k: "entity", label: "Entity" }, { k: "check", label: "Check" }, { k: "last", label: "Last run" },
          { k: "rate", label: "Pass rate", align: "r", render: r => `<span class="num" style="font-weight:640;color:${r.rate >= 99 ? "var(--ok-ink)" : "var(--warn-ink)"}">${r.rate}%</span>` },
          { k: "issues", label: "Open issues", align: "r", render: r => r.issues ? `<span class="badge b-warn">${r.issues}</span>` : `<span class="badge b-ok">0</span>` },
        ],
        rows: [
          { entity: "Transactions", check: "Unique txn_id", last: "Today, 02:20", rate: 99.98, issues: 0 },
          { entity: "Transactions", check: "Date validity", last: "Today, 02:20", rate: 99.95, issues: 0 },
          { entity: "Revenue", check: "Category coverage", last: "Today, 02:20", rate: 100, issues: 0 },
          { entity: "Expenses", check: "Dept + cost-centre mapping", last: "Yesterday, 23:40", rate: 99.7, issues: 12 },
          { entity: "Budgets", check: "Plan vs actual coverage", last: "Sep 28, 11:20", rate: 96.2, issues: 3 },
          { entity: "Products", check: "SKU master completeness", last: "Oct 2, 09:05", rate: 99.9, issues: 0 },
          { entity: "POS Gateway", check: "Feed continuity", last: "Sep 29, 04:10", rate: 81.4, issues: 1 },
        ],
        searchKeys: ["entity", "check"], exportName: "revenue-bi-data-quality", pageSize: 7,
      });
      const rt = b.querySelector("#dqRetry");
      if (rt) rt.onclick = () => { toast("info", "Retrying sync", "POS Gateway (legacy) — re-pulling last 7 days…"); setTimeout(() => { A.SOURCES[5].fresh = "ok"; A.SOURCES[5].last = "Just now"; toast("ok", "Sync restored", "POS Gateway is healthy — 4,118 records reconciled, no duplicates."); A.logAudit({ time: "Just now", user: S.user.name, role: S.user.role, action: "Restored source", entity: "Source · POS Gateway (legacy)", prev: "Failed", next: "Healthy" }); renderBody(); }, 1800); };
    }
    /* ---------- import wizard ---------- */
    function setStep(n) {
      const steps = ["Upload", "Evaluate", "Preview", "Import"];
      root.querySelector("#impSteps").innerHTML = steps.map((s, i) => `<div class="st-step ${i === n ? "active" : i < n ? "done" : ""}"><span class="n">${i < n ? icon("check", "ic-14") : i + 1}</span>${s}${i < 3 ? `<span class="st-line"></span>` : ""}</div>`).join("");
      const body = root.querySelector("#impBody");
      if (n === 0) {
        body.innerHTML = `
          <section class="import-intro">
            <div>
              <div class="t">Upload a dataset</div>
              <div class="s">Finance Analytics detects the file structure, profiles the columns, checks data quality and prepares a clean preview before import.</div>
            </div>
            <div class="format-list"><span>CSV</span><span>XLSX</span><span>TSV</span><span>JSON</span></div>
          </section>
          <div class="dz" id="dz" ${locked() ? "style=\"opacity:.6;pointer-events:none\"" : ""}>
            <span class="dz-ico">${icon("upload", "ic-24")}</span>
            <b>Drop your dataset here</b>
            <p>or <u>browse files</u></p>
            <small>CSV, XLSX, XLS, TSV or JSON · up to 25 MB · first worksheet is used for Excel files</small>
          </div>
          <div class="import-help">
            <div><b>What happens next?</b><span>1. Parse & detect columns</span><span>2. Evaluate quality</span><span>3. Preview records</span><span>4. Import valid data</span></div>
            <button class="btn btn-s btn-sm" id="sample" ${locked() ? "disabled" : ""}>${icon("zap", "ic-14")} Try sample dataset</button>
          </div>
          <input type="file" id="fileIn" accept=".csv,.xlsx,.xls,.tsv,.json,.txt" class="hidden">`;
        const dz = body.querySelector("#dz");
        const handleFile = async f => {
          if (!f) return;
          try {
            toast("info", "Reading dataset", `${f.name} is being parsed…`);
            parsed = await parseDatasetFile(f);
            setStep(1);
          } catch (err) {
            console.error(err);
            toast("bad", "Could not read file", err.message || "The file format is not supported or is corrupted.");
          }
        };
        dz.onclick = () => !locked() && body.querySelector("#fileIn").click();
        body.querySelector("#fileIn").onchange = e => handleFile(e.target.files[0]);
        ["dragover", "dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => {
          e.preventDefault(); if (locked()) return;
          if (ev === "dragover") dz.classList.add("over");
          else if (ev === "dragleave") dz.classList.remove("over");
          else { dz.classList.remove("over"); handleFile(e.dataTransfer.files[0]); }
        }));
        body.querySelector("#sample").onclick = () => {
          parsed = parseDelimitedText(makeSampleCSV(), "revenue-sep-2026-sample.csv", ",", "CSV");
          toast("info", "Sample loaded", "300 rows loaded for evaluation.");
          setStep(1);
        };
      }
      if (n === 1) {
        const v = evaluateDataset(parsed);
        parsed.evaluation = v;
        body.innerHTML = `
          <div class="eval-head">
            <div><b>${UI.esc(parsed.name)}</b><span>${parsed.type} · ${v.total.toLocaleString("en-IN")} records · ${parsed.head.length} columns</span></div>
            <span class="badge ${v.errors ? "b-warn" : "b-ok"}">${v.errors ? icon("alerts", "ic-14") + " " + v.errors + " errors" : icon("check", "ic-14") + " Evaluation complete"}</span>
          </div>
          <div class="val-card" style="margin-bottom:14px">
            ${vc("Records", v.total, "var(--text-1)" )}${vc("Ready", v.valid, "var(--ok-ink)")}${vc("Errors", v.errors, "var(--bad-ink)")}${vc("Warnings", v.warnings, "var(--warn-ink)")}${vc("Missing cells", v.missing, "var(--warn-ink)")}${vc("Duplicate rows", v.duplicateRows, "var(--warn-ink)")}
          </div>
          <div class="eval-grid">
            <div class="card"><div class="card-h"><div><div class="t">Dataset profile</div><div class="s">Automatically inferred from the uploaded data</div></div></div><div class="card-b"><div class="profile-list">
              <div><span>Delimiter / format</span><b>${UI.esc(parsed.delimiterLabel || parsed.type)}</b></div>
              <div><span>Numeric columns</span><b>${v.numericColumns.length}</b></div>
              <div><span>Text / category columns</span><b>${v.textColumns.length}</b></div>
              <div><span>Date columns</span><b>${v.dateColumns.length}</b></div>
              ${v.primaryKey ? `<div><span>Likely identifier</span><b>${UI.esc(v.primaryKey)}</b></div>` : ""}
            </div></div></div>
            <div class="card"><div class="card-h"><div><div class="t">Quality checks</div><div class="s">Issues are shown before anything is imported</div></div></div><div class="card-b"><div class="quality-list">
              ${v.checks.map(c => `<div class="quality-item"><span class="qi ${c.status}">${icon(c.status === "pass" ? "check" : c.status === "warn" ? "alerts" : "x", "ic-14")}</span><div><b>${UI.esc(c.label)}</b><span>${UI.esc(c.detail)}</span></div></div>`).join("")}
            </div></div></div>
          </div>
          <div class="note" style="margin:14px 0">${icon("shield", "ic-14")}<span>Only valid rows are marked ready. Warnings remain importable; rows with blocking errors are excluded from the import count.</span></div>
          <div class="row" style="flex-wrap:wrap"><button class="btn btn-g" id="vBack">${icon("chevronLeft", "ic-14")} Choose another file</button>
            <button class="btn btn-s" id="vErr">${icon("download", "ic-14")} Download issue report</button><span class="grow"></span>
            <button class="btn btn-g" id="vCancel">Cancel</button><button class="btn btn-p" id="vNext" ${v.valid === 0 ? "disabled" : ""}>Continue to preview ${icon("chevronRight", "ic-14")}</button></div>`;
        body.querySelector("#vBack").onclick = () => setStep(0);
        body.querySelector("#vCancel").onclick = () => { parsed = null; setStep(0); toast("info", "Import cancelled", "No records were written."); };
        body.querySelector("#vErr").onclick = () => downloadIssueReport(parsed, v);
        body.querySelector("#vNext").onclick = () => setStep(2);
      }
      if (n === 2) {
        const v = parsed.evaluation || evaluateDataset(parsed);
        const badRows = parsed.rows.filter(r => r.__status !== "Valid").slice(0, 12);
        const goodRows = parsed.rows.filter(r => r.__status === "Valid");
        const showRows = badRows.concat(goodRows).slice(0, 50);
        body.innerHTML = `<div class="row row-between" style="margin-bottom:10px"><div><b class="small">Data preview</b><div class="small muted">Showing up to 50 records · flagged rows appear first</div></div><span class="badge b-info">${v.valid.toLocaleString("en-IN")} ready</span></div>
          <div class="table-wrap" id="pvTable"></div>
          <div class="row" style="margin-top:12px;flex-wrap:wrap"><button class="btn btn-g" id="pBack">${icon("chevronLeft", "ic-14")} Back to evaluation</button><span class="grow"></span><button class="btn btn-g" id="pCancel">Cancel</button><button class="btn btn-p" id="pNext">${icon("check", "ic-14")} Review import</button></div>`;
        table({
          el: "#pvTable",
          cols: parsed.head.map((h, i) => ({ k: h, label: h, align: v.numericColumns.includes(h) ? "r" : "l", render: r => UI.esc(r[i] == null ? "" : String(r[i])) }))
            .concat([{ k: "__status", label: "Evaluation", render: r => r.__status === "Valid" ? `<span class="badge b-ok"><span class="dot"></span> Ready</span>` : r.__status === "Warning" ? `<span class="badge b-warn">${icon("alerts", "ic-14")} ${UI.esc(r.__issue || "Warning")}</span>` : `<span class="badge b-bad">${icon("x", "ic-14")} ${UI.esc(r.__issue || "Error")}</span>` }]),
          rows: showRows, pageSize: 10, searchKeys: parsed.head.concat(["__status", "__issue"]),
          toolbar: `<span class="badge b-mut">${showRows.length} of ${parsed.rows.length} rows</span>`, dense: true,
        });
        body.querySelector("#pBack").onclick = () => setStep(1);
        body.querySelector("#pCancel").onclick = () => { parsed = null; setStep(0); toast("info", "Import cancelled", "No records were written."); };
        body.querySelector("#pNext").onclick = () => setStep(3);
      }
      if (n === 3) {
        const v = parsed.evaluation || evaluateDataset(parsed);
        body.innerHTML = parsed.__done ? `<div class="empty" style="padding:34px"><div class="e-ico" style="background:var(--ok-soft);color:var(--ok-ink)">${icon("check", "ic-24")}</div><b>${v.valid.toLocaleString("en-IN")} records imported</b><p>${v.total - v.valid} flagged rows excluded from import. The dataset profile and quality evaluation have been recorded.</p><div class="row gap-8" style="justify-content:center;margin-top:10px"><a class="btn btn-p" href="#/dashboard">View dashboard</a><button class="btn btn-s" id="qGo">Go to Data Quality</button></div></div>` : `
          <div class="row" style="gap:11px;margin-bottom:14px"><span class="sev-ico sev-medium">${icon("db")}</span><div><b>Ready to import</b><div class="small muted">${UI.esc(parsed.name)} · ${v.valid.toLocaleString("en-IN")} ready · ${v.total - v.valid} excluded</div></div></div>
          <dl class="kv" style="font-size:13px;margin-bottom:14px"><dt>Dataset</dt><dd>${UI.esc(parsed.type)} · ${parsed.head.length} columns</dd><dt>Conflict policy</dt><dd>Valid rows are imported; blocking errors remain excluded</dd><dt>Quality result</dt><dd>${v.errors} errors · ${v.warnings} warnings · ${v.missing} missing cells</dd></dl>
          <div class="row" style="flex-wrap:wrap"><button class="btn btn-g" id="iBack">${icon("chevronLeft", "ic-14")} Back to preview</button><span class="grow"></span><button class="btn btn-g" id="iCancel">Cancel</button><button class="btn btn-p" id="iGo">${icon("upload", "ic-14")} Import ${v.valid.toLocaleString("en-IN")} records</button></div>`;
        const qg = body.querySelector("#qGo"); if (qg) qg.onclick = () => { tab = "quality"; renderTabs(); renderBody(); };
        const back = body.querySelector("#iBack"); if (back) back.onclick = () => setStep(2);
        const cancel = body.querySelector("#iCancel"); if (cancel) cancel.onclick = () => { parsed.__done = false; parsed = null; setStep(0); toast("info", "Import cancelled", "No records were written."); };
        const go = body.querySelector("#iGo");
        if (go) go.onclick = () => {
          go.classList.add("loading");
          setTimeout(() => {
            parsed.__done = true;
            persistLatestDataset(parsed, v);
            A.IMPORTS.unshift({ file: parsed.name, type: parsed.type, date: "Just now", by: S.user.name, records: v.total, valid: v.valid, status: "Success" });
            persistImportState();
            A.logAudit({ time: "Just now", user: S.user.name, role: S.user.role, action: "Imported dataset", entity: "Data · " + parsed.name, next: v.valid.toLocaleString("en-IN") + " ready / " + (v.total - v.valid) + " excluded" });
            toast("ok", "Import complete", v.valid.toLocaleString("en-IN") + " records imported. Dashboard data updated.");
            setStep(3);
          }, 900);
        };
      }
    }

    function parseDelimitedText(text, name, delimiter, type) {
      const rows = parseDelimitedRows(String(text || ""), delimiter);
      if (!rows.length || !rows[0].some(Boolean)) throw new Error("The dataset is empty or has no header row.");
      const head = dedupeHeaders(rows.shift());
      const cleanRows = rows.filter(r => r.some(v => String(v ?? "").trim() !== ""));
      while (cleanRows.length && cleanRows[cleanRows.length - 1].length === 0) cleanRows.pop();
      cleanRows.forEach(r => { while (r.length < head.length) r.push(""); if (r.length > head.length) r.length = head.length; });
      return { name, type, delimiterLabel: delimiter === "\t" ? "Tab-separated" : "Comma-separated", head, rows: cleanRows };
    }

    function parseDelimitedRows(text, delimiter) {
      const out = [], row = []; let cell = "", quoted = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
          if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
          else cell += ch;
        } else if (ch === '"' && cell === "") quoted = true;
        else if (ch === delimiter) { row.push(cell); cell = ""; }
        else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); out.push(row.splice(0, row.length)); cell = ""; }
        else cell += ch;
      }
      if (cell !== "" || row.length) { row.push(cell.replace(/\r$/, "")); out.push(row); }
      return out;
    }

    function dedupeHeaders(headers) {
      const seen = Object.create(null);
      return headers.map((h, i) => {
        let base = String(h || "").trim().replace(/\s+/g, " ") || `Column ${i + 1}`;
        const key = base.toLowerCase(); seen[key] = (seen[key] || 0) + 1;
        return seen[key] > 1 ? `${base} (${seen[key]})` : base;
      });
    }

    async function parseDatasetFile(file) {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (ext === "xlsx") return parseXLSX(await file.arrayBuffer(), file.name);
      if (ext === "xls") {
        if (window.XLSX && typeof window.XLSX.read === "function") return parseSheetJS(await file.arrayBuffer(), file.name);
        throw new Error("Legacy .xls files require the Excel parser library. Please save the file as .xlsx or CSV and upload again.");
      }
      const text = await file.text();
      if (ext === "json") return parseJSON(text, file.name);
      const delimiter = ext === "tsv" ? "\t" : detectDelimiter(text);
      return parseDelimitedText(text, file.name, delimiter, delimiter === "\t" ? "TSV" : "CSV");
    }

    function detectDelimiter(text) {
      const first = String(text).split(/\r?\n/).find(x => x.trim()) || "";
      const candidates = [",", "\t", ";", "|"];
      return candidates.sort((a, b) => countDelimiter(first, b) - countDelimiter(first, a))[0];
    }
    function countDelimiter(line, delimiter) { let n = 0, q = false; for (let i = 0; i < line.length; i++) { if (line[i] === '"') q = !q; else if (!q && line[i] === delimiter) n++; } return n; }

    function parseJSON(text, name) {
      let data; try { data = JSON.parse(text); } catch { throw new Error("Invalid JSON. Please upload valid JSON data."); }
      if (!Array.isArray(data)) data = Array.isArray(data.data) ? data.data : [data];
      if (!data.length) throw new Error("The JSON dataset is empty.");
      const head = dedupeHeaders([...new Set(data.flatMap(x => x && typeof x === "object" ? Object.keys(x) : []))]);
      if (!head.length) throw new Error("JSON must contain objects with fields.");
      const rows = data.map(obj => head.map(h => obj && typeof obj === "object" ? obj[h] ?? "" : ""));
      return { name, type: "JSON", delimiterLabel: "Object array", head, rows };
    }

    function parseSheetJS(buffer, name) {
      const wb = window.XLSX.read(buffer, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]]; if (!ws) throw new Error("The Excel workbook has no worksheets.");
      const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
      return parseArrayRows(rows, name, "XLS");
    }

    async function parseXLSX(buffer, name) {
      const files = await unzipEntries(new Uint8Array(buffer));
      const shared = files["xl/sharedStrings.xml"] ? parseSharedStrings(await files["xl/sharedStrings.xml"]()) : [];
      const workbook = files["xl/workbook.xml"] ? await files["xl/workbook.xml"]() : "";
      const rels = files["xl/_rels/workbook.xml.rels"] ? await files["xl/_rels/workbook.xml.rels"]() : "";
      let sheetTarget = workbook.match(/<sheet\b[^>]*r:id="([^"]+)"[^>]*>/)?.[1] || "";
      let target = sheetTarget ? rels.match(new RegExp(`<Relationship\\b[^>]*Id="${sheetTarget}"[^>]*Target="([^"]+)"[^>]*/>`))?.[1] : "";
      target = target ? (target.startsWith("/") ? target.slice(1) : target.startsWith("xl/") ? target : `xl/${target.replace(/^\//, "")}`) : "";
      const sheetPath = (target && files[target]) ? target : (files["xl/worksheets/sheet1.xml"] ? "xl/worksheets/sheet1.xml" : Object.keys(files).find(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)));
      if (!sheetPath) throw new Error("The Excel workbook does not contain a readable worksheet.");
      const xml = await files[sheetPath]();
      const rows = parseWorksheet(xml, shared);
      return parseArrayRows(rows, name, "XLSX");
    }

    function parseArrayRows(rows, name, type) {
      const head = dedupeHeaders(rows[0] || []);
      if (!head.length) throw new Error("The worksheet is empty or has no header row.");
      const cleanRows = (rows.slice(1) || []).filter(r => r && r.some(v => String(v ?? "").trim() !== ""));
      cleanRows.forEach(r => { while (r.length < head.length) r.push(""); if (r.length > head.length) r.length = head.length; });
      return { name, type, delimiterLabel: "First worksheet", head, rows: cleanRows };
    }

    async function unzipEntries(bytes) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), files = {};
      let eocd = -1;
      for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      if (eocd < 0) throw new Error("Invalid XLSX ZIP container.");
      const count = view.getUint16(eocd + 10, true), cdOffset = view.getUint32(eocd + 16, true); let pos = cdOffset;
      const decoder = new TextDecoder("utf-8");
      for (let i = 0; i < count; i++) {
        if (view.getUint32(pos, true) !== 0x02014b50) break;
        const method = view.getUint16(pos + 10, true), csize = view.getUint32(pos + 20, true), nlen = view.getUint16(pos + 28, true), xlen = view.getUint16(pos + 30, true), clen = view.getUint16(pos + 32, true), local = view.getUint32(pos + 42, true);
        const name = decoder.decode(bytes.slice(pos + 46, pos + 46 + nlen));
        const ln = view.getUint16(local + 26, true), lx = view.getUint16(local + 28, true), dataStart = local + 30 + ln + lx;
        const compressed = bytes.slice(dataStart, dataStart + csize);
        files[name] = async () => { if (method === 0) return decoder.decode(compressed); if (method !== 8) throw new Error("Unsupported XLSX compression method."); const ds = new DecompressionStream("deflate-raw"); const stream = new Blob([compressed]).stream().pipeThrough(ds); return decoder.decode(new Uint8Array(await new Response(stream).arrayBuffer())); };
        pos += 46 + nlen + xlen + clen;
      }
      return files;
    }

    function decodeXML(s) { return String(s).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"); }
    function parseSharedStrings(xml) { return [...xml.matchAll(/<si[\s\S]*?<\/si>/g)].map(m => [...m[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => decodeXML(x[1])).join("")); }
    function colIndex(ref) { let m = String(ref).match(/[A-Z]+/i)?.[0] || "A"; let n = 0; for (const c of m.toUpperCase()) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; }
    function parseWorksheet(xml, shared) {
      const rows = [];
      for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
        const arr = []; for (const cm of rm[1].matchAll(/<c\s+([^>]*)>([\s\S]*?)<\/c>/g)) {
          const attrs = cm[1], body = cm[2], ref = attrs.match(/\br="([^"]+)"/i)?.[1] || `A${arr.length + 1}`, type = attrs.match(/\bt="([^"]+)"/i)?.[1] || "";
          let val = body.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "";
          if (type === "s") val = shared[Number(val)] ?? val;
          else if (type === "inlineStr") val = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => decodeXML(x[1])).join("");
          else if (type === "b") val = val === "1" ? "TRUE" : "FALSE";
          else val = decodeXML(val);
          arr[colIndex(ref)] = val;
        }
        rows.push(arr);
      }
      return rows;
    }

    function evaluateDataset(p) {
      const rows = p.rows, head = p.head, lower = head.map(h => h.toLowerCase());
      const finance = ["txn_id", "date", "revenue", "cost"].every(k => lower.includes(k));
      rows.forEach(r => { delete r.__status; delete r.__issue; });
      const stats = head.map((h, i) => profileColumn(h, rows.map(r => r[i])));
      const numericColumns = stats.filter(x => x.type === "numeric").map(x => x.name);
      const dateColumns = stats.filter(x => x.type === "date").map(x => x.name);
      const textColumns = stats.filter(x => x.type === "text").map(x => x.name);
      const primaryKey = stats.find(x => x.uniqueRatio >= .98 && x.nonEmpty > 0 && !numericColumns.includes(x.name))?.name || stats.find(x => /(^|_)(id|code|key)$/i.test(x.name) && x.nonEmpty)?.name || "";
      let missing = 0, duplicateRows = 0, errors = 0, warnings = 0;
      const seenRows = new Map();
      rows.forEach((r, ri) => {
        const key = JSON.stringify(r.map(v => String(v ?? "").trim()));
        if (seenRows.has(key)) { duplicateRows++; r.__status = "Error"; r.__issue = "duplicate row"; rows[seenRows.get(key)].__status = "Error"; rows[seenRows.get(key)].__issue = "duplicate row"; }
        else seenRows.set(key, ri);
        const miss = r.reduce((n, v) => n + (v == null || String(v).trim() === "" ? 1 : 0), 0); missing += miss;
        if (!r.__status && miss > 0) { r.__status = "Warning"; r.__issue = `${miss} missing value${miss > 1 ? "s" : ""}`; }
      });
      if (finance) {
        const idI = lower.indexOf("txn_id"), dateI = lower.indexOf("date"), revI = lower.indexOf("revenue"), costI = lower.indexOf("cost");
        const ids = new Map();
        rows.forEach(r => {
          const id = String(r[idI] ?? "").trim(); if (id && ids.has(id)) { r.__status = "Error"; r.__issue = "duplicate txn_id"; rows[ids.get(id)].__status = "Error"; rows[ids.get(id)].__issue = "duplicate txn_id"; } else if (id) ids.set(id, rows.indexOf(r));
          const d = String(r[dateI] ?? "").trim(); if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d) && !/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(d)) { r.__status = "Error"; r.__issue = "invalid date"; }
          const rev = Number(String(r[revI] ?? "").replace(/,/g, "")), cost = Number(String(r[costI] ?? "").replace(/,/g, ""));
          if (String(r[revI] ?? "").trim() !== "" && !Number.isFinite(rev)) { r.__status = "Error"; r.__issue = "revenue is not numeric"; }
          else if (Number.isFinite(rev) && rev < 0) { r.__status = "Error"; r.__issue = "negative revenue"; }
          if (String(r[costI] ?? "").trim() !== "" && !Number.isFinite(cost)) { r.__status = "Error"; r.__issue = "cost is not numeric"; }
        });
      }
      rows.forEach(r => { if (r.__status === "Error") errors++; else if (r.__status === "Warning") warnings++; else r.__status = "Valid"; });
      const checks = [
        { label: "Structure", status: head.length && rows.length ? "pass" : "bad", detail: `${head.length} columns and ${rows.length.toLocaleString("en-IN")} records detected` },
        { label: "Missing values", status: missing ? "warn" : "pass", detail: missing ? `${missing.toLocaleString("en-IN")} empty cells found` : "No empty cells detected" },
        { label: "Duplicate records", status: duplicateRows ? "warn" : "pass", detail: duplicateRows ? `${duplicateRows} duplicate rows flagged` : "No exact duplicate rows found" },
        { label: "Numeric quality", status: stats.some(x => x.type === "numeric" && x.invalid > 0) ? "warn" : "pass", detail: stats.some(x => x.type === "numeric" && x.invalid > 0) ? "Some numeric columns contain non-numeric values" : `${numericColumns.length} numeric columns profiled` },
        { label: "Date quality", status: dateColumns.length ? "pass" : "warn", detail: dateColumns.length ? `${dateColumns.length} date column${dateColumns.length > 1 ? "s" : ""} detected` : "No date column detected" },
      ];
      if (finance) checks.push({ label: "Finance rules", status: errors ? "bad" : "pass", detail: errors ? "Transaction/date/revenue rules flagged blocking rows" : "Transaction schema checks passed" });
      return { total: rows.length, errors, warnings, missing, duplicateRows, valid: rows.length - errors, numericColumns, dateColumns, textColumns, primaryKey, stats, checks };
    }

    function profileColumn(name, values) {
      const nonEmpty = values.filter(v => v != null && String(v).trim() !== ""), normalized = nonEmpty.map(v => String(v).trim());
      const unique = new Set(normalized).size, numeric = normalized.filter(v => Number.isFinite(Number(v.replace(/,/g, "")))).length;
      const date = normalized.filter(v => !Number.isNaN(Date.parse(v)) && /[-/]/.test(v)).length;
      const type = !nonEmpty.length ? "text" : numeric / nonEmpty.length >= .85 ? "numeric" : date / nonEmpty.length >= .85 ? "date" : "text";
      return { name, nonEmpty: nonEmpty.length, uniqueRatio: nonEmpty.length ? unique / nonEmpty.length : 0, type, invalid: type === "numeric" ? nonEmpty.length - numeric : 0 };
    }

    function downloadIssueReport(p, v) {
      const rows = p.rows.filter(r => r.__status !== "Valid");
      const escCSV = x => `"${String(x ?? "").replace(/"/g, '""')}"`;
      const body = [p.head.concat(["issue", "status"]).map(escCSV).join(",")].concat(rows.map(r => p.head.map((_, i) => escCSV(r[i])).concat([escCSV(r.__issue), escCSV(r.__status)]).join(","))).join("\n");
      UI.downloadFile(`issue-report-${p.name.replace(/\.[^.]+$/, "")}.csv`, body, "text/csv");
      toast("ok", "Issue report downloaded", `${rows.length} flagged rows exported.`);
    }
    root.innerHTML = head2("Data Management", "Upload, evaluate and import datasets with automatic profiling, quality checks and a clean preview.",
      `<span class="badge b-mut">6 sources · nightly sync 02:00–06:00 IST</span>`) +
      `<div class="tabs" id="dtTabs"></div><div id="dtBody"></div>`;
    renderTabs();
    renderBody();
  };
  function dkpi(label, value, sub, ico) {
    return `<div class="kpi"><div class="kpi-top"><span class="kpi-label">${label}</span><span class="kpi-ico tint">${icon(ico)}</span></div><div class="kpi-value" style="font-size:22px">${value}</div><div class="kpi-sub">${sub}</div></div>`;
  }
  function qtile(label, v, st) {
    return `<div class="kpi" style="display:flex;gap:12px;align-items:center;padding:12px 14px">${ring(v, 46, st === "Watch" ? getCss("--warn") : getCss("--ok"))}<div><div class="kpi-label" style="margin-bottom:2px">${label}</div><b class="num" style="font-size:15px">${v}%</b><div class="small muted" style="font-size:11px">${st}</div></div></div>`;
  }
  function vc(label, v, color) {
    return `<div class="vc"><span>${label}</span><b style="color:${color}">${Number(v).toLocaleString("en-IN")}</b></div>`;
  }

  /* ============================================================
     SETTINGS
     ============================================================ */
  P.settings = function (root) {
    const u = S.user;
    const notifs = S.notifs || { email: true, budget: true, forecast: true, data: false };
    const secure = ["Administrator", "CFO"].includes(u.role);
    const adminish = u.role !== "Viewer";
    function sections() {
      return {
        "Profile": `<div class="field" style="max-width:420px"><span class="f-label">Full name</span><input class="input" id="setN" value="${esc(u.name)}"></div>
          <div class="field" style="max-width:420px;margin-top:12px"><span class="f-label">Role (demo — controls permissions across the app)</span><select class="select" id="setR">${A.REPORTS && APP.ROLES.map(r => `<option ${r.name === u.name ? "selected" : ""}>${r.name} — ${r.role}</option>`).join("")}</select></div>
          <div class="field" style="max-width:420px;margin-top:12px"><span class="f-label">Email</span><input class="input" id="setE" value="${esc(u.email)}"></div>
          <div class="row" style="margin-top:16px"><button class="btn btn-p" id="setSave" ${locked() ? "disabled" : ""}>Save profile</button><span class="small muted">Changing role immediately updates what you can do in this demo.</span></div>`,
        "Company": `<div class="kv"><dt>Company</dt><dd>Finance Analytics Platform</dd><dt>Industry</dt><dd>Retail &amp; E-Commerce</dd><dt>Entity</dt><dd>Finance Analytics Platform Pvt. Ltd. (fictional)</dd><dt>Headquarters</dt><dd>Hyderabad, Telangana, IN</dd><dt>Financial year</dt><dd>April – March</dd><dt>Default currency</dt><dd>₹ INR (Indian Rupee)</dd></div><div class="note" style="margin-top:14px">${icon("shield", "ic-14")}<span>Company profile is managed by the system administrator. All data in this environment is fictional.</span></div>`,
        "Financial Configuration": `<div class="field" style="max-width:420px"><span class="f-label">Currency</span><select class="select" disabled><option>₹ INR — Indian Rupee</option></select><div class="f-err" style="color:var(--text-4)">${icon("lock", "ic-14")}<span>Locked — currency is set at the tenant level</span></div></div>
          <div class="field" style="max-width:420px;margin-top:12px"><span class="f-label">Financial year start</span><select class="select" disabled><option>April (Apr – Mar)</option></select></div>
          <div class="field" style="max-width:420px;margin-top:12px"><span class="f-label">Variance threshold (%)</span><input class="input num" id="setThr" type="number" min="1" max="25" value="5"><div class="small muted" style="margin-top:5px">Departments within ±5% of plan are treated as “neutral” in Variance Analysis.</div></div>
          <div class="row" style="margin-top:16px"><button class="btn btn-p" id="setFin" ${locked() ? "disabled" : ""}>Save configuration</button></div>`,
        "Notifications": [["email", "Email alerts", "Daily digest of KPI movements and exceptions"], ["budget", "Budget alerts", "Immediate alert when a department breaches its budget"], ["forecast", "Forecast alerts", "When the model re-runs or accuracy degrades beyond 7% MAPE"], ["data", "Data-quality alerts", "When an import quarantines > 1% of rows or a source fails"]].map(([k, t, d]) => `<div class="row row-between" style="padding:11px 0;border-bottom:1px solid var(--border)"><div><b class="small">${t}</b><div class="small muted">${d}</div></div><button class="switch ${notifs[k] ? "on" : ""}" role="switch" aria-checked="${!!notifs[k]}" id="sw-${k}" ${locked() ? "disabled" : ""} aria-label="${t}"></button></div>`).join("") + `<div class="row" style="margin-top:14px"><button class="btn btn-p" id="setNotif" ${locked() ? "disabled" : ""}>Save preferences</button></div>`,
        "Security": `${secure ? "" : `<div class="note" style="margin-bottom:14px">${icon("lock", "ic-14")}<span>Security settings are editable by <b>Administrator</b> and <b>CFO</b> roles. Your current role (<b>${u.role}</b>) has read-only access.</span></div>`}
          <div class="row row-between" style="padding:11px 0;border-bottom:1px solid var(--border)"><div><b class="small">Two-factor authentication</b><div class="small muted">TOTP app required at sign-in · recommended for all roles</div></div><button class="switch on" id="sw-2fa" role="switch" aria-checked="true" ${locked || !secure ? "disabled" : ""} aria-label="Two-factor authentication"></button></div>
          <div class="field" style="max-width:420px;margin-top:16px"><span class="f-label">Current password</span><input class="input" type="password" id="pwCur" placeholder="••••••••" ${!adminish ? "disabled" : ""}></div>
          <div class="row gap-10" style="max-width:520px;margin-top:10px;flex-wrap:wrap"><div class="field grow" style="min-width:180px"><span class="f-label">New password</span><input class="input" type="password" id="pwNew" ${!adminish ? "disabled" : ""}></div><div class="field grow" style="min-width:180px"><span class="f-label">Confirm</span><input class="input" type="password" id="pwCon" ${!adminish ? "disabled" : ""}></div></div>
          <div class="f-err hidden" id="pwErr" style="margin-top:8px"></div>
          <div class="row" style="margin-top:12px"><button class="btn btn-p" id="pwSave" ${!adminish ? "disabled" : ""}>Update password</button></div>
          <b class="small" style="display:block;margin:18px 0 8px">Active sessions</b>
          <div id="sessList">${[["Chrome · Windows", "Hyderabad, IN", "103.147.9.41", "Active now"], ["Safari · iPhone 15", "Hyderabad, IN", "103.147.9.87", "Today, 08:12"], ["Edge · Windows", "Bangalore, IN", "49.36.211.20", "Sep 30, 19:40"]].map(s => `<div class="row row-between" style="padding:9px 0;border-bottom:1px solid var(--border);font-size:13px"><div class="row gap-10"><span class="sev-ico sev-medium">${icon("card", "ic-16")}</span><div><b style="font-weight:600">${s[0]}</b><div class="small muted">${s[1]} · ${s[2]} · ${s[3]}</div></div></div><button class="btn btn-g btn-sm" data-rev="${s[0]}" ${!adminish ? "disabled" : ""}>Revoke</button></div>`).join("")}</div>`,
        "Audit Log": `<div class="note" style="margin-bottom:14px">${icon("history", "ic-14")}<span>Immutable trail of who changed what and when. Budget edits, imports, forecast runs, alert resolutions and setting changes are all recorded — new entries appear live as you use the app.</span></div><div class="table-wrap" id="audTable"></div>`,
      };
    }
    function draw(key) {
      const secs = sections();
      root.querySelector("#setBody").innerHTML = `<h3 style="font-size:16px;margin-bottom:4px">${key}</h3><div class="divider"></div>${secs[key]}`;
      wire(key);
    }
    function wire(key) {
      const b = root.querySelector("#setBody");
      if (key === "Profile") {
        b.querySelector("#setSave").onclick = () => {
          const sel = b.querySelector("#setR").value;
          const r = APP.ROLES.find(x => x.name + " — " + x.role === sel) || APP.ROLES[0];
          S.user = { name: b.querySelector("#setN").value || r.name, role: r.role, email: b.querySelector("#setE").value || r.email };
          sessionStorage.setItem("av.user", JSON.stringify(S.user));
          localStorage.setItem("av.user", JSON.stringify(S.user));
          A.logAudit({ time: "Just now", user: S.user.name, role: S.user.role, action: "Updated profile", entity: "User · " + S.user.name, prev: "—", next: S.user.role });
          toast("ok", "Profile saved", "Welcome, " + S.user.name + " (" + S.user.role + ").");
          APP.route(true);
        };
      }
      if (key === "Financial Configuration") {
        b.querySelector("#setFin").onclick = () => {
          const v = +b.querySelector("#setThr").value;
          S.threshold = v; A.logAudit({ time: "Just now", user: S.user.name, role: S.user.role, action: "Changed financial threshold", entity: "Settings · Variance", prev: "±5%", next: "±" + v + "%" });
          toast("ok", "Configuration saved", "Variance threshold set to ±" + v + "% for Variance Analysis.");
        };
      }
      if (key === "Notifications") {
        b.querySelectorAll("[id^='sw-']").forEach(sw => sw.onclick = () => { sw.classList.toggle("on"); sw.setAttribute("aria-checked", sw.classList.contains("on")); });
        b.querySelector("#setNotif").onclick = () => {
          S.notifs = {}; b.querySelectorAll("[id^='sw-']").forEach(sw => S.notifs[sw.id.slice(3)] = sw.classList.contains("on"));
          persist(); toast("ok", "Preferences saved", "Notification routing updated.");
        };
      }
      if (key === "Security") {
        const sw2 = b.querySelector("#sw-2fa"); if (sw2) sw2.onclick = () => { sw2.classList.toggle("on"); toast(sw2.classList.contains("on") ? "ok" : "warn", "2FA " + (sw2.classList.contains("on") ? "enabled" : "disabled"), sw2.classList.contains("on") ? "TOTP will be required at next sign-in." : "Sign-in now uses password only — not recommended."); };
        const ps = b.querySelector("#pwSave");
        if (ps) ps.onclick = () => {
          const c = b.querySelector("#pwCur").value, n = b.querySelector("#pwNew").value, o = b.querySelector("#pwCon").value;
          const err = b.querySelector("#pwErr");
          const fail = msg => { err.textContent = msg; err.classList.remove("hidden"); return; };
          if (n.length < 8) fail("New password must be at least 8 characters.");
          else if (n !== o) fail("Passwords do not match.");
          else { err.classList.add("hidden"); ps.classList.add("loading"); setTimeout(() => { ps.classList.remove("loading"); toast("ok", "Password updated", "Other sessions remain active until revoked."); A.logAudit({ time: "Just now", user: S.user.name, role: S.user.role, action: "Changed password", entity: "Security · " + S.user.email }); b.querySelector("#pwCur").value = b.querySelector("#pwNew").value = b.querySelector("#pwCon").value = ""; }, 800); }
        };
        b.querySelectorAll("[data-rev]").forEach(x => x.onclick = () => UI.confirm({ title: "Revoke session?", danger: true, okLabel: "Revoke", body: `Sign out <b>${x.dataset.rev}</b>? The user will need to sign in again (2FA required).`, onOk: () => { x.closest(".row").remove(); toast("ok", "Session revoked", x.dataset.rev + " signed out."); A.logAudit({ time: "Just now", user: S.user.name, role: S.user.role, action: "Revoked session", entity: "Security · " + x.dataset.rev }); } }));
      }

      if (key === "Audit Log") {
        table({
          el: "#audTable",
          cols: [
            { k: "time", label: "Timestamp" }, { k: "user", label: "User", render: r => `<b>${r.user}</b> <span class="muted small">(${r.role})</span>` },
            { k: "action", label: "Action" }, { k: "entity", label: "Entity" },
            { k: "prev", label: "Previous value", render: r => `<span class="muted">${r.prev}</span>` },
            { k: "next", label: "New value", render: r => `<b>${r.next}</b>` },
            { k: "status", label: "Status", render: r => `<span class="badge ${r.status === "Success" || r.status === "Approved" ? "b-ok" : r.status === "Auto" ? "b-info" : "b-mut"}"><span class="dot"></span> ${r.status}</span>` },
          ],
          rows: A.getAudit().slice(), searchKeys: ["user", "action", "entity"], exportName: "revenue-bi-audit-log",
          toolbar: `<span class="badge b-mut">${A.getAudit().length} events · live</span>`,
        });
      }
    }
    const keys = Object.keys(sections());
    root.innerHTML = head2("Settings", "Profile, company, financial configuration, notifications and security.",
      `<span class="badge b-mut">${icon("shield", "ic-14")} ${u.role} role</span>`) +
      `<div class="grid"><div class="c-3"><div class="card" style="position:sticky;top:80px"><div class="card-b" style="padding:8px">${keys.map(k => `<button class="sb-link ${k === "Profile" ? "active" : ""}" data-set="${k}" style="width:100%">${icon({ "Profile": "users", "Company": "box", "Financial Configuration": "scale", "Notifications": "bell", "Security": "shield", "Audit Log": "history" }[k])}<span class="sb-label">${k}</span></button>`).join("")}</div></div></div>
      <div class="c-9"><div class="card"><div class="card-b" style="padding-top:20px" id="setBody"></div></div></div></div>`;
    draw("Profile");
    root.querySelectorAll("[data-set]").forEach(b => b.onclick = () => {
      root.querySelectorAll("[data-set]").forEach(x => x.classList.toggle("active", x === b));
      draw(b.dataset.set);
    });
  };
})();
