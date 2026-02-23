import { Sun } from "lucide-react";

export const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-12 text-slate-300 dark:text-slate-700 italic">
        <Sun size={32} strokeWidth={1} className="mb-2" />
        <p className="text-xs font-medium uppercase tracking-widest">No target terms defined</p>
    </div>
);
