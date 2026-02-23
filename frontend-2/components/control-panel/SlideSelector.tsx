"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSlideViewer } from "@/contexts/SlideViewerContext";
import { groupSlides, countSelectedInGroup, countSelectedInSubgroup, countTotalInGroup } from "@/utils/slideParser";

const MAX_CACHE_SLIDES = 10;

interface Props {
    serverFiles?: string[];
    selectedSlides?: string[];
    setSelectedSlides?: (v: string[]) => void;
    serverUrl?: string;
}

export default function SlideSelector(props: Props) {
    const context = useSlideViewer();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [slideFilter, setSlideFilter] = useState("");
    const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set());
    const [expandedSubnames, setExpandedSubnames] = useState<Set<string>>(new Set());

    const serverFiles = props.serverFiles ?? context?.serverFiles ?? [];
    const serverUrl = props.serverUrl ?? context?.serverUrl ?? "";
    const cleanUrl = serverUrl.replace(/\/$/, "");

    const isMultiSelectMode = !!props.setSelectedSlides;
    const selectedSlides = props.selectedSlides ?? (context?.selectedSlide ? [context.selectedSlide] : []);

    const setSelectedSlides = props.setSelectedSlides ?? ((slides: string[]) => {
        context?.setSelectedSlide?.(slides[0] ?? null);
    });

    const filteredSlides = serverFiles.filter(f => {
        const isSlide = f.match(/\.(mrxs|svs|ndpi)$/i);
        const matchesFilter = slideFilter === "" || f.toLowerCase().includes(slideFilter.toLowerCase());
        return isSlide && matchesFilter;
    });

    // Group slides by name and subname
    const slideGroups = useMemo(() => groupSlides(filteredSlides), [filteredSlides]);

    // Check if files use comma-separated naming
    const hasHierarchy = useMemo(() => {
        return filteredSlides.some(f => {
            const baseName = f.replace(/\.(mrxs|svs|ndpi)$/i, '');
            return baseName.includes(',');
        });
    }, [filteredSlides]);

    const toggleSlide = (filename: string) => {
        if (isMultiSelectMode) {
            if (selectedSlides.includes(filename)) {
                setSelectedSlides(selectedSlides.filter(s => s !== filename));
            } else if (selectedSlides.length < MAX_CACHE_SLIDES) {
                setSelectedSlides([...selectedSlides, filename]);
            }
        } else {
            setSelectedSlides(selectedSlides.includes(filename) ? [] : [filename]);
        }
    };

    const toggleNameExpanded = (name: string) => {
        setExpandedNames(prev => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
    };

    const toggleSubnameExpanded = (key: string) => {
        setExpandedSubnames(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        if (isMultiSelectMode) {
            setSelectedSlides(filteredSlides.slice(0, MAX_CACHE_SLIDES));
        } else if (filteredSlides[0]) {
            setSelectedSlides([filteredSlides[0]]);
        }
    };

    const handleDelete = async (filename: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering slide selection

        if (!confirm(`Are you sure you want to delete "${filename}"? This cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`${cleanUrl}/delete_file/${encodeURIComponent(filename)}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const error = await response.json();
                alert(`Failed to delete: ${error.error || 'Unknown error'}`);
                return;
            }

            // Remove from selected slides if it was selected
            if (selectedSlides.includes(filename)) {
                setSelectedSlides(selectedSlides.filter(s => s !== filename));
            }

            // Trigger a refresh of the file list by updating context
            if (context?.refreshFiles) {
                context.refreshFiles();
            }

        } catch (error) {
            console.error('Delete failed:', error);
            alert('Failed to delete file. Please try again.');
        }
    };

    return (
        <div className="healthcare-card p-4 flex flex-col">
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center gap-4 cursor-pointer select-none"
            >
                <div className="bg-brand-primary/10 text-brand-primary p-2.5 rounded-xl">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">Slide Library</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
                        {selectedSlides.length} / {MAX_CACHE_SLIDES} selected
                    </p>
                </div>
                <motion.div
                    animate={{ rotate: isCollapsed ? -90 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-slate-400"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
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
                        <div className="pt-6 flex flex-col gap-4">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search clinical slides..."
                                    value={slideFilter}
                                    onChange={(e) => setSlideFilter(e.target.value)}
                                    className="w-full pl-12 pr-5 py-3 text-base text-white font-bold bg-slate-800 rounded-xl border-none outline-none focus:ring-2 focus:ring-brand-primary/30"
                                />
                                <svg className="w-5 h-5 text-slate-400 absolute left-4 top-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={handleSelectAll}
                                    className="healthcare-button-outline flex-1 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white"
                                >
                                    {isMultiSelectMode ? 'Select All' : 'Select First'}
                                </button>
                                <button
                                    onClick={() => setSelectedSlides([])}
                                    className="healthcare-button-outline text-white flex-1 py-2 text-xs font-bold uppercase tracking-[0.2em] hover:text-rose-500 hover:border-rose-200"
                                >
                                    Clear All
                                </button>
                            </div>

                            <div className="flex-1 space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                                {filteredSlides.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center text-slate-400 py-8">
                                        <div className="opacity-20 mb-4">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                        </div>
                                        <p className="text-sm font-bold uppercase tracking-[0.2em] italic">No Slide matches</p>
                                    </div>
                                ) : hasHierarchy ? (
                                    // Tree hierarchy view
                                    slideGroups.map((group) => {
                                        const isNameExpanded = expandedNames.has(group.name);
                                        const selectedCount = countSelectedInGroup(group, selectedSlides);
                                        const totalCount = countTotalInGroup(group);

                                        return (
                                            <div key={group.name} className="space-y-2">
                                                {/* Name level header */}
                                                <div
                                                    onClick={() => toggleNameExpanded(group.name)}
                                                    className="group flex items-center p-3 rounded-xl border cursor-pointer transition-all duration-200
                                                        bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700
                                                        hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300"
                                                >
                                                    <motion.div
                                                        animate={{ rotate: isNameExpanded ? 90 : 0 }}
                                                        transition={{ duration: 0.15 }}
                                                        className="text-slate-400 mr-3"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                            <polyline points="9 6 15 12 9 18"></polyline>
                                                        </svg>
                                                    </motion.div>
                                                    <div className={`p-1.5 rounded-lg mr-3 ${isNameExpanded ? 'bg-brand-primary/20 text-brand-primary' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                                        </svg>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                                                            {group.name}
                                                        </h4>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                            {group.subgroups.size} group{group.subgroups.size !== 1 ? 's' : ''} • {totalCount} slide{totalCount !== 1 ? 's' : ''}
                                                        </p>
                                                    </div>
                                                    {selectedCount > 0 && (
                                                        <div className="bg-brand-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                            {selectedCount}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Subname level */}
                                                <AnimatePresence>
                                                    {isNameExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.15 }}
                                                            className="overflow-hidden pl-4 space-y-2"
                                                        >
                                                            {Array.from(group.subgroups.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([subname, slides]) => {
                                                                const subnameKey = `${group.name}-${subname}`;
                                                                const isSubnameExpanded = expandedSubnames.has(subnameKey);
                                                                const subSelectedCount = countSelectedInSubgroup(slides, selectedSlides);

                                                                return (
                                                                    <div key={subnameKey} className="space-y-2">
                                                                        {/* Subname header */}
                                                                        <div
                                                                            onClick={() => toggleSubnameExpanded(subnameKey)}
                                                                            className="group flex items-center p-2.5 rounded-lg border cursor-pointer transition-all duration-200
                                                                                bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800
                                                                                hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:border-slate-200"
                                                                        >
                                                                            <motion.div
                                                                                animate={{ rotate: isSubnameExpanded ? 90 : 0 }}
                                                                                transition={{ duration: 0.15 }}
                                                                                className="text-slate-300 mr-2"
                                                                            >
                                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                                    <polyline points="9 6 15 12 9 18"></polyline>
                                                                                </svg>
                                                                            </motion.div>
                                                                            <div className={`p-1 rounded mr-2 ${isSubnameExpanded ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                                                                    <polyline points="14 2 14 8 20 8" />
                                                                                </svg>
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                                                                    {subname || 'Default'}
                                                                                </span>
                                                                                <span className="text-[10px] text-slate-400 ml-2">
                                                                                    ({slides.length})
                                                                                </span>
                                                                            </div>
                                                                            {subSelectedCount > 0 && (
                                                                                <div className="bg-brand-primary/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                                                                    {subSelectedCount}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Index level (slides) */}
                                                                        <AnimatePresence>
                                                                            {isSubnameExpanded && (
                                                                                <motion.div
                                                                                    initial={{ height: 0, opacity: 0 }}
                                                                                    animate={{ height: "auto", opacity: 1 }}
                                                                                    exit={{ height: 0, opacity: 0 }}
                                                                                    transition={{ duration: 0.15 }}
                                                                                    className="overflow-hidden pl-4 space-y-1"
                                                                                >
                                                                                    {slides.map((slide) => {
                                                                                        const isSelected = selectedSlides.includes(slide.fullPath);
                                                                                        const thumbUrl = `${cleanUrl}/thumbnail/${slide.fullPath}`;

                                                                                        return (
                                                                                            <div
                                                                                                key={slide.fullPath}
                                                                                                onClick={() => toggleSlide(slide.fullPath)}
                                                                                                className={`group flex items-center p-2 rounded-lg border transition-all duration-200 cursor-pointer ${isSelected
                                                                                                    ? 'bg-brand-primary/5 border-brand-primary shadow-sm'
                                                                                                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-brand-primary/30 hover:shadow-sm'
                                                                                                    }`}
                                                                                            >
                                                                                                <div className={`w-5 h-5 rounded flex items-center justify-center mr-3 transition-all text-white border-2 ${isSelected
                                                                                                    ? 'bg-brand-primary border-brand-primary'
                                                                                                    : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-700 group-hover:border-brand-primary/30'
                                                                                                    }`}>
                                                                                                    {isSelected && (
                                                                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                                                                            <polyline points="20 6 9 17 4 12"></polyline>
                                                                                                        </svg>
                                                                                                    )}
                                                                                                </div>
                                                                                                <div className="flex-1 min-w-0">
                                                                                                    <span className={`text-sm font-medium ${isSelected ? 'text-brand-primary' : 'text-slate-700 dark:text-slate-200'}`}>
                                                                                                        Index {slide.index || '0'}
                                                                                                    </span>
                                                                                                    <span className="text-[9px] text-slate-400 ml-2 uppercase">
                                                                                                        {slide.extension}
                                                                                                    </span>
                                                                                                </div>
                                                                                                {/* Delete button */}
                                                                                                <button
                                                                                                    onClick={(e) => handleDelete(slide.fullPath, e)}
                                                                                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all mr-2"
                                                                                                    title="Delete slide"
                                                                                                >
                                                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                                                                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                                                                                    </svg>
                                                                                                </button>
                                                                                                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                                                                                                    <img
                                                                                                        src={thumbUrl}
                                                                                                        alt="thumb"
                                                                                                        className="w-full h-full object-cover rounded-lg"
                                                                                                        loading="lazy"
                                                                                                        onError={(e) => {
                                                                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                                                                        }}
                                                                                                    />
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </motion.div>
                                                                            )}
                                                                        </AnimatePresence>
                                                                    </div>
                                                                );
                                                            })}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })
                                ) : (
                                    // Flat list for non-hierarchical files
                                    filteredSlides.map((f) => {
                                        const isSelected = selectedSlides.includes(f);
                                        const displayName = f.replace(/\.(mrxs|svs|ndpi)$/i, '');
                                        const thumbUrl = `${cleanUrl}/thumbnail/${f}`;

                                        return (
                                            <div
                                                key={f}
                                                onClick={() => toggleSlide(f)}
                                                className={`group flex items-center p-3 rounded-2xl border transition-all duration-200 cursor-pointer ${isSelected
                                                    ? 'bg-brand-primary/5 border-brand-primary shadow-[0_4px_12px_rgba(37,99,235,0.06)]'
                                                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-brand-primary/20 hover:shadow-md'
                                                    }`}
                                            >
                                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center mr-4 transition-all text-white border-2 ${isSelected
                                                    ? 'bg-brand-primary border-brand-primary'
                                                    : 'bg-slate-50 dark:bg-slate-850 border-slate-100 dark:border-slate-700 group-hover:border-brand-primary/30'
                                                    }`}>
                                                    {isSelected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                                </div>

                                                <div className="flex-1 min-w-0 pr-4">
                                                    <h4 className={`text-sm font-bold break-words ${isSelected ? 'text-brand-primary' : 'text-slate-800 dark:text-slate-100'}`}>
                                                        {displayName}
                                                    </h4>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">
                                                        {f.split('.').pop()} FORMAT
                                                    </p>
                                                </div>

                                                {/* Delete button */}
                                                <button
                                                    onClick={(e) => handleDelete(f, e)}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all mr-2"
                                                    title="Delete slide"
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                                    </svg>
                                                </button>

                                                <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700 shadow-sm">
                                                    <img
                                                        src={thumbUrl}
                                                        alt="thumb"
                                                        className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-110"
                                                        loading="lazy"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
