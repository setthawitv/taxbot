"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  IconHome, IconIncome, IconExpense, IconTax, IconSettings, VendeeLogo, IconInbox, IconCart,
} from "@/components/icons";
import type { ComponentType, ReactNode } from "react";

type NavItem = { href: string; Icon: ComponentType<{ className?: string }>; labelTh: string; labelEn: string };

const NAV: NavItem[] = [
  { href: "/home",     Icon: IconHome,    labelTh: "หน้าหลัก", labelEn: "Dashboard" },
  { href: "/rairab",   Icon: IconIncome,  labelTh: "รายรับ",   labelEn: "Income"    },
  { href: "/raijhai",  Icon: IconExpense, labelTh: "รายจ่าย",  labelEn: "Expense"   },
  { href: "/phasi",    Icon: IconTax,     labelTh: "ภาษี",     labelEn: "Tax"       },
  { href: "/stock",    Icon: IconInbox,   labelTh: "สต็อก",   labelEn: "Stock"     },
  { href: "/shopee-fee", Icon: IconCart,  labelTh: "ค่าฟี Shopee", labelEn: "Fees"  },
  { href: "/settings", Icon: IconSettings,labelTh: "ตั้งค่า",  labelEn: "Settings"  },
];

type UserInfo = { displayName: string; pictureUrl: string; businessName: string };

function useResolvedUser(externalUserInfo?: UserInfo | null) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<UserInfo | null>(externalUserInfo ?? null);

  useEffect(() => {
    if (externalUserInfo) { setUser(externalUserInfo); return; }
    if (status === "loading") return;

    async function resolve() {
      if (session?.user?.email) {
        try {
          const res = await fetch("/api/user/by-email");
          if (res.ok) {
            const d = await res.json();
            if (d.userId) {
              const statusRes = await fetch(`/api/user/status?userId=${d.userId}`);
              if (statusRes.ok) {
                const sd = await statusRes.json();
                setUser({
                  displayName: session.user.name ?? session.user.email ?? "",
                  pictureUrl: session.user.image ?? "",
                  businessName: sd.profile?.businessName ?? "",
                });
                return;
              }
            }
          }
        } catch { /* ignore */ }
        setUser({
          displayName: session.user.name ?? session.user.email ?? "",
          pictureUrl: session.user.image ?? "",
          businessName: "",
        });
      }
    }

    resolve();
  }, [externalUserInfo, status, session]);

  return user;
}

export default function AppLayout({
  children,
  userInfo: externalUserInfo,
  title,
}: {
  children: ReactNode;
  userInfo?: UserInfo | null;
  title?: string;
}) {
  const pathname = usePathname();
  const user = useResolvedUser(externalUserInfo);

  const displayName = user?.businessName || user?.displayName || "Vendee Finance";
  const subName = user?.businessName ? user.displayName : "";

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-56 bg-[#0A192F] z-40 shadow-xl">

        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10 flex-shrink-0">
          <VendeeLogo className="w-8 h-8" />
          <span className="text-white font-bold text-base tracking-tight">Vendee Finance</span>
        </div>

        {/* User card */}
        <div className="px-4 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5">
            {user?.pictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.pictureUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-xs font-bold flex-shrink-0">
                {displayName[0] ?? "T"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{displayName}</p>
              {subName && <p className="text-white/40 text-xs truncate">{subName}</p>}
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, Icon, labelTh, labelEn }) => {
            const active = pathname === href || (href !== "/home" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-900/40"
                    : "text-white/55 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{labelTh}</span>
                <span className={`text-[10px] font-normal ${active ? "text-white/60" : "text-white/25"}`}>
                  {labelEn}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/10 flex-shrink-0">
          <p className="text-white/20 text-[10px] text-center">Vendee Finance · สำหรับร้านค้าออนไลน์ไทย</p>
        </div>
      </aside>

      {/* ── Content area ────────────────────────────────────────────────── */}
      <div className="flex-1 lg:pl-56 flex flex-col min-h-screen">

        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-[#0A192F] flex items-center gap-3 px-4 h-14 flex-shrink-0">
          <div className="w-7 h-7 rounded-md bg-[#10B981] flex items-center justify-center text-white font-extrabold text-xs select-none">T</div>
          <span className="text-white font-bold flex-1 text-sm">
            {title || NAV.find((n) => n.href === pathname)?.labelTh || "Vendee Finance"}
          </span>
          {user?.pictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.pictureUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/15" />
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav ───────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-100">
        <div className="flex h-16">
          {NAV.map(({ href, Icon, labelTh }) => {
            const active = pathname === href || (href !== "/home" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[9px] font-semibold">{labelTh}</span>
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
