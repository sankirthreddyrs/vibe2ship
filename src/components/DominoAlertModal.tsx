import React from "react";
import { X, AlertTriangle, Calendar, ArrowRight, Check, RefreshCw } from "lucide-react";
import { motion } from "motion/react";

export interface DominoComparisonItem {
  taskId: string;
  title: string;
  originalDeadline: string;
  suggestedDeadline: string;
  isChanged: boolean;
  conflictReason?: string;
}

interface DominoAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  warningMessage: string;
  affectedCount: number;
  comparisonList: DominoComparisonItem[];
  onApplyReshuffle: (updatedItems: DominoComparisonItem[]) => void;
  theme?: string;
}

export default function DominoAlertModal({
  isOpen,
  onClose,
  warningMessage,
  affectedCount,
  comparisonList,
  onApplyReshuffle,
  theme = "dark"
}: DominoAlertModalProps) {
  if (!isOpen) return null;

  const isDark = theme === "dark";

  // Format date helper
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return isoString;
    }
  };

  const handleApply = () => {
    onApplyReshuffle(comparisonList);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" id="domino-modal-overlay">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className={`w-full max-w-2xl overflow-hidden border rounded-2xl shadow-2xl transition-colors ${
          isDark ? "border-red-500/20 bg-[#0a0a0c]" : "border-slate-200 bg-white"
        }`}
        id="domino-modal-container"
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? "border-white/5 bg-[#050505]/40" : "border-slate-200 bg-slate-50/50"
        }`}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg animate-pulse">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            </div>
            <h3 className={`text-lg font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Domino Effect Analysis
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg text-slate-500 transition-colors cursor-pointer ${
              isDark ? "hover:text-white hover:bg-[#050505]" : "hover:text-slate-900 hover:bg-slate-100"
            }`}
            id="close-domino-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Main warning card */}
          <div className={`p-4 rounded-xl border relative overflow-hidden ${
            isDark ? "bg-rose-500/5 border-rose-500/10 text-rose-200" : "bg-rose-50 border-rose-200 text-rose-950"
          }`}>
            <p className="text-sm font-semibold leading-relaxed">{warningMessage}</p>
          </div>

          {/* Visual Comparison Section */}
          <div className="space-y-3">
            <h4 className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Visual Schedule Comparison
            </h4>

            <div className={`border rounded-xl divide-y overflow-hidden max-h-[280px] overflow-y-auto ${
              isDark ? "border-white/5 divide-white/5 bg-[#050505]/50" : "border-slate-100 divide-slate-100 bg-slate-50/30"
            }`}>
              {comparisonList.map((item) => (
                <div
                  key={item.taskId}
                  className={`p-3.5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    item.isChanged
                      ? (isDark ? "bg-emerald-500/[0.02]" : "bg-emerald-500/[0.01]")
                      : ""
                  }`}
                >
                  <div className="space-y-1 max-w-[240px]">
                    <span className={`text-xs font-bold block truncate ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      {item.title}
                    </span>
                    {item.conflictReason && (
                      <span className="text-[10px] text-rose-400 block italic leading-tight">
                        {item.conflictReason}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 sm:gap-4 font-mono text-[11px]">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-500 uppercase font-semibold">Before</span>
                      <span className={`line-through ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                        {formatDate(item.originalDeadline)}
                      </span>
                    </div>

                    <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${isDark ? "text-slate-600" : "text-slate-300"}`} />

                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-500 uppercase font-semibold">Suggested</span>
                      <span className={`font-bold ${
                        item.isChanged
                          ? (isDark ? "text-emerald-400" : "text-emerald-600")
                          : (isDark ? "text-slate-300" : "text-slate-700")
                      }`}>
                        {formatDate(item.suggestedDeadline)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prompt / Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
            <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Applying this will update <span className="font-extrabold text-emerald-400">{affectedCount}</span> affected task(s) to clear schedule space.
            </span>

            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={onClose}
                className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isDark ? "text-slate-500 hover:text-white hover:bg-[#050505]" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                }`}
                id="cancel-domino-btn"
              >
                Keep Current
              </button>
              <button
                onClick={handleApply}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                id="apply-domino-reshuffle"
              >
                <Check className="w-4 h-4" />
                Apply Suggested Reshuffle
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
