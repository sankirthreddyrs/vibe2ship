import React, { useState, useEffect, useRef } from "react";
import { 
  Brain, Zap, Target, ArrowRight, Play, Sparkles, Check, Lock, 
  Users, TrendingUp, AlertCircle, Clock, Calendar, Shield, Cpu, ChevronDown 
} from "lucide-react";

// --- Custom Mouse Cursor Component ---
function CustomCursor({ active }: { active: boolean }) {
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [trailPos, setTrailPos] = useState({ x: -100, y: -100 });
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!active) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "BUTTON" || 
        target.tagName === "A" || 
        target.closest("button") || 
        target.closest("a") ||
        target.classList.contains("cursor-pointer") ||
        target.closest(".cursor-pointer")
      ) {
        setIsHovered(true);
      } else {
        setIsHovered(false);
      }
    };
    window.addEventListener("mouseover", handleMouseOver);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseover", handleMouseOver);
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    
    let reqId: number;
    const updateTrail = () => {
      setTrailPos(prev => {
        const dx = mousePos.x - prev.x;
        const dy = mousePos.y - prev.y;
        return {
          x: prev.x + dx * 0.15,
          y: prev.y + dy * 0.15
        };
      });
      reqId = requestAnimationFrame(updateTrail);
    };
    reqId = requestAnimationFrame(updateTrail);
    return () => cancelAnimationFrame(reqId);
  }, [active, mousePos]);

  // Hide on touch devices
  const isTouchDevice = typeof window !== "undefined" && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  if (!active || isTouchDevice) return null;

  return (
    <div className={`pointer-events-none fixed inset-0 z-[99999] ${isHovered ? "custom-cursor-hovered" : ""}`}>
      <div 
        className="custom-cursor-dot" 
        style={{ left: mousePos.x, top: mousePos.y }} 
      />
      <div 
        className="custom-cursor-ring" 
        style={{ left: trailPos.x, top: trailPos.y }} 
      />
    </div>
  );
}

// --- Particle Canvas Component ---
function ParticleCanvas({ density = 80 }: { density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
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
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}

// --- Quote Section Word-by-Word Reveal ---
function QuoteSection() {
  const text = "Every day, millions of people open their to-do apps, feel overwhelmed, and close them without doing anything.";
  const words = text.split(" ");
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
        }
      },
      { threshold: 0.15 }
    );
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto text-center px-6">
      <p className="text-xl md:text-3xl lg:text-[34px] font-semibold italic leading-relaxed tracking-tight select-none">
        {words.map((word, idx) => (
          <span
            key={idx}
            className="inline-block mr-[0.22em] transition-colors duration-500"
            style={{
              color: inView ? "#a0a0dd" : "#2a2a44",
              transitionDelay: inView ? `${idx * 0.04}s` : "0s",
            }}
          >
            {word}
          </span>
        ))}
      </p>
    </div>
  );
}

// --- Stat Card for Live Counters ---
function StatCard({ value, label, duration = 1500 }: { value: string, label: string, duration?: number }) {
  const [displayValue, setDisplayValue] = useState("0");
  const elementRef = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let startTimestamp: number | null = null;
          const cleanValue = value.replace(/,/g, "");
          const numMatch = cleanValue.match(/[\d.]+/);
          if (!numMatch) {
            setDisplayValue(value);
            return;
          }
          const targetNum = parseFloat(numMatch[0]);
          const prefix = value.substring(0, value.indexOf(numMatch[0]));
          const suffix = value.substring(value.indexOf(numMatch[0]) + numMatch[0].length);
          const isDecimal = numMatch[0].includes(".");

          const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const currentNum = progress * targetNum;
            
            const formattedNum = isDecimal 
              ? currentNum.toFixed(1) 
              : Math.floor(currentNum).toLocaleString();

            setDisplayValue(`${prefix}${formattedNum}${suffix}`);
            if (progress < 1) {
              window.requestAnimationFrame(step);
            } else {
              setDisplayValue(value);
            }
          };
          window.requestAnimationFrame(step);
        }
      },
      { threshold: 0.15 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }
    return () => observer.disconnect();
  }, [value, duration, hasAnimated]);

  return (
    <div ref={elementRef} className="text-center py-6 px-4">
      <div className="text-3xl md:text-5xl font-extrabold text-white tracking-tight font-mono mb-2">
        {displayValue}
      </div>
      <div className="text-[12px] md:text-xs text-[#8888cc] font-extrabold uppercase tracking-wider font-sans">
        {label}
      </div>
    </div>
  );
}

