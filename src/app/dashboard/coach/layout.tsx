import React from "react";
import { VisionAnalysisProvider } from "@/app/Providers/VisionAnalysisProvider";
import { VideoMacroAnalysisProvider } from "@/app/Providers/VideoMacroAnalysisProvider";
import { CoachUIProvider } from "@/app/Providers/CoachUIProvider";

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VisionAnalysisProvider>
      <VideoMacroAnalysisProvider>
        <CoachUIProvider>
          {children}
        </CoachUIProvider>
      </VideoMacroAnalysisProvider>
    </VisionAnalysisProvider>
  );
}
