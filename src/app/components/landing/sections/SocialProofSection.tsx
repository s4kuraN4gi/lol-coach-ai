"use client";

import { motion } from "framer-motion";
import { useTranslation } from "@/contexts/LanguageContext";

export default function SocialProofSection() {
  const { t } = useTranslation();

  return (
    <section className="py-24 relative overflow-hidden" aria-labelledby="social-proof-heading">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent" />
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-emerald-400 text-sm font-mono tracking-wider uppercase">
            {t('landingPage.socialProof.label')}
          </span>
          <h2 id="social-proof-heading" className="text-3xl md:text-5xl font-black mt-3">
            {t('landingPage.socialProof.title')}
          </h2>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto mb-16">
          {[
            { value: t('landingPage.socialProof.stat1Value'), label: t('landingPage.socialProof.stat1Label') },
            { value: t('landingPage.socialProof.stat2Value'), label: t('landingPage.socialProof.stat2Label') },
            { value: t('landingPage.socialProof.stat3Value'), label: t('landingPage.socialProof.stat3Label') },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-3xl md:text-4xl font-black text-emerald-400">{stat.value}</div>
              <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {([
            { n: 1, stars: 5 },
            { n: 2, stars: 5 },
            { n: 3, stars: 4 },
            { n: 4, stars: 5 },
            { n: 5, stars: 4 },
            { n: 6, stars: 5 },
          ] as const).map(({ n, stars }, i) => (
            <motion.div
              key={n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm"
            >
              <div className="flex gap-1 mb-3" role="img" aria-label={`${stars} out of 5 stars`}>
                {[...Array(5)].map((_, j) => (
                  <span key={j} className={`text-sm ${j < stars ? 'text-yellow-400' : 'text-gray-600'}`} aria-hidden="true">★</span>
                ))}
              </div>
              <p className="text-gray-300 text-sm leading-relaxed mb-4">
                &ldquo;{t(`landingPage.socialProof.testimonial${n}`)}&rdquo;
              </p>
              <div className="text-xs text-gray-500">
                {t(`landingPage.socialProof.testimonial${n}Author`)}
              </div>
            </motion.div>
          ))}
        </div>
        <p className="text-center text-xs text-gray-500 mt-4">{t('landingPage.socialProof.disclaimer')}</p>
      </div>
    </section>
  );
}
