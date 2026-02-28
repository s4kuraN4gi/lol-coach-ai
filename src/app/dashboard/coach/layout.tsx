import React from "react";
import { VisionAnalysisProvider } from "@/app/providers/VisionAnalysisProvider";
import { VideoMacroAnalysisProvider } from "@/app/providers/VideoMacroAnalysisProvider";
import { CoachUIProvider } from "@/app/providers/CoachUIProvider";

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
