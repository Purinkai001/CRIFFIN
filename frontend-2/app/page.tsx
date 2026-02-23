"use client";
import { useState, useEffect } from "react";
import { v4 as uuidv4 } from 'uuid';
import ControlPanel from "@/components/control-panel/ControlPanel";
import SlideGroup from "@/components/viewer/SlideGroup";
import { normalizeScore, fetchTopRegions } from "@/utils/heatmap";
import type { HeatmapPoint, ProcessResponse, QueryResultPayload, ServerFilesResponse, TopRegion } from "@/lib/types";

const MODEL_NAME = "medsiglip";

interface ResultSet {
  query: string;
  heatmapData: HeatmapPoint[];
  scoreStats: { min: number; max: number };
  topRegions: TopRegion[];
}

interface SlideData {
  filename: string;
  thumbnailUrl: string;
  slideDims: { w: number; h: number };
  parameters: ResultSet[];
}

const normalizeServerFileName = (file: string | { name: string; size_mb?: number }): string => (
  typeof file === "string" ? file : file.name
);

export default function HeatmapPage() {
  const normalizeServerUrl = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return "";

    const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed);
    const candidate = hasScheme ? trimmed : `http://${trimmed}`;

    try {
      return new URL(candidate).origin;
    } catch {
      return candidate.replace(/\/+$/, "");
    }
  };

  const [serverUrl] = useState<string>(() => {
    const envUrl = normalizeServerUrl(process.env.NEXT_PUBLIC_SERVER_URL ?? "");
    if (typeof window === "undefined") return envUrl;
    const saved = localStorage.getItem("backend_url");
    return saved ? normalizeServerUrl(saved) : envUrl;
  });
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => uuidv4().slice(0, 8));
  const [serverFiles, setServerFiles] = useState<string[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [selectedSlides, setSelectedSlides] = useState<string[]>([]);

  const [queries, setQueries] = useState<string[]>([]);
  const [customQueryHistory, setCustomQueryHistory] = useState<string[]>([]);
  const [processLevel, setProcessLevel] = useState(3);

  const [slides, setSlides] = useState<SlideData[]>([]);
  const [threshold, setThreshold] = useState(0.90);

  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [activeParamIdx, setActiveParamIdx] = useState(0);

  useEffect(() => {
    const autoConnect = async () => {
      const savedUrl = localStorage.getItem("backend_url") || serverUrl;
      if (savedUrl) {
        try {
          const cleanSavedUrl = normalizeServerUrl(savedUrl);
          if (!cleanSavedUrl) return;
          const res = await fetch(`${cleanSavedUrl}/files`);
          if (res.ok) {
            const data: ServerFilesResponse = await res.json();
            const safeFiles = data.files.map(normalizeServerFileName);
            setServerFiles(safeFiles);
          }
        } catch {
          // ignore auto-connect failures
        }
      }
    };
    autoConnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cleanUrl = () => normalizeServerUrl(serverUrl);

  const handleConnect = async () => {
    const url = cleanUrl();
    if (!url) return;
    localStorage.setItem("backend_url", url);
    try {
      const res = await fetch(`${url}/files`);
      if (res.ok) {
        const data: ServerFilesResponse = await res.json();
        const safeFiles = data.files.map(normalizeServerFileName);
        setServerFiles(safeFiles);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpload = async () => {
    if (!serverUrl || !file) return;
    setLoading(true);
    const uniqueName = `${sessionId}_${file.name.replace(/\s/g, '')}`;
    const isZip = uniqueName.toLowerCase().endsWith(".zip");
    const CHUNK_SIZE = 5 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    try {
      for (let i = 0; i < totalChunks; i++) {
        const formData = new FormData();
        formData.append("file", file.slice(i * CHUNK_SIZE, Math.min(file.size, (i + 1) * CHUNK_SIZE)));
        formData.append("filename", uniqueName);
        formData.append("chunk_index", i.toString());
        await fetch(`${cleanUrl()}/upload_chunk`, { method: "POST", body: formData });
        setProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      if (isZip) {
        const extractForm = new FormData();
        extractForm.append("filename", uniqueName);
        const extractRes = await fetch(`${cleanUrl()}/extract_batch`, { method: "POST", body: extractForm });

        if (extractRes.ok) {
          const extractData = await extractRes.json();
          await handleConnect();

          if (extractData.slides && extractData.slides.length > 0) {
            const filenames = extractData.slides.map((s: { filename: string }) => s.filename);
            setSelectedSlides(filenames);
          }
        }
      } else {
        await handleConnect();
        setSelectedSlides([uniqueName]);
      }
    } catch {
      // ignore upload errors for now
    }
    setLoading(false);
    setProgress(0);
  };

  const handleProcess = async () => {
    const distinctTerms = Array.from(new Set(queries));
    if (selectedSlides.length === 0 || distinctTerms.length === 0) return;

    setLoading(true);
    setSlides([]);
    setActiveSlideIdx(0);
    setActiveParamIdx(0);

    try {
      const newSlides: SlideData[] = [];
      let processFailed = false;

      for (const slideFilename of selectedSlides) {
        let thumbnailUrl = "";
        try {
          const thumbRes = await fetch(`${cleanUrl()}/thumbnail/${slideFilename}`);
          if (thumbRes.ok) {
            thumbnailUrl = URL.createObjectURL(await thumbRes.blob());
          }
        } catch {
          // ignore thumbnail fetch errors
        }

        const slideResults: ResultSet[] = [];
        let slideDims = { w: 0, h: 0 };

        const formData = new FormData();
        formData.append("filename", slideFilename);
        formData.append("query", JSON.stringify(distinctTerms));
        formData.append("level", processLevel.toString());
        formData.append("model_name", MODEL_NAME);

        const res = await fetch(`${cleanUrl()}/process`, { method: "POST", body: formData });
        if (res.ok) {
          const data: ProcessResponse = await res.json();
          slideDims = { w: data.width, h: data.height };

          const resultsMap = new Map<string, HeatmapPoint[]>();
          const rawResults: QueryResultPayload[] = "query_results" in data
            ? data.query_results
            : [{ query: distinctTerms[0], results: data.results }];

          for (const qr of rawResults) {
            resultsMap.set(qr.query, qr.results || []);
          }

          for (const q of queries) {
            const points = (resultsMap.get(q) || []).map((pt) => ({
              ...pt,
              score: normalizeScore(pt.score)
            }));

            if (points.length > 0) {
              const scores = points.map((r) => r.score);
              const stats = { min: Math.min(...scores), max: Math.max(...scores) };
              const topRegions = await fetchTopRegions(points, cleanUrl(), slideFilename, processLevel);
              slideResults.push({ query: q, heatmapData: points, scoreStats: stats, topRegions });
            }
          }
        } else {
          processFailed = true;
          break;
        }

        if (slideResults.length > 0) {
          newSlides.push({
            filename: slideFilename,
            thumbnailUrl,
            slideDims,
            parameters: slideResults
          });
        }
      }

      newSlides.sort((a, b) => a.filename.localeCompare(b.filename));

      if (!processFailed && newSlides.length > 0) {
        setSlides(newSlides);
        setThreshold(0.90);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const onTileFetch = async (x: number, y: number) => {
    if (slides.length === 0 || !slides[activeSlideIdx]) return null;
    try {
      const res = await fetch(`${cleanUrl()}/tile/${slides[activeSlideIdx].filename}/${x}/${y}?level=${processLevel}`);
      if (res.ok) return URL.createObjectURL(await res.blob());
    } catch {
      // ignore tile fetch errors
    }
    return null;
  };

  const handleSelectSlideParam = (slideIdx: number, paramIdx: number) => {
    setActiveSlideIdx(slideIdx);
    setActiveParamIdx(paramIdx);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-200 pb-20 transition-colors">
      <div className="max-w-7xl mx-auto px-6 pt-8">

        <ControlPanel
          serverFiles={serverFiles}
          selectedSlides={selectedSlides}
          setSelectedSlides={setSelectedSlides}
          setFile={setFile}
          file={file}
          handleUpload={handleUpload}
          loading={loading}
          progress={progress}
          queries={queries}
          setQueries={setQueries}
          customQueryHistory={customQueryHistory}
          setCustomQueryHistory={setCustomQueryHistory}
          processLevel={processLevel}
          setProcessLevel={setProcessLevel}
          handleProcess={handleProcess}
          serverUrl={serverUrl}
        />

        {slides.length > 0 && (
          <div className="my-6 flex justify-center sticky top-20 z-40">
            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur px-6 py-3 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-4 animate-in slide-in-from-top-4 transition-colors">
              <span className="font-bold text-sm text-slate-600 dark:text-slate-300">Global Score Filter</span>
              <input
                type="range"
                min="0"
                max="0.95"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-48 accent-emerald-600 cursor-pointer"
              />
              <span className="text-xs font-mono w-8">{threshold.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-12">
          {slides.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-2">
                All Slides ({slides.length})
              </h3>
              {slides.map((slide, slideIdx) => (
                <SlideGroup
                  key={slide.filename}
                  slideFilename={slide.filename}
                  thumbnailUrl={slide.thumbnailUrl}
                  slideDims={slide.slideDims}
                  parameters={slide.parameters}
                  threshold={threshold}
                  isActiveSlide={slideIdx === activeSlideIdx}
                  activeParamIdx={activeParamIdx}
                  onSelectParam={(paramIdx) => handleSelectSlideParam(slideIdx, paramIdx)}
                  onTileFetch={onTileFetch}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
