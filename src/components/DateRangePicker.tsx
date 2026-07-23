"use client";

import { useEffect, useRef, useState } from "react";

// A compact date-range control: a trigger button showing the current range,
// opening a popover with quick presets + custom from/to inputs. Emits ISO
// date strings (YYYY-MM-DD). Parent owns persistence.

export type DateRange = { from: string; to: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const MONTH_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** Presets return a {from,to} range relative to today. */
export function presetRange(key: string): DateRange {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const at = (yy: number, mm: number, dd: number) => iso(new Date(yy, mm, dd));
  switch (key) {
    case "today":     return { from: at(y, m, d), to: at(y, m, d) };
    case "7d":        return { from: at(y, m, d - 6),  to: at(y, m, d) };
    case "30d":       return { from: at(y, m, d - 29), to: at(y, m, d) };
    case "thisMonth": return { from: at(y, m, 1),      to: at(y, m + 1, 0) };
    case "3m":        return { from: at(y, m - 2, 1),  to: at(y, m + 1, 0) };
    case "thisYear":
    default:          return { from: at(y, 0, 1),      to: at(y, 11, 31) };
  }
}

const PRESETS: { key: string; label: string }[] = [
  { key: "today",     label: "วันนี้" },
  { key: "7d",        label: "7 วันล่าสุด" },
  { key: "30d",       label: "30 วันล่าสุด" },
  { key: "thisMonth", label: "เดือนนี้" },
  { key: "3m",        label: "3 เดือนล่าสุด" },
  { key: "thisYear",  label: "ปีนี้" },
];

function fmt(range: DateRange): string {
  const f = new Date(range.from + "T00:00:00");
  const t = new Date(range.to + "T00:00:00");
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return "เลือกช่วงเวลา";
  const fy = f.getFullYear() + 543, ty = t.getFullYear() + 543;
  const same = range.from === range.to;
  if (same) return `${f.getDate()} ${MONTH_TH[f.getMonth()]} ${fy}`;
  const sameYear = f.getFullYear() === t.getFullYear();
  const left = sameYear ? `${f.getDate()} ${MONTH_TH[f.getMonth()]}` : `${f.getDate()} ${MONTH_TH[f.getMonth()]} ${fy}`;
  return `${left} – ${t.getDate()} ${MONTH_TH[t.getMonth()]} ${ty}`;
}

export default function DateRangePicker({
  value, onChange, className = "",
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from);
  const [to, setTo]     = useState(value.to);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function applyPreset(key: string) {
    const r = presetRange(key);
    onChange(r);
    setOpen(false);
  }
  function applyCustom() {
    if (!from || !to) return;
    const r = from <= to ? { from, to } : { from: to, to: from };
    onChange(r);
    setOpen(false);
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { if (!open) { setFrom(value.from); setTo(value.to); } setOpen((v) => !v); }}
        className="w-full sm:w-auto inline-flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white text-[#0A192F] font-semibold hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0A192F]/20 transition-colors"
      >
        <span className="inline-flex items-center gap-2">
          <span aria-hidden>📅</span> {fmt(value)}
        </span>
        <span className={`text-gray-400 text-xs transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="absolute z-40 mt-2 left-0 w-[min(92vw,340px)] bg-white border border-gray-200 rounded-2xl shadow-xl p-3">
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                className="text-sm text-[#0A192F] font-medium bg-gray-50 hover:bg-[#0A192F] hover:text-white rounded-lg px-3 py-2 text-left transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-400 mb-2">กำหนดเอง</p>
            <div className="flex items-center gap-2">
              <input
                type="date" value={from} max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A192F]/20"
              />
              <span className="text-gray-400 text-sm">–</span>
              <input
                type="date" value={to} min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A192F]/20"
              />
            </div>
            <button
              type="button"
              onClick={applyCustom}
              disabled={!from || !to}
              className="w-full mt-3 py-2.5 rounded-lg bg-[#0A192F] hover:bg-[#0d2242] text-white text-sm font-semibold disabled:opacity-40 transition-colors"
            >
              ใช้ช่วงนี้
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
