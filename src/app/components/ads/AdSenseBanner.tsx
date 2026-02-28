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
  const [shouldRender, setShouldRender] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkPremiumAndLoadAd = async () => {
      try {
        const status = await getAnalysisStatus();
        if (!isMounted) return;

        if (status?.is_premium) {
          console.log("[AdSense] User is Premium. Hiding Ad.");
          setShouldRender(false);
          return;
        }
      } catch (e) {
        // Guest user or error - show ads
        console.log("[AdSense] Guest or error, showing ads");
      }

      // Load ad for non-premium users
      if (isMounted) {
        setIsLoaded(true);
        try {
          if (typeof window !== 'undefined' && window.adsbygoogle && process.env.NEXT_PUBLIC_ADSENSE_ID) {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
          }
        } catch (e) {
          console.error("AdSense Error:", e);
        }
      }
    };

    checkPremiumAndLoadAd();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!shouldRender) return null;

  // Placeholder for development / when env is missing
  if (!process.env.NEXT_PUBLIC_ADSENSE_ID) {
    return (
      <div
        className={`bg-slate-800/50 border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-500 rounded-lg ${className || ''}`}
        style={style}
      >
        <div className="text-center p-2">
          <p className="text-xs font-mono">AD SPACE</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${className || ''}`} style={style}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block", width: "100%", height: "100%" }}
        data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_ID}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}
