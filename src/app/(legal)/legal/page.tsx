import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | LoL Coach AI",
  description: "特定商取引法に基づく表記です。",
};

export default function LegalPage() {
  return (
    <>
      <h1 className="text-3xl font-bold text-white mb-8">特定商取引法に基づく表記</h1>

      <div className="space-y-8">
        <div>
            <h3 className="text-lg font-bold text-slate-200 mb-2">販売業者</h3>
            <p>※個人のため、請求があり次第開示いたします。</p>
        </div>
        
        <div>
            <h3 className="text-lg font-bold text-slate-200 mb-2">運営統括責任者</h3>
            <p>Masamizu</p>
        </div>

        <div>
            <h3 className="text-lg font-bold text-slate-200 mb-2">所在地</h3>
            <p>※個人のため、請求があり次第開示いたします。</p>
        </div>

        <div>
            <h3 className="text-lg font-bold text-slate-200 mb-2">販売価格</h3>
            <p>プレミアムプラン: 月額980円（税込）</p>
        </div>

        <div>
            <h3 className="text-lg font-bold text-slate-200 mb-2">商品代金以外に必要な料金</h3>
            <p>インターネット接続料金、通信料金等はお客様のご負担となります。</p>
        </div>

        <div>
            <h3 className="text-lg font-bold text-slate-200 mb-2">代金の支払方法</h3>
            <p>クレジットカード決済 (Stripe)</p>
        </div>

        <div>
            <h3 className="text-lg font-bold text-slate-200 mb-2">代金の支払時期</h3>
             <p>初回申込時に決済され、以降毎月同日に自動更新されます。</p>
        </div>

        <div>
            <h3 className="text-lg font-bold text-slate-200 mb-2">返品・キャンセルに関する特約</h3>
            <p>商品の性質上、返品・返金はお受けできません。解約はいつでもマイページから行うことができ、次回の更新日に課金が停止されます。</p>
        </div>
      </div>
    </>
  );
}
