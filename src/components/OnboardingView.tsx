import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Sparkles, Brain, Zap, Calendar, Clock, ArrowRight, HeartHandshake, ShieldCheck, Flame } from "lucide-react";
import { Task, TaskCategory } from "../types";

interface OnboardingViewProps {
  onCompleteOnboarding: (firstTask: Omit<Task, "id" | "createdAt" | "completed">, aiTone: "gentle" | "balanced" | "ruthless") => void;
  currentUserEmail?: string | null;
  currentUserName?: string | null;
  onLaunch?: () => void;
}

// --- PARTICLES BACKGROUND FOR COSMIC THEME ---
const ParticlesBackground = () => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (canvas) {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      }
    };
    window.addEventListener("resize", handleResize);

    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speed: number;
      opacity: number;
      color: string;
    }> = [];

    const colors = [
      "rgba(108, 59, 255, ",
      "rgba(59, 130, 246, ",
      "rgba(167, 139, 250, ",
    ];

    const density = 60; // perfect density for auth screen

    for (let i = 0; i < density; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 0.4 + 0.1,
        opacity: Math.random() * 0.4 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let animationFrameId: number;
    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      const shouldAnimate = !mediaQuery.matches;

      for (let i = 0; i < density; i++) {
        const p = particles[i];

        ctx.fillStyle = `${p.color}${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (shouldAnimate) {
          p.y -= p.speed;
          if (p.y < -10) {
            p.y = height + 10;
            p.x = Math.random() * width;
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
};

export default function OnboardingView({ onCompleteOnboarding, currentUserEmail, currentUserName, onLaunch }: OnboardingViewProps) {
  const [step, setStep] = useState<number>(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Step 1: Task Details
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCategory, setTaskCategory] = useState<TaskCategory>("Study");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("12:00");
  const [estimatedHours, setEstimatedHours] = useState<number>(3);
  const [taskNotes, setTaskNotes] = useState("");

  // Step 2: AI Tone / Push Mode
  const [aiTone, setAiTone] = useState<"gentle" | "balanced" | "ruthless">("balanced");

  // Local validation error
  const [errorMsg, setErrorMsg] = useState("");

  // Handler for Step 1 -> Step 2
  const handleNextFromStep1 = () => {
    if (!taskTitle.trim()) {
      setErrorMsg("Please specify what your task is!");
      return;
    }
    if (!deadlineDate) {
      setErrorMsg("Please select a target date!");
      return;
    }
    setErrorMsg("");
    setStep(2);
  };

  // Handler to wrap up and finish onboarding
  const handleFinish = () => {
    // Construct ISO string for the deadline
    const deadlineISO = `${deadlineDate}T${deadlineTime || "12:00"}:00`;
    
    onCompleteOnboarding({
      title: taskTitle.trim(),
      category: taskCategory,
      deadline: deadlineISO,
      estimatedHours: Number(estimatedHours) || 1,
      notes: taskNotes.trim()
    }, aiTone);
  };

  // Set default deadline date helper (tomorrow)
  React.useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    setDeadlineDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  const getDisplayName = (email: string | null | undefined) => {
    if (currentUserName) return currentUserName;
    if (!email) return "Operator";
    const namePart = email.split("@")[0];
    const parts = namePart.split(/[._-]/);
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  };
  const displayName = getDisplayName(currentUserEmail);

  const handleLaunch = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      if (onLaunch) {
        onLaunch();
      } else {
        setStep(1);
      }
      setIsTransitioning(false);
    }, 500);
  };

  return (
    <div className={step === 0 ? "" : "max-w-2xl mx-auto my-6 px-4 py-8"} id="onboarding-wizard-container">
      <style>{`
        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
      <AnimatePresence mode="wait">
        
        {/* STEP 0: WELCOME SCREEN */}
        {step === 0 && (
          <div className="fixed inset-0 w-screen h-screen z-50 bg-[#080810] overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center p-4">
            {/* Large purple radial glow orb behind the main content */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#6c3bff]/10 rounded-full blur-[120px] pointer-events-none" />
            <ParticlesBackground />
            
            <motion.div
              animate={isTransitioning ? { opacity: 0, scale: 1.04 } : { opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="relative z-10 w-full max-w-5xl flex flex-col items-center justify-between min-h-screen py-12 md:py-16 px-4"
            >
              {/* TOP SECTION (centered) */}
              <div className="flex flex-col items-center text-center gap-6 mt-4">
                {/* Small animated checkmark circle */}
                <div className="relative flex items-center justify-center mb-1">
                  {/* Ripple ring expanding and fading */}
                  <div className="absolute w-12 h-12 bg-green-500/30 rounded-full animate-[ripple_1.2s_cubic-bezier(0.1,0.8,0.3,1)_forwards]" style={{ animationDelay: "0.4s" }} />
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xl relative z-10"
                  >
                    ✓
                  </motion.div>
                </div>

                {/* Eyebrow text */}
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="font-mono text-xs font-bold text-[#a78bfa] tracking-[3px] uppercase"
                >
                  YOU'RE IN ✦
                </motion.p>

                {/* Main welcome headline */}
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight flex flex-col items-center">
                  <motion.span
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.5, ease: "easeOut" }}
                    className="text-white block"
                  >
                    Welcome,
                  </motion.span>
                  <motion.span
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.5, ease: "easeOut" }}
                    className="bg-gradient-to-r from-[#6c3bff] via-[#a78bfa] to-[#3b82f6] bg-clip-text text-transparent block mt-1 pb-1"
                  >
                    {displayName}
                  </motion.span>
                </h1>

                {/* Subtext below */}
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                  className="text-[#8888aa] text-sm sm:text-base max-w-[440px] leading-relaxed font-medium mt-1"
                >
                  DeadlineOS is ready. Your AI productivity agent is armed and watching.
                </motion.p>
              </div>

              {/* MIDDLE SECTION — Feature cards (3 cards, horizontal) */}
              <div className="flex flex-col md:flex-row items-stretch justify-center gap-6 my-12 relative z-10 w-full max-w-4xl px-4">
                {/* Card 1 — Risk Engine */}
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8, duration: 0.6, ease: "easeOut" }}
                  whileHover={{ y: -4, borderColor: "rgba(108, 59, 255, 0.35)" }}
                  className="flex-1 min-w-[200px] max-w-[280px] bg-[#0f0f1e] border border-[#2a2a4a] rounded-2xl p-6 flex flex-col items-center text-center gap-4 transition-all duration-300 shadow-lg mx-auto"
                >
                  <div className="w-12 h-12 rounded-full bg-[#6c3bff]/20 flex items-center justify-center text-2xl">
                    ⚡
                  </div>
                  <div className="space-y-2 flex-1 flex flex-col justify-center">
                    <h3 className="font-sans font-bold text-base text-white">Risk Scoring</h3>
                    <p className="font-sans text-xs text-[#8888aa] leading-relaxed">
                      Every task gets a live danger score. DeadlineOS reorders your day automatically.
                    </p>
                  </div>
                </motion.div>

                {/* Card 2 — AI Coach */}
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.95, duration: 0.6, ease: "easeOut" }}
                  whileHover={{ y: -4, borderColor: "rgba(59, 130, 246, 0.35)" }}
                  className="flex-1 min-w-[200px] max-w-[280px] bg-[#0f0f1e] border border-[#2a2a4a] rounded-2xl p-6 flex flex-col items-center text-center gap-4 transition-all duration-300 shadow-lg mx-auto"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-2xl">
                    🧠
                  </div>
                  <div className="space-y-2 flex-1 flex flex-col justify-center">
                    <h3 className="font-sans font-bold text-base text-white">AI Coach</h3>
                    <p className="font-sans text-xs text-[#8888aa] leading-relaxed">
                      Get personalized action plans and accountability nudges powered by Gemini.
                    </p>
                  </div>
                </motion.div>

                {/* Card 3 — Gamification */}
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1.1, duration: 0.6, ease: "easeOut" }}
                  whileHover={{ y: -4, borderColor: "rgba(234, 179, 8, 0.35)" }}
                  className="flex-1 min-w-[200px] max-w-[280px] bg-[#0f0f1e] border border-[#2a2a4a] rounded-2xl p-6 flex flex-col items-center text-center gap-4 transition-all duration-300 shadow-lg mx-auto"
                >
                  <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-2xl">
                    🏆
                  </div>
                  <div className="space-y-2 flex-1 flex flex-col justify-center">
                    <h3 className="font-sans font-bold text-base text-white">Gamification</h3>
                    <p className="font-sans text-xs text-[#8888aa] leading-relaxed">
                      Earn XP, build streaks, and unlock achievements as you conquer deadlines.
                    </p>
                  </div>
                </motion.div>
              </div>

              {/* BOTTOM SECTION */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3, duration: 0.6 }}
                className="flex flex-col items-center gap-3 relative z-10 mb-4"
              >
                <motion.button
                  onClick={handleLaunch}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className="h-14 min-w-[240px] bg-gradient-to-r from-[#6c3bff] to-[#8b5cf6] text-white font-sans font-bold text-base rounded-[14px] shadow-[0_0_40px_rgba(108,59,255,0.33)] hover:shadow-[0_0_50px_rgba(108,59,255,0.6)] transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 px-8"
                >
                  <span>Launch DeadlineOS</span>
                  <span className="text-xl">&rarr;</span>
                </motion.button>
                <p className="text-xs font-mono text-[#555577]">
                  Your data is saved locally and privately.
                </p>
              </motion.div>
            </motion.div>
          </div>
        )}

        {/* STEP 1: WHAT'S YOUR BIGGEST UPCOMING DEADLINE? */}
        {step === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6 bg-[#16162a]/90 border border-[#2a2a4a]/40 p-6 md:p-8 rounded-3xl shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#2a2a4a]/30 pb-4">
              <div>
                <span className="text-xs font-bold text-indigo-400 font-mono uppercase tracking-wider">Step 1 of 3</span>
                <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight mt-1">What's your biggest upcoming deadline?</h2>
              </div>
              <span className="text-xs bg-indigo-500/10 text-indigo-400 font-bold px-3 py-1 rounded-full border border-indigo-500/20">Task Builder</span>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-medium">
                ⚠️ {errorMsg}
              </div>
            )}

            <div className="space-y-4">
              {/* Task Title */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[1px] text-slate-400 font-bold">Deadline / Task Title</label>
                <input
                  type="text"
                  placeholder="e.g. Finish Machine Learning Assignment 3"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-[#121224]/50 border border-[#2a2a4a]/50 text-white placeholder-slate-500 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
                />
              </div>

              {/* Task Category */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[1px] text-slate-400 font-bold">Category</label>
                <div className="flex flex-wrap gap-2">
                  {(["Study", "Work", "Personal", "Finance"] as TaskCategory[]).map((cat) => {
                    const isSel = taskCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setTaskCategory(cat)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          isSel
                            ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                            : "bg-[#121224]/40 border-[#2a2a4a]/40 text-slate-400 hover:text-white"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Date & Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-[1px] text-slate-400 font-bold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    className="w-full px-4 py-3 bg-[#121224]/50 border border-[#2a2a4a]/50 text-white rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-[1px] text-slate-400 font-bold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    Target Time
                  </label>
                  <input
                    type="time"
                    value={deadlineTime}
                    onChange={(e) => setDeadlineTime(e.target.value)}
                    className="w-full px-4 py-3 bg-[#121224]/50 border border-[#2a2a4a]/50 text-white rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                  />
                </div>
              </div>

              {/* Estimated Effort slider/hours */}
              <div className="space-y-1.5 bg-[#121224]/30 border border-[#2a2a4a]/20 p-4 rounded-xl">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] uppercase tracking-[1px] text-slate-400 font-bold">Estimated Effort (Hours)</label>
                  <span className="text-xs font-bold text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/10">{estimatedHours} Hours</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="24"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#0f0f1e] rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-2"
                />
                <p className="text-[10px] text-slate-500 font-medium">Be realistic. Underestimating effort spikes your calculated risk level.</p>
              </div>

              {/* Quick Notes (Optional) */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[1px] text-slate-400 font-bold">Task Notes (Optional)</label>
                <textarea
                  placeholder="e.g. Implement neural network backpropagation from scratch in Numpy..."
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-[#121224]/50 border border-[#2a2a4a]/50 text-white placeholder-slate-500 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all resize-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#2a2a4a]/20 flex justify-end">
              <button
                type="button"
                onClick={handleNextFromStep1}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>Configure Coach</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: HOW DO YOU WANT TO BE PUSHED? (AI PRESSURE TONE) */}
        {step === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6 bg-[#16162a]/90 border border-[#2a2a4a]/40 p-6 md:p-8 rounded-3xl shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#2a2a4a]/30 pb-4">
              <div>
                <span className="text-xs font-bold text-indigo-400 font-mono uppercase tracking-wider">Step 2 of 3</span>
                <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight mt-1">How do you want to be pushed?</h2>
              </div>
              <span className="text-xs bg-purple-500/10 text-purple-400 font-bold px-3 py-1 rounded-full border border-purple-500/20">AI Calibration</span>
            </div>

            <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
              Our integrated AI Copilot will formulate daily priority briefings and procrastination interventions tailored to your chosen pressure mode:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Gentle Mode */}
              <button
                type="button"
                onClick={() => setAiTone("gentle")}
                className={`text-left p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-56 ${
                  aiTone === "gentle"
                    ? "bg-emerald-600/10 border-emerald-500 text-emerald-300"
                    : "bg-[#121224]/40 border-[#2a2a4a]/40 text-slate-400 hover:border-slate-500 hover:bg-[#1a1a36]/10"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <HeartHandshake className="w-6 h-6 text-emerald-400" />
                    {aiTone === "gentle" && <Check className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <h3 className="text-[15px] font-bold text-white leading-tight">Gentle Coach</h3>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Soft, encouraging, and highly empathetic daily briefings. No sarcastic remarks or harsh roasts; just warm supportive nudges.
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono">Soft & Inspiring</span>
              </button>

              {/* Balanced Mode */}
              <button
                type="button"
                onClick={() => setAiTone("balanced")}
                className={`text-left p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-56 ${
                  aiTone === "balanced"
                    ? "bg-indigo-600/10 border-indigo-500 text-indigo-300"
                    : "bg-[#121224]/40 border-[#2a2a4a]/40 text-slate-400 hover:border-slate-500 hover:bg-[#1a1a36]/10"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <ShieldCheck className="w-6 h-6 text-indigo-400" />
                    {aiTone === "balanced" && <Check className="w-4 h-4 text-indigo-400" />}
                  </div>
                  <h3 className="text-[15px] font-bold text-white leading-tight">Balanced Partner</h3>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Default level. Provides objective analysis, realistic task risk warnings, and lighthearted humorous accountability interventions.
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 font-mono">Default Baseline</span>
              </button>

              {/* Ruthless Mode */}
              <button
                type="button"
                onClick={() => setAiTone("ruthless")}
                className={`text-left p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-56 ${
                  aiTone === "ruthless"
                    ? "bg-rose-600/10 border-rose-500 text-rose-300"
                    : "bg-[#121224]/40 border-[#2a2a4a]/40 text-slate-400 hover:border-slate-500 hover:bg-[#1a1a36]/10"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Flame className="w-6 h-6 text-rose-400 animate-pulse" />
                    {aiTone === "ruthless" && <Check className="w-4 h-4 text-rose-400" />}
                  </div>
                  <h3 className="text-[15px] font-bold text-white leading-tight">Ruthless Warden</h3>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Sarcastic, direct, and brutally honest procrastination roasts. Strictly designed for chronic planners who need extreme pressure to act.
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 font-mono">No Excuses Tolerated</span>
              </button>
            </div>

            <div className="pt-4 border-t border-[#2a2a4a]/20 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Back to Task
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>Final Summary</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: YOU'RE ALL SET! */}
        {step === 3 && (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6 bg-[#16162a]/90 border border-[#2a2a4a]/40 p-6 md:p-8 rounded-3xl shadow-2xl text-center"
          >
            <div className="mx-auto w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500/20 mb-2">
              <Check className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-emerald-400 font-mono uppercase tracking-wider">Step 3 of 3</span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">You're all set!</h2>
              <p className="text-slate-400 text-xs md:text-sm max-w-md mx-auto">
                Your first milestone is locked into DeadlineOS. The system will now begin tracking its micro-risk score.
              </p>
            </div>

            {/* Structured representation of what is added */}
            <div className="max-w-md mx-auto text-left bg-[#121224]/50 border border-[#2a2a4a]/30 rounded-2xl p-4 space-y-3.5">
              <div className="flex items-start gap-3">
                <span className="mt-1 w-5 h-5 rounded-full border border-[#2a2a4a] flex items-center justify-center text-transparent text-xs font-bold shrink-0">o</span>
                <div>
                  <h4 className="text-sm font-bold text-white">{taskTitle}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 leading-none">
                      {taskCategory}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      📅 {deadlineDate} &middot; ⏱️ {deadlineTime}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#2a2a4a]/20 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Estimated Effort:</span>
                <span className="text-indigo-400 font-bold font-mono">{estimatedHours} Hours</span>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">AI Vigilance Calibration:</span>
                <span className={`font-bold font-mono uppercase ${
                  aiTone === "gentle" ? "text-emerald-400" : aiTone === "ruthless" ? "text-rose-400" : "text-indigo-400"
                }`}>
                  {aiTone} Mode
                </span>
              </div>
            </div>

            <div className="pt-6 border-t border-[#2a2a4a]/20 flex justify-between items-center max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Adjust Coach
              </button>
              <button
                type="button"
                onClick={handleFinish}
                className="px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-emerald-500/10 transition-all cursor-pointer inline-flex items-center gap-1.5"
                id="onboarding-complete-btn"
              >
                <span>Launch DeadlineOS</span>
                <Sparkles className="w-4 h-4 text-white" />
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
