"use client";

import { FaUpload, FaClock, FaSearch } from "react-icons/fa";
import { useTranslation } from "@/contexts/LanguageContext";
import type { GuestSegment } from "@/app/actions/guestConstants";
import type { VideoMacroSegment } from "@/app/actions/videoMacroAnalysis";

interface VideoUploaderProps {
    videoUrl: string | null;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    videoDuration: number;
    onVideoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onVideoReset: () => void;
    onVideoLoaded: () => void;
    analysisMode: 'macro' | 'micro';
    // Macro mode props
    hasMatchParams: boolean;
    autoSegments: VideoMacroSegment[];
    activeSegments: (GuestSegment | VideoMacroSegment)[];
    loadingSegments: boolean;
    // Micro mode props
    microStartTime: number;
    onMicroStartTimeChange: (time: number) => void;
    formatTime: (seconds: number) => string;
}

export default function VideoUploader({
    videoUrl,
    videoRef,
    videoDuration,
    onVideoSelect,
    onVideoReset,
    onVideoLoaded,
    analysisMode,
    hasMatchParams,
    autoSegments,
    activeSegments,
    loadingSegments,
    microStartTime,
    onMicroStartTimeChange,
    formatTime,
}: VideoUploaderProps) {
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            {/* Video Upload Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <FaUpload className="text-emerald-400" />
                    {t('analyzePage.upload.title')}
                </h2>

                {!videoUrl ? (
                    <label className="block cursor-pointer">
                        <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-emerald-500/50 transition">
                            <FaUpload className="text-4xl text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-400 mb-2">
                                {t('analyzePage.upload.dragDrop')}
                            </p>
                            <p className="text-xs text-slate-400">
                                {t('analyzePage.upload.formats')}
                            </p>
                        </div>
                        <input
                            type="file"
                            accept="video/*"
                            onChange={onVideoSelect}
                            className="hidden"
                        />
                    </label>
                ) : (
                    <div className="space-y-4">
                        <video
                            ref={videoRef}
                            src={videoUrl}
                            controls
                            onLoadedMetadata={onVideoLoaded}
                            className="w-full rounded-lg bg-black"
                        />
                        <button
                            onClick={onVideoReset}
                            className="text-sm text-slate-400 hover:text-white transition"
                        >
                            {t('analyzePage.upload.changeVideo')}
                        </button>
                    </div>
                )}
            </div>

            {/* Mode-specific left column content */}
            {analysisMode === 'macro' ? (
                /* Segments Info */
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                        <FaClock className={hasMatchParams && autoSegments.length > 0 ? "text-emerald-400" : "text-blue-400"} />
                        {hasMatchParams && autoSegments.length > 0
                            ? t('analyzePage.segments.titleAuto')
                            : t('analyzePage.segments.titleFixed')}
                    </h3>
                    {loadingSegments ? (
                        <div className="flex items-center gap-2 text-slate-400 py-4">
                            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            {t('analyzePage.segments.loading')}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {activeSegments.map((seg) => (
                                <div key={seg.segmentId} className="flex items-center gap-3 text-sm">
                                    <span className="font-mono w-12 text-emerald-400">
                                        {seg.targetTimestampStr}
                                    </span>
                                    <span className="text-slate-400">
                                        {seg.eventDescription}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                    <p className="mt-3 text-xs text-slate-400">
                        {hasMatchParams && autoSegments.length > 0
                            ? t('analyzePage.segments.autoNote')
                            : t('analyzePage.segments.registerNote')}
                    </p>
                </div>
            ) : (
                /* Micro Analysis - Clip Selector */
                <div className="bg-slate-900 border border-purple-500/30 rounded-xl p-6">
                    <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                        <FaSearch className="text-purple-400" />
                        {t('analyzePage.micro.clipSelector')}
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-2">
                                {t('analyzePage.micro.clipFrom')}
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min={0}
                                    max={Math.max(0, videoDuration - 30)}
                                    step={1}
                                    value={microStartTime}
                                    onChange={(e) => onMicroStartTimeChange(Number(e.target.value))}
                                    className="flex-1 accent-purple-500"
                                />
                                <span className="text-white font-mono text-sm min-w-[50px] text-right">
                                    {formatTime(microStartTime)}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-400 mt-1">
                                <span>0:00</span>
                                <span className="text-purple-400 font-medium">
                                    {formatTime(microStartTime)} - {formatTime(microStartTime + 30)}
                                </span>
                                <span>{formatTime(videoDuration)}</span>
                            </div>
                        </div>
                        <p className="text-xs text-slate-400">
                            {t('analyzePage.micro.clipDescription')}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
