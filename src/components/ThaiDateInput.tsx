"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Date input that displays as วว/ดด/ปปปป (Thai convention)
 * but passes YYYY-MM-DD to onChange (for DB/API compatibility).
 */
interface ThaiDateInputProps {
  value: string;           // YYYY-MM-DD
  onChange: (v: string) => void; // called with YYYY-MM-DD
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

/** "2026-05-20" → "20/05/2026" */
function toThai(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** "20/05/2026" → "2026-05-20" — returns "" if incomplete */
function toIso(thai: string): string {
  const clean = thai.replace(/[^\d/]/g, "");
  const parts = clean.split("/");
  if (parts.length !== 3) return "";
  const [d, m, y] = parts;
  if (d.length !== 2 || m.length !== 2 || y.length !== 4) return "";
  const date = new Date(`${y}-${m}-${d}`);
  if (isNaN(date.getTime())) return "";
  return `${y}-${m}-${d}`;
}

/** Auto-insert slashes as user types */
function formatLive(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export default function ThaiDateInput({
  value, onChange, className = "", disabled, required,
}: ThaiDateInputProps) {
  const [display, setDisplay] = useState(toThai(value));
  const [error,   setError]   = useState(false);
  const prevIso = useRef(value);

  // Sync if parent changes value externally (e.g. OCR pre-fill)
  useEffect(() => {
    if (value !== prevIso.current) {
      prevIso.current = value;
      setDisplay(toThai(value));
      setError(false);
    }
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const formatted = formatLive(raw);
    setDisplay(formatted);

    const iso = toIso(formatted);
    if (iso) {
      setError(false);
      prevIso.current = iso;
      onChange(iso);
    } else {
      // Only show error when full length is typed
      setError(formatted.replace(/\D/g, "").length === 8);
    }
  }

  function handleBlur() {
    // On blur: if valid, snap to clean format
    const iso = toIso(display);
    if (iso) {
      setDisplay(toThai(iso));
      setError(false);
    } else if (display) {
      setError(true);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        placeholder="วว/ดด/ปปปป"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        required={required}
        maxLength={10}
        className={`${className} ${error ? "border-red-400 focus:ring-red-300" : ""}`}
      />
      {error && (
        <p className="text-red-500 text-xs mt-0.5">รูปแบบวันที่ไม่ถูกต้อง (วว/ดด/ปปปป)</p>
      )}
    </div>
  );
}
