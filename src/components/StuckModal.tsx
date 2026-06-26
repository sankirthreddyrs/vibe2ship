import React, { useState } from "react";
import { HelpCircle, Sparkles, X, Check, Loader2, ArrowRight, ListChecks, CheckCircle2, ChevronRight, HelpCircle as StuckIcon } from "lucide-react";
import { Task } from "../types";
import { apiFetch as fetch } from "../utils/api";

interface SuggestedSubtask {
  title: string;
  estimatedHours: number;
}

interface StuckResponse {
  steps: string[];
  resourcesAndApproaches: string[];
  suggestedSubtasks: SuggestedSubtask[];
}

interface StuckModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSplit: (originalTaskId: string, subtasks: SuggestedSubtask[], replaceOriginal: boolean) => void;
  currentTime: Date;
  theme?: string;
}

export default function StuckModal({ task, isOpen, onClose, onSplit, currentTime, theme = "dark" }: StuckModalProps) {
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<StuckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [splitOption, setSplitOption] = useState<"replace" | "add">("replace");

  const isDark = theme === "dark";

  if (!isOpen || !task) return null;

  const handleGetHelp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/stuck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          description: description.trim(),
          currentTime: currentTime.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to retrieve guidance");
      }

      const data: StuckResponse = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to generate custom guidance. Please check your network connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSplitClick = () => {
    if (!result || result.suggestedSubtasks.length === 0) return;
    onSplit(task.id, result.suggestedSubtasks, splitOption === "replace");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" id="stuck-modal-overlay">
      <div 
        className={`w-full max-w-2xl overflow-hidden border rounded-2xl shadow-2xl flex flex-col max-h-[85vh] transition-colors ${
          isDark ? "border-white/5 bg-[#0a0a0c]" : "border-slate-200 bg-white"
        }`}
        id="stuck-modal-container"
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? "border-white/5 bg-[#050505]/40" : "border-slate-200 bg-slate-50/50"
        }`}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg">
              <HelpCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Get Unstuck Assistant</h3>
              <p className="text-[10px] text-slate-500">Breaking barriers for: <span className="text-rose-500 font-semibold">{task.title}</span></p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-1 rounded-lg text-slate-500 transition-colors cursor-pointer ${
              isDark ? "hover:text-white hover:bg-[#050505]" : "hover:text-slate-900 hover:bg-slate-100"
            }`}
            id="close-stuck-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!result && !isLoading && (
            <form onSubmit={handleGetHelp} className="space-y-4">
              <div className={`p-4 rounded-xl space-y-2 border ${
                isDark ? "bg-rose-500/5 border-rose-500/10" : "bg-rose-50/40 border-rose-100"
              }`}>
                <h4 className="text-xs font-bold text-rose-500 flex items-center gap-1.5 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" /> Procrastinating or Uncertain?
                </h4>
                <p className={`text-xs leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Tell the AI Copilot exactly what is making you hesitate or what step you're stuck on (e.g. "I don't know where to start writing", "I'm having trouble with the coding syntax", or just "Feeling overwhelmed"). We will design a custom roadmap to bypass friction.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Describe what you're stuck on:
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. I am having trouble starting the coding setup because the database documentation is confusing."
                  className={`w-full h-28 px-4 py-3 rounded-xl border text-xs transition-all resize-none ${
                    isDark 
                      ? "bg-[#050505] border-white/5 text-white placeholder-slate-600 focus:ring-rose-500/20 focus:border-rose-400" 
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-rose-500/20 focus:border-rose-400"
                  }`}
                  id="stuck-description-input"
                />
              </div>

              <div className={`flex justify-end gap-3 pt-2 border-t ${isDark ? "border-white/5" : "border-slate-100"}`}>
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isDark ? "text-slate-500 hover:text-white hover:bg-[#050505]" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                  id="stuck-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/10 transition-all flex items-center gap-2 cursor-pointer"
                  id="stuck-submit-btn"
                >
                  Analyze & Breakdown
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4" id="stuck-loading">
              <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
              <div className="text-center">
                <h4 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Deconstructing Task...</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Gemini is analyzing your block to design an optimal, lower-friction path.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3" id="stuck-error">
              <p className="text-xs text-rose-400 font-medium">{error}</p>
              <button
                onClick={handleGetHelp}
                className="px-4 py-2 bg-rose-500 text-white rounded-lg text-xs font-semibold hover:bg-rose-600 transition-colors cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}

          {result && (
            <div className="space-y-6 animate-fade-in" id="stuck-results">
              {/* 1. Chronological Steps */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-rose-500 rounded-sm"></span>
                  Bite-Sized Action Roadmap
                </h4>
                <div className="space-y-2.5">
                  {result.steps.map((step, idx) => (
                    <div key={`step-${idx}`} className={`flex gap-3 p-3 border rounded-xl items-start ${
                      isDark ? "bg-[#111114] border-white/5" : "bg-slate-50 border-slate-200/80"
                    }`}>
                      <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/10 text-rose-500 font-mono text-xs font-bold mt-0.5">
                        {idx + 1}
                      </span>
                      <p className={`text-xs leading-relaxed ${isDark ? "text-slate-300" : "text-slate-700"}`}>{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Strategies & Resources */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-amber-500 rounded-sm"></span>
                  Suggested Strategies & Mental Models
                </h4>
                <div className="space-y-2.5">
                  {result.resourcesAndApproaches.map((strategy, idx) => (
                    <div key={`strategy-${idx}`} className={`flex gap-2.5 p-3 border rounded-xl items-start ${
                      isDark ? "bg-[#111114] border-white/5" : "bg-slate-50 border-slate-200/80"
                    }`}>
                      <ChevronRight className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className={`text-xs leading-relaxed ${isDark ? "text-slate-300" : "text-slate-700"}`}>{strategy}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Automatic Task Split Option */}
              <div className={`space-y-3 pt-2 border-t ${isDark ? "border-white/5" : "border-slate-100"}`}>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-3 bg-indigo-500 rounded-sm"></span>
                    Micro-Subtasks Decomposition
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Total: {result.suggestedSubtasks.reduce((sum, s) => sum + s.estimatedHours, 0)}h effort
                  </span>
                </div>

                <div className="space-y-2">
                  {result.suggestedSubtasks.map((subtask, idx) => (
                    <div key={`subtask-${idx}`} className={`flex items-center justify-between p-3 border rounded-xl ${
                      isDark ? "bg-[#111114]/50 border-white/5" : "bg-slate-50/50 border-slate-200"
                    }`}>
                      <span className={`text-xs font-semibold ${isDark ? "text-slate-200" : "text-slate-700"}`}>{subtask.title}</span>
                      <span className="text-[10px] font-mono font-medium text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/15">
                        {subtask.estimatedHours}h
                      </span>
                    </div>
                  ))}
                </div>

                {/* Subtask splitting option controls */}
                <div className={`p-4 rounded-xl space-y-4 border ${
                  isDark ? "bg-indigo-500/5 border-indigo-500/15" : "bg-indigo-50/20 border-indigo-100 shadow-sm"
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h5 className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Split Task Automatically</h5>
                      <p className="text-[10px] text-slate-400 mt-0.5">Let AI convert this heavy task into the subtasks listed above.</p>
                    </div>

                    {/* Radio Group for replacement vs addition */}
                    <div className={`flex gap-2 p-0.5 rounded-lg border self-start sm:self-auto ${
                      isDark ? "bg-[#050505] border-white/5" : "bg-slate-100 border-slate-200"
                    }`}>
                      <button
                        onClick={() => setSplitOption("replace")}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                          splitOption === "replace"
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        Replace Original
                      </button>
                      <button
                        onClick={() => setSplitOption("add")}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                          splitOption === "add"
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        Keep & Add Alongside
                      </button>
                    </div>
                  </div>

                  <div className={`flex justify-between items-center pt-2 border-t ${isDark ? "border-white/5" : "border-slate-200/80"}`}>
                    <button
                      onClick={() => {
                        setResult(null);
                        setDescription("");
                      }}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-700 transition-colors uppercase tracking-wider cursor-pointer"
                    >
                      ← Back to Prompt
                    </button>
                    <button
                      onClick={handleSplitClick}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                      id="stuck-execute-split-btn"
                    >
                      <ListChecks className="w-3.5 h-3.5" />
                      Execute Task Split
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
