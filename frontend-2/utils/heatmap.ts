import { getBlueRedColor } from "./colors";
import type { HeatmapPoint, TopRegion } from "@/lib/types";

interface DrawHeatmapOptions {
    ctx: CanvasRenderingContext2D;
    heatmapData: HeatmapPoint[];
    scoreStats: { min: number; max: number };
    threshold: number;
    imgW: number;
    imgH: number;
    slideW: number;
    slideH: number;
}

export const drawHeatmap = ({
    ctx, heatmapData, scoreStats, threshold, imgW, imgH, slideW, slideH
}: DrawHeatmapOptions) => {
    if (slideW <= 0 || heatmapData.length === 0) return;

    const sX = imgW / slideW;
    const sY = imgH / slideH;

    let stepSize = 224;
    if (heatmapData.length > 1) {
        const sortedX = [...new Set(heatmapData.map((p) => p.x))].sort((a, b) => a - b);
        if (sortedX.length > 1) stepSize = sortedX[1] - sortedX[0];
    }

    const tileW = Math.max(1, Math.ceil(stepSize * sX));
    const tileH = Math.max(1, Math.ceil(stepSize * sY));
    const { min, max } = scoreStats;
    const range = max - min || 1;

    heatmapData.forEach((pt) => {
        const norm = (pt.score - min) / range;
        if (norm < threshold) return;
        ctx.fillStyle = getBlueRedColor(norm);
        ctx.fillRect(Math.floor(pt.x * sX), Math.floor(pt.y * sY), tileW, tileH);
    });
};

export const normalizeScore = (s: number) => (s + 1) / 2;

export const matchGroup = (a: string[], b: string[]) =>
    [...a].sort().join("|") === [...b].sort().join("|");

export async function fetchTopRegions(
    points: { x: number; y: number; score: number }[],
    serverUrl: string, filename: string, level: number, count = 3
): Promise<TopRegion[]> {
    const sorted = [...points].sort((a, b) => b.score - a.score).slice(0, count);
    return Promise.all(sorted.map(async (item) => {
        try {
            const reqX = Math.floor(item.x / 50) * 50;
            const reqY = Math.floor(item.y / 50) * 50;
            const res = await fetch(`${serverUrl}/tile/${filename}/${reqX}/${reqY}?level=${level}`);
            if (res.ok) return { ...item, imgUrl: URL.createObjectURL(await res.blob()) };
        } catch { /* ignore */ }
        return item;
    }));
}

export function calculateScaleFactor(w: number, h: number, max = 8192) {
    return Math.max(16, Math.ceil(Math.max(w, h) / max));
}

export function calculateStepSize(data: { x: number; y: number }[]) {
    if (data.length < 6) return 448;
    const sorted = [...data].sort((a, b) => a.x - b.x);
    const counts: Record<number, number> = {};
    for (let i = 0; i < Math.min(20, sorted.length - 1); i++) {
        const d = sorted[i + 1].x - sorted[i].x;
        if (d > 0) counts[d] = (counts[d] || 0) + 1;
    }
    return Object.entries(counts).reduce<[number, number]>((best, [d, c]) =>
        c > best[1] ? [+d, c] : best, [448, 0])[0];
}
