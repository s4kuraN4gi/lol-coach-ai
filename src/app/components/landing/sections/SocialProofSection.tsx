"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LuLink, LuChartBar, LuTarget } from "react-icons/lu";
import { useTranslation } from "@/contexts/LanguageContext";

export default function SocialProofSection() {
  const { t } = useTranslation();

  const steps = [
    {
      icon: <LuLink className="text-2xl" />,
      color: "cyan",
      title: t('landingPage.howItWorks.step1Title'),
      desc: t('landingPage.howItWorks.step1Desc'),
    },
    {
      icon: <LuChartBar className="text-2xl" />,
      color: "purple",
      title: t('landingPage.howItWorks.step2Title'),
      desc: t('landingPage.howItWorks.step2Desc'),
    },
    {
      icon: <LuTarget className="text-2xl" />,
      color: "emerald",
      title: t('landingPage.howItWorks.step3Title'),
      desc: t('landingPage.howItWorks.step3Desc'),
    },
  ];

  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    cyan: { bg: "bg-cyan-500/20", text: "text-cyan-400", border: "border-cyan-500/30" },
    purple: { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/30" },
    emerald: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30" },
  };

  return (
    <section className="py-24 relative overflow-hidden" aria-labelledby="how-it-works-heading">
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
            {t('landingPage.howItWorks.label')}
          </span>
          <h2 id="how-it-works-heading" className="text-3xl md:text-5xl font-black mt-3">
            {t('landingPage.howItWorks.title')}
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-16">
          {steps.map((step, i) => {
            const colors = colorMap[step.color];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="text-center"
              >
                <div className={`w-16 h-16 rounded-2xl ${colors.bg} flex items-center justify-center ${colors.text} mx-auto mb-4`}>
                  {step.icon}
                </div>
                <div className="text-xs text-gray-500 font-mono mb-2">
                  {t('landingPage.howItWorks.stepLabel', 'STEP')} {i + 1}
                </div>
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Trust Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-wrap justify-center gap-4 mb-12"
        >
          {[
            { label: t('landingPage.howItWorks.badgeRiotApi'), color: "border-cyan-500/30 text-cyan-400" },
            { label: t('landingPage.howItWorks.badgeAi'), color: "border-purple-500/30 text-purple-400" },
            { label: t('landingPage.howItWorks.badgeFree'), color: "border-emerald-500/30 text-emerald-400" },
          ].map((badge, i) => (
            <span
              key={i}
              className={`px-4 py-2 rounded-full border text-xs font-bold ${badge.color} bg-white/5`}
            >
              {badge.label}
            </span>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center"
        >
          <Link
            href="/analyze"
            className="inline-block px-8 py-4 text-lg font-bold bg-gradient-to-r from-emerald-500 to-cyan-600 text-white rounded-lg hover:opacity-90 transition"
          >
            {t('landingPage.howItWorks.cta')}
          </Link>
          <p className="text-sm text-gray-500 mt-3">
            {t('landingPage.howItWorks.ctaSub')}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
