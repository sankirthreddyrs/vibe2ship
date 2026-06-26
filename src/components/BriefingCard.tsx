import React from "react";
import { Sparkles, RefreshCw, Star } from "lucide-react";

interface BriefingCardProps {
  briefing: string;
  isLoading: boolean;
  onRefresh: () => void;
  theme?: string;
}

export default function BriefingCard({ briefing, isLoading, onRefresh, theme = "dark" }: BriefingCardProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (isLoading) return;
    onRefresh();
  };

  const isDark = theme === "dark";

  return (
    <div 
      onClick={handleClick}
      className={`relative overflow-hidden border rounded-2xl p-6 shadow-xl transition-all ${
        isDark 
          ? "border-indigo-500/20 bg-indigo-500/10 hover:border-indigo-500/40 hover:bg-indigo-500/15" 
          : "border-indigo-200/60 bg-indigo-50 hover:border-indigo-300 hover:bg-indigo-100/50"
      } ${isLoading ? "cursor-wait" : "cursor-pointer"}`}
      id="daily-briefing-card"
    >
      {/* Decorative background ambient glows */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-full ${isDark ? "bg-indigo-500/20" : "bg-indigo-100"}`}>
              <Sparkles className="w-4 h-4 text-indigo-500" />
            </div>
            <span className={`text-xs font-semibold uppercase tracking-widest ${isDark ? "text-indigo-300" : "text-indigo-700"}`}>
              AI Daily Briefing
            </span>
          </div>
          <div className="text-sm leading-relaxed pr-4">
            {isLoading ? (
              <div className="space-y-2 py-1 animate-pulse">
                <div className={`h-4 rounded w-5/6 ${isDark ? "bg-[#111114]" : "bg-slate-200"}`}></div>
                <div className={`h-4 rounded w-4/5 ${isDark ? "bg-[#111114]" : "bg-slate-200"}`}></div>
              </div>
            ) : (
              <p id="briefing-text" className={`italic ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                "{briefing}"
              </p>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 self-end md:self-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isLoading) onRefresh();
            }}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wider transition-all border cursor-pointer ${
              isDark
                ? "text-indigo-200 border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/40 hover:text-white"
                : "text-indigo-700 border-indigo-200 bg-white hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-900 shadow-sm"
            } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            id="refresh-briefing-btn"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>AI Refresh</span>
            <RefreshCw className={`w-3.5 h-3.5 ml-0.5 text-slate-400 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
