import React, { useState, useEffect, useRef } from "react";
import { X, Play, Pause, RotateCcw, Brain, Check, RefreshCw, Sparkles, Smile, Hourglass, SkipForward } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Task } from "../types";
import confetti from "canvas-confetti";
import { apiFetch as fetch } from "../utils/api";

interface MicroStep {
  id: string;
  timeRange: string;
  instruction: string;
  completed: boolean;
}

interface FocusSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onCompleteTask: (taskId: string, xpEarned: number) => void;
  onAwardXpOnly: (xpEarned: number) => void;
  theme?: string;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export default function FocusSprintModal({
  isOpen,
  onClose,
  task,
  onCompleteTask,
  onAwardXpOnly,
  theme = "dark",
  showToast
}: FocusSprintModalProps) {
  if (!isOpen || !task) return null;

  const isDark = theme === "dark";

  // Phase: "work" (25 min) or "break" (5 min)
  const [phase, setPhase] = useState<"work" | "break">("work");
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [isActive, setIsActive] = useState(false);

  // Gemini steps state
  const [introText, setIntroText] = useState("");
  const [steps, setSteps] = useState<MicroStep[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(false);

  // Completion prompt state
  const [showCompletionPrompt, setShowCompletionPrompt] = useState(false);
  const [adjustingPlan, setAdjustingPlan] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial game plan
  useEffect(() => {
    const fetchGamePlan = async () => {
      setLoadingPlan(true);
      try {
        const res = await fetch("/api/generate-sprint-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskTitle: task.title,
            taskCategory: task.category,
            notes: task.notes
          })
        });
        if (res.ok) {
          const data = await res.json();
          setIntroText(data.introText || "Here's your 25-minute game plan:");
          setSteps(data.steps || []);
        } else {
          throw new Error("Failed to fetch");
        }
      } catch (err) {
        console.error("Failed to generate sprint plan:", err);
        showToast("Using local offline fallback plan.", "info");
        // Offline plan fallback
        setIntroText("Here's your 25-minute offline game plan:");
        setSteps([
          { id: "step-1", timeRange: "0-5min", instruction: `Review requirements and prepare workspace files for "${task.title}".`, completed: false },
          { id: "step-2", timeRange: "5-20min", instruction: `Engage in highly-focused deep work with zero tab-switching.`, completed: false },
          { id: "step-3", timeRange: "20-25min", instruction: `Wrap up progress, write down comments, and check off details.`, completed: false }
        ]);
      } finally {
        setLoadingPlan(false);
      }
    };

    setPhase("work");
    setTimeLeft(25 * 60);
    setIsActive(false);
    setShowCompletionPrompt(false);
    fetchGamePlan();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [task, isOpen]);

  // Timer Tick Engine
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      // Auto-toggle phases or prompt
      setIsActive(false);
      if (timerRef.current) clearInterval(timerRef.current);

      if (phase === "work") {
        showToast("Focus Sprint completed! Time for a short break, or declare success! ⚡", "success");
        setPhase("break");
        setTimeLeft(5 * 60); // 5 min break
        setShowCompletionPrompt(true);
      } else {
        showToast("Break over! Ready for another focused sprint?", "info");
        setPhase("work");
        setTimeLeft(25 * 60);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft, phase]);

  const toggleTimer = () => {
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(phase === "work" ? 25 * 60 : 5 * 60);
  };

  const skipPhase = () => {
    setIsActive(false);
    if (phase === "work") {
      setPhase("break");
      setTimeLeft(5 * 60);
      setShowCompletionPrompt(true);
    } else {
      setPhase("work");
      setTimeLeft(25 * 60);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const toggleStep = (stepId: string) => {
    setSteps(prev =>
      prev.map(step => (step.id === stepId ? { ...step, completed: !step.completed } : step))
    );
  };

  // Completion Evaluators
  const handleDeclareCompletion = (completedSuccessfully: boolean) => {
    if (completedSuccessfully) {
      // Complete Task fully, awards high XP + confetti
      const xpEarned = 100;
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
      onCompleteTask(task.id, xpEarned);
      showToast(`🏆 Focus Sprint Won! +${xpEarned} XP awarded.`, "success");
      onClose();
    } else {
      // Trigger Gemini plan adjustment for the next sprint
      handleAdjustPlan();
    }
  };

  const handleAdjustPlan = async () => {
    setAdjustingPlan(true);
    try {
      const res = await fetch("/api/adjust-sprint-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle: task.title,
          previousSteps: steps
        })
      });
      if (res.ok) {
        const data = await res.json();
        setIntroText(data.introText || "Let's regroup! Adjusted focus game plan:");
        setSteps(data.steps || []);
        // Award minor partial XP for attempt
        onAwardXpOnly(25);
        showToast("Gemini recalibrated the game plan for your next sprint! (+25 partial XP)", "info");
      } else {
        throw new Error("Adjust failed");
      }
    } catch (err) {
      console.error("Failed to adjust plan:", err);
      showToast("Regrouping fallback active. We've simplified your remaining steps.", "info");
      onAwardXpOnly(15);
      setIntroText("No problem! Let's slice the work into even smaller bite-sized pieces:");
      setSteps(prev =>
        prev.map((step, idx) => ({
          ...step,
          timeRange: `${idx * 5}-${(idx + 1) * 5}min`,
          instruction: `Bite-sized Step: Focus solely on 30% of: ${step.instruction}`,
          completed: false
        }))
      );
    } finally {
      setAdjustingPlan(false);
      setShowCompletionPrompt(false);
      setPhase("work");
      setTimeLeft(25 * 60);
      setIsActive(false);
    }
  };

  // Calculate percentage of steps checked
  const totalSteps = steps.length;
  const completedStepsCount = steps.filter(s => s.completed).length;
  const progressPercent = totalSteps === 0 ? 0 : Math.round((completedStepsCount / totalSteps) * 100);

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden flex flex-col justify-between p-6 md:p-12 animate-fade-in"
      id="focus-sprint-overlay"
      style={{
        backgroundColor: isDark ? "#050507" : "#fafafa",
        color: isDark ? "#fff" : "#1e293b"
      }}
    >
      {/* Decorative full-screen elements */}
      {isActive && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] rounded-full bg-indigo-500/[0.015] blur-3xl animate-pulse" />
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-500">
            <Hourglass className={`w-5 h-5 ${isActive ? "animate-spin" : ""}`} style={{ animationDuration: "8s" }} />
          </div>
          <div>
            <span className={`text-[10px] font-extrabold uppercase tracking-[0.2em] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              Distraction-Free Focus Sprint
            </span>
            <h1 className="text-sm font-bold tracking-tight text-indigo-500 uppercase">
              DeadlineOS Deep Mode
            </h1>
          </div>
        </div>

        <button
          onClick={onClose}
          className={`p-2 rounded-xl transition-all border cursor-pointer ${
            isDark 
              ? "border-white/5 bg-[#111114] hover:bg-[#1c1c22] text-slate-400 hover:text-white" 
              : "border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 shadow-sm"
          }`}
          title="Exit Sprint"
          id="exit-sprint-btn"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Main split content */}
      <main className="my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-6xl mx-auto w-full z-10 py-8">
        
        {/* Left: Pomodoro Timer Visual */}
        <section className="lg:col-span-5 flex flex-col items-center justify-center text-center space-y-6">
          <div className="space-y-1.5">
            <span className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
              phase === "work"
                ? (isDark ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" : "bg-indigo-50 border-indigo-200 text-indigo-700")
                : (isDark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700")
            }`}>
              {phase === "work" ? "🎯 Focus Phase" : "☕ Rest Phase"}
            </span>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"} pt-1`}>
              {phase === "work" ? "Deep execution, absolutely no distraction." : "Great job. Take a deep breath & stretch."}
            </p>
          </div>

          {/* Elegant Circular Progress / Giant Digital Clock */}
          <div className="relative flex items-center justify-center w-64 h-64 sm:w-72 sm:h-72">
            <svg className="absolute w-full h-full transform -rotate-90">
              <circle
                cx="144"
                cy="144"
                r="128"
                stroke={isDark ? "#121217" : "#e2e8f0"}
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="144"
                cy="144"
                r="128"
                stroke={phase === "work" ? "#4f46e5" : "#10b981"}
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 128}
                strokeDashoffset={2 * Math.PI * 128 * (1 - timeLeft / (phase === "work" ? 25 * 60 : 5 * 60))}
                strokeLinecap="round"
                className="transition-all duration-300 ease-linear"
              />
            </svg>

            <div className="flex flex-col items-center justify-center z-10 space-y-2">
              <span className="text-5xl sm:text-6xl font-black font-mono tracking-tighter" id="sprint-timer-clock">
                {formatTime(timeLeft)}
              </span>
              <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Time Remaining
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTimer}
              className={`p-4 rounded-full shadow-lg transition-all hover:scale-105 cursor-pointer text-white ${
                isActive
                  ? "bg-amber-600 hover:bg-amber-500 shadow-amber-950/10"
                  : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-950/20"
              }`}
              id="play-pause-sprint-btn"
            >
              {isActive ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-white" />}
            </button>

            <button
              onClick={resetTimer}
              className={`p-3.5 rounded-full transition-all border cursor-pointer ${
                isDark 
                  ? "border-white/5 bg-[#111114] hover:bg-[#1c1c22] text-slate-400 hover:text-white"
                  : "border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 shadow-sm"
              }`}
              title="Reset timer"
              id="reset-sprint-timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={skipPhase}
              className={`p-3.5 rounded-full transition-all border cursor-pointer ${
                isDark 
                  ? "border-white/5 bg-[#111114] hover:bg-[#1c1c22] text-slate-400 hover:text-white"
                  : "border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 shadow-sm"
              }`}
              title="Skip to next phase"
              id="skip-sprint-phase"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Right: Task Details & Gemini Micro checklist */}
        <section className="lg:col-span-7 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                task.category === "Study" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                task.category === "Work" ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" :
                task.category === "Personal" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                "bg-amber-500/10 border-amber-500/20 text-amber-400"
              }`}>
                {task.category}
              </span>
              <span className={`text-[10px] font-mono ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Estimated: {task.estimatedHours} Hours
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight leading-tight">
              {task.title}
            </h2>
            {task.notes && (
              <p className={`text-xs italic leading-relaxed line-clamp-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                "{task.notes}"
              </p>
            )}
          </div>

          {/* Gemini game plan container */}
          <div className={`border rounded-2xl p-5 shadow-xl space-y-4 ${
            isDark ? "border-white/5 bg-[#0a0a0c]" : "border-slate-200/80 bg-white"
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-white/5">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-400 animate-bounce" />
                <span className="text-xs font-bold uppercase tracking-wider">AI Micro-Steps Plan</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono font-bold ${
                  progressPercent === 100 ? "text-emerald-400" : "text-indigo-400"
                }`}>
                  {progressPercent}% Done
                </span>
                <div className="w-20 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {loadingPlan ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-xs text-slate-400 animate-pulse">
                  Gemini is dissecting "{task.title}" into highly tactical, 25-minute Pomodoro actions...
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                <p className={`text-xs italic leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  {introText}
                </p>

                <div className="space-y-2.5">
                  {steps.map((step) => (
                    <div
                      key={step.id}
                      onClick={() => toggleStep(step.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                        step.completed
                          ? (isDark ? "bg-emerald-500/[0.04] border-emerald-500/20 text-slate-400" : "bg-emerald-500/[0.02] border-emerald-500/30 text-slate-500")
                          : (isDark ? "bg-[#111114]/50 border-white/5 hover:border-white/10" : "bg-slate-50/50 border-slate-100 hover:border-slate-200 shadow-sm")
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`text-[10px] font-black font-mono tracking-tight shrink-0 px-1.5 py-0.5 rounded ${
                          step.completed
                            ? "bg-emerald-500/10 text-emerald-400"
                            : (isDark ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-50 text-indigo-600")
                        }`}>
                          {step.timeRange}
                        </span>
                        <p className={`text-xs font-medium leading-relaxed ${step.completed ? "line-through text-slate-500" : ""}`}>
                          {step.instruction}
                        </p>
                      </div>

                      <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                        step.completed
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : (isDark ? "border-white/10 hover:border-indigo-500/50" : "border-slate-300 hover:border-indigo-400")
                      }`}>
                        {step.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* End Sprint Evaluation Panel */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"} max-w-sm`}>
              Done working or want to wrap up early? Assess your progress now to adjust the schedule or claim rewards.
            </p>

            <button
              onClick={() => setShowCompletionPrompt(true)}
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              id="declare-sprint-completion"
            >
              <Check className="w-4 h-4" />
              Complete Focus Sprint
            </button>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="z-10 text-center py-2 text-[10px] text-slate-500 dark:text-slate-600 font-mono">
        Pomodoro Sprint Engine • Minimize tabs and focus fully. Your future self is watching! 😉
      </footer>

      {/* Completion Dialog Prompt */}
      <AnimatePresence>
        {showCompletionPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-md p-6 border rounded-2xl shadow-2xl transition-colors text-center space-y-6 ${
                isDark ? "border-white/5 bg-[#0a0a0c]" : "border-slate-200 bg-white"
              }`}
              id="completion-prompt-card"
            >
              <div className="space-y-2">
                <div className="mx-auto p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl w-fit">
                  <Smile className="w-8 h-8 text-indigo-500" />
                </div>
                <h3 className="text-lg font-black tracking-tight">Did you complete the main task?</h3>
                <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"} leading-relaxed`}>
                  Be honest! Fully completing your task awards massive XP and marks the goal as complete. Otherwise, we'll recalibrate the remaining steps with Gemini to try again!
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleDeclareCompletion(false)}
                  disabled={adjustingPlan}
                  className={`flex-1 px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                    isDark
                      ? "border-white/5 bg-[#111114] hover:bg-[#1c1c22] text-slate-300"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                  }`}
                  id="sprint-incomplete-btn"
                >
                  {adjustingPlan ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  No, Adjust Plan
                </button>

                <button
                  onClick={() => handleDeclareCompletion(true)}
                  className="flex-1 px-4 py-3 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  id="sprint-complete-btn"
                >
                  <Sparkles className="w-4 h-4" />
                  Yes! Task Complete
                </button>
              </div>

              <button
                onClick={() => setShowCompletionPrompt(false)}
                className={`text-[10px] font-mono block mx-auto underline cursor-pointer ${isDark ? "text-slate-600 hover:text-slate-400" : "text-slate-400 hover:text-slate-600"}`}
              >
                Go Back to Sprint Timer
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
