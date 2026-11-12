/* ============================================================
   REVENUE FORECASTING & BUSINESS INTELLIGENCE — shell · router · global chrome
   ============================================================ */
(function () {
  "use strict";
  const { icon, toast, modal, drawer, menu, delta, S, persist, esc, initials } = window.UI;
  const A = window.AV;
  window.AV.pages = window.AV.pages || {};

  /* ---------------- navigation model ---------------- */
  const NAV = [
    { group: "Workspace", items: [
      { id: "dashboard", label: "Overview", icon: "dashboard", hash: "#/dashboard" },
      { id: "products", label: "Performance", icon: "product", hash: "#/products" },
      { id: "expenses", label: "Profit & Loss", icon: "reports", hash: "#/expenses" },
      { id: "budgets", label: "Budget Control", icon: "budgets", hash: "#/budgets" },
      { id: "forecast", label: "Forecast", icon: "forecast", hash: "#/forecast" },
      { id: "insights", label: "Market Strategy", icon: "insights", hash: "#/insights" },
      { id: "stability", label: "Stability & Break-even", icon: "shield", hash: "#/stability" },
    ]},
    { group: "Data & Alerts", items: [
      { id: "alerts", label: "Alerts", icon: "alerts", hash: "#/alerts", badge: () => (A.NOTIFS || []).filter(n => !n.read && n.type === "bad").length },
      { id: "data", label: "Data Import", icon: "data", hash: "#/data" },
    ]},
  ];
  const TITLES = {
    dashboard: ["Workspace", "Overview"], revenue: ["Workspace", "Performance"], expenses: ["Finance", "Profit & Loss"], products: ["Workspace", "Performance"],
    regions: ["Workspace", "Performance"], profitability: ["Workspace", "Performance"], budgets: ["Finance", "Budget Control"], variance: ["Finance", "Budget Control"],
    forecast: ["Planning", "Forecast"], reports: ["Finance", "Profit & Loss"], pl: ["Finance", "Profit & Loss"], insights: ["Intelligence", "Market Strategy"],
    stability: ["Risk", "Stability & Break-even"], alerts: ["Intelligence", "Alerts"], data: ["Data", "Data Import"], quality: ["Data", "Data Import"], settings: ["Administration", "Settings"],
  };

  /* ---------------- auth ---------------- */
  const ROLES = [
    { name: "Ananya Iyer", role: "CFO", email: "cfo@revenuebi.example" },
    { name: "Rohit Mehta", role: "Finance Manager", email: "finance@revenuebi.example" },
    { name: "Kavya Nair", role: "Business Analyst", email: "analyst@revenuebi.example" },
    { name: "Arjun Reddy", role: "Administrator", email: "admin@revenuebi.example" },
    { name: "Priya Sharma", role: "Viewer", email: "viewer@revenuebi.example" },
  ];
  function can(action) {
    if (!S.user) return false;
    if (action === "write" && (S.user.role === "Viewer")) return false;
    if (action === "admin" && (S.user.role === "Viewer" || S.user.role === "CFO")) return false;
    return true;
  }

  /* ---------------- shell ---------------- */
  const appEl = document.getElementById("app");
  function sidebarHTML(activeId) {
    return `<aside class="sidebar" aria-label="Primary navigation">
      <div class="sb-head">
        <div class="logo-mark">R</div>
        <div class="sb-name"><b>Finance Analytics Platform</b><span>Finance Intelligence</span></div>
      </div>
      <nav class="sb-nav">
        ${NAV.map(g => `<div class="sb-group" role="group" aria-label="${g.group}">
          <div class="sb-group-label">${g.group}</div>
          ${g.items.map(it => {
            const active = activeId === it.id;
            const badge = it.badge ? it.badge() : 0;
            return `<button class="sb-link ${active ? "active" : ""}" data-hash="${it.hash}" aria-current="${active ? "page" : "false"}">
              ${icon(it.icon)}<span class="sb-label">${it.label}</span>${badge ? `<span class="sb-badge">${badge}</span>` : ""}</button>`;
          }).join("")}</div>`).join("")}
      </nav>
      <div class="sb-foot">
        <button class="sb-link" id="helpBtn">${icon("help")}<span class="sb-label">Help &amp; Support</span></button>
        <button class="u-chip" id="sideUser">
          <span class="avatar">${initials(S.user.name)}</span>
          <span class="u-meta"><b>${esc(S.user.name)}</b><span>${esc(S.user.role)}</span></span>
        </button>
      </div></aside>`;
  }
  function topbarHTML(crumb, title) {
    return `<header class="topbar">
      <button class="tb-btn hamb" id="hamb" aria-label="Open navigation">${icon("menu")}</button>
      <div class="tb-page">
        <div class="crumb"><a href="#/dashboard">Finance Analytics</a><span>/</span><span>${crumb}</span></div>
        <div class="page-title">${title}</div>
      </div>
      <div class="tb-search" id="searchOpen" role="button" tabindex="0" aria-label="Search">
        ${icon("search", "ic-16")}<span class="ph" style="font-size:13px;color:var(--text-4);flex:1">Search reports, transactions, products…</span><span class="kbd">Ctrl K</span>
      </div>
      <div class="tb-right">
        <button class="tb-btn theme-toggle" id="themeToggle" aria-label="Switch light or dark mode" title="Toggle light/dark mode">${S.theme === "dark" ? "☀" : "☾"}</button>
        <button class="tb-btn" id="viewsBtn" aria-label="Saved views" title="Saved filter views">${icon("filter")}</button>
        <button class="tb-btn" id="bellBtn" aria-label="Notifications" style="position:relative">${icon("bell")}${unread() ? `<span class="dot-badge">${unread()}</span>` : ""}</button>
        <button class="tb-btn" id="helpBtn2" aria-label="Help">${icon("help")}</button>
        <div class="tb-div"></div>
        <button class="u-menu-btn" id="userBtn">
          <span class="avatar">${initials(S.user.name)}</span>
          <span class="u-meta"><b>${esc(S.user.name)}</b><span>${esc(S.user.role)}</span></span>
          ${icon("chevronDown", "ic-14")}
        </button>
      </div></header>`;
  }
  const unread = () => A.NOTIFS.filter(n => !n.read).length;

  function wireChrome(activeId) {
    document.querySelectorAll(".sb-link[data-hash]").forEach(b => b.onclick = () => {
      location.hash = b.dataset.hash;
      appEl.classList.remove("sb-open");
    });
    const hamb = document.getElementById("hamb"); if (hamb) hamb.onclick = () => appEl.classList.toggle("sb-open");
    const scrim = document.querySelector(".sb-scrim"); if (scrim) scrim.onclick = () => appEl.classList.remove("sb-open");
    const themeBtn = document.getElementById("themeToggle"); if (themeBtn) themeBtn.onclick = () => {
      S.theme = S.theme === "dark" ? "light" : "dark";
      persist(); UI.applyTheme();
      themeBtn.textContent = S.theme === "dark" ? "☀" : "☾";
      themeBtn.setAttribute("aria-label", S.theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
      // Re-render current page so Plotly axis labels, grids, and legends use the new theme colors.
      route(true);
    };
    const vb = document.getElementById("viewsBtn"); if (vb) vb.onclick = openViews;
    const bell = document.getElementById("bellBtn"); if (bell) bell.onclick = openNotifs;
    const h1 = document.getElementById("helpBtn"), h2 = document.getElementById("helpBtn2");
    if (h1) h1.onclick = openHelp; if (h2) h2.onclick = openHelp;
    const su = document.getElementById("sideUser"); if (su) su.onclick = () => { location.hash = "#/settings"; };
    const ub = document.getElementById("userBtn");
    if (ub) ub.onclick = e => { e.stopPropagation(); menu(ub, [
      { id: "profile", icon: "users", label: "Profile & settings", action: () => location.hash = "#/settings" },
      { id: "views", icon: "filter", label: "Saved filter views", action: openViews },
      { id: "help", icon: "help", label: "Help & support", action: openHelp },
      "hr",
      { id: "signout", icon: "logout", label: "Sign out", danger: true, action: signOut },
    ], "right"); };
    const so = document.getElementById("searchOpen");
    if (so) { so.onclick = openSearch; so.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSearch(); } }; }
    // mobile bottom nav
    const bn = document.getElementById("bnav");
    if (bn) bn.querySelectorAll("button").forEach(b => b.onclick = () => {
      const h = b.dataset.hash; if (h === "more") { openMore(); return; }
      location.hash = h;
    });
  }
  function openMore() {
    const items = [{ id: "expenses", label: "Profit & Loss", icon: "reports", hash: "#/expenses" }, { id: "insights", label: "Market Strategy", icon: "insights", hash: "#/insights" }, { id: "stability", label: "Stability & Break-even", icon: "shield", hash: "#/stability" }, { id: "alerts", label: "Alerts", icon: "alerts", hash: "#/alerts" }, { id: "data", label: "Data Import", icon: "data", hash: "#/data" }, { id: "settings", label: "Settings", icon: "settings", hash: "#/settings" }];
    const m = modal({ title: "All sections", size: "sm", body: items.map(it => `<div class="sr-item" data-h="${it.hash}">${icon(it.icon)}<b>${it.label}</b><span>${it.hash}</span></div>`).join("") });
    m.body.querySelectorAll(".sr-item").forEach(el => el.onclick = () => { location.hash = el.dataset.h; m.close(); });
  }

  /* ---------------- router ---------------- */
  function parseHash() {
    const h = location.hash || "#/dashboard";
    const [path, query] = h.split("?");
    const id = path.replace("#/", "") || "dashboard";
    return { id, query: new URLSearchParams(query || "") };
  }
  let currentPage = null;
  function route(soft) {
    const { id, query } = parseHash();
    const page = A.pages[id] || A.pages.dashboard;
    const uiId = (id === "data" && query.get("tab") === "quality") ? "quality" : id; // sidebar/title label
    const [crumb, title] = TITLES[uiId] || TITLES.dashboard;
    document.title = title + " · Finance Analytics Platform";
    if (window.FSUI) window.FSUI.syncNotifs();
    document.getElementById("chrome").innerHTML = topbarHTML(crumb, title);
    const sb = document.querySelector(".sidebar");
    if (sb) sb.outerHTML = sidebarHTML(uiId);
    const bn = document.getElementById("bnav");
    if (bn) bn.querySelectorAll("button").forEach(b => b.classList.toggle("active", (b.dataset.hash || "").includes(id)));
    wireChrome(id);
    const content = document.getElementById("content");
    content.innerHTML = "";
    document.removeEventListener("click", closePopovers);
    currentPage = page(content, query, soft);
    document.addEventListener("click", closePopovers);
    if (!soft) window.scrollTo({ top: 0 });
  }
  function closePopovers() { document.querySelectorAll(".dd.open").forEach(d => { const host = d.parentElement; if (host && !host.contains(document.activeElement) && !host.classList.contains("dd")) d.remove(); }); }
  window.addEventListener("hashchange", () => route(false));

  /* ---------------- global search ---------------- */
  function openSearch() {
    const idx = buildSearchIndex();
    const m = modal({ size: "sm", body: `<div class="sr-input">${icon("search")}<input id="srIn" placeholder="Search pages, regions, products, departments, alerts…" aria-label="Search" autocomplete="off"><span class="kbd" style="font-size:10.5px;color:var(--text-4);border:1px solid var(--border);border-radius:5px;padding:1px 5px">ESC</span></div>
      <div class="sr-body" id="srBody"></div>
      <div class="sr-foot"><span>↑↓ to navigate</span><span>Enter to open</span><span style="margin-left:auto">Finance Analytics Search · v2.4</span></div>` });
    const inp = m.el.querySelector("#srIn"), body = m.el.querySelector("#srBody");
    let sel = 0;
    function results(q) {
      if (!q) return idx.map(g => ({ ...g, items: g.items.slice(0, 3) }));
      const out = [];
      idx.forEach(g => {
        const hits = g.items.filter(it => (it.title + " " + it.meta).toLowerCase().includes(q.toLowerCase())).slice(0, 4);
        if (hits.length) out.push({ ...g, items: hits });
      });
      return out;
    }
    function draw() {
      const groups = results(inp.value.trim());
      sel = 0;
      const total = groups.reduce((s, g) => s + g.items.length, 0);
      body.innerHTML = groups.length ? groups.map(g => `
        <div class="sr-group">${g.icon ? "" : ""}${g.name}</div>
        ${g.items.map((it, i) => `<div class="sr-item ${g === groups[0] && i === 0 ? "sel" : ""}" data-h="${it.hash}" data-f="${esc(it.focus || "")}" data-t="${esc(it.title)}">${icon(g.icon)}<b>${esc(it.title)}</b><span>${esc(it.meta)}</span></div>`).join("")}`).join("")
        : `<div class="empty" style="padding:30px"><div class="e-ico">${icon("search")}</div><b>No results for “${esc(inp.value)}”</b><p>Check the spelling or search for products, reports, departments or transactions.</p><button class="btn btn-s btn-sm" id="srReset">Clear search</button></div>`;
      const rs = body.querySelector("#srReset"); if (rs) rs.onclick = () => { inp.value = ""; draw(); };
      body.querySelectorAll(".sr-item").forEach(el => {
        el.onmouseenter = () => { body.querySelectorAll(".sr-item").forEach(x => x.classList.remove("sel")); el.classList.add("sel"); };
        el.onclick = () => { m.close(); if (el.dataset.f && window.FSUI) window.FSUI.focus(el.dataset.f); location.hash = el.dataset.h; };
      });
    }
    draw();
    inp.focus();
    inp.addEventListener("input", draw);
    inp.addEventListener("keydown", e => {
      const items = [...body.querySelectorAll(".sr-item")];
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!items.length) return;
        sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items.forEach((x, i) => x.classList.toggle("sel", i === sel));
        items[sel].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && items[sel]) { m.close(); if (items[sel].dataset.f && window.FSUI) window.FSUI.focus(items[sel].dataset.f); location.hash = items[sel].dataset.h; }
    });
  }
  function buildSearchIndex() {
    return window.FSUI ? window.FSUI.searchIndex() : [];
  }

  /* ---------------- notifications drawer ---------------- */
  function openNotifs() {
    const d = drawer({
      title: "Notifications", sub: unread() + " unread",
      body: `<div style="display:flex;gap:7px;margin-bottom:12px">
          <button class="btn btn-g btn-sm" id="nRead">Mark all as read</button>
          <button class="btn btn-g btn-sm" id="nClear">Clear all</button>
        </div><div id="nList"></div>`,
      onClose: () => {},
    });
    const list = d.body.querySelector("#nList");
    function draw() {
      list.innerHTML = A.NOTIFS.length ? A.NOTIFS.map(n => `
        <div class="n-item ${n.read ? "" : "unread"}" data-id="${n.id}">
          <div class="n-ic ${n.type}">${icon(n.icon)}</div>
          <div style="flex:1;min-width:0"><b>${n.title}</b><p>${n.body}</p><time>${n.time}</time></div>
          ${n.read ? "" : '<span style="color:var(--primary);margin-top:4px">' + icon("dot", "ic-14") + "</span>"}
        </div>`).join("") : `<div class="empty"><div class="e-ico">${icon("bell")}</div><b>You're all caught up</b><p>New alerts, forecasts and import results will appear here.</p></div>`;
      list.querySelectorAll(".n-item").forEach(el => el.onclick = () => {
        const n = A.NOTIFS.find(x => x.id === +el.dataset.id);
        n.read = true;
        location.hash = n.link;
        d.close();
        const b = document.getElementById("bellBtn");
        if (b) b.querySelector(".dot-badge")?.remove();
      });
    }
    draw();
    d.body.querySelector("#nRead").onclick = () => { A.NOTIFS.forEach(n => n.read = true); toast("ok", "All caught up", "Notifications marked as read."); location.hash = location.hash; route(true); draw(); const b = document.getElementById("bellBtn"); if (b) b.querySelector(".dot-badge")?.remove(); };
    d.body.querySelector("#nClear").onclick = () => { A.NOTIFS.length = 0; draw(); route(true); toast("info", "Cleared", "All notifications removed."); };
  }

  /* ---------------- saved views ---------------- */
  function openViews() { if (window.FSUI) window.FSUI.openViews(); }

  /* ---------------- help ---------------- */
  function openHelp() {
    modal({
      title: "Help & Support", sub: "Finance Analytics Platform v2.4.1 · build 8821", size: "md",
      body: `<div class="grid" style="gap:12px">
        <div class="c-6"><div class="card"><div class="card-b"><b class="small">Shortcuts</b>
          <dl class="kv" style="grid-template-columns:110px 1fr;margin-top:8px;font-size:12.5px">
            <dt>Global search</dt><dd>Ctrl / ⌘ + K</dd>
            <dt>Close dialogs</dt><dd>Esc</dd>
            <dt>Next / previous page</dt><dd>Use table pager</dd>
          </dl></div></div></div>
        <div class="c-6"><div class="card"><div class="card-b"><b class="small">Support</b>
          <p class="small muted" style="margin:8px 0 10px;line-height:1.55">In-app guide: <a href="#/settings">Settings</a> · <a href="#/data">Data guide</a> · <a href="#/insights">Insights</a></p>
          <div class="row gap-8"><button class="btn btn-s btn-sm" id="hContact">Contact support</button><button class="btn btn-g btn-sm" id="hShort">Keyboard shortcuts</button></div>
        </div></div></div>
        <div class="c-12 note"><span>${icon("shield", "ic-16")}</span><span>Finance Analytics Platform runs entirely in your browser. The built-in demo data is synthetic; anything you upload stays on your device.</span></div>
      </div>`,
      foot: `<button class="btn btn-g" id="hClose">Close</button>`,
    }).foot.querySelector("#hClose").onclick = () => location.hash;
    document.querySelector("#hContact").onclick = () => toast("info", "Support", "support@revenuebi.example · SLA 4 business hours");
    document.querySelector("#hShort").onclick = () => toast("info", "Shortcuts", "Ctrl/⌘ + K to search anywhere in the app.");
  }

  function signOut() {
    sessionStorage.removeItem("av.user");
    localStorage.removeItem("av.user");
    location.href = "index.html";
  }

  /* ---------------- boot ---------------- */
  function boot() {
    if (!S.user) { location.replace("index.html"); return; }
    appEl.innerHTML = sidebarHTML(parseHash().id) +
      `<div class="main"><div id="chrome"></div><div class="content" id="content"></div>
      <nav class="bnav" id="bnav" aria-label="Mobile navigation">
        <button data-hash="#/dashboard" class="${parseHash().id === "dashboard" ? "active" : ""}">${icon("dashboard", "ic-20")} Dashboard</button>
        <button data-hash="#/products" class="${parseHash().id === "products" ? "active" : ""}">${icon("product", "ic-20")} Performance</button>
        <button data-hash="#/budgets" class="${parseHash().id === "budgets" ? "active" : ""}">${icon("budget", "ic-20")} Budget</button>
        <button data-hash="#/forecast" class="${parseHash().id === "forecast" ? "active" : ""}">${icon("forecast", "ic-20")} Forecast</button>
        <button data-hash="more" class="${!["dashboard", "products", "budgets", "forecast"].includes(parseHash().id) ? "active" : ""}">${icon("menu", "ic-20")} More</button>
      </nav></div><div class="sb-scrim"></div>`;
    document.addEventListener("keydown", e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
    });
    document.addEventListener("revenuebi:rendered", () => {});
    route(false);
  }
  document.addEventListener("DOMContentLoaded", boot);
  window.APP = { route, signOut, openSearch, openNotifs, can, ROLES, parseHash, TITLES, openViews, openHelp, refreshChrome: () => route(true) };
})();
