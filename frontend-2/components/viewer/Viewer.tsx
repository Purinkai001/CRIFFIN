import React, { useRef, useEffect, useState, useLayoutEffect, useId, useCallback } from "react";
import { drawHeatmap } from "@/utils/heatmap";
import { motion, type MotionValue, useMotionValue, useTransform } from "framer-motion";
import { X } from "lucide-react";
import type { HeatmapPoint, TopRegion } from "@/lib/types";

interface Props {
    thumbnailUrl: string | null;
    heatmapData: HeatmapPoint[];
    slideDims: { w: number; h: number };
    scoreStats: { min: number; max: number };
    threshold: number;
    onTileFetch: (x: number, y: number) => Promise<string | null>;
    topRegions: TopRegion[];
    title?: string;
}

interface DynamicLineProps {
    x1: number;
    y1: number;
    baseX2: number;
    baseY2: number;
    motionX: MotionValue<number>;
    motionY: MotionValue<number>;
    isPrimary: boolean;
    markerId: string;
}

function DynamicLine({ x1, y1, baseX2, baseY2, motionX, motionY, isPrimary, markerId }: DynamicLineProps) {
    // High-performance direct binding using useTransform
    const x2 = useTransform(motionX, (v: number) => baseX2 + v);
    const y2 = useTransform(motionY, (v: number) => baseY2 + v);

    return (
        <g>
            <motion.line
                x1={x1} y1={y1}
                x2={x2} y2={y2}
                className={isPrimary ? "stroke-brand-primary" : "stroke-slate-200 dark:stroke-slate-800"}
                strokeWidth={isPrimary ? "3" : "2"}
                strokeDasharray="8 6"
                markerStart={`url(#${markerId})`}
            />
            <motion.line
                x1={x1} y1={y1}
                x2={x2} y2={y2}
                className="stroke-white dark:stroke-slate-900 opacity-20"
                strokeWidth="6"
                strokeDasharray="8 6"
            />
        </g>
    );
}

interface ActiveTile {
    url: string;
    x: number;
    y: number;
    ratioX: number;
    ratioY: number;
    data?: HeatmapPoint;
}

