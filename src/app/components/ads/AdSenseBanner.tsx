"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    adsbygoogle: Record<string, unknown>[];
  }
}

type AdFormat = "auto" | "fluid" | "rectangle";

interface Props {
  className?: string;
  style?: React.CSSProperties;
  format?: AdFormat;
  responsive?: boolean;
  slotId?: string;
  /** When provided, skips the server action call for premium check */
  isPremium?: boolean;
}

import { getAnalysisStatus } from "@/app/actions/analysis";

export default function AdSenseBanner({ className, style, format = "auto", responsive = true, slotId, isPremium }: Props) {
  const adRef = useRef<HTMLModElement>(null);
  const [shouldRender, setShouldRender] = useState(isPremium === undefined ? true : !isPremium);
  const [isLoaded, setIsLoaded] = useState(false);

  const resolvedSlotId = slotId || process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID;

  useEffect(() => {
    // If isPremium was passed as prop, skip the server action call
    if (isPremium !== undefined) {
      if (isPremium) {
        setShouldRender(false);
        return;
      }
      setIsLoaded(true);
      try {
        if (typeof window !== 'undefined' && window.adsbygoogle && process.env.NEXT_PUBLIC_ADSENSE_ID) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
      } catch (e) {
        // Ad load error — silently ignore
      }
      return;
    }

    let isMounted = true;

    const checkPremiumAndLoadAd = async () => {
      try {
        const status = await getAnalysisStatus();
        if (!isMounted) return;

        if (status?.is_premium) {
          setShouldRender(false);
          return;
        }
      } catch (e) {
        // Guest user or error - show ads
      }

      // Load ad for non-premium users
      if (isMounted) {
        setIsLoaded(true);
        try {
          if (typeof window !== 'undefined' && window.adsbygoogle && process.env.NEXT_PUBLIC_ADSENSE_ID) {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
          }
        } catch (e) {
          // Ad load error — silently ignore
        }
      }
    };

    checkPremiumAndLoadAd();

    return () => {
      isMounted = false;
    };
  }, [isPremium]);

  if (!shouldRender) return null;

  // Don't render if AdSense is not configured
  if (!process.env.NEXT_PUBLIC_ADSENSE_ID || !resolvedSlotId) {
    return null;
  }

  return (
    <div className={`overflow-hidden ${className || ''}`} style={style}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block", width: "100%", height: "100%" }}
        data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_ID}
        data-ad-slot={resolvedSlotId}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}
