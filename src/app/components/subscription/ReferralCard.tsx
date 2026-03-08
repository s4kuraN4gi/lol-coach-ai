"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { getReferralInfo } from "@/app/actions/referral";
import { toast } from "sonner";
import { LuGift, LuCopy, LuCheck, LuShare2, LuMessageCircle } from "react-icons/lu";

export default function ReferralCard() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<{
    referralCode: string;
    totalReferrals: number;
    rewardedReferrals: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getReferralInfo().then(setInfo).catch(() => {});
  }, []);

  if (!info) return null;

  const referralUrl = `https://lolcoachai.com/signup?ref=${info.referralCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      toast.success(t("referral.copied", "Link copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("referral.copyFailed", "Failed to copy"));
    }
  };

  const shareText = t("referral.shareText", "Check out LoL Coach AI — AI-powered League coaching! Use my invite link for an extended free trial:");
  const encodedText = encodeURIComponent(`${shareText}\n${referralUrl}`);
  const encodedUrl = encodeURIComponent(referralUrl);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "LoL Coach AI", text: shareText, url: referralUrl });
      } catch { /* user cancelled */ }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="bg-gradient-to-r from-emerald-900/20 to-teal-900/20 border border-emerald-500/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <LuGift className="text-emerald-400" />
        <h3 className="text-sm font-bold text-white">
          {t("referral.title", "Invite Friends")}
        </h3>
      </div>

      <p className="text-xs text-slate-400 mb-1">
        {t("referral.descFriend", "Your friend gets a 14-day free trial (normally 7 days) with all Premium features.")}
      </p>
      <p className="text-xs text-emerald-400/80 mb-3">
        {t("referral.descYou", "When they subscribe, your subscription is extended by 1 week!")}
      </p>

      <div className="flex gap-2 mb-3">
        <input
          readOnly
          value={referralUrl}
          className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 truncate"
        />
        <button
          onClick={handleCopy}
          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
        >
          {copied ? <LuCheck /> : <LuCopy />}
          {copied ? t("referral.copiedShort", "OK") : t("referral.copy", "Copy")}
        </button>
      </div>

      {/* Social share buttons */}
      <div className="flex gap-2 mb-3">
        <a
          href={`https://x.com/intent/tweet?text=${encodedText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 transition"
          aria-label="Share on X"
        >
          X
        </a>
        <a
          href={`https://social-plugins.line.me/lineit/share?url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-1.5 bg-[#06c755]/20 hover:bg-[#06c755]/30 border border-[#06c755]/40 rounded-lg text-xs text-[#06c755] transition"
          aria-label="Share on LINE"
        >
          <LuMessageCircle className="text-sm" />
          LINE
        </a>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`${shareText}\n${referralUrl}`);
              toast.success(t("referral.discordCopied", "Copied! Paste it in Discord"));
            } catch { handleCopy(); }
          }}
          className="flex items-center gap-1 px-3 py-1.5 bg-[#5865F2]/20 hover:bg-[#5865F2]/30 border border-[#5865F2]/40 rounded-lg text-xs text-[#5865F2] transition"
          aria-label="Copy for Discord"
        >
          Discord
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 transition"
          aria-label={t("referral.share", "Share")}
        >
          <LuShare2 className="text-sm" />
        </button>
      </div>

      <div className="flex gap-4 text-xs text-slate-400">
        <span>
          {t("referral.invited", "Invited")}: <strong className="text-white">{info.totalReferrals}</strong>
        </span>
        <span>
          {t("referral.rewarded", "Rewards earned")}: <strong className="text-emerald-400">{info.rewardedReferrals}</strong>
        </span>
      </div>
    </div>
  );
}
