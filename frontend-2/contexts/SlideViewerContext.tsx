"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { HeatmapPoint, ServerFilesResponse } from '@/lib/types';

const normalizeServerFileName = (file: string | { name: string; size_mb?: number }): string => (
    typeof file === "string" ? file : file.name
);

interface SlideViewerContextType {
    serverUrl: string;
    setServerUrl: (url: string) => void;
    serverFiles: string[];
    refreshFiles: () => Promise<void>;
    connectionStatus: 'connected' | 'disconnected' | 'connecting';
    selectedSlide: string | null;
    setSelectedSlide: (slide: string | null) => void;
    heatmapData: HeatmapPoint[];
    setHeatmapData: (data: HeatmapPoint[]) => void;
    loading: boolean;
    setLoading: (loading: boolean) => void;
}

const SlideViewerContext = createContext<SlideViewerContextType | null>(null);

export function useSlideViewer() {
    return useContext(SlideViewerContext);
}

export function useSlideViewerRequired() {
    const context = useContext(SlideViewerContext);
    if (!context) throw new Error('useSlideViewerRequired must be used within SlideViewerProvider');
    return context;
}

interface ProviderProps {
    children: ReactNode;
    defaultServerUrl?: string;
}

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

export function SlideViewerProvider({ children, defaultServerUrl }: ProviderProps) {
    const [serverUrl, setServerUrl] = useState(() => {
        const fromProp = defaultServerUrl ?? "";
        const fromEnv = process.env.NEXT_PUBLIC_SERVER_URL ?? "";
        return normalizeServerUrl(fromProp || fromEnv);
    });
    const [serverFiles, setServerFiles] = useState<string[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
    const [selectedSlide, setSelectedSlide] = useState<string | null>(null);
    const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([]);
    const [loading, setLoading] = useState(false);

    const cleanUrl = useCallback(() => serverUrl.replace(/\/$/, ""), [serverUrl]);

    const refreshFiles = useCallback(async () => {
        setConnectionStatus('connecting');
        try {
            const filesRes = await fetch(`${cleanUrl()}/files`);

            if (filesRes.ok) {
                const data: ServerFilesResponse = await filesRes.json();
                const safeFiles = data.files.map(normalizeServerFileName);
                setServerFiles(safeFiles);
                setConnectionStatus('connected');
            } else {
                setConnectionStatus('disconnected');
            }
        } catch {
            setConnectionStatus('disconnected');
        }
    }, [cleanUrl]);

    useEffect(() => {
        let isMounted = true;
        fetch(`${cleanUrl()}/files`)
            .then(async (filesRes) => {
                if (!isMounted) return;
                if (!filesRes.ok) {
                    setConnectionStatus('disconnected');
                    return;
                }
                const data: ServerFilesResponse = await filesRes.json();
                const safeFiles = data.files.map(normalizeServerFileName);
                setServerFiles(safeFiles);
                setConnectionStatus('connected');
            })
            .catch(() => {
                if (isMounted) setConnectionStatus('disconnected');
            });

        return () => {
            isMounted = false;
        };
    }, [cleanUrl]);

    return (
        <SlideViewerContext.Provider value={{
            serverUrl, setServerUrl,
            serverFiles, refreshFiles, connectionStatus,
            selectedSlide, setSelectedSlide,
            heatmapData, setHeatmapData,
            loading, setLoading,
        }}>
            {children}
        </SlideViewerContext.Provider>
    );
}
