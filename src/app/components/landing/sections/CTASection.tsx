"use client";

import { motion } from "framer-motion";
import { useTranslation } from "@/contexts/LanguageContext";
import { MagneticButton } from "../utils";

export default function CTASection() {
  const { t } = useTranslation();

  return (
    <section className="py-32 relative overflow-hidden" aria-labelledby="cta-heading">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent" />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/10 rounded-full blur-[200px]"
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      <div className="container mx-auto px-6 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 id="cta-heading" className="text-4xl md:text-6xl font-black mb-6">
            {t('landingPage.cta.titlePrefix')}<span className="text-cyan-400">{t('landingPage.cta.title')}</span>{t('landingPage.cta.titleEnd')}
          </h2>
          <p className="text-gray-400 mb-10 max-w-xl mx-auto">
            {t('landingPage.cta.desc')}
          </p>
          <MagneticButton
            href="/signup"
            className="inline-block px-12 py-5 text-xl font-bold bg-white text-black rounded-lg hover:bg-gray-100 transition shadow-2xl shadow-white/10"
          >
            {t('landingPage.cta.button')}
          </MagneticButton>
          <p className="text-sm text-slate-400 mt-4">
            {t('landingPage.hero.freeSubText', 'Free to start — 3 AI analyses per week')}
          </p>

          {/* Trust indicators */}
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full" />
              <span>{t('landingPage.cta.trustRiot')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-cyan-400 rounded-full" />
              <span>{t('landingPage.cta.trustNoCc')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-400 rounded-full" />
              <span>{t('landingPage.cta.trustJa')}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
