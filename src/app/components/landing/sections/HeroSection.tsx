"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, MotionValue } from "framer-motion";
import { LuTrendingUp, LuSwords, LuTarget, LuZap } from "react-icons/lu";
import { useTranslation } from "@/contexts/LanguageContext";
import { fadeUpVariants, MagneticButton, TiltCard, StatsCounter } from "../utils";

// Lazy-load heavy decorative effects to reduce initial JS bundle
const FloatingParticles = dynamic(() => import('../HeavyEffects').then(m => ({ default: m.FloatingParticles })), { ssr: false });
const GridBackground = dynamic(() => import('../HeavyEffects').then(m => ({ default: m.GridBackground })), { ssr: false });

interface HeroSectionProps {
  bgY1: MotionValue<number>;
  bgY2: MotionValue<number>;
}

export default function HeroSection({ bgY1, bgY2 }: HeroSectionProps) {
  const { t } = useTranslation();

  return (
    <header className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      {/* Background Effects */}
      <GridBackground />
      <FloatingParticles />

      {/* Floating Glow Orbs - Parallax */}
      <motion.div
        style={{ y: bgY1 }}
        className="absolute top-[10%] right-[10%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px]"
      />
      <motion.div
        style={{ y: bgY2 }}
        className="absolute bottom-[10%] left-[5%] w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[150px]"
      />

      <div className="container mx-auto px-6 relative z-10">
        {/* Main Hero Content */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <motion.span
              className="inline-block px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-cyan-400 border border-cyan-500/30 rounded-full mb-8 bg-cyan-500/5"
              animate={{
                boxShadow: ["0 0 20px rgba(0,255,255,0)", "0 0 20px rgba(0,255,255,0.3)", "0 0 20px rgba(0,255,255,0)"]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {t('landingPage.bento.badgeAiCoaching')}
            </motion.span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6"
          >
            <span className="block text-white">{t('landingPage.hero.titleLine1')}</span>
            <span className="block bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
              {t('landingPage.hero.titleLine2')}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            {t('landingPage.hero.subtitle')}<br className="hidden md:block" />
            {t('landingPage.hero.subtitlePrefix')}<span className="text-cyan-400 font-semibold">{t('landingPage.hero.subtitleHighlight')}</span>{t('landingPage.hero.subtitleEnd')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <MagneticButton
              href="/signup"
              className="group relative inline-block px-8 py-4 text-lg font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg overflow-hidden"
            >
              <span className="relative z-10">{t('landingPage.hero.ctaStart')}</span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500"
                initial={{ x: "-100%" }}
                whileHover={{ x: 0 }}
                transition={{ duration: 0.3 }}
              />
            </MagneticButton>
            <MagneticButton
              href="/analyze"
              className="group relative px-8 py-4 text-lg font-bold border-2 border-emerald-500/50 text-emerald-400 rounded-lg hover:bg-emerald-500/10 transition"
            >
              <span className="relative z-10">{t('landingPage.hero.ctaAnalyze')}</span>
            </MagneticButton>
          </motion.div>

          {/* Free tier sub-text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="text-sm text-slate-400 mt-4"
          >
            {t('landingPage.hero.freeSubText', 'Free to start — 3 AI analyses per week')}
          </motion.p>

          {/* Free Analysis Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="mt-6 flex justify-center"
          >
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-sm text-emerald-300 hover:bg-emerald-500/20 transition"
            >
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              {t('landingPage.hero.freeBadge')}
            </Link>
          </motion.div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-12 gap-4 max-w-6xl mx-auto">
          {/* Main Stats Card - Large */}
          <motion.div
            custom={0}
            initial="hidden"
            animate="visible"
            variants={fadeUpVariants}
            className="col-span-12 md:col-span-8"
          >
            <TiltCard
              className="h-full bg-gradient-to-br from-[#0f0f15] to-[#0a0a0f] p-6 md:p-8 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-colors"
              glowColor="cyan"
            >
              <div className="flex flex-col md:flex-row gap-6 h-full">
                {/* Radar Chart Mock */}
                <div className="flex-shrink-0 flex items-center justify-center">
                  <div className="relative w-40 h-40 md:w-48 md:h-48">
                    <svg viewBox="0 0 100 100" className="w-full h-full" role="img" aria-label="Skill radar chart">
                      {/* Background circles */}
                      <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                      <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                      <circle cx="50" cy="50" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                      {/* Radar polygon */}
                      <motion.polygon
                        points="50,10 85,35 75,80 25,80 15,35"
                        fill="rgba(0, 255, 255, 0.15)"
                        stroke="rgba(0, 255, 255, 0.8)"
                        strokeWidth="2"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 1, delay: 0.5 }}
                      />
                      {/* Data points */}
                      {[[50, 10], [85, 35], [75, 80], [25, 80], [15, 35]].map(([cx, cy], i) => (
                        <motion.circle
                          key={i}
                          cx={cx}
                          cy={cy}
                          r="4"
                          fill="#00ffff"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.8 + i * 0.1 }}
                        />
                      ))}
                    </svg>
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full" />
                  </div>
                </div>

                {/* Stats Content */}
                <div className="flex-1">
                  <div className="text-xs text-cyan-400 font-bold uppercase tracking-wider mb-2">{t('landingPage.bento.skillLabel')}</div>
                  <h3 className="text-2xl font-bold mb-4">{t('landingPage.bento.skillAnalysis')}</h3>
                  <p className="text-gray-400 text-sm mb-6">{t('landingPage.bento.skillDesc')}</p>

                  {/* Mini stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-white/5 rounded-lg">
                      <div className="text-2xl font-black text-cyan-400"><StatsCounter value={87} suffix="%" /></div>
                      <div className="text-xs text-gray-500">{t('landingPage.bento.csAccuracy')}</div>
                    </div>
                    <div className="text-center p-3 bg-white/5 rounded-lg">
                      <div className="text-2xl font-black text-purple-400"><StatsCounter value={142} /></div>
                      <div className="text-xs text-gray-500">{t('landingPage.bento.visionScore')}</div>
                    </div>
                    <div className="text-center p-3 bg-white/5 rounded-lg">
                      <div className="text-2xl font-black text-amber-400"><StatsCounter value={24} suffix="K" /></div>
                      <div className="text-xs text-gray-500">{t('landingPage.bento.totalDamage')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </TiltCard>
          </motion.div>

          {/* Win Rate Card */}
          <motion.div
            custom={1}
            initial="hidden"
            animate="visible"
            variants={fadeUpVariants}
            className="col-span-6 md:col-span-4"
          >
            <TiltCard
              className="h-full bg-gradient-to-br from-[#0f0f15] to-[#0a0a0f] p-6 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-colors flex flex-col justify-center items-center"
              glowColor="emerald"
            >
              <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-2">{t('landingPage.bento.winRateLabel')}</div>
              <div className="text-5xl md:text-6xl font-black text-white mb-2">
                <StatsCounter value={67} suffix="%" />
              </div>
              <div className="flex items-center gap-1 text-emerald-400 text-sm">
                <LuTrendingUp className="text-lg" />
                <span>{t('landingPage.bento.winRateChange')}</span>
              </div>
            </TiltCard>
          </motion.div>

          {/* AI Chat Preview */}
          <motion.div
            custom={2}
            initial="hidden"
            animate="visible"
            variants={fadeUpVariants}
            className="col-span-6 md:col-span-4"
          >
            <TiltCard
              className="h-full bg-gradient-to-br from-[#0f0f15] to-[#0a0a0f] p-5 rounded-2xl border border-white/5 hover:border-amber-500/30 transition-colors"
              glowColor="amber"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-bold text-black">
                  AI
                </div>
                <div>
                  <div className="font-bold text-sm">{t('landingPage.bento.aiCoachLabel')}</div>
                  <div className="text-xs text-gray-500">{t('landingPage.bento.activeNow')}</div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="bg-white/5 rounded-lg p-3 text-gray-300">
                  {t('landingPage.bento.aiChatPreview')}
                </div>
              </div>
            </TiltCard>
          </motion.div>

          {/* Feature Card 1 */}
          <motion.div
            custom={3}
            initial="hidden"
            animate="visible"
            variants={fadeUpVariants}
            className="col-span-12 md:col-span-4"
          >
            <TiltCard
              className="h-full bg-gradient-to-br from-[#0f0f15] to-[#0a0a0f] p-6 rounded-2xl border border-white/5 hover:border-purple-500/30 transition-colors"
              glowColor="purple"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-2xl text-purple-400 mb-4">
                <LuSwords />
              </div>
              <h3 className="text-lg font-bold mb-2">{t('landingPage.bento.matchupTitle')}</h3>
              <p className="text-gray-400 text-sm">
                {t('landingPage.bento.matchupDesc')}
              </p>
            </TiltCard>
          </motion.div>

          {/* Feature Card 2 */}
          <motion.div
            custom={4}
            initial="hidden"
            animate="visible"
            variants={fadeUpVariants}
            className="col-span-6 md:col-span-4"
          >
            <TiltCard
              className="h-full bg-gradient-to-br from-[#0f0f15] to-[#0a0a0f] p-6 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-colors"
              glowColor="cyan"
            >
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center text-2xl text-cyan-400 mb-4">
                <LuTarget />
              </div>
              <h3 className="text-lg font-bold mb-2">{t('landingPage.bento.macroTitle')}</h3>
              <p className="text-gray-400 text-sm">
                {t('landingPage.bento.macroDesc')}
              </p>
            </TiltCard>
          </motion.div>

          {/* Feature Card 3 */}
          <motion.div
            custom={5}
            initial="hidden"
            animate="visible"
            variants={fadeUpVariants}
            className="col-span-6 md:col-span-4"
          >
            <TiltCard
              className="h-full bg-gradient-to-br from-[#0f0f15] to-[#0a0a0f] p-6 rounded-2xl border border-white/5 hover:border-amber-500/30 transition-colors"
              glowColor="amber"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-2xl text-amber-400 mb-4">
                <LuZap />
              </div>
              <h3 className="text-lg font-bold mb-2">{t('landingPage.bento.microTitle')}</h3>
              <p className="text-gray-400 text-sm">
                {t('landingPage.bento.microDesc')}
              </p>
            </TiltCard>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center pt-2"
        >
          <motion.div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
        </motion.div>
      </motion.div>
    </header>
  );
}
