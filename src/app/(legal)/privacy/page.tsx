import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー | LoL Coach AI",
  description: "LoL Coach AIのプライバシーポリシーです。",
};

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-3xl font-bold text-white mb-8">プライバシーポリシー</h1>
      <p className="text-sm text-slate-400 mb-8">最終更新日: 2024年12月13日</p>

      <section className="mb-8">
        <h2>1. 個人情報の収集について</h2>
        <p>当サービスでは、GoogleアカウントまたはRiotアカウントを通じた認証時に、以下の情報を収集する場合があります。</p>
        <ul>
            <li>メールアドレス</li>
            <li>ユーザー名、サモナー名</li>
            <li>Riot PUUID（プレイヤー識別子）</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2>2. 情報の利用目的</h2>
        <p>収集した情報は、以下の目的のために利用します。</p>
        <ul>
            <li>本サービスの提供・運営のため</li>
            <li>ユーザーからのお問い合わせに回答するため</li>
            <li>重要なお知らせなどのご連絡のため</li>
            <li>AIによる分析精度の向上のため</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2>3. 広告について (Google AdSense)</h2>
        <p>当サービスでは、第三者配信の広告サービス（Google AdSense）を利用しており、ユーザーの興味に応じた商品やサービスの広告を表示するため、クッキー（Cookie）を使用しております。</p>
        <p>クッキーを使用することで当サイトはお客様のコンピュータを識別できるようになりますが、お客様個人を特定できるものではありません。</p>
        <p>Cookieを無効にする方法やGoogleアドセンスに関する詳細は<a href="https://policies.google.com/technologies/ads?hl=ja" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Googleのポリシーと規約</a>をご確認ください。</p>
      </section>

      <section className="mb-8">
        <h2>4. アクセス解析ツールについて</h2>
        <p>当サイトでは、Googleによるアクセス解析ツール「Googleアナリティクス」を使用しています。このGoogleアナリティクスはデータの収集のためにCookieを使用しています。このデータは匿名で収集されており、個人を特定するものではありません。</p>
      </section>

      <section className="mb-8">
        <h2>5. 個人情報の第三者提供</h2>
        <p>あらかじめユーザーの同意を得ることなく、第三者に個人情報を提供することはありません。ただし、個人情報保護法その他の法令で認められる場合を除きます。</p>
      </section>
    </>
  );
}
