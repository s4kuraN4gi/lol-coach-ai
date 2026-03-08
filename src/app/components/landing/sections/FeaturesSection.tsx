"use client";

import { motion } from "framer-motion";
import { LuChartBar, LuMessageCircle } from "react-icons/lu";
import { useTranslation } from "@/contexts/LanguageContext";

export default function FeaturesSection() {
  const { t } = useTranslation();

  return (
    <section className="py-32 relative" aria-labelledby="features-heading">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <span className="text-cyan-400 font-bold uppercase tracking-widest text-sm">{t('landingPage.features.label')}</span>
          <h2 id="features-heading" className="text-4xl md:text-5xl font-black mt-4 mb-6">
            {t('landingPage.features.sectionTitlePrefix')}<span className="text-cyan-400">{t('landingPage.features.sectionTitle')}</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {t('landingPage.features.sectionDesc')}
          </p>
        </motion.div>

        {/* Large Feature Cards */}
        <div className="space-y-8">
          {/* Feature 1 */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="grid md:grid-cols-2 gap-8 items-center"
          >
            <div className="bg-gradient-to-br from-[#0f0f15] to-[#0a0a0f] p-8 rounded-2xl border border-white/5">
              <div className="aspect-video bg-black/50 rounded-lg flex items-center justify-center">
                <div className="text-6xl text-cyan-400/50">
                  <LuChartBar />
                </div>
              </div>
            </div>
            <div>
              <span className="text-cyan-400 font-bold text-sm uppercase tracking-wider">01</span>
              <h3 className="text-3xl font-bold mt-2 mb-4">{t('landingPage.features.statsTitle')}</h3>
              <p className="text-gray-400 leading-relaxed mb-6">
                {t('landingPage.features.statsDesc')}
              </p>
              <ul className="space-y-2 text-sm">
                {[t('landingPage.features.statsFeature1'), t('landingPage.features.statsFeature2'), t('landingPage.features.statsFeature3')].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-300">
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* Feature 2 */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="grid md:grid-cols-2 gap-8 items-center"
          >
            <div className="md:order-2 bg-gradient-to-br from-[#0f0f15] to-[#0a0a0f] p-8 rounded-2xl border border-white/5">
              <div className="aspect-video bg-black/50 rounded-lg flex items-center justify-center">
                <div className="text-6xl text-purple-400/50">
                  <LuMessageCircle />
                </div>
              </div>
            </div>
            <div className="md:order-1">
              <span className="text-purple-400 font-bold text-sm uppercase tracking-wider">02</span>
              <h3 className="text-3xl font-bold mt-2 mb-4">{t('landingPage.features.chatTitle')}</h3>
              <p className="text-gray-400 leading-relaxed mb-6">
                {t('landingPage.features.chatDesc')}
              </p>
              <ul className="space-y-2 text-sm">
                {[t('landingPage.features.chatFeature1'), t('landingPage.features.chatFeature2'), t('landingPage.features.chatFeature3')].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-300">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
