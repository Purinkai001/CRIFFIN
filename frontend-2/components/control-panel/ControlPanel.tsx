import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Check, Gauge, RotateCcw } from "lucide-react";
import { useClickOutside } from "@/hooks/useClickOutside";
import UploadCard from "@/components/control-panel/UploadCard";
import SlideSelector from "@/components/control-panel/SlideSelector";
import CustomSelect from "@/components/ui/CustomSelect";
import { Header } from "@/components/control-panel/heatmap-search/Header";
import { EmptyState } from "@/components/control-panel/heatmap-search/EmptyState";

interface Props {
    serverFiles: string[];
    selectedSlides: string[];
    setSelectedSlides: (v: string[]) => void;
    setFile: (f: File | null) => void;
    file: File | null;
    handleUpload: () => void;
    loading: boolean;
    progress: number;
    handleProcess: () => void;
    serverUrl: string;
    queries: string[];
    setQueries: (v: string[]) => void;
    customQueryHistory: string[];
    setCustomQueryHistory: (v: string[]) => void;
    processLevel: number;
    setProcessLevel: (v: number) => void;
}

export default function ControlPanel({
    serverFiles,
    selectedSlides, setSelectedSlides,
    setFile, file, handleUpload,
    loading, progress,
    queries, setQueries,
    customQueryHistory, setCustomQueryHistory,
    processLevel, setProcessLevel,
    handleProcess,
    serverUrl,
}: Props) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 flex flex-col gap-6">


                <UploadCard file={file} setFile={setFile} handleUpload={handleUpload} loading={loading} progress={progress} />

                <div className="min-h-[500px]">
                    <SlideSelector serverFiles={serverFiles} selectedSlides={selectedSlides} setSelectedSlides={setSelectedSlides} serverUrl={serverUrl} />
                </div>
            </div>

            <div className="lg:col-span-8">
                <HeatmapSearchLegacy
                    queries={queries}
                    setQueries={setQueries}
                    customQueryHistory={customQueryHistory}
                    setCustomQueryHistory={setCustomQueryHistory}
                    processLevel={processLevel}
                    setProcessLevel={setProcessLevel}
                    handleProcess={handleProcess}
                    loading={loading}
                    selectedSlidesCount={selectedSlides.length}
                    serverUrl={serverUrl}
                />
            </div>
        </div>
    );
}

interface LegacyProps {
    queries: string[];
    setQueries: (v: string[]) => void;
    customQueryHistory: string[];
    setCustomQueryHistory: (v: string[]) => void;
    processLevel: number;
    setProcessLevel: (v: number) => void;
    handleProcess: () => void;
    loading: boolean;
    selectedSlidesCount: number;
    serverUrl: string;
}

