"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, ChevronDown, Plus, Loader2 } from "lucide-react";
import { useSlideViewer } from "@/contexts/SlideViewerContext";

interface Props {
    file?: File | null;
    setFile?: (f: File | null) => void;
    handleUpload?: () => void;
    loading?: boolean;
    progress?: number;
}

export default function UploadCard(props: Props) {
    const context = useSlideViewer();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const [internalFile, setInternalFile] = useState<File | null>(null);
    const [internalProgress, setInternalProgress] = useState(0);
    const [uploading, setUploading] = useState(false);

    const file = props.file !== undefined ? props.file : internalFile;
    const setFile = props.setFile || setInternalFile;
    const progress = props.progress !== undefined ? props.progress : internalProgress;
    const loading = props.loading !== undefined ? props.loading : uploading;

    const envServerUrl = (process.env.NEXT_PUBLIC_SERVER_URL ?? "").replace(/\/$/, "");
    const serverUrl = (context?.serverUrl || envServerUrl).replace(/\/$/, "");

    const handleUpload = props.handleUpload || (async () => {
        if (!file || !serverUrl) return;
        setUploading(true);
        const uniqueName = file.name.replace(/\s/g, '');
        const CHUNK_SIZE = 5 * 1024 * 1024;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        try {
            for (let i = 0; i < totalChunks; i++) {
                const formData = new FormData();
                formData.append("file", file.slice(i * CHUNK_SIZE, Math.min(file.size, (i + 1) * CHUNK_SIZE)));
                formData.append("filename", uniqueName);
                formData.append("chunk_index", i.toString());
                await fetch(`${serverUrl}/upload_chunk`, { method: "POST", body: formData });
                setInternalProgress(Math.round(((i + 1) / totalChunks) * 100));
            }
            context?.refreshFiles?.();
            setInternalFile(null);
        } catch (err) {
            console.error("Upload failed", err);
        }
        setUploading(false);
        setInternalProgress(0);
    });

    return (
        <div className="healthcare-card p-4">
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center gap-4 cursor-pointer select-none"
            >
                <div className="bg-brand-primary/10 text-brand-primary p-2.5 rounded-xl">
                    <Upload size={24} strokeWidth={2.5} />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg flex-1">New Slide Upload</h3>
                <motion.div
                    animate={{ rotate: isCollapsed ? -90 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-slate-400"
                >
                    <ChevronDown size={20} strokeWidth={2.5} />
                </motion.div>
            </div>

            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-5 pt-6">
                            <label className="block w-full cursor-pointer group">
                                <div className="flex flex-col items-center justify-center w-full h-36 border-2 border-slate-200 dark:border-slate-800 border-dashed rounded-xl bg-slate-50/50 dark:bg-slate-900/50 group-hover:bg-slate-100/50 dark:group-hover:bg-slate-800/50 group-hover:border-brand-primary/30 transition-all relative">
                                    <div className="flex flex-col items-center justify-center pt-6 pb-8">
                                        {file ? (
                                            <div className="text-center px-4 animate-in fade-in zoom-in-95">
                                                <div className="text-4xl mb-3">📄</div>
                                                <p className="text-base text-slate-900 dark:text-slate-100 font-bold px-2 break-words">{file.name}</p>
                                                <p className="text-xs text-slate-500 mt-2 uppercase tracking-widest font-bold">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="mb-4 text-slate-400">
                                                    <Plus size={40} strokeWidth={1.5} />
                                                </div>
                                                <p className="text-base text-slate-600 dark:text-slate-300 font-bold">
                                                    Drag & Drop or <span className="text-brand-primary">Browse</span>
                                                </p>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 uppercase tracking-widest">
                                                    SVS, NDPI, MRXS, ZIP
                                                </p>
                                            </>
                                        )}
                                    </div>
                                    <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                                </div>
                            </label>

                            <button
                                onClick={handleUpload}
                                disabled={loading || !file}
                                className="healthcare-button w-full h-14 flex items-center justify-center shadow-lg shadow-brand-primary/10"
                            >
                                {progress > 0 && progress < 100 ? (
                                    <div className="flex items-center gap-3">
                                        <Loader2 size={20} className="animate-spin" />
                                        <span className="text-base font-bold tracking-widest uppercase">UPLOADING {progress}%</span>
                                    </div>
                                ) : (
                                    <span className="text-base text-white font-bold tracking-widest uppercase">Start Digital Upload</span>
                                )}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
