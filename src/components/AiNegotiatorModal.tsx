import React, { useState, useEffect } from "react";
import { X, Brain, Check, HelpCircle, Activity, Sparkles, AlertOctagon, RotateCw, CheckSquare, Square, RefreshCw, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Task } from "../types";
import { formatDeadline } from "../utils";
import { apiFetch as fetch } from "../utils/api";

export interface RescueSuggestion {
  id: string;
  taskId: string;
  taskTitle: string;
  type: "keep" | "move" | "split" | "drop";
  explanation: string;
  suggestedDeadline: string | null;
  accepted?: boolean; // client-side state
}

interface AiNegotiatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onApplyRescuePlan: (suggestions: RescueSuggestion[]) => void;
  theme?: string;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export default function AiNegotiatorModal({
  isOpen,
  onClose,
  tasks,
  onApplyRescuePlan,
  theme = "dark",
  showToast
}: AiNegotiatorModalProps) {
  if (!isOpen) return null;

  const isDark = theme === "dark";
  const [loading, setLoading] = useState(false);
  const [introText, setIntroText] = useState("");
  const [suggestions, setSuggestions] = useState<RescueSuggestion[]>([]);

  // Fetch the Rescue Plan suggestions from Gemini Negotiator API
  const fetchRescuePlan = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/negotiate-rescue-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allTasks: tasks })
      });
      if (res.ok) {
        const data = await res.json();
        setIntroText(data.introText || "I've analyzed your active workload. Here are the recommendations:");
        // Default all suggestions to 'accepted = true' initially
        const list = (data.suggestions || []).map((sug: any) => ({
          ...sug,
          accepted: true
        }));
        setSuggestions(list);
      } else {
        throw new Error("Failed to fetch negotiator analysis");
      }
    } catch (err) {
      console.error(err);
      showToast("Could not contact the Executive Negotiator. Using fallback planner.", "error");
      // Local fallback
      setIntroText("The Negotiator system is on standby. Here is a curated de-escalation plan to relieve calendar pressure:");
      const activeTasks = tasks.filter(t => !t.completed);
      const list: RescueSuggestion[] = activeTasks.map((t, index) => {
        if (index === 0) {
          return {
            id: `sug-${t.id}`,
            taskId: t.id,
            taskTitle: t.title,
            type: "keep",
            explanation: "Keep this as your primary focal point. Avoid context shifting.",
            suggestedDeadline: null,
            accepted: true
          };
        } else {
          // Postpone by 2 days
          const d = new Date(t.deadline);
          d.setDate(d.getDate() + 2);
          return {
            id: `sug-${t.id}`,
            taskId: t.id,
            taskTitle: t.title,
            type: "move",
            explanation: "Push back by 48 hours to secure high quality execution space.",
            suggestedDeadline: d.toISOString(),
            accepted: true
          };
        }
      });
      setSuggestions(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRescuePlan();
    }
  }, [isOpen]);

  const toggleSuggestion = (id: string) => {
    setSuggestions(prev =>
      prev.map(sug => (sug.id === id ? { ...sug, accepted: !sug.accepted } : sug))
    );
  };

  const handleApplyChanges = () => {
    const acceptedList = suggestions.filter(sug => sug.accepted);
    if (acceptedList.length === 0) {
      showToast("No changes accepted. Workload remained unmodified.", "info");
      onClose();
      return;
    }
    onApplyRescuePlan(acceptedList);
    onClose();
  };

  const getTypeBadgeStyles = (type: RescueSuggestion["type"]) => {
    switch (type) {
      case "keep":
        return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
      case "move":
        return "bg-amber-500/10 border-amber-500/20 text-amber-400";
      case "split":
        return "bg-sky-500/10 border-sky-500/20 text-sky-400";
      case "drop":
        return "bg-rose-500/10 border-rose-500/20 text-rose-400";
      default:
        return "bg-slate-500/10 border-slate-500/20 text-slate-400";
    }
  };

  const getTypeIcon = (type: RescueSuggestion["type"]) => {
    switch (type) {
      case "keep":
        return "✅ KEEP";
      case "move":
        return "🔄 MOVE";
      case "split":
        return "✂️ SPLIT";
      case "drop":
        return "❌ DROP";
      default:
        return "❓ SUGGEST";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
          isDark ? "border-white/5 bg-[#0a0a0c]" : "border-slate-200 bg-white"
        }`}
        id="ai-negotiator-modal-panel"
      >
        {/* Header */}
        <header className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-red-500/5 to-rose-500/5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 animate-pulse">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <span className={`text-[10px] font-extrabold uppercase tracking-[0.2em] ${isDark ? "text-rose-500" : "text-rose-600"}`}>
                Critical Workload De-escalation
              </span>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                Executive AI Negotiator <Sparkles className="w-4 h-4 text-rose-500 fill-rose-500" />
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isDark 
                ? "border-white/5 bg-[#111114] hover:bg-[#1c1c22] text-slate-400 hover:text-white"
                : "border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900"
            }`}
            title="Close Negotiator"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Content area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <RefreshCw className="w-10 h-10 text-rose-500 animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-rose-500">Evaluating calendar bottlenecks...</p>
                <p className={`text-xs max-w-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Gemini is weighing deadline risk multipliers, historical completion velocities, and priority matrices to draft your stress-free rescue plan.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Strategic Intro / Reassurance Card */}
              <div className={`p-4 rounded-2xl border flex gap-3 items-start ${
                isDark ? "bg-rose-500/[0.02] border-rose-500/10" : "bg-rose-50/50 border-rose-100"
              }`}>
                <Brain className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className={`text-[9px] font-black uppercase tracking-wider ${isDark ? "text-rose-400" : "text-rose-700"}`}>
                    Strategic Diagnosis
                  </span>
                  <p className={`text-xs leading-relaxed font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    {introText}
                  </p>
                </div>
              </div>

              {/* Suggestions Registry */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Negotiation Recommendations ({suggestions.length})
                  </h3>
                  <button
                    onClick={fetchRescuePlan}
                    className={`text-[10px] font-bold font-mono uppercase underline flex items-center gap-1 cursor-pointer hover:text-rose-500`}
                  >
                    <RotateCw className="w-3 h-3" /> Re-Analyze
                  </button>
                </div>

                {suggestions.length === 0 ? (
                  <div className={`p-8 rounded-2xl border text-center space-y-2 ${
                    isDark ? "border-white/5 bg-[#111114]/50" : "border-slate-200 bg-slate-50"
                  }`}>
                    <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
                    <p className="text-xs font-bold text-slate-400">Excellent! No overwhelming tasks detected.</p>
                    <p className="text-[10px] text-slate-500">Your current agenda is perfectly optimized and sustainable.</p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {suggestions.map((sug) => (
                      <div
                        key={sug.id}
                        onClick={() => toggleSuggestion(sug.id)}
                        className={`p-4 rounded-2xl border flex items-start justify-between gap-4 cursor-pointer transition-all ${
                          sug.accepted
                            ? (isDark ? "bg-rose-500/[0.02] border-rose-500/20" : "bg-rose-500/[0.01] border-rose-500/20")
                            : (isDark ? "bg-slate-900/10 border-white/5 opacity-50 hover:opacity-75" : "bg-slate-50/50 border-slate-100 opacity-60 hover:opacity-80")
                        }`}
                      >
                        <div className="space-y-2.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${getTypeBadgeStyles(sug.type)}`}>
                              {getTypeIcon(sug.type)}
                            </span>
                            <h4 className="text-xs font-black tracking-tight">
                              {sug.taskTitle}
                            </h4>
                          </div>

                          <p className={`text-xs leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                            {sug.explanation}
                          </p>

                          {sug.suggestedDeadline && (sug.type === "move" || sug.type === "split") && (
                            <div className={`p-2.5 rounded-xl border w-fit flex items-center gap-2 text-[10px] font-mono font-bold ${
                              isDark ? "bg-amber-950/10 border-amber-500/10 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-800"
                            }`}>
                              <span className="uppercase">Proposed Deadline:</span>
                              <span>{formatDeadline(sug.suggestedDeadline)}</span>
                            </div>
                          )}
                        </div>

                        {/* Accept Checkbox Box */}
                        <div className={`w-6 h-6 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                          sug.accepted
                            ? "bg-rose-600 border-rose-600 text-white"
                            : (isDark ? "border-white/10 hover:border-rose-500/50 text-transparent" : "border-slate-300 hover:border-rose-400 text-transparent")
                        }`}>
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <footer className={`p-5 border-t flex items-center justify-between gap-4 ${
          isDark ? "border-white/5 bg-[#111114]/30" : "border-slate-200 bg-slate-50/50"
        }`}>
          <p className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"} max-w-sm`}>
            De-selecting a card leaves it intact. Accepted changes will instantly update, split, or retire targeted tasks on your workspace.
          </p>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onClose}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                isDark
                  ? "border-white/5 bg-[#111114] hover:bg-[#1c1c22] text-slate-300"
                  : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleApplyChanges}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
              id="apply-rescue-plan-btn"
            >
              <Check className="w-4 h-4" />
              Apply Strategic Changes
            </button>
          </div>
        </footer>
      </motion.div>
    </div>
  );
}
