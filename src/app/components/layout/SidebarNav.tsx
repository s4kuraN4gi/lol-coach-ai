"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { signOut } from "../../actions/auth";
import { useTranslation } from "@/contexts/LanguageContext";

import { LuLayoutDashboard, LuTrendingUp, LuBrainCircuit, LuMessageSquare, LuSettings, LuLogOut, LuCircleDollarSign, LuSwords, LuBox, LuSparkles, LuExternalLink, LuMenu, LuX } from "react-icons/lu";

export default function SidebarNav() {
    const router = useRouter();
    const pathname = usePathname();
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    // Close drawer on route change
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    // Prevent scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    const handleLogout = async () => {
      await signOut();
    }

    const navItems = [
      { name: t('sidebar.nav.dashboard'), href: "/dashboard", icon: <LuLayoutDashboard /> },
      { name: t('sidebar.nav.stats'), href: "/dashboard/stats", icon: <LuTrendingUp /> },
      { name: t('sidebar.nav.coach'), href: "/dashboard/coach", icon: <LuBrainCircuit /> },
      { name: t('sidebar.nav.analysis'), href: "/chat", icon: <LuMessageSquare /> },
      { name: t('sidebar.nav.account'), href: "/account", icon: <LuSettings /> },
    ];

    const referenceItems = [
      { name: t('sidebar.nav.champions'), href: "/champions", icon: <LuSwords /> },
      { name: t('sidebar.nav.items'), href: "/items", icon: <LuBox /> },
      { name: t('sidebar.nav.economy'), href: "/guide/gold", icon: <LuCircleDollarSign /> },
      { name: t('sidebar.nav.runeGuide'), href: "/guide/runes", icon: <LuSparkles /> },
    ];

    const sidebarContent = (
        <>
            <div>
              <div className="flex items-center justify-between mb-8 px-2">
                  <h2 className="text-2xl font-black tracking-tighter">
                      <span className="text-cyan-400">LoL</span> Coach AI
                  </h2>
                  <button
                      onClick={() => setIsOpen(false)}
                      className="lg:hidden p-2 text-slate-400 hover:text-white transition"
                      aria-label="Close menu"
                  >
                      <LuX className="text-xl" />
                  </button>
              </div>
              <nav className="flex flex-col gap-2 text-slate-400">
                  {navItems.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`font-bold flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative overflow-hidden
                                ${isActive
                                    ? "bg-primary/10 text-primary shadow-[0_0_15px_rgba(240,230,140,0.1)] border-l-2 border-primary"
                                    : "hover:bg-slate-800/80 hover:text-white"
                                }
                            `}
                        >
                            <span className={`text-xl transition-transform duration-200 ${isActive ? "scale-110" : "group-hover:scale-110"}`}>
                                {item.icon}
                            </span>
                            <span className="tracking-wide text-sm">{item.name}</span>
                        </Link>
                      );
                  })}
              </nav>

              {/* Reference Pages */}
              <div className="mt-6 pt-4 border-t border-slate-800/50">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600 px-4 mb-2">{t('sidebar.reference')}</div>
                  <nav className="flex flex-col gap-1 text-slate-500">
                      {referenceItems.map((item) => (
                          <Link
                              key={item.href}
                              href={item.href}
                              className="flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 group hover:bg-slate-800/80 hover:text-slate-300"
                          >
                              <span className="text-lg group-hover:scale-110 transition-transform duration-200">
                                  {item.icon}
                              </span>
                              <span className="tracking-wide text-xs">{item.name}</span>
                              <LuExternalLink className="ml-auto text-[10px] opacity-0 group-hover:opacity-50 transition-opacity" />
                          </Link>
                      ))}
                  </nav>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-800">
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500 px-4 mb-4">
                  <Link href="/terms" className="hover:text-blue-400 transition">{t('sidebar.footer.terms')}</Link>
                  <Link href="/privacy" className="hover:text-blue-400 transition">{t('sidebar.footer.privacy')}</Link>
                  <Link href="/legal" className="hover:text-blue-400 transition">{t('sidebar.footer.legal')}</Link>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left text-red-400 hover:text-red-300 hover:bg-red-900/20 px-4 py-3 rounded-lg font-bold transition flex items-center gap-3"
              >
                <span className="text-xl"><LuLogOut /></span>
                {t('sidebar.logout').toUpperCase()}
              </button>
            </div>
        </>
    );

  return (
    <>
        {/* Mobile hamburger button */}
        <button
            onClick={() => setIsOpen(true)}
            className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg text-slate-300 hover:text-white transition"
            aria-label="Open menu"
        >
            <LuMenu className="text-xl" />
        </button>

        {/* Mobile overlay */}
        {isOpen && (
            <div
                className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                onClick={() => setIsOpen(false)}
            />
        )}

        {/* Sidebar: always visible on lg+, drawer on mobile */}
        <aside className={`
            fixed lg:sticky top-0 left-0 h-screen z-50
            w-64 bg-[#0f0f15]/95 lg:bg-[#0f0f15]/80 backdrop-blur-xl border-r border-white/5 p-6
            flex flex-col justify-between
            transition-transform duration-300 ease-in-out
            ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}>
            {sidebarContent}
        </aside>
    </>
  )
}
