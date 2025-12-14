import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "利用規約 | LoL Coach AI",
  description: "LoL Coach AIの利用規約です。",
};

export default function TermsPage() {
  return (
    <>
      <h1 className="text-3xl font-bold text-white mb-8">利用規約</h1>
      <p className="text-sm text-slate-400 mb-8">最終更新日: 2024年12月13日</p>

      <section className="mb-8">
        <h2>第1条（適用）</h2>
        <p>本規約は、ユーザーと当サービス運営者との間の本サービスの利用に関わる一切の関係に適用されます。</p>
      </section>

      <section className="mb-8">
        <h2>第2条（Riot APIポリシー）</h2>
        <p>LoL Coach AI（以下「本サービス」）は、Riot Gamesの公式製品ではありません。また、Riot GamesまたはLeague of Legendsの製作・管理に正式に関与する人物によって承認されたものではありません。League of LegendsおよびRiot Gamesは、Riot Games, Inc.の商標または登録商標です。</p>
      </section>

      <section className="mb-8">
        <h2>第3条（禁止事項）</h2>
        <p>ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
        <ul>
          <li>法令または公序良俗に違反する行為</li>
          <li>犯罪行為に関連する行為</li>
          <li>当サービスのサーバーまたはネットワークの機能を破壊したり、妨害したりする行為</li>
          <li>当サービスの運営を妨害するおそれのある行為</li>
          <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
          <li>不正アクセスをし、またはこれを試みる行為</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2>第4条（利用制限および登録抹消）</h2>
        <p>運営者は、ユーザーが本規約のいずれかの条項に違反した場合、事前の通知なく、ユーザーに対して本サービスの全部もしくは一部の利用を制限し、またはユーザーとしての登録を抹消することができるものとします。</p>
      </section>

      <section className="mb-8">
        <h2>第5条（免責事項）</h2>
        <p>当サービスの債務不履行責任は、運営者の故意または重過失によらない場合には免責されるものとします。当サービスに関して、ユーザーと他のユーザーまたは第三者との間において生じた取引、連絡または紛争等について一切責任を負いません。</p>
      </section>
      
      {/* 他、一般的な条項 */}
    </>
  );
}