export default function Viewer({
    thumbnailUrl, heatmapData, slideDims, scoreStats, threshold, onTileFetch, topRegions, title
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const uniqueId = useId();

    const [activeTile, setActiveTile] = useState<ActiveTile | null>(null);
    const [isHolding, setIsHolding] = useState(false);
    const [zoom, setZoom] = useState(1.0);
    const [layout, setLayout] = useState({
        containerW: 0, containerH: 0,
        canvasW: 0, canvasH: 0,
        canvasLeft: 0, canvasTop: 0
    });

    // Dynamic motion values for draggable cards (fixed size to satisfy hook rules).
    const motionX0 = useMotionValue(0);
    const motionX1 = useMotionValue(0);
    const motionX2 = useMotionValue(0);
    const motionX3 = useMotionValue(0);
    const motionX4 = useMotionValue(0);
    const motionY0 = useMotionValue(0);
    const motionY1 = useMotionValue(0);
    const motionY2 = useMotionValue(0);
    const motionY3 = useMotionValue(0);
    const motionY4 = useMotionValue(0);
    const mValues = [
        { x: motionX0, y: motionY0 },
        { x: motionX1, y: motionY1 },
        { x: motionX2, y: motionY2 },
        { x: motionX3, y: motionY3 },
        { x: motionX4, y: motionY4 },
    ];

    const activeMX = useMotionValue(0);
    const activeMY = useMotionValue(0);
    const activeM = { x: activeMX, y: activeMY };

    // Track closed regions by index
    const [closedRegions, setClosedRegions] = useState<number[]>([]);

    const updateLayout = () => {
        if (containerRef.current && canvasRef.current) {
            const contRect = containerRef.current.getBoundingClientRect();
            const canvRect = canvasRef.current.getBoundingClientRect();
            setLayout({
                containerW: contRect.width,
                containerH: contRect.height,
                canvasW: canvRect.width,
                canvasH: canvRect.height,
                // Calculate canvas position relative to container
                canvasLeft: canvRect.left - contRect.left,
                canvasTop: canvRect.top - contRect.top
            });
        }
    };

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const timer = setTimeout(updateLayout, 100);
        window.addEventListener('resize', updateLayout);

        const scrollEl = scrollContainerRef.current;
        if (scrollEl) {
            scrollEl.addEventListener('scroll', updateLayout);
        }

        return () => {
            window.removeEventListener('resize', updateLayout);
            if (scrollEl) scrollEl.removeEventListener('scroll', updateLayout);
            clearTimeout(timer);
        };
    }, [thumbnailUrl, zoom, topRegions]);

    // Redraw heatmap on canvas
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
            updateLayout();

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

    // --- Hold-to-zoom tile fetching ---
    const tileCacheRef = useRef<Map<string, string>>(new Map()); // "x,y" -> blobUrl
    const isHoldingRef = useRef(false);
    const lastFetchKeyRef = useRef<string | null>(null);
    const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingFetchRef = useRef(false);
    const latestFetchSeqRef = useRef(0);

    const getTileKey = (x: number, y: number) => `${x},${y}`;

    const getSlideCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!slideDims.w) return null;
        const rect = e.currentTarget.getBoundingClientRect();
        const xRatio = (e.clientX - rect.left) / rect.width;
        const yRatio = (e.clientY - rect.top) / rect.height;
        const reqX = Math.floor((xRatio * slideDims.w) / 50) * 50;
        const reqY = Math.floor((yRatio * slideDims.h) / 50) * 50;
        return { reqX, reqY, xRatio, yRatio };
    }, [slideDims]);

    const fetchTileAt = useCallback(async (reqX: number, reqY: number, xRatio: number, yRatio: number) => {
        const key = getTileKey(reqX, reqY);
        const fetchSeq = ++latestFetchSeqRef.current;

        // Skip if we just fetched this exact tile
        if (key === lastFetchKeyRef.current && activeTile) return;
        lastFetchKeyRef.current = key;

        // Reset drag offset when starting a new tile zoom
        activeM.x.set(0);
        activeM.y.set(0);

        // Check cache first
        const cached = tileCacheRef.current.get(key);
        if (cached) {
            const match = heatmapData.find((pt) => Math.abs(pt.x - reqX) < 200 && Math.abs(pt.y - reqY) < 200);
            setActiveTile({ url: cached, x: reqX, y: reqY, ratioX: xRatio, ratioY: yRatio, data: match });
            return;
        }

        // Fetch from server
        pendingFetchRef.current = true;
        try {
            const url = await onTileFetch(reqX, reqY);
            if (url) {
                tileCacheRef.current.set(key, url);
                // Ignore stale responses when user clicks a new tile quickly.
                if (fetchSeq !== latestFetchSeqRef.current) return;
                const match = heatmapData.find((pt) => Math.abs(pt.x - reqX) < 200 && Math.abs(pt.y - reqY) < 200);
                setActiveTile({ url, x: reqX, y: reqY, ratioX: xRatio, ratioY: yRatio, data: match });
            }
        } finally {
            pendingFetchRef.current = false;
        }
    }, [onTileFetch, heatmapData, activeTile, activeM.x, activeM.y]);

    const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const coords = getSlideCoords(e);
        if (!coords) return;
        isHoldingRef.current = true;
        setIsHolding(true);
        lastFetchKeyRef.current = null; // Reset so first tile always fetches
        fetchTileAt(coords.reqX, coords.reqY, coords.xRatio, coords.yRatio);
    }, [getSlideCoords, fetchTileAt]);

    const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isHoldingRef.current) return;
        const coords = getSlideCoords(e);
        if (!coords) return;

        const key = getTileKey(coords.reqX, coords.reqY);
        // Skip if same tile or already fetching
        if (key === lastFetchKeyRef.current) return;
        if (pendingFetchRef.current) return;

        // Throttle: wait 100ms between fetches
        if (throttleTimerRef.current) return;
        throttleTimerRef.current = setTimeout(() => {
            throttleTimerRef.current = null;
        }, 100);

        fetchTileAt(coords.reqX, coords.reqY, coords.xRatio, coords.yRatio);
    }, [getSlideCoords, fetchTileAt]);

    const handleCanvasMouseUp = useCallback(() => {
        isHoldingRef.current = false;
        setIsHolding(false);
        if (throttleTimerRef.current) {
            clearTimeout(throttleTimerRef.current);
            throttleTimerRef.current = null;
        }
    }, []);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
            // Revoke cached blob URLs to free memory
            tileCacheRef.current.forEach(url => URL.revokeObjectURL(url));
            tileCacheRef.current.clear();
        };
    }, []);

    // Clear tile cache when slide data changes
    useEffect(() => {
        tileCacheRef.current.forEach(url => URL.revokeObjectURL(url));
        tileCacheRef.current.clear();
        lastFetchKeyRef.current = null;
    }, [thumbnailUrl, heatmapData]);

    const handleZoom = (delta: number) => setZoom(prev => Math.max(0.2, Math.min(4.0, prev + delta)));
    const toggleRegion = (idx: number) => {
        if (closedRegions.includes(idx)) {
            setClosedRegions(closedRegions.filter(i => i !== idx));
        } else {
            setClosedRegions([...closedRegions, idx]);
        }
    };

    if (!thumbnailUrl) return (
        <div className="h-96 flex flex-col items-center justify-center healthcare-card border-dashed">
            <div className="text-slate-300 mb-4">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" /><polyline points="16 5 21 5 21 10" /><line x1="9" y1="15" x2="21" y2="3" /></svg>
            </div>
            <p className="text-xl font-bold uppercase tracking-widest text-slate-400">Waiting for clinical data</p>
        </div>
    );

    const scaleX = layout.canvasW / (slideDims.w || 1);
    const scaleY = layout.canvasH / (slideDims.h || 1);

    // Top 3 regions should always be visible (they are the highest-scoring regions)
    const leftRegions = topRegions.filter(r => (r.x / slideDims.w) < 0.5);
    const rightRegions = topRegions.filter(r => (r.x / slideDims.w) >= 0.5);

    const renderCard = (region: TopRegion, side: 'left' | 'right', verticalOffsetIndex: number) => {
        // Use the original index from topRegions for motion values
        const originalIndex = topRegions.indexOf(region);
        const isClosed = closedRegions.includes(originalIndex);
        if (isClosed) return null;

        const isTop = originalIndex === 0;
        const topPos = 80 + (verticalOffsetIndex * 300);
        const m = mValues[originalIndex % mValues.length];

        return (
            <motion.div
                drag
                dragMomentum={false}
                onDrag={(_, info) => {
                    // Use delta (change since last frame) for smooth, unrestricted dragging
                    m.x.set(m.x.get() + info.delta.x);
                    m.y.set(m.y.get() + info.delta.y);
                }}
                key={originalIndex}
                className={`absolute w-72 healthcare-card overflow-hidden z-30 shadow-[0_20px_50px_rgba(0,0,0,0.15)] cursor-grab active:cursor-grabbing ${side === 'left' ? 'left-6' : 'right-6'}`}
                style={{ top: topPos, x: m.x, y: m.y }}
            >
                <div className="relative h-64 bg-slate-100 dark:bg-slate-900 group pointer-events-none">
                    {region.imgUrl && <img src={region.imgUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className={`absolute top-4 left-4 w-10 h-10 flex items-center justify-center rounded-xl text-base font-bold text-white shadow-sm transition-transform group-hover:scale-110 ${isTop ? 'bg-brand-primary' : 'bg-slate-800'}`}>
                        {originalIndex + 1}
                    </div>

                    <button
                        onClick={(e) => { e.stopPropagation(); toggleRegion(originalIndex); }}
                        className="absolute top-4 right-4 w-10 h-10 bg-white/10 backdrop-blur hover:bg-rose-500 text-white rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all pointer-events-auto shadow-sm"
                        title="Dismiss"
                    >
                        <X size={20} />
                    </button>
                </div>
            </motion.div>
        );
    };

    const renderClosedMarkers = () => {
        return topRegions.map((region, idx) => {
            if (!closedRegions.includes(idx)) return null;

            const left = layout.canvasLeft + (region.x * scaleX);
            const top = layout.canvasTop + (region.y * scaleY);

            return (
                <button
                    key={`marker-${idx}`}
                    onClick={() => toggleRegion(idx)}
                    className="absolute z-40 w-12 h-12 -ml-6 -mt-6 bg-brand-primary text-white rounded-2xl flex items-center justify-center shadow-2xl border-2 border-white dark:border-slate-900 hover:scale-125 transition-all animate-in zoom-in font-display font-black text-xl cursor-pointer"
                    style={{ left, top }}
                    title="Restore View"
                >
                    {idx + 1}
                </button>
            );
        });
    };

    const renderActiveTilePopup = () => {
        if (!activeTile) return null;

        const left = layout.canvasLeft + (activeTile.x * scaleX);
        const top = layout.canvasTop + (activeTile.y * scaleY);

        return (
            <motion.div
                drag
                dragMomentum={false}
                onDrag={(_, info) => {
                    activeM.x.set(activeM.x.get() + info.delta.x);
                    activeM.y.set(activeM.y.get() + info.delta.y);
                }}
                className={`absolute z-[60] cursor-grab active:cursor-grabbing ${isHolding ? 'pointer-events-none' : ''}`}
                style={{ left, top, x: activeM.x, y: activeM.y }}
            >
                <div className="absolute top-2 left-2 w-72 healthcare-card overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
                    <div className="relative h-64 bg-slate-100 dark:bg-slate-900 group">
                        <img src={activeTile.url} className="w-full h-full object-cover pointer-events-none" />

                        <button
                            onClick={() => setActiveTile(null)}
                            className="absolute top-4 right-4 w-10 h-10 bg-white/10 backdrop-blur hover:bg-rose-500 text-white rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                            title="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            </motion.div>
        );
    };

    return (
        <div ref={containerRef} className="relative w-full min-h-[950px] rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-900 overflow-hidden mb-20 transition-all shadow-inner">

            {title && (
                <div className="absolute top-0 left-0 right-0 h-14 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 flex items-center justify-center z-20">
                    <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">{title}</span>
                </div>
            )}


            <svg className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible">
                <defs>
                    <marker id={`dot-${uniqueId}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4">
                        <circle cx="5" cy="5" r="5" className="fill-brand-primary" />
                    </marker>
                </defs>
                {topRegions.map((region, idx) => {
                    const x1 = layout.canvasLeft + (region.x * scaleX);
                    const y1 = layout.canvasTop + (region.y * scaleY);

                    if (closedRegions.includes(idx)) return null;

                    const isLeft = (region.x / slideDims.w) < 0.5;
                    const sideList = isLeft ? leftRegions : rightRegions;
                    const vIdx = sideList.indexOf(region);

                    // Anchor points on the MODAL edges
                    const cardX = isLeft ? 24 + 288 : layout.containerW - 24 - 288;
                    const cardY = 80 + (vIdx * 300) + 128;

                    const m = mValues[idx % mValues.length];

                    return (
                        <DynamicLine
                            key={idx}
                            x1={x1} y1={y1}
                            baseX2={cardX} baseY2={cardY}
                            motionX={m.x} motionY={m.y}
                            isPrimary={idx === 0}
                            markerId={`dot-${uniqueId}`}
                        />
                    );
                })}
            </svg>

            <div ref={scrollContainerRef} className="flex justify-center items-start pt-0 pb-0 px-12 relative z-10 w-full min-h-full ">
                <div className="relative transition-all duration-300 ease-out flex-shrink-0" style={{ width: `${100 * zoom}%`, maxWidth: `${Math.max(1000, slideDims.w * 0.2) * zoom}px` }}>
                    <canvas ref={canvasRef} onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp} className="w-full h-auto shadow-[0_30px_90px_rgba(0,0,0,0.18)] rounded-[2.5rem] cursor-crosshair bg-white dark:bg-slate-900 block border-4 border-white dark:border-slate-800" />
                    <div className="absolute -inset-4 border-8 border-brand-primary/5 rounded-[3.5rem] pointer-events-none" />
                </div>
            </div>

            {leftRegions.map((r, i) => renderCard(r, 'left', i))}
            {rightRegions.map((r, i) => renderCard(r, 'right', i))}

            <div className="absolute top-20 left-0 right-0 z-40 flex justify-center pointer-events-none">
                <div className="bg-slate-900 text-white border-2 border-brand-primary shadow-2xl rounded-sm px-10 py-5 flex items-center gap-10 pointer-events-auto transition-transform hover:scale-105">
                    <button onClick={() => handleZoom(-0.25)} className="text-slate-400 hover:text-white font-black p-2 transition-colors text-3xl">−</button>
                    <div className="flex flex-col items-center min-w-[140px]">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-primary leading-none mb-2">Zoom Percentage</span>
                        <span className="text-xl font-mono font-black text-white whitespace-nowrap">{Math.round(zoom * 100)}%</span>
                    </div>
                    <button onClick={() => handleZoom(0.25)} className="text-slate-400 hover:text-white font-black p-2 transition-colors text-3xl">+</button>
                </div>
            </div>

            {renderClosedMarkers()}
            {renderActiveTilePopup()}

        </div>
    );
}
