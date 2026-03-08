"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Footer from "@/app/components/layout/Footer";
import { LuMenu, LuX } from "react-icons/lu";
import { useTranslation } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import LandingPageJsonLd from "@/app/components/seo/LandingPageJsonLd";
import { MagneticButton } from "./utils";
import HeroSection from "./sections/HeroSection";
// Below-fold sections: lazy-load to reduce initial JS (includes framer-motion)
const FeaturesSection = dynamic(() => import("./sections/FeaturesSection"), { ssr: false });
const SocialProofSection = dynamic(() => import("./sections/SocialProofSection"), { ssr: false });
const CTASection = dynamic(() => import("./sections/CTASection"), { ssr: false });

// Lazy-load heavy decorative effects to reduce initial JS bundle
const MouseFollowGlow = dynamic(() => import('./HeavyEffects').then(m => ({ default: m.MouseFollowGlow })), { ssr: false });

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function LandingPageClient() {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });

  // Parallax transforms
  const bgY1 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const bgY2 = useTransform(scrollYProgress, [0, 1], [0, -200]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0a0a0f] text-white font-sans selection:bg-cyan-500 selection:text-black overflow-x-hidden" role="main">
      {/* SEO Structured Data */}
      <LandingPageJsonLd />

      {/* Mouse Follow Glow */}
      <MouseFollowGlow />

      {/* Navigation */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled ? "bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-cyan-500/10" : "bg-transparent"
        }`}
      >
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <motion.div
            className="flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-2xl font-black tracking-tight">
              <span className="text-cyan-400">LoL</span> Coach AI
            </span>
          </motion.div>
          <div className="hidden md:flex gap-4 items-center">
            <LanguageSwitcher />
            <Link href="/champions" className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition hidden lg:block">
              {t('publicNav.champions')}
            </Link>
            <Link href="/items" className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition hidden lg:block">
              {t('publicNav.items')}
            </Link>
            <Link href="/guide/gold" className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition hidden lg:block">
              {t('publicNav.guideGold')}
            </Link>
            <Link href="/guide/runes" className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition hidden lg:block">
              {t('publicNav.guideRunes')}
            </Link>
            <Link href="/pricing" className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition">
              {t('landingPage.nav.pricing')}
            </Link>
            <Link href="/login" className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition">
              {t('landingPage.nav.login')}
            </Link>
            <MagneticButton href="/signup" className="px-5 py-2.5 text-sm font-bold bg-cyan-500 text-black rounded-lg transition shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40">
              {t('landingPage.nav.getStarted')}
            </MagneticButton>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center gap-2">
            <LanguageSwitcher />
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-300 hover:text-white transition" aria-label="Toggle menu">
              {mobileMenuOpen ? <LuX className="text-xl" /> : <LuMenu className="text-xl" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-cyan-500/10 px-6 py-4 flex flex-col gap-2"
          >
            <Link href="/champions" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white transition rounded-lg hover:bg-slate-800/50">{t('publicNav.champions')}</Link>
            <Link href="/items" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white transition rounded-lg hover:bg-slate-800/50">{t('publicNav.items')}</Link>
            <Link href="/guide/gold" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white transition rounded-lg hover:bg-slate-800/50">{t('publicNav.guideGold')}</Link>
            <Link href="/guide/runes" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white transition rounded-lg hover:bg-slate-800/50">{t('publicNav.guideRunes')}</Link>
            <Link href="/pricing" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white transition rounded-lg hover:bg-slate-800/50">{t('landingPage.nav.pricing')}</Link>
            <div className="flex gap-3 pt-2 border-t border-slate-800/50">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="flex-1 text-center px-4 py-3 text-sm font-medium text-gray-400 hover:text-white transition rounded-lg border border-slate-700">{t('landingPage.nav.login')}</Link>
              <Link href="/signup" onClick={() => setMobileMenuOpen(false)} className="flex-1 text-center px-4 py-3 text-sm font-bold bg-cyan-500 text-black rounded-lg transition">{t('landingPage.nav.getStarted')}</Link>
            </div>
          </motion.div>
        )}
      </motion.nav>

      {/* Page Sections */}
      <HeroSection bgY1={bgY1} bgY2={bgY2} />
      <FeaturesSection />
      <SocialProofSection />
      <CTASection />

      {/* Footer */}
      <Footer />
    </div>
  );
}