function HeatmapSearchLegacy({
    queries,
    setQueries,
    customQueryHistory,
    setCustomQueryHistory,
    processLevel,
    setProcessLevel,
    handleProcess,
    loading,
    selectedSlidesCount,
    serverUrl,
}: LegacyProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [inputFocus, setInputFocus] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const searchContainerRef = useRef<HTMLDivElement>(null);
    useClickOutside(searchContainerRef, useCallback(() => setInputFocus(false), []));

    const [commonQueries, setCommonQueries] = useState<string[]>([]);

    useEffect(() => {
        const cleanUrl = serverUrl.replace(/\/$/, "");
        if (!serverUrl) return;
        (async () => {
            try {
                const res = await fetch(`${cleanUrl}/queries`);
                if (res.ok) {
                    const data = await res.json();
                    setCommonQueries(data.common_queries || []);
                    return;
                }
            } catch {
                // ignore
            }
            setCommonQueries(["Tumor cells", "poorly differentiated adenocarcinoma"]);
        })();
    }, [serverUrl]);

    const isQueryActive = (q: string) => queries.includes(q);

    const toggleQuery = (q: string) => {
        const trimmed = q.trim();
        if (!trimmed) return;
        setQueries(isQueryActive(trimmed) ? queries.filter((e) => e !== trimmed) : [...queries, trimmed]);
    };

    const handleAddFromInput = (val: string) => {
        const trimmed = val.trim();
        if (!trimmed) return;

        if (!customQueryHistory.includes(trimmed)) {
            setCustomQueryHistory([...customQueryHistory, trimmed]);
        }
        toggleQuery(trimmed);
        setInputValue("");
    };

    const clearActiveQueries = () => setQueries([]);
    const clearCustomHistory = () => setCustomQueryHistory([]);

    const displayItems: Array<{ value: string; active: boolean; source: "backend" | "custom" }> = [];
    commonQueries.forEach((q) => displayItems.push({ value: q, active: isQueryActive(q), source: "backend" }));
    customQueryHistory.forEach((q) => {
        if (!commonQueries.includes(q)) {
            displayItems.push({ value: q, active: isQueryActive(q), source: "custom" });
        }
    });

    const totalQueries = queries.length;
    const canProcess = selectedSlidesCount > 0 && totalQueries > 0;
    const selectionSummary = totalQueries > 0 ? `${totalQueries} targets selected` : "No target selected";

    return (
        <div className="healthcare-card p-4 flex flex-col border border-slate-200/70 dark:border-slate-700">
            <Header isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} selection={selectionSummary} />

            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="pt-6 flex flex-col gap-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/80">
                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Slides Selected</p>
                                    <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{selectedSlidesCount}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/80">
                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Active Targets</p>
                                    <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{totalQueries}</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50/70 dark:bg-slate-900/50">

                                <div className="flex items-center gap-2 justify-between">
                                    <button
                                        onClick={clearActiveQueries}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.16em] border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-brand-primary/40 hover:text-brand-primary transition-colors"
                                    >
                                        <RotateCcw size={12} />
                                        Clear Active
                                    </button>
                                    <button
                                        onClick={clearCustomHistory}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.16em] border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-rose-400/50 hover:text-rose-500 transition-colors"
                                    >
                                        <RotateCcw size={12} />
                                        Clear Custom
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4">
                                <CustomSelect
                                    label="Magnification"
                                    value={processLevel}
                                    onChange={(v) => setProcessLevel(Number(v))}
                                    options={[
                                        { value: 3, label: "x 5", description: "Fast preview", icon: <Gauge size={12} className="opacity-40" /> },
                                        { value: 2, label: "x 10", description: "Balanced speed and detail", icon: <Gauge size={12} className="opacity-70" /> },
                                        { value: 1, label: "x 20", description: "Full resolution", icon: <Gauge size={12} /> },
                                    ]}
                                />
                            </div>

                            <div className="relative" ref={searchContainerRef}>
                                <div className={`flex items-center healthcare-input p-1.5 transition-all ${inputFocus ? "border-brand-primary shadow-sm" : ""}`}>
                                    <div className="pl-4 text-slate-400"><Search size={24} /></div>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-transparent border-none outline-none text-lg text-slate-700 dark:text-slate-100 font-bold placeholder:text-slate-400 placeholder:font-normal"
                                        placeholder="Type Query"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onFocus={() => setInputFocus(true)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleAddFromInput(inputValue);
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => handleAddFromInput(inputValue)}
                                        disabled={!inputValue.trim()}
                                        className="h-10 px-4 flex items-center justify-center text-sm uppercase tracking-widest shrink-0 bg-brand-primary rounded-xl hover:bg-brand-primary/80 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Add Query
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                {displayItems.map((item, idx) => (
                                    <button
                                        key={`single-${idx}`}
                                        onClick={() => toggleQuery(item.value)}
                                        className={`w-full px-5 py-4 rounded-2xl border transition-all duration-200 flex items-center justify-between group text-left ${item.active
                                            ? "bg-brand-primary/5 border-brand-primary shadow-[0_8px_22px_rgba(37,99,235,0.12)]"
                                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-brand-primary/40"
                                            }`}
                                    >
                                        <div className="flex-1 min-w-0 pr-5">

                                            <p className={`text-base font-bold leading-tight break-words w-full ${item.active ? "text-brand-primary" : "text-slate-800 dark:text-slate-100"}`}>
                                                {item.value}
                                            </p>
                                        </div>
                                        <div className={`w-7 h-7 rounded-xl flex shrink-0 items-center justify-center border-2 transition-all ${item.active
                                            ? "bg-brand-primary border-brand-primary text-white"
                                            : "border-slate-300 dark:border-slate-600 text-transparent group-hover:border-brand-primary/40"
                                            }`}>
                                            <Check size={14} strokeWidth={4} />
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {displayItems.length === 0 && <EmptyState />}

                            <button
                                onClick={handleProcess}
                                disabled={!canProcess || loading}
                                className="healthcare-button w-full py-4 shadow-lg shadow-brand-primary/10 flex items-center justify-center gap-3 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        <span className="text-base font-bold uppercase tracking-widest">Processing Analysis...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-base font-bold uppercase tracking-widest">Initiate Heatmap Analysis</span>
                                        {canProcess && (
                                            <span className="bg-white/20 text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">
                                                {totalQueries} Targets
                                            </span>
                                        )}
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
