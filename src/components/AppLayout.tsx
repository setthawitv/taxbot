"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconHome, IconIncome, IconExpense, IconTax, IconSettings,
} from "@/components/icons";
import type { ComponentType, ReactNode } from "react";

type NavItem = { href: string; Icon: ComponentType<{ className?: string }>; labelTh: string; labelEn: string };

const NAV: NavItem[] = [
  { href: "/",         Icon: IconHome,    labelTh: "หน้าหลัก", labelEn: "Dashboard" },
  { href: "/rairab",   Icon: IconIncome,  labelTh: "รายรับ",   labelEn: "Income"    },
  { href: "/raijhai",  Icon: IconExpense, labelTh: "รายจ่าย",  labelEn: "Expense"   },
  { href: "/phasi",    Icon: IconTax,     labelTh: "ภาษี",     labelEn: "Tax"       },
  { href: "/settings", Icon: IconSettings,labelTh: "ตั้งค่า",  labelEn: "Settings"  },
];

type UserInfo = { displayName: string; pictureUrl: string; businessName: string };

export default function AppLayout({
  children,
  userInfo,
  title,
}: {
  children: ReactNode;
  userInfo?: UserInfo | null;
  title?: string;
}) {
  const pathname = usePathname();

  const displayName = userInfo?.businessName || userInfo?.displayName || "TaxBot";
  const subName = userInfo?.businessName ? userInfo.displayName : "";

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-56 bg-[#0A192F] z-40 shadow-xl">

        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#10B981] flex items-center justify-center text-white font-extrabold text-sm select-none">
            T
          </div>
          <span className="text-white font-bold text-base tracking-tight">TaxBot</span>
        </div>

        {/* User card */}
        {userInfo && (
          <div className="px-4 py-4 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5">
              {userInfo.pictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={userInfo.pictureUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#10B981]/30 flex items-center justify-center text-[#10B981] text-xs font-bold flex-shrink-0">
                  {displayName[0] ?? "T"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate">{displayName}</p>
                {subName && <p className="text-white/40 text-xs truncate">{subName}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, Icon, labelTh, labelEn }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/55 hover:text-white hover:bg-white/8"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{labelTh}</span>
                <span className={`text-[10px] font-normal ${active ? "text-white/40" : "text-white/25"}`}>
                  {labelEn}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/10 flex-shrink-0">
          <p className="text-white/20 text-[10px] text-center">TaxBot · สำหรับร้านค้าออนไลน์ไทย</p>
        </div>
      </aside>

      {/* ── Content area ────────────────────────────────────────────────── */}
      <div className="flex-1 lg:pl-56 flex flex-col min-h-screen">

        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-[#0A192F] flex items-center gap-3 px-4 h-14 flex-shrink-0">
          <div className="w-7 h-7 rounded-md bg-[#10B981] flex items-center justify-center text-white font-extrabold text-xs select-none">T</div>
          <span className="text-white font-bold flex-1 text-sm">
            {title || displayName || "TaxBot"}
          </span>
          {userInfo?.pictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userInfo.pictureUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/15" />
          )}
        </header>

        {/* Desktop top bar */}
        <div className="hidden lg:flex items-center gap-4 h-16 px-6 bg-white border-b border-gray-100 flex-shrink-0">
          <h1 className="text-[#0A192F] font-bold text-lg flex-1">
            {title || NAV.find((n) => n.href === pathname)?.labelTh || "TaxBot"}
          </h1>
        </div>

        {/* Page content */}
        <main className="flex-1 pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav ───────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-100 safe-area-pb">
        <div className="flex h-16">
          {NAV.map(({ href, Icon, labelTh }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? "text-[#0A192F]" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : ""}`} />
                <span className="text-[9px] font-semibold">{labelTh}</span>
                {active && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#0A192F] rounded-t-full" />}
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
