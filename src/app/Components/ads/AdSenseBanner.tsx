
"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

type AdFormat = "auto" | "fluid" | "rectangle";

interface Props {
  className?: string;
  style?: React.CSSProperties;
  format?: AdFormat;
  responsive?: boolean;
  slotId?: string;
}

export default function AdSenseBanner({ className, style, format = "auto", responsive = true, slotId = "1234567890" }: Props) {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    try {
      if (window.adsbygoogle && process.env.NEXT_PUBLIC_ADSENSE_ID) {
        // Prevent double injection if already loaded in this specific slot
        // AdSense is tricky with SPA, sometimes needs reload.
        // We push to adsbygoogle array.
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (e) {
      console.error("AdSense Error:", e);
    }
  }, []);

  // Placeholder for development / when env is missing
  if (!process.env.NEXT_PUBLIC_ADSENSE_ID) {
      return (
          <div className={`bg-slate-800 border-2 border-dashed border-slate-700 p-4 text-center text-slate-500 rounded-lg ${className}`} style={style}>
              <p className="text-xs font-mono mb-1">GOOGLE ADSENSE PLACEHOLDER</p>
              <p className="text-[10px]">Set NEXT_PUBLIC_ADSENSE_ID to enable</p>
          </div>
      );
  }

  return (
    <div className={`overflow-hidden ${className}`} style={style}>
      <ins
        className="adsbygoogle"
        style={{ display: "block", ...style }}
        data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_ID}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
      ></ins>
    </div>
  );
}
