import React, { useState, useRef, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useClickOutside } from "@/hooks/useClickOutside";

interface Option {
    value: string | number;
    label: string;
    description?: string;
    icon?: React.ReactNode;
}

interface CustomSelectProps {
    options: Option[];
    value: string | number;
    onChange: (value: string | number) => void;
    className?: string;
    label?: string;
}

export default function CustomSelect({
    options,
    value,
    onChange,
    className = "",
    label
}: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    useClickOutside(containerRef, useCallback(() => setIsOpen(false), []));

    const selectedOption = options.find(opt => opt.value === value) || options[0];

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">
                    <span className="md:hidden">{label.split(" ")[0]}</span>
                    <span className="hidden md:inline">{label}</span>
                </span>
            )}

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between md:gap-2 lg:gap-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] md:text-lg lg:text-xl py-1.5 px-3 rounded-lg border-none outline-none cursor-pointer focus:ring-2 focus:ring-brand-primary/20 transition-all min-w-[100px] sm:min-w-[140px] w-full sm:w-auto"
            >
                <div className="flex items-center gap-2 min-w-0">
                    {selectedOption.icon && <span className="opacity-70 shrink-0">{selectedOption.icon}</span>}
                    <span className="truncate">{selectedOption.label}</span>
                </div>
                <ChevronDown size={12} strokeWidth={3} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 w-max min-w-full left-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-2 animate-in fade-in zoom-in-95 duration-100">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => { onChange(option.value); setIsOpen(false); }}
                            className={`w-full flex flex-col items-start px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left ${value === option.value ? 'bg-brand-primary/5' : ''}`}
                        >
                            <div className="flex items-center gap-2 w-full">
                                {option.icon && (
                                    <span className={`transition-colors ${value === option.value ? 'text-brand-primary' : 'text-slate-400'}`}>
                                        {option.icon}
                                    </span>
                                )}
                                <span className={`text-[11px] font-bold ${value === option.value ? 'text-brand-primary' : 'text-slate-700 dark:text-slate-200'}`}>
                                    {option.label}
                                </span>
                                {value === option.value && <Check size={12} strokeWidth={4} className="ml-auto text-brand-primary" />}
                            </div>
                            {option.description && (
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-tight">{option.description}</p>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
