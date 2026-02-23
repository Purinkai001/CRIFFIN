import { Box, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

export const Header = ({ isCollapsed, onToggle, selection }: { isCollapsed: boolean, onToggle: () => void, selection: string | null }) => (
    <div onClick={onToggle} role="button" className="flex items-center gap-4 cursor-pointer select-none group">
        <div className="bg-brand-primary text-white p-2.5 rounded-xl shadow-md group-hover:bg-brand-primary/90 transition-colors">
            <Box size={24} />
        </div>
        <div className="flex-1">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">Heatmap Search</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest truncate max-w-[200px]">
                {selection || "No target selected"}
            </p>
        </div>
        <motion.div animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.2 }} className="text-slate-400">
            <ChevronDown size={20} />
        </motion.div>
    </div>
);
