"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import AppLayout from "@/components/AppLayout";
import * as XLSX from "xlsx";

type Product = {
  id: string; sku: string | null; name: string; category: string | null;
  unit: string; cost_price: number; sell_price: number; stock_qty: number;
  low_stock_at: number; attr1_type: string | null; attr1_val: string | null;
  attr2_type: string | null; attr2_val: string | null;
};

const fmt = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtB = (n: number) => "฿" + n.toLocaleString("th-TH", { minimumFractionDigits: 0 });

// ── Add / Edit modal ─────────────────────────────────────────────────────────
function ProductModal({ product, onClose, onSave }: {
  product?: Product | null;
  onClose: () => void;
  onSave: (data: Partial<Product>) => void;
}) {
  const [form, setForm] = useState({
    sku:         product?.sku         ?? "",
    name:        product?.name        ?? "",
    category:    product?.category    ?? "",
    unit:        product?.unit        ?? "ชิ้น",
    cost_price:  product?.cost_price  ?? 0,
    sell_price:  product?.sell_price  ?? 0,
    stock_qty:   product?.stock_qty   ?? 0,
    low_stock_at: product?.low_stock_at ?? 5,
    attr1_type:  product?.attr1_type  ?? "",
    attr1_val:   product?.attr1_val   ?? "",
    attr2_type:  product?.attr2_type  ?? "",
    attr2_val:   product?.attr2_val   ?? "",
  });

  function set(k: string, v: string | number) { setForm((f) => ({ ...f, [k]: v })); }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-lg">{product ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">รหัสสินค้า (SKU)</label>
            <input value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="P0001"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">หน่วย</label>
            <input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="ชิ้น"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">ชื่อสินค้า <span className="text-red-500">*</span></label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="ชื่อสินค้า"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">หมวดหมู่</label>
          <input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="เช่น เสื้อผ้า, อาหาร"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">ราคาทุน (฿)</label>
            <input type="number" value={form.cost_price} onChange={(e) => set("cost_price", +e.target.value)} min={0}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">ราคาขาย (฿)</label>
            <input type="number" value={form.sell_price} onChange={(e) => set("sell_price", +e.target.value)} min={0}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">จำนวนคงเหลือ</label>
            <input type="number" value={form.stock_qty} onChange={(e) => set("stock_qty", +e.target.value)} min={0}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">แจ้งเตือนเมื่อต่ำกว่า</label>
            <input type="number" value={form.low_stock_at} onChange={(e) => set("low_stock_at", +e.target.value)} min={0}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
        </div>

        {/* Attributes */}
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500 mb-2">คุณสมบัติ (เช่น Size, Color) — ไม่บังคับ</p>
          <div className="grid grid-cols-2 gap-2">
            <input value={form.attr1_type} onChange={(e) => set("attr1_type", e.target.value)} placeholder="ประเภท เช่น Size"
              className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300" />
            <input value={form.attr1_val} onChange={(e) => set("attr1_val", e.target.value)} placeholder="ค่า เช่น M"
              className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300" />
            <input value={form.attr2_type} onChange={(e) => set("attr2_type", e.target.value)} placeholder="ประเภท เช่น Color"
              className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300" />
            <input value={form.attr2_val} onChange={(e) => set("attr2_val", e.target.value)} placeholder="ค่า เช่น ดำ"
              className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">
            ยกเลิก
          </button>
          <button onClick={() => onSave(form)} disabled={!form.name}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#0A192F] text-white hover:bg-[#0d2240] disabled:opacity-40">
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Adjust stock modal ───────────────────────────────────────────────────────
function AdjustModal({ product, onClose, onSave }: {
  product: Product;
  onClose: () => void;
  onSave: (type: "in"|"out"|"adjust", qty: number, note: string) => void;
}) {
  const [type, setType] = useState<"in"|"out"|"adjust">("in");
  const [qty,  setQty]  = useState(0);
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">ปรับสต็อก — {product.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
          <span className="text-sm text-gray-500">สต็อกปัจจุบัน</span>
          <span className="font-bold text-gray-800">{fmt(product.stock_qty)} {product.unit}</span>
        </div>

        <div className="flex gap-2">
          {(["in","out","adjust"] as const).map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                type === t
                  ? t === "in" ? "bg-emerald-500 text-white"
                    : t === "out" ? "bg-rose-500 text-white"
                    : "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-500"
              }`}>
              {t === "in" ? "รับของเข้า" : t === "out" ? "จ่ายออก" : "ปรับยอด"}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">จำนวน ({product.unit})</label>
          <input type="number" value={qty} onChange={(e) => setQty(+e.target.value)} min={0}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">หมายเหตุ</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น รับของล็อต 2"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600">ยกเลิก</button>
          <button onClick={() => onSave(type, qty, note)} disabled={qty <= 0}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#0A192F] text-white disabled:opacity-40">
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StockPage() {
  const [lineUserId, setLineUserId] = useState("");
  const [authReady,  setAuthReady]  = useState(false);
  const { data: session, status: sessionStatus } = useSession();

  const [products,  setProducts]  = useState<Product[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [showAdd,   setShowAdd]   = useState(false);
  const [editProd,  setEditProd]  = useState<Product | null>(null);
  const [adjustProd,setAdjustProd]= useState<Product | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Auth
  useEffect(() => {
    if (sessionStatus === "loading") return;
    async function resolve() {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (liffId) {
        try {
          const { default: liff } = await import("@line/liff");
          await liff.init({ liffId });
          if (liff.isLoggedIn()) {
            const p = await liff.getProfile();
            setLineUserId(p.userId); setAuthReady(true); return;
          }
        } catch { /* ignore */ }
      }
      if (session?.user?.email) {
        const res = await fetch("/api/user/by-email");
        if (res.ok) { const d = await res.json(); if (d.lineUserId) setLineUserId(d.lineUserId); }
      }
      setAuthReady(true);
    }
    resolve();
  }, [sessionStatus, session]);

  // Load products
  const loadProducts = async () => {
    if (!lineUserId) return;
    setLoading(true);
    const res = await fetch(`/api/products?lineUserId=${lineUserId}&search=${search}`);
    const d   = await res.json();
    setProducts(d.products ?? []);
    setLoading(false);
  };

  useEffect(() => { if (authReady && lineUserId) loadProducts(); else if (authReady) setLoading(false); }, [authReady, lineUserId]);
  useEffect(() => { if (lineUserId) { const t = setTimeout(loadProducts, 300); return () => clearTimeout(t); } }, [search]);

  async function handleSave(data: Partial<Product>) {
    if (editProd) {
      await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId, id: editProd.id, ...data }) });
    } else {
      await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId, ...data }) });
    }
    setShowAdd(false); setEditProd(null); loadProducts();
  }

  async function handleDelete(id: string) {
    if (!confirm("ลบสินค้านี้ใช่มั้ย?")) return;
    await fetch("/api/products", { method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId, id }) });
    loadProducts();
  }

  async function handleAdjust(type: "in"|"out"|"adjust", qty: number, note: string) {
    if (!adjustProd) return;
    await fetch("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId, productId: adjustProd.id, type, qty, note }) });
    setAdjustProd(null); loadProducts();
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg("");
    const fd = new FormData();
    fd.append("file", file); fd.append("lineUserId", lineUserId);
    const res = await fetch("/api/products/import", { method: "POST", body: fd });
    const d   = await res.json();
    setImportMsg(d.ok ? `นำเข้าสำเร็จ ${d.saved} สินค้า` : `Error: ${d.error}`);
    setImporting(false);
    e.target.value = "";
    loadProducts();
  }

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const headers = [
      ["ข้อมูลทั่วไป","","","","","ข้อมูลการซื้อ","ข้อมูลการขาย","ยอดยกมา","คุณสมบัติ","คุณสมบัติ"],
      ["รหัสสินค้า","ชื่อสินค้า*","หมวดหมู่","หน่วยสินค้า (ตัวอย่าง: ชิ้น, ตัว)","Barcode","ราคาต่อหน่วย","ราคาขาย","จำนวนหน่วย","ประเภทคุณสมบัติ","คุณสมบัติ"],
      ["P0001","เสื้อยืด สีขาว M","เสื้อผ้า","ตัว","","150","350","10","Size","M"],
      ["P0002","เสื้อยืด สีดำ L","เสื้อผ้า","ตัว","","150","350","8","Size","L"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    ws["!cols"] = [{wch:12},{wch:25},{wch:12},{wch:18},{wch:12},{wch:12},{wch:10},{wch:10},{wch:15},{wch:10}];
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "product_import_template.xlsx");
  }

  const lowStockProducts = products.filter((p) => p.stock_qty <= p.low_stock_at && p.stock_qty >= 0);
  const totalValue       = products.reduce((s, p) => s + p.stock_qty * p.cost_price, 0);

  return (
    <AppLayout title="สต็อกสินค้า">
      <div className="px-4 lg:px-6 py-6 max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">สต็อกสินค้า</h1>
            <p className="text-sm text-gray-400">{products.length} รายการ · มูลค่ารวม {fmtB(totalValue)}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:border-gray-400 transition-colors">
              ⬇ Template
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            <button onClick={() => fileRef.current?.click()} disabled={importing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50">
              {importing ? "กำลังนำเข้า..." : "📥 นำเข้า Excel"}
            </button>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-[#0A192F] text-white hover:bg-[#0d2240] transition-colors">
              + เพิ่มสินค้า
            </button>
          </div>
        </div>

        {importMsg && (
          <div className={`px-4 py-2.5 rounded-xl text-sm font-medium ${
            importMsg.startsWith("Error") ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
          }`}>{importMsg}</div>
        )}

        {/* Low stock warning */}
        {lowStockProducts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="font-semibold text-amber-700 text-sm mb-2">⚠️ สินค้าใกล้หมด {lowStockProducts.length} รายการ</p>
            <div className="flex flex-wrap gap-2">
              {lowStockProducts.map((p) => (
                <span key={p.id} className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">
                  {p.name} ({fmt(p.stock_qty)} {p.unit})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 ค้นหาสินค้า..."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A192F]/20" />

        {/* Product table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">กำลังโหลด...</div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-4xl mb-3">📦</p>
              <p className="text-gray-500 font-medium">ยังไม่มีสินค้า</p>
              <p className="text-gray-400 text-sm mt-1">เพิ่มสินค้าหรือนำเข้าจาก Excel</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">สินค้า</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">ราคาทุน</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">ราคาขาย</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">คงเหลือ</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => {
                  const isLow = p.stock_qty <= p.low_stock_at;
                  return (
                    <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/30"}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400">
                          {p.sku && <span className="mr-2">{p.sku}</span>}
                          {p.category && <span className="mr-2">{p.category}</span>}
                          {p.attr1_type && <span>{p.attr1_type}: {p.attr1_val}</span>}
                          {p.attr2_type && <span className="ml-2">{p.attr2_type}: {p.attr2_val}</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{fmtB(p.cost_price)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{fmtB(p.sell_price)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${isLow ? "text-rose-500" : "text-emerald-600"}`}>
                          {fmt(p.stock_qty)}
                        </span>
                        <span className="text-gray-400 text-xs ml-1">{p.unit}</span>
                        {isLow && <span className="ml-1 text-xs">⚠️</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setAdjustProd(p)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                            ปรับสต็อก
                          </button>
                          <button onClick={() => setEditProd(p)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                            แก้ไข
                          </button>
                          <button onClick={() => handleDelete(p.id)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {(showAdd || editProd) && (
        <ProductModal product={editProd} onClose={() => { setShowAdd(false); setEditProd(null); }} onSave={handleSave} />
      )}
      {adjustProd && (
        <AdjustModal product={adjustProd} onClose={() => setAdjustProd(null)} onSave={handleAdjust} />
      )}
    </AppLayout>
  );
}
