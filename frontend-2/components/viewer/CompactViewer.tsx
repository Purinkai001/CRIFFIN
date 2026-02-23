"use client";
import React, { useRef, useEffect } from "react";
import { Search } from "lucide-react";
import type { HeatmapPoint, TopRegion } from "@/lib/types";

interface Props {
  thumbnailUrl: string | null;
  heatmapData: HeatmapPoint[];
  slideDims: { w: number; h: number };
  scoreStats: { min: number; max: number };
  threshold: number;
  topRegions: TopRegion[];
  title?: string;
  onClick: () => void;
}

import { drawHeatmap } from "@/utils/heatmap";

export default function CompactViewer({
  thumbnailUrl, heatmapData, slideDims, scoreStats, threshold, topRegions, title, onClick
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!thumbnailUrl || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = thumbnailUrl;
    img.onload = () => {
      canvasRef.current!.width = img.width;
      canvasRef.current!.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Draw Heatmap
      if (slideDims.w > 0 && heatmapData.length > 0) {
        drawHeatmap({
          ctx,
          heatmapData,
          scoreStats,
          threshold,
          imgW: img.width,
          imgH: img.height,
          slideW: slideDims.w,
          slideH: slideDims.h
        });
      }
    };
  }, [thumbnailUrl, heatmapData, slideDims, threshold, scoreStats]);

  return (
    <div
      onClick={onClick}
      className="healthcare-card w-full p-5 transition-all duration-300 hover:shadow-xl hover:border-brand-primary/30 cursor-pointer flex flex-col md:flex-row items-center gap-8 group"
    >
      {/* 1. Title Section */}
      <div className="w-full md:w-64 flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-3 h-3 rounded-full bg-brand-primary animate-pulse" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Analysis</span>
        </div>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight group-hover:text-brand-primary transition-colors">
          {title?.split(/[+,]/).map((part, i, arr) => (
            <span key={i}>
              {part.trim()}
              {i < arr.length - 1 && <span className="text-brand-primary opacity-40"> , </span>}
              <br />
            </span>
          ))}
        </h3>
        <p className="text-sm text-slate-500 font-bold mt-3 uppercase tracking-wider flex items-center gap-3">
          <Search size={18} strokeWidth={2.5} />
          {heatmapData.length} Matching Points
        </p>
      </div>

      {/* 2. Map Section */}
      <div className="h-40 w-full md:w-auto flex-shrink-0 border-2 border-slate-50 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 overflow-hidden relative shadow-inner">
        <canvas ref={canvasRef} className="h-full w-auto object-contain transition-transform duration-700 group-hover:scale-105" />
      </div>

      {/* 3. Top Regions Section (Row) - LARGE IMAGES */}
      <div className="flex-1 w-full flex items-center gap-4 overflow-x-auto pb-2 custom-scrollbar">
        {topRegions.slice(0, 3).map((region, idx) => (
          <div key={idx} className="flex-shrink-0 w-80 h-80 bg-slate-100 dark:bg-slate-900 rounded-2xl overflow-hidden relative shadow-md border border-slate-100 dark:border-slate-800 transition-all group-hover:shadow-lg">
            {region.imgUrl && <img src={region.imgUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />}
            <div className={`absolute top-3 left-3 w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold text-white shadow-lg backdrop-blur-md ${idx === 0 ? 'bg-brand-primary' : 'bg-slate-900/80'}`}>
              {idx + 1}
            </div>
          </div>
        ))}
        {topRegions.length === 0 && (
          <div className="flex flex-col items-center justify-center w-full py-12 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic">No candidates found</p>
          </div>
        )}
      </div>

    </div>
  );
}
