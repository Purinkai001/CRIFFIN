"use client";
import React from "react";
import CompactViewer from "@/components/viewer/CompactViewer";
import Viewer from "@/components/viewer/Viewer";
import type { HeatmapPoint, TopRegion } from "@/lib/types";

interface ResultSet {
    query: string;
    heatmapData: HeatmapPoint[];
    scoreStats: { min: number; max: number };
    topRegions: TopRegion[];
}

interface Props {
    slideFilename: string;
    thumbnailUrl: string;
    slideDims: { w: number; h: number };
    parameters: ResultSet[];
    threshold: number;
    isActiveSlide: boolean;
    activeParamIdx: number;
    onSelectParam: (paramIdx: number) => void;
    onTileFetch: (x: number, y: number) => Promise<string | null>;
}

export default function SlideGroup({
    slideFilename,
    thumbnailUrl,
    slideDims,
    parameters,
    threshold,
    isActiveSlide,
    activeParamIdx,
    onSelectParam,
    onTileFetch
}: Props) {
    // Format display name (remove extensions, clean up)
    const displayName = slideFilename
        .replace(/\.mrxs$/i, '')
        .replace(/\.svs$/i, '')
        .replace(/\.ndpi$/i, '');

    return (
        <div className="bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600 flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center">
                    <span className="text-indigo-600 dark:text-indigo-300 text-sm">📁</span>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-700 dark:text-slate-100 truncate">{displayName}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-300">{parameters.length} parameters</p>
                </div>
                {isActiveSlide && (
                    <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-full">
                        ACTIVE
                    </span>
                )}
            </div>

            {/* Parameters Grid */}
            <div className="p-4 space-y-3">
                {parameters.map((param, idx) => {
                    const isActive = isActiveSlide && idx === activeParamIdx;

                    if (isActive) {
                        // Show full Viewer inline for active parameter
                        return (
                            <div
                                key={param.query}
                                className="animate-in fade-in slide-in-from-top-4 duration-500"
                            >
                                <Viewer
                                    title={`${displayName} — "${param.query}"`}
                                    thumbnailUrl={thumbnailUrl}
                                    heatmapData={param.heatmapData}
                                    slideDims={slideDims}
                                    scoreStats={param.scoreStats}
                                    threshold={threshold}
                                    onTileFetch={onTileFetch}
                                    topRegions={param.topRegions}
                                />
                            </div>
                        );
                    }

                    return (
                        <CompactViewer
                            key={param.query}
                            title={param.query}
                            thumbnailUrl={thumbnailUrl}
                            heatmapData={param.heatmapData}
                            slideDims={slideDims}
                            scoreStats={param.scoreStats}
                            threshold={0} // Always 0 for compacted view as requested
                            topRegions={param.topRegions}
                            onClick={() => onSelectParam(idx)}
                        />
                    );
                })}
            </div>
        </div>
    );
}
