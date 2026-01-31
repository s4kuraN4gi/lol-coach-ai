"use client";

import { FaEnvelope, FaClock, FaInfoCircle } from "react-icons/fa";
import { useTranslation } from "@/contexts/LanguageContext";

export default function ContactPage() {
  const { t } = useTranslation();
  const email = "s4kuran4gi@gmail.com";

  return (
    <>
      <h1 className="text-3xl font-bold text-white mb-8">{t('contactPage.title')}</h1>

      <section className="mb-8">
        <p className="mb-6">
          {t('contactPage.intro')}
        </p>
      </section>

      <section className="mb-8">
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <FaEnvelope className="text-blue-400 text-xl" />
            <h2 className="text-xl font-bold text-white m-0">{t('contactPage.emailTitle')}</h2>
          </div>

          <a
            href={`mailto:${email}?subject=[LoL Coach AI]`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition no-underline"
          >
            <FaEnvelope />
            {email}
          </a>
        </div>
      </section>

      <section className="mb-8">
        <h2>{t('contactPage.requestsTitle')}</h2>
        <ul>
          <li>{t('contactPage.requests.subject')}</li>
          <li>{t('contactPage.requests.bugReport')}</li>
          <li>{t('contactPage.requests.privacy')}</li>
        </ul>
      </section>

      <section className="mb-8 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="flex items-start gap-3">
          <FaClock className="text-yellow-400 mt-1" />
          <div>
            <h3 className="text-lg font-bold text-white mt-0 mb-2">{t('contactPage.responseTitle')}</h3>
            <p className="m-0 text-slate-400">
              {t('contactPage.responseDesc')}
            </p>
          </div>
        </div>
      </section>

      <section className="p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
        <div className="flex items-start gap-3">
          <FaInfoCircle className="text-blue-400 mt-1" />
          <div>
            <h3 className="text-lg font-bold text-white mt-0 mb-2">{t('contactPage.supportTitle')}</h3>
            <ul className="m-0 text-slate-400">
              <li>{t('contactPage.supportItems.usage')}</li>
              <li>{t('contactPage.supportItems.bugs')}</li>
              <li>{t('contactPage.supportItems.features')}</li>
              <li>{t('contactPage.supportItems.billing')}</li>
              <li>{t('contactPage.supportItems.general')}</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
