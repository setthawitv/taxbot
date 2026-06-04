"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import AppLayout from "@/components/AppLayout";
import * as XLSX from "xlsx";

type PlatformMapping = { id: string; platform: string; platform_name: string };

type Product = {
  id: string; sku: string | null; name: string; category: string | null;
  unit: string; cost_price: number; sell_price: number; stock_qty: number;
  low_stock_at: number; attr1_type: string | null; attr1_val: string | null;
  attr2_type: string | null; attr2_val: string | null;
  product_platform_names?: PlatformMapping[];
};

const PLATFORM_LABELS: Record<string, { label: string; color: string }> = {
  shopee:  { label: "Shopee",  color: "bg-orange-100 text-orange-700" },
  tiktok:  { label: "TikTok",  color: "bg-pink-100 text-pink-700"     },
  lazada:  { label: "Lazada",  color: "bg-blue-100 text-blue-700"     },
  manual:  { label: "Manual",  color: "bg-gray-100 text-gray-600"     },
};

const fmt = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtB = (n: number) => "฿" + n.toLocaleString("th-TH", { minimumFractionDigits: 0 });

// ── Platform Mapping Modal ────────────────────────────────────────────────────
function MappingModal({ product, lineUserId, onClose, onSaved }: {
  product: Product;
  lineUserId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mappings, setMappings] = useState<PlatformMapping[]>(product.product_platform_names ?? []);
  const [platform, setPlatform] = useState("shopee");
  const [name,     setName]     = useState("");
  const [saving,   setSaving]   = useState(false);

  async function addMapping() {
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/stock/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId, productId: product.id, platform, platformName: name.trim() }),
    });
    const res = await fetch(`/api/products?lineUserId=${lineUserId}`);
    const d   = await res.json();
    const updated = (d.products ?? []).find((p: Product) => p.id === product.id);
    setMappings(updated?.product_platform_names ?? []);
    setName(""); setSaving(false); onSaved();
  }

  async function deleteMapping(id: string) {
    await fetch("/api/stock/mapping", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, lineUserId }),
    });
    setMappings((m) => m.filter((x) => x.id !== id));
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-800">Platform Mapping</h3>
              <p className="text-sm text-gray-400 mt-0.5">{product.name}{product.attr1_val ? ` · ${product.attr1_val}` : ""}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Existing mappings */}
          {mappings.length > 0 ? (
            <div className="space-y-2">
              {mappings.map((m) => {
                const pl    = PLATFORM_LABELS[m.platform] ?? { label: m.platform, color: "bg-gray-100 text-gray-600" };
                const parts = m.platform_name.split(" | ");
                const dispName = parts[0];
                const dispVar  = parts[1] ?? "";
                return (
                  <div key={m.id} className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${pl.color}`}>
                        {pl.label}
                      </span>
                      <span className="text-gray-400 text-sm flex-shrink-0">→</span>
                      <span className="text-sm text-gray-700 flex-1 truncate font-medium">{dispName}</span>
                      <button onClick={() => deleteMapping(m.id)}
                        className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0">×</button>
                    </div>
                    {dispVar && (
                      <p className="text-xs text-gray-400 pl-16">
                        ตัวเลือก: <span className="font-semibold text-violet-600">{dispVar}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-2">ยังไม่มี mapping</p>
          )}

          {/* Add new */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">เพิ่ม Mapping ใหม่</p>
            <div className="flex gap-2 items-end">
              <div className="w-28 flex-shrink-0">
                <label className="text-xs text-gray-500 mb-1 block">Platform</label>
                <select value={platform} onChange={(e) => setPlatform(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-300">
                  <option value="shopee">Shopee</option>
                  <option value="tiktok">TikTok</option>
                  <option value="lazada">Lazada</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">ชื่อบน Platform</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="ชื่อที่แสดงใน Excel ของ platform"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
              </div>
              <button onClick={addMapping} disabled={!name.trim() || saving}
                className="px-3 py-2 rounded-xl text-sm font-semibold bg-[#0A192F] text-white disabled:opacity-40 flex-shrink-0">
                + เพิ่ม
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">
            เสร็จสิ้น
          </button>
        </div>
      </div>
    </div>
  );
}

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

        {/* Variants */}
        <div className="border-t border-gray-100 pt-3 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">ตัวเลือกสินค้า (Variant) — ไม่บังคับ</p>
          <p className="text-xs text-gray-400 -mt-2">ใส่ชื่อสินค้าหลักใน "ชื่อสินค้า" ด้านบน ไม่ต้องรวม Size/Color</p>

          <div className="flex items-center gap-2">
            <div className="w-24 flex-shrink-0">
              <label className="text-xs text-gray-500 mb-1 block">ประเภท 1</label>
              <input value={form.attr1_type} onChange={(e) => set("attr1_type", e.target.value)} placeholder="Size"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">ค่า</label>
              <input value={form.attr1_val} onChange={(e) => set("attr1_val", e.target.value)} placeholder="เช่น S, M, L, XL"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-24 flex-shrink-0">
              <label className="text-xs text-gray-500 mb-1 block">ประเภท 2</label>
              <input value={form.attr2_type} onChange={(e) => set("attr2_type", e.target.value)} placeholder="Color"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">ค่า</label>
              <input value={form.attr2_val} onChange={(e) => set("attr2_val", e.target.value)} placeholder="เช่น ดำ, ขาว, แดง"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
          </div>

          {/* Preview badge */}
          {(form.attr1_val || form.attr2_val) && (
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
              <span className="text-xs text-gray-400">ตัวอย่าง:</span>
              <span className="text-sm font-medium text-gray-700">{form.name || "ชื่อสินค้า"}</span>
              {form.attr1_val && (
                <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {form.attr1_type || "Size"}: {form.attr1_val}
                </span>
              )}
              {form.attr2_val && (
                <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                  {form.attr2_type || "Color"}: {form.attr2_val}
                </span>
              )}
            </div>
          )}
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
  const [mappingProd,setMappingProd]= useState<Product | null>(null);
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-800">{p.name}</p>
                          {p.attr1_val && (
                            <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                              {p.attr1_val}
                            </span>
                          )}
                          {p.attr2_val && (
                            <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                              {p.attr2_val}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {p.sku && <span className="mr-2 font-mono">{p.sku}</span>}
                          {p.category && <span className="mr-2">{p.category}</span>}
                          {p.unit && <span className="text-gray-300">· {p.unit}</span>}
                        </p>
                        {/* Platform mappings */}
                        {(p.product_platform_names?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {p.product_platform_names!.map((m) => {
                              const pl = PLATFORM_LABELS[m.platform] ?? { label: m.platform, color: "bg-gray-100 text-gray-600" };
                              return (
                                <span key={m.id} className="inline-flex items-center gap-1 text-[11px] border border-gray-200 rounded-full px-2 py-0.5">
                                  <span className={`font-semibold px-1.5 py-0.5 rounded-full ${pl.color}`}>{pl.label}</span>
                                  <span className="text-gray-400">→</span>
                                  <span className="text-gray-600 max-w-[160px] truncate">
                                    {m.platform_name.split(" | ")[0]}
                                    {m.platform_name.includes(" | ") && (
                                      <span className="ml-1 text-violet-600 font-medium">
                                        [{m.platform_name.split(" | ")[1]}]
                                      </span>
                                    )}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        )}
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
                          <button onClick={() => setMappingProd(p)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                            🔗 Map
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
      {mappingProd && (
        <MappingModal product={mappingProd} lineUserId={lineUserId}
          onClose={() => setMappingProd(null)} onSaved={loadProducts} />
      )}
    </AppLayout>
  );
}
