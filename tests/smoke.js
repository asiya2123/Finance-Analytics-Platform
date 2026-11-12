/* Engine smoke test — no dependencies. Run: node tests/smoke.js */
const E = require("../frontend/assets/js/finance-engine.js");
const assert = require("assert");
const raw = E.demoData();
const mp = E.autoMap(raw.columns, raw.rows);
["date", "revenue", "cost", "budget", "region", "dept", "category", "product", "role", "salary"].forEach(k => assert(mp[k] >= 0, "auto-map " + k));
const M = E.normalize(raw, mp, { fyStart: 3 });
const spec = E.filterSpec(M, { range: "12m" });
const recs = E.select(M, spec), a = E.agg(recs);
assert(recs.length > 0 && Math.abs(a.profit - (a.rev - a.cost)) < 1, "profit = revenue - cost");
const f = E.forecastSeries(E.monthly(E.select(M, spec, true)), 12);
assert(f.fc.length === 12 && f.fc.every(x => x.lo90 <= x.base && x.base <= x.hi90), "forecast band ordering");
const be = E.breakEven(recs); assert(be.breakEvenRevenue < be.revenue === be.profit > 0, "break-even consistent with profit");
const st = E.strategy(M, spec, { total: a }); assert(st.dims.region.top[0].score >= st.dims.region.top.at(-1).score, "scores ranked");
const bt = E.budgetTable(M, spec, "dept", {}, 0.1); assert(bt.rows.length === 5, "budget rows by department");
const fq = E.select(M, E.filterSpec(M, { range: "all", fy: "2024", q: "2" })); assert(fq.every(r => r.fy === 2024 && r.q === 2), "FY + quarter filter");
// foreign schema
const cols = ["Order Date", "Country", "Segment", "Sales", "Profit"], rows = [];
for (let i = 0; i < 120; i++) rows.push([`${String(1 + i % 27).padStart(2, "0")}/${String(1 + i % 12).padStart(2, "0")}/2023`, ["US", "IN", "DE"][i % 3], ["A", "B"][i % 2], "$" + (100 + i), 10 + (i % 7)]);
const m2 = E.autoMap(cols, rows); assert(m2.date === 0 && m2.region === 1 && m2.revenue === 3 && m2.profit === 4, "foreign schema mapping");
console.log("SMOKE TEST: ALL PASSED ✓");
