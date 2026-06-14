/* Generates vendee-cost-model.xlsx with live formulas (no Thai encoding issues). */
const XLSX = require("xlsx");
const path = require("path");

const ws = {};
const set = (addr, v, opts = {}) => { ws[addr] = { ...opts, v: opts.f ? undefined : v, ...(opts.f ? { f: opts.f } : {}) }; };
const S = (addr, s) => (ws[addr] = { t: "s", v: s });
const N = (addr, n, z) => (ws[addr] = { t: "n", v: n, ...(z ? { z } : {}) });
const F = (addr, f, z) => (ws[addr] = { t: "n", f, ...(z ? { z } : {}) });

// Title + instructions
S("A1", "Vendee — Cost Model (สูตรคำนวณอัตโนมัติ — แก้ค่าช่อง B แล้วทุกอย่างอัปเดต)");

// Assumptions
S("A3", "ASSUMPTIONS"); S("B3", "ค่า"); S("C3", "หน่วย");
const assum = [
  ["อัตราแลกเปลี่ยน (THB/USD)", 35, "฿/$"],
  ["ราคา Eco", 100, "฿/เดือน"],
  ["ราคา Pro", 200, "฿/เดือน"],
  ["ราคา Platinum", 700, "฿/เดือน"],
  ["ต้นทุน AI ต่อ scan", 0.13, "฿"],
  ["scans/เดือน Free", 8, "ครั้ง"],
  ["scans/เดือน Eco", 30, "ครั้ง"],
  ["scans/เดือน Pro", 100, "ครั้ง"],
  ["scans/เดือน Platinum (heavy)", 400, "ครั้ง"],
  ["Beam fee", 1.65, "%"],
  ["Vercel", 20, "$/เดือน"],
  ["Supabase", 25, "$/เดือน"],
];
assum.forEach((row, i) => { const r = 4 + i; S(`A${r}`, row[0]); N(`B${r}`, row[1]); S(`C${r}`, row[2]); });

// Header row 17
const headers = ["Scenario", "Free", "Eco", "Pro", "Platinum", "รายได้ ฿", "AI cost ฿", "Beam fee ฿", "Infra ฿", "ต้นทุนรวม ฿", "กำไรสุทธิ ฿", "Margin"];
const cols = ["A","B","C","D","E","F","G","H","I","J","K","L"];
headers.forEach((h, i) => S(`${cols[i]}17`, h));

// Scenarios: [name, Free, Eco, Pro, Platinum]
const scen = [
  ["ปัจจุบัน (8 free)", 8, 0, 0, 0],
  ["5 Eco", 0, 5, 0, 0],
  ["20 Eco", 0, 20, 0, 0],
  ["10 Pro", 0, 0, 10, 0],
  ["Break-even ~17 Eco", 0, 17, 0, 0],
  ["Break-even ~9 Pro", 0, 0, 9, 0],
  ["Mixed 100F/30E/15P/3Plat", 100, 30, 15, 3],
  ["Scale 50 Pro", 0, 0, 50, 0],
  ["Scale 200F/80E/40P/10Plat", 200, 80, 40, 10],
  ["Big 100 Pro + 20 Plat", 0, 0, 100, 20],
];
const THB = "#,##0";
scen.forEach((row, i) => {
  const r = 18 + i;
  S(`A${r}`, row[0]); N(`B${r}`, row[1]); N(`C${r}`, row[2]); N(`D${r}`, row[3]); N(`E${r}`, row[4]);
  F(`F${r}`, `B$5*C${r}+B$6*D${r}+B$7*E${r}`, THB);
  F(`G${r}`, `B$8*(B${r}*B$9+C${r}*B$10+D${r}*B$11+E${r}*B$12)`, THB);
  F(`H${r}`, `B$13/100*F${r}`, THB);
  F(`I${r}`, `(B$14+B$15)*B$4`, THB);
  F(`J${r}`, `G${r}+H${r}+I${r}`, THB);
  F(`K${r}`, `F${r}-J${r}`, THB);
  F(`L${r}`, `IF(F${r}=0,"",K${r}/F${r})`, "0.0%");
});

ws["!ref"] = "A1:L27";
ws["!cols"] = [{ wch: 26 }, { wch: 8 }, { wch: 6 }, { wch: 6 }, { wch: 9 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 9 }, { wch: 12 }, { wch: 12 }, { wch: 8 }];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Cost Model");
const out = path.join(process.cwd(), "vendee-cost-model.xlsx");
XLSX.writeFile(wb, out);
console.log("wrote", out);
