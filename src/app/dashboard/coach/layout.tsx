import React from "react";
import { VisionAnalysisProvider } from "@/app/Providers/VisionAnalysisProvider";
import { CoachUIProvider } from "@/app/Providers/CoachUIProvider";

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VisionAnalysisProvider>
      <CoachUIProvider>
        {children}
      </CoachUIProvider>
    </VisionAnalysisProvider>
  );
}
