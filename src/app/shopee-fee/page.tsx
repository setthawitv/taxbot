"use client";

import { useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { IconCart } from "@/components/icons";

// อัตราค่าธรรมเนียม (โดยประมาณ, รวม VAT แล้วสำหรับค่าธุรกรรม) — แก้ได้ตามจริงของ Shopee
const PAYMENTS = [
  { key: "shopeepay", label: "ShopeePay Wallet",          rate: 3.21 },
  { key: "card",      label: "บัตรเครดิต / เดบิต",         rate: 3.21 },
  { key: "bank",      label: "โอนผ่านธนาคาร / อื่นๆ",       rate: 3.21 },
  { key: "cod",       label: "เก็บเงินปลายทาง (COD)",       rate: 3.21 },
];
const PROGRAMS = [
  { key: "none", label: "ไม่เข้าร่วมโปรแกรม",  rate: 0 },
  { key: "free", label: "ส่งฟรีXtra",          rate: 5.35 },
  { key: "coin", label: "ร้านโค้ดคุ้ม",         rate: 5.35 },
  { key: "both", label: "ส่งฟรี ร้านโค้ดคุ้ม",  rate: 5.35 },
];
const CATEGORIES = [
  { label: "อิเล็กทรอนิกส์ กล้อง/โดรน/คอม/เกม/มือถือ/เครื่องใช้ไฟฟ้า", rate: 5.35 },
  { label: "แฟชั่น เสื้อผ้า กระเป๋า รองเท้า", rate: 5.35 },
  { label: "ความงาม & สุขภาพ",                rate: 5.35 },
  { label: "บ้าน & ไลฟ์สไตล์",                rate: 5.35 },
  { label: "แม่ & เด็ก / ของเล่น",            rate: 5.35 },
  { label: "อื่นๆ",                          rate: 5.35 },
];

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ShopeeFeePage() {
  const [v, setV] = useState<Record<string, string>>({
    price: "110", cost: "30", custDiscount: "10", shipping: "10",
    shopeeDiscount: "10", coin: "20", otherCost: "2",
    commissionPct: "5.35", partnerPct: "4",
  });
  const [paymentKey, setPaymentKey] = useState("shopeepay");
  const [programKey, setProgramKey] = useState("both");
  const [catIdx, setCatIdx]         = useState(0);
  const [isMall, setIsMall]         = useState(false);
  const [vat, setVat]               = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }));
  const num = (k: string) => parseFloat(v[k] || "0") || 0;

  const r = useMemo(() => {
    const price = num("price"), cost = num("cost"), cd = num("custDiscount"), ship = num("shipping");
    const sd = num("shopeeDiscount"), coin = num("coin"), other = num("otherCost");
    const commissionPct = num("commissionPct"), partnerPct = num("partnerPct");
    const paymentRate = PAYMENTS.find((p) => p.key === paymentKey)?.rate ?? 0;
    const programRate = PROGRAMS.find((p) => p.key === programKey)?.rate ?? 0;

    const base    = price - cd + ship;                // ยอดที่คิดค่าธรรมเนียม
    const vatMult = vat ? 1.07 : 1;
    const txnFee        = (base * paymentRate) / 100; // ค่าธุรกรรม (รวม VAT แล้ว)
    const serviceFee    = (base * programRate) / 100 * vatMult;
    const commissionFee = (base * commissionPct) / 100 * vatMult;
    const partnerFee    = (base * partnerPct) / 100;
    const totalFees     = txnFee + serviceFee + commissionFee + partnerFee;
    const feePct        = base > 0 ? (totalFees / base) * 100 : 0;
    const sellerReceived = base - totalFees + sd;     // ร้านได้รับ (บวกส่วนลด Shopee ที่ได้คืน)
    const profit        = sellerReceived - cost - other;
    const marginPct     = cost > 0 ? (profit / cost) * 100 : 0;

    return { price, cost, cd, ship, sd, coin, other, base,
      txnFee, serviceFee, commissionFee, partnerFee, totalFees, feePct, sellerReceived, profit, marginPct };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, paymentKey, programKey, vat]);

  const programLabel = PROGRAMS.find((p) => p.key === programKey)?.label ?? "";

  return (
    <AppLayout title="คิดค่าฟี Shopee">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-500">
            <IconCart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">โปรแกรมคิดค่าธรรมเนียม Shopee</h1>
            <p className="text-xs text-gray-400">Shopee Fee &amp; Profit Calculator</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

          {/* ── Form ─────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="ราคาขาย"            labelClass="text-emerald-600" value={v.price}          onChange={set("price")} />
              <Field label="ต้นทุน"             labelClass="text-emerald-600" value={v.cost}           onChange={set("cost")} />
              <Field label="ส่วนลดให้ลูกค้า (ถ้ามี)" labelClass="text-rose-500"    value={v.custDiscount}   onChange={set("custDiscount")} />
              <Field label="ค่าส่งลูกค้าจ่าย"    labelClass="text-rose-500"    value={v.shipping}       onChange={set("shipping")} />
              <Field label="ส่วนลดจาก Shopee (ถ้ามี)" labelClass="text-amber-500"  value={v.shopeeDiscount} onChange={set("shopeeDiscount")} />
              <Field label="Shopee Coin (ถ้ามี)" labelClass="text-amber-500"   value={v.coin}           onChange={set("coin")} />
            </div>

            <SelectRow label="โปรแกรมที่เข้าร่วม" labelClass="text-rose-500"
              value={programKey} onChange={(e) => setProgramKey(e.target.value)}
              options={PROGRAMS.map((p) => ({ value: p.key, label: p.label }))} />

            <SelectRow label="ช่องทางการชำระเงิน" labelClass="text-rose-500"
              value={paymentKey} onChange={(e) => setPaymentKey(e.target.value)}
              options={PAYMENTS.map((p) => ({ value: p.key, label: p.label }))} />

            <SelectRow label="เลือกประเภทสินค้า (ค่าธรรมเนียมการขาย)" labelClass="text-rose-500"
              value={String(catIdx)}
              onChange={(e) => { const i = +e.target.value; setCatIdx(i); setV((p) => ({ ...p, commissionPct: String(CATEGORIES[i].rate) })); }}
              options={CATEGORIES.map((c, i) => ({ value: String(i), label: `${c.label} (${c.rate}%)` }))} />

            <div className="grid grid-cols-2 gap-3">
              <Field label="ค่าธรรมเนียมการขาย %" labelClass="text-gray-500" value={v.commissionPct} onChange={set("commissionPct")} />
              <Field label="ค่า % โปรโมทผ่านพาร์ทเนอร์" labelClass="text-rose-500" value={v.partnerPct} onChange={set("partnerPct")} />
            </div>
            <Field label="ค่าใช้จ่ายอื่นๆ เช่น ค่ากล่อง ฯลฯ" labelClass="text-rose-500" value={v.otherCost} onChange={set("otherCost")} />

            <div className="flex flex-wrap gap-5 pt-1">
              <Toggle checked={isMall} onChange={setIsMall} label="เป็นร้าน Shopee MALL" />
              <Toggle checked={vat}    onChange={setVat}    label="คำนวณ VAT 7%" labelClass="text-rose-500" />
            </div>
          </div>

          {/* ── Result ───────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-[15px]">
            <Row label="ราคาสินค้า"        val={r.price}   labelClass="text-emerald-600 font-semibold" />
            <Row label="ต้นทุนสินค้า"      val={r.cost} />
            <Row label="ค่าขนส่ง"          val={r.ship} />
            <Row label="ส่วนลดให้ลูกค้า"    val={r.cd} />
            <Row label="ส่วนลดจาก Shopee"   val={r.sd}   labelClass="text-amber-500" />
            <Row label="ใช้ Shopee Coin"    val={r.coin} labelClass="text-amber-500" />
            <Row label="ค่าใช้จ่ายอื่น ๆ"   val={r.other} />
            <Row label="การชำระเงินของผู้ซื้อ" val={r.base} labelClass="text-purple-600 font-bold" valClass="text-purple-600 font-bold" />

            <hr className="my-3 border-gray-100" />

            <Row label="ค่าธุรกรรมการชำระเงิน" val={r.txnFee}        labelClass="text-blue-600" valClass="text-blue-600" />
            <Row label={`ค่าบริการ`}            val={r.serviceFee}    labelClass="text-blue-600" valClass="text-blue-600" note={programLabel} />
            <Row label="ค่าธรรมเนียมการขาย"     val={r.commissionFee} labelClass="text-blue-600" valClass="text-blue-600" />
            <Row label="ค่าโปรโมทผ่านพาร์ทเนอร์" val={r.partnerFee}    labelClass="text-blue-600" valClass="text-blue-600" />
            <Row label="รวมหักค่าธรรมเนียม"      val={r.totalFees}     labelClass="text-purple-600 font-bold" valClass="text-purple-600 font-bold" note={`${r.feePct.toFixed(2)}%`} />

            <hr className="my-3 border-gray-100" />

            <div className="flex items-baseline justify-between">
              <span className="text-purple-600 font-bold">รวมยอดที่ร้านค้าจะได้รับ</span>
              <span className="text-orange-500 font-extrabold text-xl">{fmt(r.sellerReceived)}</span>
            </div>

            <div className="flex items-baseline justify-between mt-4">
              <span className="text-emerald-600 font-bold">กำไรที่ได้จากสินค้าชิ้นนี้</span>
              <span className={`font-extrabold text-2xl underline decoration-2 ${r.profit >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                {fmt(r.profit)}
              </span>
            </div>
            <p className="text-right text-xs text-gray-400 mt-1">
              มาร์จิ้น {r.marginPct.toFixed(2)}% ของต้นทุน
            </p>

            <p className="text-[11px] text-gray-400 mt-5 leading-relaxed">
              * ตัวเลขโดยประมาณ · อัตราค่าธรรมเนียมจริงอาจต่างตามประเภทสินค้า/โปรแกรม/ประเภทร้าน
              {isMall ? " (ร้าน MALL อัตราค่าคอมมิชชั่นมักสูงกว่าปกติ — ปรับ % ได้เอง)" : ""}
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ── Small UI helpers ──────────────────────────────────────────────────────────
function Field({ label, labelClass, value, onChange }: {
  label: string; labelClass?: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className={`text-xs font-semibold mb-1 block ${labelClass ?? "text-gray-600"}`}>{label}</label>
      <input
        type="text" inputMode="decimal" value={value} onChange={onChange}
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400"
      />
    </div>
  );
}

function SelectRow({ label, labelClass, value, onChange, options }: {
  label: string; labelClass?: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className={`text-xs font-semibold mb-1 block ${labelClass ?? "text-gray-600"}`}>{label}</label>
      <select value={value} onChange={onChange}
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 bg-white">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Toggle({ checked, onChange, label, labelClass }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; labelClass?: string;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2">
      <span className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${checked ? "bg-orange-500" : "bg-gray-300"}`}>
        <span className={`w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : ""}`} />
      </span>
      <span className={`text-sm ${labelClass ?? "text-gray-600"}`}>{label}</span>
    </button>
  );
}

function Row({ label, val, labelClass, valClass, note }: {
  label: string; val: number; labelClass?: string; valClass?: string; note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className={labelClass ?? "text-gray-600"}>{label}</span>
      <span className={`tabular-nums ${valClass ?? "text-gray-800 font-medium"}`}>
        {fmt(val)}{note ? <span className="text-xs text-gray-400 font-normal ml-1.5">({note})</span> : null}
      </span>
    </div>
  );
}