// --- Feature Mockup 1: Live Risk Cards ---
function Feature1Mockup() {
  const [scores, setScores] = useState([0, 0, 0]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const targets = [93, 61, 22];
          let start: number | null = null;
          const duration = 1200;

          const step = (timestamp: number) => {
            if (!start) start = timestamp;
            const progress = Math.min((timestamp - start) / duration, 1);
            setScores(targets.map(t => Math.floor(progress * t)));
            if (progress < 1) {
              window.requestAnimationFrame(step);
            }
          };
          window.requestAnimationFrame(step);
        }
      },
      { threshold: 0.15 }
    );
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [hasAnimated]);

  return (
    <div ref={containerRef} className="bg-[#0f0f1e] border border-[#1a1a2e] rounded-2xl p-5 space-y-3 shadow-2xl relative max-w-sm mx-auto w-full font-sans text-left">
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="flex items-center justify-between border-b border-[#2a2a4a]/20 pb-2.5">
        <span className="text-[9px] font-mono uppercase tracking-[1.5px] text-[#606080] font-black">Live Priorities</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      {/* Row 1: Red 93% with glow */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-[#16162a]/50 border border-red-500/10 relative group">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping shrink-0" />
          <span className="text-xs font-bold text-white truncate max-w-[150px]">Write Thesis Draft</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-400">Due 2h</span>
          <span className="px-2 py-0.5 bg-red-500/15 border border-red-500/30 text-red-400 rounded text-[10px] font-black tracking-tight relative shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            CRITICAL {scores[0]}%
          </span>
        </div>
      </div>

      {/* Row 2: Orange 61% */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-[#16162a]/30 border border-amber-500/5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          <span className="text-xs font-bold text-slate-200 truncate max-w-[150px]">Vite Integration</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-500">Due 12h</span>
          <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded text-[10px] font-black tracking-tight">
            HIGH {scores[1]}%
          </span>
        </div>
      </div>

      {/* Row 3: Green 22% */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-[#16162a]/20 border border-emerald-500/5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-xs font-bold text-slate-300 truncate max-w-[150px]">Weekly Planner Sync</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-500">Due 3d</span>
          <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[10px] font-black tracking-tight">
            SAFE {scores[2]}%
          </span>
        </div>
      </div>
    </div>
  );
}

// --- Feature Mockup 2: Accountability Intervention ---
function Feature2Mockup() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
        }
      },
      { threshold: 0.15 }
    );
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-sm mx-auto h-[220px] flex items-center justify-center">
      {/* Background decoration */}
      <div className="absolute w-[85%] bg-[#0e0e1b]/40 border border-[#2a2a4a]/20 rounded-2xl p-4 top-2 opacity-30 blur-[0.5px] scale-95" />
      
      {/* Sliding card */}
      <div 
        className={`bg-[#1e1c12] border border-amber-500/30 rounded-2xl p-5 shadow-2xl relative w-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] font-sans text-left ${
          inView ? "translate-y-0 opacity-100 scale-100" : "translate-y-12 opacity-0 scale-95"
        }`}
      >
        <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
          Alert
        </div>
        <div className="flex gap-3.5">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl h-fit shrink-0">
            ⚠️
          </div>
          <div className="space-y-3">
            <div>
              <h5 className="text-xs font-black uppercase tracking-wider text-amber-400 font-mono leading-none">Accountability Check</h5>
              <p className="text-xs text-slate-300 font-medium leading-relaxed mt-1.5">
                Hey, you've opened the app <span className="text-amber-400 font-bold font-mono">8 times</span> without completing anything.
              </p>
            </div>
            <button className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-[10px] font-extrabold tracking-wide transition-all hover:scale-[1.03] active:scale-[0.98] cursor-pointer">
              Break it down! 🪄
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Feature Mockup 3: Gamified Progression ---
function Feature3Mockup() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [xpPercent, setXpPercent] = useState(60);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let start: number | null = null;
          const duration = 1500;

          const step = (timestamp: number) => {
            if (!start) start = timestamp;
            const progress = Math.min((timestamp - start) / duration, 1);
            setXpPercent(60 + Math.floor(progress * 15));
            if (progress < 1) {
              window.requestAnimationFrame(step);
            }
          };
          window.requestAnimationFrame(step);
        }
      },
      { threshold: 0.15 }
    );
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [hasAnimated]);

  return (
    <div ref={containerRef} className="bg-[#0f0f1e] border border-[#1a1a2e] rounded-2xl p-5 space-y-4 shadow-2xl relative max-w-sm mx-auto w-full font-sans text-left">
      <div className="absolute -top-10 -left-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex items-center justify-between border-b border-[#2a2a4a]/20 pb-2">
        <span className="text-[9px] font-mono uppercase tracking-[1.5px] text-[#606080] font-black">Progression Hub</span>
        <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Level Up +250 XP</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-end">
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Active Rank</span>
            <h5 className="text-xs font-bold text-white tracking-tight">Deadline Slayer ⚡</h5>
          </div>
          <span className="text-[10px] font-mono font-bold text-indigo-400">{xpPercent}%</span>
        </div>
        
        <div className="w-full h-2 bg-slate-800/60 rounded-full overflow-hidden border border-[#2a2a4a]/40 p-[1px]">
          <div 
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-75"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
      </div>

      <div className="space-y-1.5 pt-1">
        <span className="text-[9px] font-mono uppercase tracking-[1px] text-slate-500 font-bold block">Unlocked Medals</span>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-base shadow-lg shadow-amber-500/5 transition-transform" title="3 Day Streak">
              🏅
            </div>
            <span className="text-[7px] font-extrabold text-amber-500 font-mono">STREAK 3</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-base shadow-lg shadow-amber-500/5 transition-transform" title="10 Deadlines Met">
              ⚔️
            </div>
            <span className="text-[7px] font-extrabold text-amber-500 font-mono">10 TASKS</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="w-9 h-9 rounded-full bg-slate-800/30 border border-slate-800 flex items-center justify-center text-base opacity-40 grayscale" title="Godlike">
              🔒
            </div>
            <span className="text-[7px] font-bold text-slate-600 font-mono">GODLIKE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Landing Page Component ---
interface LandingPageProps {
  onGetStarted: () => void;
  isTransitioningOut?: boolean;
}

export default function LandingPage({ onGetStarted, isTransitioningOut = false }: LandingPageProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isStartedClicked, setIsStartedClicked] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Set up scroll reveals using IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    const elements = document.querySelectorAll(".scroll-reveal");
    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  const handleStartFlow = () => {
    if (isStartedClicked) return;
    setIsStartedClicked(true);
    // Button shows loading spinner for 600ms, then triggers parent start handler which handles crossfade!
    setTimeout(() => {
      onGetStarted();
    }, 600);
  };

  return (
    <div 
      className={`relative min-h-screen bg-[#080810] text-slate-300 font-sans selection:bg-purple-500/30 selection:text-white overflow-x-hidden ${
        isTransitioningOut ? "animate-landing-fade-out" : ""
      }`}
      style={{
        zIndex: 100,
        backgroundColor: "#080810",
      }}
    >
      {/* CSS Styles injection for exact animations/gradients */}
      <style>{`
        /* Global Custom landing styles */
        .custom-cursor-dot {
          position: fixed;
          width: 8px;
          height: 8px;
          background-color: #8b5cf6;
          border-radius: 50%;
          pointer-events: none;
          z-index: 99999;
          transform: translate(-50%, -50%);
          transition: width 0.2s, height 0.2s;
          will-change: left, top;
        }
        .custom-cursor-ring {
          position: fixed;
          width: 32px;
          height: 32px;
          border: 1px solid rgba(139, 92, 246, 0.4);
          border-radius: 50%;
          pointer-events: none;
          z-index: 99999;
          transform: translate(-50%, -50%);
          transition: width 0.2s, height 0.2s, background-color 0.2s, border-color 0.2s;
          will-change: left, top;
        }
        .custom-cursor-hovered .custom-cursor-ring {
          width: 48px;
          height: 48px;
          border-color: rgba(139, 92, 246, 0.8);
          background-color: rgba(139, 92, 246, 0.1);
        }

        /* Scroll reveals */
        .scroll-reveal {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity, transform;
        }
        .scroll-reveal.animate-in {
          opacity: 1;
          transform: translateY(0);
        }

        .scroll-reveal.animate-in .stagger-1 { transition-delay: 0.1s; }
        .scroll-reveal.animate-in .stagger-2 { transition-delay: 0.2s; }
        .scroll-reveal.animate-in .stagger-3 { transition-delay: 0.3s; }

        /* Animation loops */
        @keyframes orbPulse {
          0% { transform: translate(-50%, -50%) scale(1.0); opacity: 0.15; }
          50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.22; }
          100% { transform: translate(-50%, -50%) scale(1.0); opacity: 0.15; }
        }
        .pulse-orb {
          animation: orbPulse 4s ease-in-out infinite;
        }

        @keyframes textGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-text {
          background-size: 200% auto;
          animation: textGradient 3s linear infinite;
        }

        @keyframes mouseBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
        .animate-mouse-bounce {
          animation: mouseBounce 2s ease-in-out infinite;
        }

        @keyframes wheelScroll {
          0% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, 8px); }
        }
        .mouse-wheel-dot {
          position: absolute;
          top: 6px;
          left: 50%;
          width: 3px;
          height: 6px;
          border-radius: 2px;
          background-color: #8b5cf6;
          animation: wheelScroll 1.6s ease-out infinite;
        }

        @keyframes movingDot {
          0% { left: 0%; }
          100% { left: 100%; }
        }
        .animated-flow-line {
          position: relative;
          height: 2px;
          background: repeating-linear-gradient(to right, transparent, transparent 6px, #2a2a4a 6px, #2a2a4a 12px);
          width: 100%;
        }
        .animated-flow-line::after {
          content: '';
          position: absolute;
          top: -3px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #8b5cf6;
          box-shadow: 0 0 10px #8b5cf6, 0 0 20px #8b5cf6;
          animation: movingDot 3.5s linear infinite;
        }

        /* Hero Entry Animations */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hero-eyebrow {
          animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: 0.3s;
          opacity: 0;
        }
        .hero-word {
          display: inline-block;
          opacity: 0;
          transform: translateY(40px);
          animation: fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .hero-word-1 { animation-delay: 0.5s; }
        .hero-word-2 { animation-delay: 0.6s; }
        .hero-word-3 { animation-delay: 0.7s; }
        
        .hero-sub {
          animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: 0.9s;
          opacity: 0;
        }
        .hero-cta {
          animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: 1.1s;
          opacity: 0;
        }
        .hero-proof {
          animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: 1.3s;
          opacity: 0;
        }

        /* Outward transition */
        @keyframes landingFadeOut {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.05); }
        }
        .animate-landing-fade-out {
          animation: landingFadeOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          pointer-events: none;
        }
      `}</style>

      {/* Interactive custom cursor */}
      <CustomCursor active={true} />

      {/* =======================================
          TOP FIXED NAVBAR
          ======================================= */}
      <nav 
        className={`fixed top-0 left-0 right-0 h-[64px] z-50 flex items-center justify-between px-6 md:px-12 transition-all duration-300 ${
          isScrolled 
            ? "bg-[#0a0a18]/85 backdrop-blur-md border-b border-[#2a2a50]/20" 
            : "bg-transparent border-b border-transparent"
        }`}
      >
        {/* Logo Left */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 shadow-lg shadow-indigo-500/20">
            <Cpu className="w-4.5 h-4.5 text-white animate-pulse" />
          </div>
          <span className="text-base font-black text-white tracking-wider font-mono">
            DeadlineOS
          </span>
        </div>

        {/* Buttons Right */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleStartFlow}
            className="px-4 py-2 rounded-xl text-xs font-black text-white bg-[#6c3bff] hover:bg-[#5b2df4] hover:shadow-[0_0_20px_rgba(108,59,255,0.4)] transition-all border border-[#8b5cf6]/30 cursor-pointer flex items-center gap-1.5"
          >
            {isStartedClicked ? (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : null}
            <span>Get Started</span>
          </button>
        </div>
      </nav>

      {/* =======================================
          SECTION 1 — HERO
          ======================================= */}
      <header className="relative min-h-screen w-full flex flex-col justify-center items-center px-6 md:px-12 text-center overflow-hidden pt-16 select-none">
        {/* Animated Particles background */}
        <ParticleCanvas density={80} />

        {/* Blurred Radial Pulsing Orb */}
        <div 
          className="pulse-orb absolute top-1/2 left-1/2 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none -z-10"
          style={{
            background: "radial-gradient(circle, rgba(108, 59, 255, 0.15) 0%, rgba(108, 59, 255, 0) 70%)",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Eyebrow Pill */}
        <div className="hero-eyebrow inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#6c3bff]/10 to-[#3b82f6]/10 border border-[#6c3bff]/30 text-[#a78bfa] text-[10px] md:text-[11px] font-black uppercase tracking-[2px] mb-6">
          <Sparkles className="w-3 h-3 text-[#a78bfa] animate-pulse" />
          <span>Powered by Gemini AI</span>
        </div>

        {/* Headline */}
        <h1 className="font-display font-extrabold tracking-tight leading-none text-[52px] sm:text-[68px] md:text-[84px] lg:text-[96px] max-w-5xl mb-6">
          <span className="hero-word hero-word-1 text-white block md:inline mr-4">Stop Missing</span>
          <span className="hero-word hero-word-2 animate-gradient-text text-transparent bg-clip-text bg-gradient-to-r from-[#a78bfa] via-[#60a5fa] to-[#a78bfa] block md:inline">
            Deadlines.
          </span>
        </h1>

        {/* Subheading */}
        <p className="hero-sub text-base sm:text-lg md:text-xl text-[#8888aa] font-medium max-w-[560px] leading-relaxed mb-10">
          DeadlineOS is your AI-powered productivity agent that thinks, plans, and acts — so you never miss what matters.
        </p>

        {/* CTA Button Group */}
        <div className="hero-cta flex flex-col sm:flex-row items-center gap-4 mb-10 w-full justify-center max-w-md">
          {/* Get Started Free */}
          <button
            onClick={handleStartFlow}
            className="w-full sm:w-[220px] h-[56px] rounded-xl font-black text-white bg-gradient-to-r from-[#6c3bff] to-[#4f46e5] shadow-[0_0_40px_rgba(108,59,255,0.35)] hover:shadow-[0_0_60px_rgba(108,59,255,0.6)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 border border-indigo-400/20 cursor-pointer flex items-center justify-center gap-2"
          >
            {isStartedClicked ? (
              <span className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Get Started Free</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>

        {/* Social proof */}
        <p className="hero-proof text-[11px] md:text-xs text-[#555577] font-bold tracking-wide flex items-center gap-1.5">
          <span>⭐</span>
          <span>Trusted by 2,400+ students and professionals</span>
        </p>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[10px] uppercase tracking-[2px] text-slate-500 font-bold">
          <div className="relative w-5 h-8 rounded-full border-2 border-slate-700 animate-mouse-bounce">
            <div className="mouse-wheel-dot" />
          </div>
          <span>Scroll to explore</span>
        </div>
      </header>

      {/* =======================================
          SECTION 2 — PROBLEM STATEMENT
          ======================================= */}
      <section className="relative bg-[#0a0a18] py-28 px-6 md:px-12 border-t border-[#111124]">
        <div className="max-w-5xl mx-auto space-y-16">
          
          {/* Quote Section Word-by-word reveal */}
          <QuoteSection />

          {/* Pain Point Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
            
            {/* Card 1 */}
            <div className="scroll-reveal group bg-[#0f0f1e] border border-[#1a1a2e] rounded-2xl p-7 transition-all duration-300 hover:border-[#6c3bff]/30 hover:-translate-y-1">
              <div className="text-3xl mb-4 group-hover:scale-110 transition-transform w-fit">😰</div>
              <h4 className="text-sm font-extrabold text-white uppercase tracking-[1px] mb-2 font-mono">Passive Reminders</h4>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Standard alarms and popups that are easy to swipe away or ignore when you are feeling busy.
              </p>
            </div>

            {/* Card 2 */}
            <div className="scroll-reveal group bg-[#0f0f1e] border border-[#1a1a2e] rounded-2xl p-7 transition-all duration-300 hover:border-[#6c3bff]/30 hover:-translate-y-1 stagger-1">
              <div className="text-3xl mb-4 group-hover:scale-110 transition-transform w-fit">📋</div>
              <h4 className="text-sm font-extrabold text-white uppercase tracking-[1px] mb-2 font-mono">Overgrowing Lists</h4>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Task databases that multiply continuously with zero prioritization, driving stress and task aversion.
              </p>
            </div>

            {/* Card 3 */}
            <div className="scroll-reveal group bg-[#0f0f1e] border border-[#1a1a2e] rounded-2xl p-7 transition-all duration-300 hover:border-[#6c3bff]/30 hover:-translate-y-1 stagger-2">
              <div className="text-3xl mb-4 group-hover:scale-110 transition-transform w-fit">⏰</div>
              <h4 className="text-sm font-extrabold text-white uppercase tracking-[1px] mb-2 font-mono">Sneaky Deadlines</h4>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Milestones that approach silently, leaving you in absolute panic when you realize how much work is left.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* =======================================
          SECTION 3 — SOLUTION / FEATURES
          ======================================= */}
      <section className="bg-[#080810] py-28 px-6 md:px-12 relative overflow-hidden">
        {/* Subtle decorative grid background */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />

        <div className="max-w-5xl mx-auto space-y-24 relative z-10">
          
          {/* Section Header */}
          <div className="scroll-reveal text-center space-y-3">
            <span className="text-[#a78bfa] text-[11px] font-black uppercase tracking-[2.5px] font-mono block">WHAT DEADLINEOS DOES</span>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-white tracking-tight">
              An AI agent that works while you sleep
            </h2>
          </div>

          {/* Feature 1: Risk Engine */}
          <div className="scroll-reveal grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Column: Text */}
            <div className="space-y-6 text-left order-1">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Zap className="w-6 h-6 fill-current" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-extrabold text-white tracking-tight font-display">Risk Score Engine</h3>
                <p className="text-[14px] text-slate-400 leading-relaxed font-medium">
                  Every task gets a live 0–100 danger score. DeadlineOS watches your deadlines 24/7 and reorders your day automatically when things shift.
                </p>
              </div>
              <ul className="space-y-2.5 text-xs font-semibold text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Auto-reprioritizes every 30 minutes</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Color-coded danger levels</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Deadline expiry detection</span>
                </li>
              </ul>
            </div>

            {/* Right Column: Visual Mockup */}
            <div className="order-2 lg:pl-6">
              <Feature1Mockup />
            </div>

          </div>

          {/* Feature 2: Procrastination Detector */}
          <div className="scroll-reveal grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Column: Visual Mockup */}
            <div className="order-2 lg:order-1 lg:pr-6">
              <Feature2Mockup />
            </div>

            {/* Right Column: Text */}
            <div className="space-y-6 text-left order-1 lg:order-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Brain className="w-6 h-6" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-extrabold text-white tracking-tight font-display">Procrastination Detector</h3>
                <p className="text-[14px] text-slate-400 leading-relaxed font-medium">
                  Our AI notices when you're avoiding tasks and intervenes — breaking them into 10-minute steps before panic sets in.
                </p>
              </div>
              <ul className="space-y-2.5 text-xs font-semibold text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Behavioral pattern analysis</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Gentle AI accountability check</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Auto task breakdown</span>
                </li>
              </ul>
            </div>

          </div>

          {/* Feature 3: Gamified Productivity */}
          <div className="scroll-reveal grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Column: Text */}
            <div className="space-y-6 text-left order-1">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Target className="w-6 h-6" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-extrabold text-white tracking-tight font-display">Gamified Productivity</h3>
                <p className="text-[14px] text-slate-400 leading-relaxed font-medium">
                  Earn XP, unlock achievements, and climb from Procrastinator to Productivity God. Deadlines become a game you want to win.
                </p>
              </div>
              <ul className="space-y-2.5 text-xs font-semibold text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>XP & leveling system</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Streak tracking</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Achievement badges</span>
                </li>
              </ul>
            </div>

            {/* Right Column: Visual Mockup */}
            <div className="order-2 lg:pl-6">
              <Feature3Mockup />
            </div>

          </div>

        </div>
      </section>

      {/* =======================================
          SECTION 4 — HOW IT WORKS
          ======================================= */}
      <section className="bg-[#0c0c1a] py-28 px-6 md:px-12 border-t border-[#11112a]">
        <div className="max-w-5xl mx-auto space-y-16 text-center">
          
          <div className="scroll-reveal space-y-3">
            <span className="text-[#a78bfa] text-[11px] font-black uppercase tracking-[2.5px] font-mono block">60-SECOND ONBOARDING</span>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
              Up and running in 60 seconds
            </h2>
          </div>

          {/* Steps container */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch relative">
            
            {/* Horizontal flow line (desktop only) */}
            <div className="hidden md:block absolute top-[68px] left-[15%] right-[15%] h-[2px] z-0 pointer-events-none">
              <div className="animated-flow-line" />
            </div>

            {/* Step 1 */}
            <div className="scroll-reveal bg-[#0f0f1e]/40 border border-[#1a1a2e]/60 rounded-2xl p-6 relative flex flex-col justify-between h-full z-10 transition-transform duration-300 hover:scale-[1.02]">
              <span className="absolute top-4 left-4 font-mono font-black text-xs text-purple-500 uppercase">01</span>
              <div className="my-6">
                <div className="text-3xl mb-4">📝</div>
                <h4 className="text-[15px] font-extrabold text-white tracking-wide mb-2 font-mono">Add Deadlines</h4>
                <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
                  Type naturally: "ML assignment due Friday, 4 hours"
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="scroll-reveal bg-[#0f0f1e]/40 border border-[#1a1a2e]/60 rounded-2xl p-6 relative flex flex-col justify-between h-full z-10 transition-transform duration-300 hover:scale-[1.02] stagger-1">
              <span className="absolute top-4 left-4 font-mono font-black text-xs text-purple-500 uppercase">02</span>
              <div className="my-6">
                <div className="text-3xl mb-4">🤖</div>
                <h4 className="text-[15px] font-extrabold text-white tracking-wide mb-2 font-mono">AI Takes Over</h4>
                <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
                  DeadlineOS scores, schedules, and monitors everything
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="scroll-reveal bg-[#0f0f1e]/40 border border-[#1a1a2e]/60 rounded-2xl p-6 relative flex flex-col justify-between h-full z-10 transition-transform duration-300 hover:scale-[1.02] stagger-2">
              <span className="absolute top-4 left-4 font-mono font-black text-xs text-purple-500 uppercase">03</span>
              <div className="my-6">
                <div className="text-3xl mb-4">✅</div>
                <h4 className="text-[15px] font-extrabold text-white tracking-wide mb-2 font-mono">Never Miss Again</h4>
                <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
                  Get proactive briefings and real-time risk alerts
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =======================================
          SECTION 6 — FINAL CTA
          ======================================= */}
      <section className="relative py-32 px-6 md:px-12 text-center overflow-hidden">
        {/* Dense particles */}
        <ParticleCanvas density={120} />

        <div 
          className="pulse-orb absolute top-1/2 left-1/2 w-[550px] h-[550px] rounded-full blur-[110px] pointer-events-none -z-10"
          style={{
            background: "radial-gradient(circle, rgba(108, 59, 255, 0.11) 0%, rgba(108, 59, 255, 0) 70%)",
            transform: "translate(-50%, -50%)",
          }}
        />

        <div className="max-w-3xl mx-auto space-y-8 relative z-10">
          <h2 className="font-display font-extrabold text-4xl sm:text-5xl text-white tracking-tight">
            Your next deadline is waiting.
          </h2>
          <p className="text-[#8888aa] text-base md:text-lg font-medium max-w-md mx-auto">
            Start for free. No account needed.
          </p>

          <button
            onClick={handleStartFlow}
            className="w-full sm:w-[260px] h-[56px] rounded-xl font-black text-white bg-gradient-to-r from-[#6c3bff] to-[#4f46e5] shadow-[0_0_40px_rgba(108, 59, 255, 0.35)] hover:shadow-[0_0_60px_rgba(108, 59, 255, 0.6)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 border border-indigo-400/20 cursor-pointer flex items-center justify-center gap-2 mx-auto"
          >
            {isStartedClicked ? (
              <span className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Get Started Now</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-[11px] text-[#444466] font-bold tracking-wide flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#444466]" />
            <span>Your data stays on your device. Always private.</span>
          </p>
        </div>
      </section>

      {/* =======================================
          SECTION 7 — FOOTER
          ======================================= */}
      <footer className="bg-[#080810] border-t border-[#111122]/80 py-8 px-6 md:px-12 select-none z-10 relative">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xs text-slate-500 font-bold font-mono">
            DeadlineOS © 2026. Built with Gemini AI.
          </span>
          <div className="flex items-center gap-1.5 bg-[#121224]/50 border border-[#2a2a4c]/30 rounded-xl px-3 py-1.5 text-[11px] text-[#8888aa] font-extrabold tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Powered by Gemini</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
