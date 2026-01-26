
"use client";

import { useEffect, useRef, useState } from "react";

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

import { getAnalysisStatus } from "@/app/actions/analysis";

export default function AdSenseBanner({ className, style, format = "auto", responsive = true, slotId = "1234567890" }: Props) {
  const adRef = useRef<HTMLModElement>(null);
  const [shouldRender, setShouldRender] = useState(true); // Default yes, hide if premium found

  useEffect(() => {
    // 1. Check Premium Status
    getAnalysisStatus().then(status => {
        if (status?.is_premium) {
            console.log("[AdSense] User is Premium. Hiding Ad.");
            setShouldRender(false);
        } else {
            // 2. Only inject AdSense script if NOT premium
             try {
                if (window.adsbygoogle && process.env.NEXT_PUBLIC_ADSENSE_ID) {
                    (window.adsbygoogle = window.adsbygoogle || []).push({});
                }
            } catch (e) {
                console.error("AdSense Error:", e);
            }
        }
    });
  }, []);

  if (!shouldRender) return null; // Hide completely

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
