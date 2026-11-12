/* ============================================================
   REVENUE FORECASTING & BUSINESS INTELLIGENCE — core: icons · UI kit · charts
   ============================================================ */
(function () {
  "use strict";
  const A = window.AV;

  /* ---------------- icon sprite ---------------- */
  const PATHS = {
    dashboard: '<rect x="3" y="3" width="7.5" height="9" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="1.6"/><rect x="13.5" y="12" width="7.5" height="9" rx="1.6"/><rect x="3" y="15.5" width="7.5" height="5.5" rx="1.6"/>',
    revenue: '<path d="M3 17.5 9.5 11l4 4L21 7.5"/><path d="M15.5 7.5H21V13"/>',
    expense: '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 9.5h19"/><path d="M6.5 14.5h4"/>',
    product: '<path d="m12 2.8 8.5 4.9v8.6L12 21.2l-8.5-4.9V7.7L12 2.8Z"/><path d="M3.8 7.9 12 12.6l8.2-4.7"/><path d="M12 12.6v8.4"/>',
    region: '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
    budget: '<path d="M20 7H4a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 4 19h16a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 20 7Z"/><path d="M2.5 11h19"/><circle cx="16.8" cy="14.6" r="1.1"/>',
    variance: '<path d="M12 3v18"/><path d="M5 7h4M5 7 3 5.5M5 7l2-1.5"/><path d="M15 17h4m0 0-2-1.5m2 1.5-2 1.5"/><path d="M4 3.5h16" opacity=".45"/>',
    forecast: '<path d="M3 20h18"/><path d="M4.5 16.5 9 12l3.5 3 6-6.5" /><path d="M15 8.5h3.5V12" stroke-dasharray="0" /><path d="M4.5 12V4.5" opacity=".0"/>',
    reports: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M8.5 13h7M8.5 16.5h7M8.5 9.5h2"/>',
    insights: '<path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9L12 2.5Z"/><path d="M19 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z"/>',
    alerts: '<path d="M12 3 2.8 19.5h18.4L12 3Z"/><path d="M12 10v4.2"/><circle cx="12" cy="17" r=".4"/>',
    data: '<ellipse cx="12" cy="5.5" rx="8" ry="2.8"/><path d="M4 5.5v13c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8v-13"/><path d="M4 12c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8"/>',
    quality: '<path d="M12 2.8 4.5 6v5.2c0 4.6 3.2 8.4 7.5 9.6 4.3-1.2 7.5-5 7.5-9.6V6L12 2.8Z"/><path d="m8.8 11.8 2.2 2.2 4.4-4.6"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4L9.6 5.1a7.6 7.6 0 0 0-2.6 1.5l-2.4-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.5Z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.3 9.2a2.8 2.8 0 0 1 5.5.9c0 1.9-2.8 2.4-2.8 4"/><circle cx="12" cy="17.2" r=".4"/>',
    bell: '<path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9Z"/><path d="M10 19.5a2.2 2.2 0 0 0 4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.6-4.6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronLeft: '<path d="m15 6-6 6 6 6"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m4.5 12.5 5 5 10-11"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M12 3.5V15m0 0 4.5-4.5M12 15 7.5 10.5"/><path d="M4 17.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-1.5"/>',
    upload: '<path d="M12 15V3.5m0 0L7.5 8M12 3.5 16.5 8"/><path d="M4 17.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-1.5"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 3.5V8h-4.5"/>',
    filter: '<path d="M4 5.5h16l-6.2 7.2v5.1L10.2 20v-7.3L4 5.5Z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    eye: '<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
    eyeOff: '<path d="M4 4l16 16"/><path d="M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 9.5 7 9.5 7a17.6 17.6 0 0 1-2.7 3.6M6.6 6.9A17 17 0 0 0 2.5 12S6 19 12 19a9.4 9.4 0 0 0 4.3-1"/><path d="M9.5 9.8a2.9 2.9 0 0 0 4 4.1"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 1 1 8 0v2.5"/>',
    logout: '<path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14"/><path d="m10 12h10.5m0 0-3.5-3.5m3.5 3.5-3.5 3.5"/>',
    more: '<circle cx="5" cy="12" r=".6"/><circle cx="12" cy="12" r=".6"/><circle cx="19" cy="12" r=".6"/>',
    trendUp: '<path d="M3 17.5 9.5 11l4 4L21 7.5"/><path d="M15.5 7.5H21V13"/>',
    trendDown: '<path d="M3 6.5 9.5 13l4-4L21 16.5"/><path d="M15.5 16.5H21V11"/>',
    scale: '<path d="M12 3.5v17"/><path d="M5.5 6.5h13"/><path d="m5.5 6.5-2.7 6a3 3 0 0 0 5.4 0l-2.7-6ZM18.5 6.5l-2.7 6a3 3 0 0 0 5.4 0l-2.7-6Z"/><path d="M8.5 20.5h7"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.9L12 3.5Z"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.5"/><path d="M16 14.6c2.3.2 4 1.8 4.5 4.4"/>',
    shield: '<path d="M12 2.8 4.5 6v5.2c0 4.6 3.2 8.4 7.5 9.6 4.3-1.2 7.5-5 7.5-9.6V6L12 2.8Z"/>',
    card: '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 9.5h19"/>',
    cart: '<circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17.5" cy="19.5" r="1.4"/><path d="M3 4h2.5l2.3 11h10.4l2.3-8H6.2"/>',
    db: '<ellipse cx="12" cy="5.5" rx="8" ry="2.8"/><path d="M4 5.5v13c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8v-13"/><path d="M4 12c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8"/>',
    piggy: '<path d="M4.5 11.5a7.5 7.5 0 0 1 15 0v1a7.5 7.5 0 0 1-1.6 4.7l.4 2.3h-3l-.6-1.4a7.5 7.5 0 0 1-2.4.4c-.5 0-1-.1-1.4-.2l-.7 1.2h-3l.4-2.2A7.5 7.5 0 0 1 4.5 12.5v-1Z"/><circle cx="15" cy="11" r=".5"/><path d="M9 11.5h.01"/>',
    trending: '<path d="M3 17.5 9.5 11l4 4L21 7.5"/><path d="M15.5 7.5H21V13"/>',
    trendingDown: '<path d="M3 6.5 9.5 13l4-4L21 16.5"/><path d="M15.5 16.5H21V11"/>',
    box: '<path d="m12 2.8 8.5 4.9v8.6L12 21.2l-8.5-4.9V7.7L12 2.8Z"/><path d="M3.8 7.9 12 12.6l8.2-4.7"/><path d="M12 12.6v8.4"/>',
    map: '<path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z"/><path d="M9 4v13M15 6.5v13"/>',
    plug: '<path d="M9 7V3.5M15 7V3.5"/><path d="M6.5 7h11v4a5.5 5.5 0 0 1-11 0V7Z"/><path d="M12 16.5V20"/>',
    external: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M19.5 13.5v4a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h4"/>',
    edit: '<path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17 4 20Z"/><path d="m14.5 8 3 3"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
    trash: '<path d="M4 6.5h16"/><path d="M9 6.5V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8v1.7"/><path d="M6 6.5 7 20a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 20l1-13.5"/><path d="M10 10.5v6.5M14 10.5v6.5"/>',
    file: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8l-5-5Z"/><path d="M14 3v5h5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    dot: '<circle cx="12" cy="12" r="4"/>',
    zap: '<path d="M13 2.5 4.5 13.5H11l-1 8L19.5 10.5H13l1-8Z"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5M7 2.5V6M17 2.5V6M7 18v3.5M17 18v3.5"/>',
    history: '<path d="M4 12a8 8 0 1 1 2.3 5.6"/><path d="M4 12H2.5M4 12l-1.8 2"/><path d="M12 8v4.5l3 1.8"/>',
  };
  function icon(name, cls) {
    return `<svg class="ic ${cls || ""}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] || PATHS.dot}</svg>`;
  }

  /* ---------------- state ---------------- */
  const S = {
    user: JSON.parse(sessionStorage.getItem("av.user") || localStorage.getItem("av.user") || "null"),
    period: localStorage.getItem("av.period") || "t12m",
    filters: JSON.parse(localStorage.getItem("av.filters") || '{"region":"","dept":"","category":"","product":""}'),
    theme: localStorage.getItem("av.theme") || "light",
    savedViews: JSON.parse(localStorage.getItem("av.views") || "null") || {
      "Executive View": { period: "t12m", region: "", dept: "", category: "" },
      "Finance View": { period: "t12m", region: "", dept: "", category: "" },
      "Marketing View": { period: "t12m", region: "", dept: "Marketing", category: "" },
      "Operations View": { period: "t6m", region: "", dept: "Operations", category: "" },
    },
  };
  function persist() {
    localStorage.setItem("av.period", S.period);
    localStorage.setItem("av.filters", JSON.stringify(S.filters));
    localStorage.setItem("av.theme", S.theme);
    localStorage.setItem("av.views", JSON.stringify(S.savedViews));
  }
  function applyTheme() { document.documentElement.setAttribute("data-theme", S.theme); }
  applyTheme();

  /* ---------------- toasts ---------------- */
  let toastsEl;
  function toast(type, title, body) {
    if (!toastsEl) { toastsEl = document.createElement("div"); toastsEl.className = "toasts"; toastsEl.setAttribute("aria-live", "polite"); document.body.appendChild(toastsEl); }
    const t = document.createElement("div");
    t.className = "toast " + type;
    t.innerHTML = `<div class="t-ico">${icon(type === "ok" ? "check" : type === "bad" ? "x" : type === "warn" ? "alerts" : "insights", "ic-16")}</div>
      <div style="flex:1;min-width:0"><b>${title}</b>${body ? `<p>${body}</p>` : ""}</div>
      <button class="x" aria-label="Dismiss">${icon("x", "ic-14")}</button>`;
    toastsEl.appendChild(t);
    const kill = () => { t.style.transition = "opacity .25s, transform .25s"; t.style.opacity = "0"; t.style.transform = "translateY(6px)"; setTimeout(() => t.remove(), 260); };
    t.querySelector(".x").onclick = kill;
    setTimeout(kill, 4600);
  }

  /* ---------------- modal ---------------- */
  function modal(opts) {
    // opts: {title, sub, body(html), foot(html), size, onOpen, closable}
    const ov = document.createElement("div");
    ov.className = "m-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", opts.title || "Dialog");
    ov.innerHTML = `<div class="m-box ${opts.size || ""}">
      <div class="m-h">${opts.title ? `<div><h3>${opts.title}</h3>${opts.sub ? `<div class="small muted" style="margin-top:2px">${opts.sub}</div>` : ""}</div>` : ""}
      ${opts.closable === false ? "" : `<button class="x btn-icon" aria-label="Close">${icon("x", "ic-16")}</button>`}</div>
      <div class="m-b">${opts.body || ""}</div>
      ${opts.foot ? `<div class="m-f">${opts.foot}</div>` : ""}</div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("open"));
    function close() { ov.classList.remove("open"); setTimeout(() => ov.remove(), 180); document.removeEventListener("keydown", esc); }
    function esc(e) { if (e.key === "Escape" && opts.closable !== false) close(); }
    document.addEventListener("keydown", esc);
    ov.addEventListener("mousedown", e => { if (e.target === ov && opts.closable !== false) close(); });
    const x = ov.querySelector(".x"); if (x) x.onclick = close;
    return { el: ov, close, body: ov.querySelector(".m-b"), foot: ov.querySelector(".m-f") };
  }
  function confirmDlg({ title, body, okLabel = "Confirm", danger = false, onOk }) {
    const m = modal({
      title, size: "sm",
      body: `<p style="line-height:1.55">${body}</p>`,
      foot: `<button class="btn btn-g" data-a="cancel">Cancel</button><button class="btn ${danger ? "btn-d" : "btn-p"}" data-a="ok">${okLabel}</button>`,
      onOpen() {
        m.foot.querySelector('[data-a="cancel"]').onclick = () => m.close();
        const ok = m.foot.querySelector('[data-a="ok"]'); ok.onclick = () => { m.close(); onOk && onOk(); };
        m.foot.querySelector("button").focus();
      },
    });
    m.onOpen = onOpen; if (m.onOpen) m.onOpen();
  }

  /* ---------------- drawer ---------------- */
  function drawer({ title, sub, body, foot, onClose }) {
    const ov = document.createElement("div");
    ov.className = "d-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
    ov.innerHTML = `<div class="d-panel"><div class="d-h"><div><h3>${title}</h3>${sub ? `<div class="small muted">${sub}</div>` : ""}</div>
      <button class="x btn-icon" aria-label="Close" style="margin-left:auto">${icon("x", "ic-16")}</button></div>
      <div class="d-b">${body}</div>${foot ? `<div class="d-f">${foot}</div>` : ""}</div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("open"));
    function close() { ov.classList.remove("open"); setTimeout(() => ov.remove(), 200); onClose && onClose(); }
    ov.querySelector(".x").onclick = close;
    ov.addEventListener("mousedown", e => { if (e.target === ov) close(); });
    const esc = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", esc);
    ov.addEventListener("removeEventListener");
    return { el: ov, close, body: ov.querySelector(".d-b") };
  }

  /* ---------------- dropdown menu ---------------- */
  function menu(anchor, items, align) {
    let el = document.querySelector(".dd");
    if (el) el.remove();
    el = document.createElement("div");
    el.className = "dd " + (align || "");
    el.innerHTML = items.map(it => it === "hr" ? "<hr>" :
      `<button data-m="${it.id || ""}" class="${it.danger ? "danger" : ""}">${icon(it.icon || "dot", "ic-16")} ${it.label}${it.hint ? `<span class="muted2 small" style="margin-left:auto">${it.hint}</span>` : ""}</button>`).join("");
    if (anchor.style) anchor.style.position = "relative";
    anchor.appendChild(el);
    requestAnimationFrame(() => el.classList.add("open"));
    el.querySelectorAll("button").forEach(b => b.onclick = () => { el.remove(); items.find(i => (i.id || "") === b.dataset.m)?.action(); });
    setTimeout(() => document.addEventListener("mousedown", function h(e) { if (!anchor.contains(e.target)) { el.remove(); document.removeEventListener("mousedown", h); } }), 0);
  }

  /* ---------------- sparkline / ring (SVG) ---------------- */
  function spark(vals, w = 84, h = 26, color) {
    const min = Math.min(...vals), max = Math.max(...vals), r = max - min || 1;
    const pts = vals.map((v, i) => [i / (vals.length - 1) * (w - 4) + 2, h - 3 - (v - min) / r * (h - 8)]);
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const c = color || getCss("--chart-1");
    const area = d + ` L${pts[pts.length - 1][0].toFixed(1)} ${h - 1} L${pts[0][0].toFixed(1)} ${h - 1} Z`;
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${area}" fill="${c}" opacity=".1"/><path d="${d}" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/><circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="2.2" fill="${c}"/></svg>`;
  }
  function ring(pct, size = 44, color, label) {
    const r = (size - 8) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.min(pct, 100) / 100);
    const col = color || (pct > 100 ? getCss("--bad") : pct >= 95 ? getCss("--warn") : pct >= 75 ? getCss("--primary") : getCss("--ok"));
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${pct.toFixed(0)} percent">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${getCss("--ring-track")}" stroke-width="5"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
      <text x="50%" y="50%" dy=".34em" text-anchor="middle" font-size="${size / 3.9}" font-weight="700" fill="${getCss("--text-1")}" font-family="inherit">${label != null ? label : Math.round(pct) + "%"}</text></svg>`;
  }

  /* ---------------- chart engine (Plotly) ---------------- */
  function getCss(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function axisCfg() {
    const grid = getCss("--grid"), t3 = getCss("--text-3");
    return {
      gridcolor: grid, zerolinecolor: grid, linecolor: getCss("--border"),
      tickfont: { family: "Inter, sans-serif", size: 11, color: t3 },
      titlefont: { family: "Inter, sans-serif", size: 11, color: t3 },
      color: t3,
    };
  }
  function baseLayout(extra) {
    return Object.assign({
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: "Inter, sans-serif", size: 12, color: getCss("--text-2") },
      margin: { l: 58, r: 14, t: 10, b: 34 },
      hovermode: "closest", showlegend: false, dragmode: false,
      xaxis: Object.assign({ automargin: true }, axisCfg()),
      yaxis: Object.assign({ automargin: true }, axisCfg()),
    }, extra || {});
  }
  const CH_CFG = { displayModeBar: false, responsive: true };
  function render(el, data, layout) {
    if (!el) return;
    if (!window.Plotly) { el.innerHTML = `<div class="chart-fallback">Charts unavailable offline.</div>`; return; }
    if (el.dataset && el.dataset.animateChart === "true" && !el.dataset.chartAnimated && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && data.length) {
      el.dataset.chartAnimated = "true";
      const startData = data.map(trace => {
        const copy = Object.assign({}, trace);
        if (trace.type === "bar" && trace.orientation === "h" && Array.isArray(trace.x)) copy.x = trace.x.map(v => Number.isFinite(+v) ? 0 : v);
        else if (Array.isArray(trace.y) && trace.type !== "bar" ? true : (Array.isArray(trace.y) && trace.type === "bar")) copy.y = trace.y.map(v => Number.isFinite(+v) ? 0 : v);
        return copy;
      });
      const animatedLayout = Object.assign({}, layout, { transition: { duration: 850, easing: "cubic-in-out" } });
      // Lock the numeric axis to the uploaded values before animating from zero; otherwise
      // Plotly auto-ranges against the placeholder values ([-1, 1]) and bars appear clipped.
      const rangeFor = key => {
        const vals = data.flatMap(trace => Array.isArray(trace[key]) ? trace[key] : []).map(Number).filter(Number.isFinite);
        if (!vals.length) return [0, 1];
        const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo;
        if (!span) { const pad = Math.abs(hi) * .1 || 1; return lo >= 0 ? [0, hi + pad] : [lo - pad, hi + pad]; }
        const pad = span * .08;
        return [lo < 0 ? lo - pad : 0, hi + pad];
      };
      const horizontalBars = data.some(trace => trace.type === "bar" && trace.orientation === "h");
      const valueAxis = data.some(trace => trace.type === "bar") && horizontalBars ? "xaxis" : "yaxis";
      animatedLayout[valueAxis] = Object.assign({}, animatedLayout[valueAxis] || {}, { range: rangeFor(valueAxis === "xaxis" ? "x" : "y"), autorange: false });
      Plotly.newPlot(el, startData, animatedLayout, CH_CFG).then(() => {
        const update = data.map(trace => ({ x: trace.x, y: trace.y }));
        return Plotly.animate(el, { data: update, traces: data.map((_, i) => i) }, { transition: { duration: 900, easing: "cubic-in-out" }, frame: { duration: 900, redraw: false } });
      }).catch(() => Plotly.react(el, data, animatedLayout, CH_CFG).catch(() => {}));
      return;
    }
    Plotly.react(el, data, Object.assign({}, layout, { transition: { duration: 700, easing: "cubic-in-out" } }), CH_CFG).catch(() => {});
  }
  function moneyTick(l) { // values in ₹ lakh
    return v => Math.abs(v) >= 100 ? "₹" + (v / 100).toFixed(v % 100 === 0 ? 0 : 1) + " Cr" : "₹" + v.toFixed(0) + " L";
  }

  const CH = {
    line(el, opts) {
      const tr = (opts.series || []).map((s, i) => ({
        x: opts.labels, y: s.values, type: "scatter", mode: "lines" + (s.dots ? "+markers" : ""),
        name: s.name, line: { color: s.color || getCss("--chart-" + (i + 1)), width: s.width || 2.2, dash: s.dashed ? "dash" : "solid", shape: "spline", smoothing: 0.55 },
        marker: { size: 3.5 }, hovertemplate: s.hov || (opts.yFmt === "number" ? "%{x}<br>" + s.name + ": <b>%{y:,.2f}</b><extra></extra>" : "%{x}<br>" + s.name + ": <b>₹%{y:,.0f} L</b><extra></extra>"),
        stackgroup: s.stack ? "s" : undefined, fillcolor: s.fill || undefined,
      }));
      if (opts.bands) opts.bands.forEach(b => {
        tr.push({ x: opts.labels, y: b.upper, type: "scatter", mode: "lines", line: { width: 0 }, showlegend: false, hoverinfo: "skip", name: b.name + " upper" });
        tr.push({ x: opts.labels, y: b.lower, type: "scatter", mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: getCss("--chart-1").replace(")", ", .10)").replace("rgb", "rgba").replace("#", ""), showlegend: false, hoverinfo: "skip", name: b.name + " lower",
          fillcolor: hexA(getCss("--chart-1"), 0.12) });
      });
      const layout = baseLayout({
        yaxis: Object.assign({ automargin: true, tickformat: opts.yFmt === "pct" ? ",.0f" : undefined }, axisCfg(), opts.yFmt === "money" || !opts.yFmt ? { tickprefix: "₹" } : {}),
        showlegend: opts.legend !== false && (opts.series || []).length > 1,
        legend: { orientation: "h", y: 1.12, x: 0, font: { size: 11.5 } },
        hovermode: "x unified", hoverlabel: { bgcolor: getCss("--surface"), bordercolor: getCss("--border"), font: { size: 12 } },
      });
      if (opts.vlines) opts.vlines.forEach(v => layout.shapes = (layout.shapes || []).concat([{ type: "line", x0: v.x, x1: v.x, y0: 0, y1: 1, yref: "paper", line: { color: getCss("--chart-4"), width: 1.2, dash: "dot" } }]));
      if (opts.vlines) layout.annotations = (layout.annotations || []).concat(opts.vlines.map(v => ({ x: v.x, y: 1.04, yref: "paper", text: v.label, showarrow: false, font: { size: 10.5, color: getCss("--chart-4") } })));
      render(el, tr, layout);
    },
    bars(el, opts) {
      const tr = (opts.series || []).map((s, i) => ({
        x: opts.hbar ? s.values : opts.labels, y: opts.hbar ? opts.labels : s.values,
        type: "bar", name: s.name, orientation: opts.hbar ? "h" : "v",
        marker: { color: s.colors || s.color || getCss("--chart-" + (i + 1)), line: { width: 0 }, cornerradius: 3 },
        text: opts.text ? s.values.map(v => opts.text(v)) : undefined, textposition: opts.text ? "outside" : "auto",
        cliponaxis: false, hovertemplate: s.name + ": <b>" + (opts.yFmt === "number" ? "%{" + (opts.hbar ? "x" : "y") + ":,.2f}" : "₹%{" + (opts.hbar ? "x" : "y") + ":,.0f} L") + "</b><extra></extra>",
      }));
      const layout = baseLayout({
        barmode: (opts.series || []).length > 1 ? (opts.hbar ? "group" : "group") : "group",
        showlegend: opts.legend !== false && (opts.series || []).length > 1,
        legend: { orientation: "h", y: 1.13, x: 0, font: { size: 11.5 } },
        hovermode: "closest",
        xaxis: Object.assign({ automargin: true }, axisCfg()),
        yaxis: Object.assign({ automargin: true, tickprefix: opts.yFmt === "number" ? "" : "₹" }, axisCfg()),
      });
      if (opts.hbar) { layout.yaxis = Object.assign({ automargin: true }, axisCfg()); layout.xaxis = Object.assign({ tickprefix: opts.yFmt === "number" ? "" : "₹" }, axisCfg()); layout.margin = { l: 130, r: 40, t: 10, b: 24 }; }
      render(el, tr, layout);
    },
    combo(el, opts) { // bars + line
      const tr = (opts.series || []).map(s => s.type === "line" ? {
        x: opts.labels, y: s.values, type: "scatter", mode: "lines+markers", name: s.name,
        line: { color: s.color || getCss("--ok"), width: 2.4, shape: "spline", smoothing: 0.5 }, marker: { size: 4 },
        yaxis: "y2", hovertemplate: s.name + ": <b>₹%{y:,.0f} L</b><extra></extra>",
      } : {
        x: opts.labels, y: s.values, type: "bar", name: s.name, marker: { color: s.color, cornerradius: 3, line: { width: 0 } },
        hovertemplate: s.name + ": <b>₹%{y:,.0f} L</b><extra></extra>",
      });
      render(el, tr, baseLayout({
        barmode: "group", showlegend: true, legend: { orientation: "h", y: 1.13, x: 0, font: { size: 11.5 } },
        yaxis: Object.assign({ automargin: true, tickprefix: opts.yFmt === "number" ? "" : "₹" }, axisCfg()),
        yaxis2: { overlaying: "y", side: "right", showgrid: false, showticklabels: false },
        hovermode: "x unified",
      }));
    },
    bubble(el, opts) {
      const tr = [{
        x: opts.pts.map(p => p.x), y: opts.pts.map(p => p.y),
        text: opts.pts.map(p => p.label), hovertemplate: opts.pts.map(p => `<b>${p.label}</b><br>Revenue ₹${(p.x / 100).toFixed(2)} Cr · Margin ${p.y.toFixed(1)}% · Profit ₹${(p.profit / 100).toFixed(2)} Cr<extra></extra>`),
        mode: "markers+text", textposition: "top center", textfont: { size: 10.5, color: getCss("--text-3") },
        type: "scattergl",
        marker: { size: opts.pts.map(p => p.r), color: opts.pts.map(p => p.color), opacity: 0.78, line: { width: 1.5, color: "rgba(255,255,255,.85)" } },
      }];
      const layout = baseLayout({
        margin: { l: 52, r: 20, t: 24, b: 40 },
        xaxis: Object.assign({ title: { text: "Revenue (₹ Cr)", font: { size: 11, color: getCss("--text-3") } }, automargin: true }, axisCfg(), { tickprefix: "" }),
        yaxis: Object.assign({ title: { text: "Profit margin (%)", font: { size: 11, color: getCss("--text-3") } }, automargin: true, tickformat: ",.0f", ticksuffix: "%" }, axisCfg()),
        hovermode: "closest",
      });
      const xs = opts.pts.map(p => p.x), ys = opts.pts.map(p => p.y);
      const mx = Math.max(...xs) * 0.55, my = opts.midY != null ? opts.midY : Math.max(...ys) * 0.55;
      layout.shapes = [
        { type: "line", x0: mx, x1: mx, y0: Math.min(...ys) * 0.85, y1: Math.max(...ys) * 1.08, line: { color: getCss("--border-2"), width: 1, dash: "dot" } },
        { type: "line", x0: Math.min(...xs) * 0.8, x1: Math.max(...xs) * 1.05, y0: my, y1: my, line: { color: getCss("--border-2"), width: 1, dash: "dot" } },
      ];
      layout.annotations = [
        { x: Math.max(...xs) * 0.97, y: Math.max(...ys) * 1.06, text: "High rev · High margin", showarrow: false, font: { size: 10.5, color: getCss("--ok-ink") } },
        { x: Math.min(...xs) * 0.85, y: Math.max(...ys) * 1.06, text: "Low rev · High margin", showarrow: false, font: { size: 10.5, color: getCss("--text-4") } },
        { x: Math.max(...xs) * 0.97, y: Math.min(...ys) * 0.9, text: "High rev · Low margin", showarrow: false, font: { size: 10.5, color: getCss("--warn-ink") } },
        { x: Math.min(...xs) * 0.85, y: Math.min(...ys) * 0.9, text: "Watch", showarrow: false, font: { size: 10.5, color: getCss("--text-4") } },
      ];
      render(el, tr, layout);
    },
    donut(el, opts) {
      render(el, [{
        type: "pie", labels: opts.labels, values: opts.values, hole: 0.62,
        marker: { colors: opts.colors || CATCOLORS, line: { color: getCss("--surface"), width: 2 } },
        textinfo: "percent", textfont: { size: 11, color: "#fff" },
        hovertemplate: "%{label}<br><b>₹%{value:,.0f} L</b> (%{percent})<extra></extra>",
      }], baseLayout({ margin: { l: 10, r: 10, t: 8, b: 8 }, showlegend: true, legend: { orientation: "h", y: -0.08, x: 0, font: { size: 11 } } }));
    },
  };
  function hexA(hex, a) {
    if (hex.startsWith("#")) {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }
    return hex;
  }
  const CATCOLORS = ["#1D5BD6", "#3E8FD8", "#7A5AF8", "#B45309", "#178A50", "#8593A9"];

  /* ---------------- table builder ---------------- */
  function table(cfg) {
    // cfg: {el, cols:[{k,label,align,fmt,render}], rows, pageSize, searchKeys, exportName, onRow, colSelect, dense}
    const el = document.querySelector(cfg.el);
    if (!el) return { refresh() {} };
    let state = { q: "", sort: cfg.sortKey || null, dir: 1, page: 1, size: cfg.pageSize || 10, hidden: new Set(cfg.hiddenCols || []) };
    const cols = cfg.cols || [];
    function fmtCell(c, row) {
      if (c.render) return c.render(row);
      const v = row[c.k];
      if (v == null) return "—";
      if (c.fmt === "money") return A.fmt.cr(v);
      if (c.fmt === "money2") return A.fmt.crExact(v * 100);
      if (c.fmt === "inr") return A.fmt.inr(v);
      if (c.fmt === "pct") return A.fmt.pct(v);
      if (c.fmt === "pctSign") { const cls = v > 0 ? "pos" : v < 0 ? "neg" : "flat"; return `<span class="pos-neg ${cls}">${A.fmt.pctSign(v)}</span>`; }
      if (c.fmt === "num") return A.fmt.num(v, c.dp);
      return v;
    }
    function visible() { return cols.filter(c => !state.hidden.has(c.k)); }
    function filtered() {
      let rows = cfg.rows.slice();
      if (state.q) {
        const q = state.q.toLowerCase();
        const keys = cfg.searchKeys || cols.map(c => c.k);
        rows = rows.filter(r => keys.some(k => String(r[k] != null ? r[k] : (r[cfg.rowText && cfg.rowText(r)] || "")).toLowerCase().includes(q)));
      }
      if (state.sort) {
        const c = cols.find(x => x.k === state.sort);
        rows.sort((a, b) => {
          const av = a[c.k], bv = b[c.k];
          return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv))) * state.dir;
        });
      }
      return rows;
    }
    function draw() {
      const rows = filtered();
      const pages = Math.max(1, Math.ceil(rows.length / state.size));
      if (state.page > pages) state.page = pages;
      const slice = rows.slice((state.page - 1) * state.size, state.page * state.size);
      const vis = visible();
      let html = `<div class="tbar">
        <div class="t-search">${icon("search", "ic-16")}<input type="search" placeholder="${cfg.searchPh || "Search…"}" aria-label="Search table" value="${state.q.replace(/"/g, "&quot;")}"></div>
        ${cfg.toolbar || ""}
        <div class="row gap-6" style="margin-left:auto">
        ${cfg.colSelect !== false ? `<button class="btn btn-g btn-sm" data-a="cols">${icon("filter", "ic-14")} Columns</button>` : ""}
        ${cfg.exportName ? `<button class="btn btn-g btn-sm" data-a="exp">${icon("download", "ic-14")} Export</button>` : ""}
        </div></div>
        <div class="t-scroll"><table class="dt"><thead><tr>${vis.map(c =>
          `<th class="${c.align === "r" ? "r" : ""} ${cfg.sortable !== false && c.sort !== false ? "sortable" : ""} ${state.sort === c.k ? (state.dir > 0 ? "asc" : "desc") : ""}" data-k="${c.k}">${c.label}<span class="arr">▲</span></th>`).join("")}</tr></thead>
        <tbody>${slice.length ? slice.map((r, i) =>
          `<tr data-i="${i}" class="${cfg.onRow ? "clickable" : ""}">${vis.map(c => `<td class="${c.align === "r" ? "r" : ""}">${fmtCell(c, r)}</td>`).join("")}</tr>`).join("")
          : `<tr><td colspan="${vis.length}"><div class="empty"><div class="e-ico">${icon("search")}</div><b>No records found</b><p>Try a different search or reset the filters.</p><button class="btn btn-s btn-sm" data-a="reset">Reset filters</button></div></td></tr>`}</tbody></table></div>
        <div class="tfoot">
          <label class="row gap-6" style="font-size:12.5px">Rows
            <select class="select" style="height:30px;width:64px;font-size:12.5px" data-a="size">${[10, 25, 50].map(n => `<option ${n === state.size ? "selected" : ""}>${n}</option>`).join("")}</select>
          </label>
          <span>${rows.length ? (state.page - 1) * state.size + 1 + "–" + Math.min(rows.length, state.page * state.size) + " of " : "0 of"} ${rows.length}</span>
          <div class="pager">
            <button data-pg="prev" ${state.page === 1 ? "disabled" : ""} aria-label="Previous page">${icon("chevronLeft", "ic-14")}</button>
            ${pagerBtns(pages).map(p => `<button data-pg="${p}" class="${p === state.page ? "active" : ""}">${p}</button>`).join("")}
            <button data-pg="next" ${state.page === pages ? "disabled" : ""} aria-label="Next page">${icon("chevronRight", "ic-14")}</button>
          </div></div>`;
      el.innerHTML = html;
      // wire
      el.querySelector(".t-search input").addEventListener("input", e => { state.q = e.target.value; state.page = 1; draw(); e.target.focus(); restoreCaret(e.target); });
      function restoreCaret() {}
      el.querySelectorAll("th.sortable").forEach(th => th.onclick = () => {
        if (state.sort === th.dataset.k) state.dir *= -1; else { state.sort = th.dataset.k; state.dir = 1; }
        draw();
      });
      el.querySelector('[data-a="size"]').onchange = e => { state.size = +e.target.value; state.page = 1; draw(); };
      el.querySelectorAll("[data-pg]").forEach(b => b.onclick = () => { const p = b.dataset.pg; state.page = p === "prev" ? state.page - 1 : p === "next" ? state.page + 1 : +p; draw(); });
      const rc = el.querySelector('[data-a="reset"]'); if (rc) rc.onclick = () => { state.q = ""; state.sort = null; state.page = 1; draw(); };
      const ce = el.querySelector('[data-a="cols"]');
      if (ce) ce.onclick = e => {
        e.stopPropagation();
        menu(ce, cols.map(c => ({
          id: c.k, label: `<span class="row gap-8 w-full" style="justify-content:flex-start"><input type="checkbox" ${!state.hidden.has(c.k) ? "checked" : ""} style="accent-color:var(--primary);width:14px;height:14px"> ${c.label}</span>`,
        })), "right");
        setTimeout(() => ce.parentElement.querySelectorAll(".dd input").forEach(inp => {
          inp.onclick = ev => ev.stopPropagation();
          inp.onchange = () => { const k = inp.closest("button").dataset.m; inp.checked ? state.hidden.delete(k) : state.hidden.add(k); draw(); };
        }), 30);
      };
      const xb = el.querySelector('[data-a="exp"]');
      if (xb) xb.onclick = () => exportCSV(cfg.exportName, vis, rows);
      if (cfg.onRow) el.querySelectorAll("tr[data-i]").forEach(tr => tr.onclick = () => cfg.onRow(slice[+tr.dataset.i]));
    }
    function pagerBtns(pages) {
      const out = []; const cur = state.page;
      for (let i = 1; i <= pages; i++) {
        if (pages <= 7 || i === 1 || i === pages || Math.abs(i - cur) <= 1) out.push(i);
        else if (out[out.length - 1] !== "…") out.push("…");
      }
      return out;
    }
    draw();
    return {
      refresh() { draw(); },
      getData() { return filtered(); },
      setQuery(q) { state.q = q || ""; state.page = 1; draw(); },
    };
  }
  function exportCSV(name, cols, rows) {
    const head = cols.map(c => c.label).join(",");
    const body = rows.map(r => cols.map(c => {
      let v = r[c.k]; if (v == null) v = "";
      if (typeof v === "string" && (v.includes(",") || v.includes('"'))) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }).join(",")).join("\n");
    downloadFile(name + ".csv", head + "\n" + body, "text/csv");
    toast("ok", "Export ready", name + ".csv downloaded.");
  }
  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type: type || "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ---------------- misc ---------------- */
  function delta(v, { goodWhenDown = false, suffix = "", dp } = {}) {
    const up = v > 0.0001, flat = Math.abs(v) <= 0.0001;
    const good = flat ? null : (up ? !goodWhenDown : goodWhenDown);
    const cls = flat ? "flat" : good ? "up" : "down";
    const tri = flat ? "•" : up ? "▲" : "▼";
    const txt = flat ? "0.0%" : `${up ? "+" : "−"}${Math.abs(v).toFixed(dp == null ? 1 : dp)}%${suffix}`;
    return `<span class="delta ${cls}"><span class="tri">${tri}</span>${txt}</span>`;
  }
  function skeletons(n, type) {
    let h = "";
    for (let i = 0; i < n; i++) h += `<div class="sk ${type === "kpi" ? "sk-kpi" : type === "chart" ? "sk-chart" : "sk-line"}"></div>`;
    return h;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function initials(name) { return name.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase(); }
  function debounce(fn, ms) { let t; return function () { clearTimeout(t); const a = arguments, c = this; t = setTimeout(() => fn.apply(c, a), ms || 200); }; }

  window.UI = { icon, toast, modal, confirm, drawer, menu, spark, ring, CH, table, exportCSV, downloadFile, delta, skeletons, esc, initials, S, persist, applyTheme, getCss, state: S };
})();
