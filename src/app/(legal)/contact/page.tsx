import type { Metadata } from "next";
import { FaEnvelope, FaClock, FaInfoCircle } from "react-icons/fa";

export const metadata: Metadata = {
  title: "お問い合わせ | LoL Coach AI",
  description: "LoL Coach AIへのお問い合わせはこちらから。",
};

export default function ContactPage() {
  const email = "s4kuran4gi@gmail.com";

  return (
    <>
      <h1 className="text-3xl font-bold text-white mb-8">お問い合わせ / Contact</h1>

      <section className="mb-8">
        <p className="mb-6">
          LoL Coach AIに関するご質問、ご意見、不具合報告などがございましたら、
          下記メールアドレスまでお気軽にお問い合わせください。
        </p>
        <p className="mb-6 text-slate-400">
          For questions, feedback, or bug reports regarding LoL Coach AI,
          please feel free to contact us at the email address below.
        </p>
      </section>

      <section className="mb-8">
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <FaEnvelope className="text-blue-400 text-xl" />
            <h2 className="text-xl font-bold text-white m-0">メールでのお問い合わせ</h2>
          </div>

          <a
            href={`mailto:${email}?subject=[LoL Coach AI] お問い合わせ`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition no-underline"
          >
            <FaEnvelope />
            {email}
          </a>
        </div>
      </section>

      <section className="mb-8">
        <h2>お問い合わせの際のお願い</h2>
        <ul>
          <li>件名に「LoL Coach AI」と記載してください</li>
          <li>不具合報告の場合は、発生状況をできるだけ詳しくお知らせください</li>
          <li>サモナー名やPUUIDなどの個人情報は、必要な場合のみお知らせください</li>
        </ul>
      </section>

      <section className="mb-8 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="flex items-start gap-3">
          <FaClock className="text-yellow-400 mt-1" />
          <div>
            <h3 className="text-lg font-bold text-white mt-0 mb-2">返信について</h3>
            <p className="m-0 text-slate-400">
              通常、3営業日以内にご返信いたします。お急ぎの場合はその旨を記載してください。
            </p>
          </div>
        </div>
      </section>

      <section className="p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
        <div className="flex items-start gap-3">
          <FaInfoCircle className="text-blue-400 mt-1" />
          <div>
            <h3 className="text-lg font-bold text-white mt-0 mb-2">サポート対象</h3>
            <ul className="m-0 text-slate-400">
              <li>サービスの使い方に関するご質問</li>
              <li>不具合・エラーのご報告</li>
              <li>機能のご要望・ご提案</li>
              <li>プレミアムプラン・お支払いに関するお問い合わせ</li>
              <li>その他サービスに関する全般的なお問い合わせ</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
