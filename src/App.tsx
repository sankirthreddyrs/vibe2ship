import { useState, useEffect, useRef } from "react";
import { 
  Plus, Search, SlidersHorizontal, CheckCircle2, Circle, Trash2, Edit, 
  Calendar, Clock, ShieldCheck, Sparkles, GraduationCap, Briefcase, 
  User, Wallet, BrainCircuit, AlertCircle, X, Check, HelpCircle, Sun, Moon, Settings, Lock,
  Play, Flame, Activity, Timer, Brain, AlertTriangle, MessageSquare, LifeBuoy,
  Home, Trophy, BarChart2, Target, Menu, LogOut
} from "lucide-react";
import { Task, TaskCategory, DailyChallenge, Achievement, GamificationState } from "./types";
import { calculateRiskScore, getRiskBadgeDetails, formatDeadline, getInitialTasks } from "./utils";
import TaskModal from "./components/TaskModal";
import BriefingCard from "./components/BriefingCard";
import StuckModal from "./components/StuckModal";
import SettingsModal from "./components/SettingsModal";
import PlanningView from "./components/PlanningView";
import DominoAlertModal, { DominoComparisonItem } from "./components/DominoAlertModal";
import FocusSprintModal from "./components/FocusSprintModal";
import AiNegotiatorModal, { RescueSuggestion } from "./components/AiNegotiatorModal";
import DashboardView from "./components/DashboardView";
import MyTasksView from "./components/MyTasksView";
import TodayFocusView from "./components/TodayFocusView";
import AchievementsView from "./components/AchievementsView";
import MyStatsView from "./components/MyStatsView";
import SettingsView from "./components/SettingsView";
import OnboardingView from "./components/OnboardingView";
import LandingPage from "./components/LandingPage";
import { AuthComponent } from "./components/AuthComponent";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch as fetch } from "./utils/api";

interface Toast {
  id: string;
  message: string;
  type: "success" | "info" | "error";
}

export default function App() {
  // Theme State (Dark / Light Mode)
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("deadline_os_theme") as "dark" | "light") || "dark";
  });

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("deadline_os_theme", nextTheme);
  };

  // Check for session in localStorage
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(() => {
    const session = localStorage.getItem("deadlineos_session");
    if (session) {
      try {
        const parsed = JSON.parse(session);
        return parsed.email || null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [currentUserName, setCurrentUserName] = useState<string | null>(() => {
    const session = localStorage.getItem("deadlineos_session");
    if (session) {
      try {
        const parsed = JSON.parse(session);
        return parsed.name || (parsed.email ? parsed.email.split('@')[0] : null);
      } catch {
        return null;
      }
    }
    return null;
  });

  // View states definitions and load logic
  type ViewState = "landing" | "auth" | "onboarding" | "dashboard";
  const [currentView, setCurrentView] = useState<ViewState>(() => {
    const session = localStorage.getItem("deadlineos_session");
    if (session) {
      try {
        const parsed = JSON.parse(session);
        // Only go to dashboard if user has logged in before
        // Check if this is a brand new signup using isNewUser flag
        if (parsed.isNewUser) {
          // Remove the flag so next login goes to dashboard
          parsed.isNewUser = false;
          localStorage.setItem("deadlineos_session", JSON.stringify(parsed));
          return "onboarding";
        } else {
          return "dashboard";
        }
      } catch {
        return "landing";
      }
    } else {
      return "landing";
    }
  });

  // Landing Page State
  const [landingActive, setLandingActive] = useState<boolean>(currentView === "landing");
  const [hasStarted, setHasStarted] = useState<boolean>(currentView === "dashboard" || currentView === "onboarding");
  const [authActive, setAuthActive] = useState<boolean>(currentView === "auth");

  const changeView = (view: ViewState) => {
    setCurrentView(view);
    setLandingActive(view === "landing");
    setAuthActive(view === "auth");
    setHasStarted(view === "dashboard" || view === "onboarding");
  };

  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [isTransitioningAuth, setIsTransitioningAuth] = useState<boolean>(false);

  // Tasks State
  const [tasks, setTasks] = useState<Task[]>([]);
  // Live Current Time state to recalculate Risk Scores reactively
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  // Dashboard Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Completed">("Active");
  const [categoryFilter, setCategoryFilter] = useState<"All" | TaskCategory>("All");

  // Briefing State
  const [briefing, setBriefing] = useState<string>("");
  const [briefingLoading, setBriefingLoading] = useState(false);

  // Modals & Popups State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
  const [isStuckModalOpen, setIsStuckModalOpen] = useState(false);
  const [stuckTask, setStuckTask] = useState<Task | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isMissedExpanded, setIsMissedExpanded] = useState(true);
  const [draftExtensionTask, setDraftExtensionTask] = useState<Task | null>(null);

  // Notifications state
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);
  const [farewellToast, setFarewellToast] = useState<string | null>(null);

  // Auto-Pilot Toggle State (Loaded from localStorage, defaults to true so it is active initially)
  const [isAutopilotOn, setIsAutopilotOn] = useState<boolean>(() => {
    const saved = localStorage.getItem("deadline_os_autopilot");
    return saved !== "false";
  });

  // Gamification States
  const [xp, setXp] = useState<number>(() => {
    return Number(localStorage.getItem("deadline_os_xp") || "0");
  });
  const [streak, setStreak] = useState<number>(() => {
    return Number(localStorage.getItem("deadline_os_streak") || "0");
  });
  const [lastCompletedDate, setLastCompletedDate] = useState<string>(() => {
    return localStorage.getItem("deadline_os_last_completed_date") || "";
  });
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("deadline_os_unlocked_achievements");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(() => {
    try {
      const saved = localStorage.getItem("deadline_os_daily_challenge");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [challengeDate, setChallengeDate] = useState<string>(() => {
    return localStorage.getItem("deadline_os_challenge_date") || "";
  });

  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const [celebratingAchievement, setCelebratingAchievement] = useState<Achievement | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(false);

  // Procrastination Detector States
  const [appOpensSinceComplete, setAppOpensSinceComplete] = useState<number>(0);
  const [avgStartLag, setAvgStartLag] = useState<string | null>(null);
  const [heavyDelayCategory, setHeavyDelayCategory] = useState<string | null>(null);
  const [tasksCompleted, setTasksCompleted] = useState<number>(0);
  const [tasksMissed, setTasksMissed] = useState<number>(0);
  const hasIncrementedAppOpens = useRef<string | null>(null);
  const [procrastinationRoast, setProcrastinationRoast] = useState<string>("");
  const [roastLoading, setRoastLoading] = useState<boolean>(false);
  const [isInterventionDismissed, setIsInterventionDismissed] = useState<boolean>(false);

  // Domino Effect States
  const [isDominoModalOpen, setIsDominoModalOpen] = useState<boolean>(false);
  const [dominoWarning, setDominoWarning] = useState<string>("");
  const [dominoAffectedCount, setDominoAffectedCount] = useState<number>(0);
  const [dominoComparison, setDominoComparison] = useState<DominoComparisonItem[]>([]);

  // Focus Sprint States
  const [activeSprintTask, setActiveSprintTask] = useState<Task | null>(null);
  const [isSprintModalOpen, setIsSprintModalOpen] = useState<boolean>(false);

  // AI Negotiator Panic Mode State
  const [isNegotiatorOpen, setIsNegotiatorOpen] = useState<boolean>(false);

  // Gemini Key status check states
  const [geminiStatus, setGeminiStatus] = useState<"checking" | "connected" | "expired" | "disconnected" | "error" | "limited">("checking");
  const [geminiError, setGeminiError] = useState<string>("");
  const [hasApiCallFailed, setHasApiCallFailed] = useState<boolean>(false);
  const [isStatusBannerDismissed, setIsStatusBannerDismissed] = useState<boolean>(() => {
    return sessionStorage.getItem("deadline_os_status_banner_dismissed") === "true";
  });

  const [activeSection, setActiveSection] = useState<"dashboard" | "tasks" | "focus" | "planner" | "achievements" | "stats" | "settings">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  const ALL_ACHIEVEMENTS: Achievement[] = [
    {
      id: "early_bird",
      title: "Early Bird",
      description: "Complete 5 tasks at least 24 hours before their deadlines.",
      emoji: "🐦",
      locked: true,
      xpReward: 150,
    },
    {
      id: "fire_streak",
      title: "Fire Streak",
      description: "Maintain a 7-day streak with no missed tasks.",
      emoji: "🔥",
      locked: true,
      xpReward: 250,
    },
    {
      id: "comeback_kid",
      title: "Comeback Kid",
      description: "Complete 3 tasks in a row after missing a deadline.",
      emoji: "🐐",
      locked: true,
      xpReward: 200,
    },
    {
      id: "zero_miss_week",
      title: "Zero Miss Week",
      description: "Complete a full week with absolutely zero missed deadlines.",
      emoji: "🛡️",
      locked: true,
      xpReward: 300,
    },
    {
      id: "speed_runner",
      title: "Speed Runner",
      description: "Complete any task within 1 hour of adding it.",
      emoji: "🏃",
      locked: true,
      xpReward: 100,
    },
    {
      id: "pro_planner",
      title: "Pro Planner",
      description: "Add 10 tasks to your planner backlog.",
      emoji: "📅",
      locked: true,
      xpReward: 100,
    },
    {
      id: "focus_legend",
      title: "Focus Legend",
      description: "Complete 5 high-intensity Focus Sprints.",
      emoji: "🧘",
      locked: true,
      xpReward: 150,
    },
    {
      id: "domino_defier",
      title: "Domino Defier",
      description: "Complete 3 high-risk tasks (risk score >= 80) to prevent cascading failures.",
      emoji: "🀄",
      locked: true,
      xpReward: 200,
    },
    {
      id: "elite_level",
      title: "Elite Level",
      description: "Reach Level 3 with a total of 1000+ XP.",
      emoji: "👑",
      locked: true,
      xpReward: 250,
    },
    {
      id: "negotiation_master",
      title: "Negotiation Master",
      description: "Successfully negotiate 3 AI workload extensions or rescue plans.",
      emoji: "🤝",
      locked: true,
      xpReward: 150,
    },
  ];

  const playChimeSound = (type: "unlock" | "complete" | "fail") => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      if (type === "unlock") {
        const notes = [261.63, 329.63, 392.00, 523.25];
        notes.forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.12);
          gain.gain.setValueAtTime(0.12, ctx.currentTime + index * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + index * 0.12 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + index * 0.12);
          osc.stop(ctx.currentTime + index * 0.12 + 0.35);
        });
      } else if (type === "complete") {
        const notes = [440.00, 554.37];
        notes.forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.1);
          gain.gain.setValueAtTime(0.1, ctx.currentTime + index * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + index * 0.1 + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + index * 0.1);
          osc.stop(ctx.currentTime + index * 0.1 + 0.25);
        });
      } else if (type === "fail") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      }
    } catch (e) {
      console.error("Failed to play chime audio:", e);
    }
  };

  const fetchDailyChallenge = async (currentTasks: Task[]) => {
    setChallengeLoading(true);
    try {
      const res = await fetch("/api/daily-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: currentTasks.filter(t => !t.completed && !t.missed) }),
      });
      if (res.ok) {
        const data = await res.json();
        const todayStr = new Date().toLocaleDateString("en-CA");
        setDailyChallenge({
          ...data,
          completed: false,
          currentValue: 0,
        });
        setChallengeDate(todayStr);
        localStorage.setItem("deadline_os_daily_challenge", JSON.stringify({
          ...data,
          completed: false,
          currentValue: 0,
        }));
        localStorage.setItem("deadline_os_challenge_date", todayStr);
      }
    } catch (err) {
      console.error("Failed to generate Daily Challenge:", err);
    } finally {
      setChallengeLoading(false);
    }
  };

  useEffect(() => {
    const todayStr = new Date().toLocaleDateString("en-CA");
    if (challengeDate !== todayStr && !challengeLoading) {
      fetchDailyChallenge(tasks);
    }
  }, [challengeDate]);

  const checkAndUnlockAchievements = (currentTasks: Task[], currentStreak: number, currentXp: number) => {
    const newlyUnlocked: string[] = [];
    const copyUnlocked = [...unlockedAchievements];

    const earlyCompletedCount = currentTasks.filter(t => {
      if (!t.completed || !t.completedAt) return false;
      const dMs = new Date(t.deadline).getTime();
      const cMs = new Date(t.completedAt).getTime();
      return dMs - cMs >= 24 * 60 * 60 * 1000;
    }).length;
    if (earlyCompletedCount >= 5 && !copyUnlocked.includes("early_bird")) {
      newlyUnlocked.push("early_bird");
    }

    if (currentStreak >= 7 && !copyUnlocked.includes("fire_streak")) {
      newlyUnlocked.push("fire_streak");
    }

    const missedDeadlines = currentTasks.filter(t => t.missed && t.missedAt);
    if (missedDeadlines.length > 0) {
      const lastMissed = missedDeadlines.sort(
        (a, b) => new Date(b.missedAt!).getTime() - new Date(a.missedAt!).getTime()
      )[0];
      const completedAfterMissed = currentTasks.filter(t => {
        if (!t.completed || !t.completedAt) return false;
        return new Date(t.completedAt).getTime() > new Date(lastMissed.missedAt!).getTime();
      }).length;
      if (completedAfterMissed >= 3 && !copyUnlocked.includes("comeback_kid")) {
        newlyUnlocked.push("comeback_kid");
      }
    }

    const hasMissedInLast7Days = currentTasks.some(t => {
      if (!t.missed || !t.missedAt) return false;
      return currentTime.getTime() - new Date(t.missedAt).getTime() <= 7 * 24 * 60 * 60 * 1000;
    });
    const hasCompletedInLast7Days = currentTasks.some(t => {
      if (!t.completed || !t.completedAt) return false;
      return currentTime.getTime() - new Date(t.completedAt).getTime() <= 7 * 24 * 60 * 60 * 1000;
    });
    if ((currentStreak >= 7 || (hasCompletedInLast7Days && !hasMissedInLast7Days)) && !copyUnlocked.includes("zero_miss_week")) {
      newlyUnlocked.push("zero_miss_week");
    }

    const hasSpeedRun = currentTasks.some(t => {
      if (!t.completed || !t.completedAt) return false;
      const cMs = new Date(t.completedAt).getTime();
      const crMs = new Date(t.createdAt).getTime();
      return cMs - crMs <= 60 * 60 * 1000;
    });
    if (hasSpeedRun && !copyUnlocked.includes("speed_runner")) {
      newlyUnlocked.push("speed_runner");
    }

    // 6. Pro Planner: Add 10 tasks to planner backlog
    if (currentTasks.length >= 10 && !copyUnlocked.includes("pro_planner")) {
      newlyUnlocked.push("pro_planner");
    }

    // 7. Focus Legend: Complete 5 high-intensity Focus Sprints
    const sprintsCount = parseInt(localStorage.getItem("deadline_os_completed_sprints") || "0");
    if (sprintsCount >= 5 && !copyUnlocked.includes("focus_legend")) {
      newlyUnlocked.push("focus_legend");
    }

    // 8. Domino Defier: Complete 3 high-risk tasks (risk score >= 80)
    const completedHighRiskCount = currentTasks.filter(t => {
      if (!t.completed) return false;
      const score = calculateRiskScore(t, new Date(t.createdAt));
      return score >= 80;
    }).length;
    if (completedHighRiskCount >= 3 && !copyUnlocked.includes("domino_defier")) {
      newlyUnlocked.push("domino_defier");
    }

    // 9. Elite Level: Reach Level 3 with a total of 1000+ XP
    if (currentXp >= 1000 && !copyUnlocked.includes("elite_level")) {
      newlyUnlocked.push("elite_level");
    }

    // 10. Negotiation Master: Successfully negotiate 3 AI workload extensions
    const negCount = parseInt(localStorage.getItem("deadline_os_negotiation_count") || "0");
    if (negCount >= 3 && !copyUnlocked.includes("negotiation_master")) {
      newlyUnlocked.push("negotiation_master");
    }

    if (newlyUnlocked.length > 0) {
      const nextUnlocked = [...copyUnlocked, ...newlyUnlocked];
      setUnlockedAchievements(nextUnlocked);
      localStorage.setItem("deadline_os_unlocked_achievements", JSON.stringify(nextUnlocked));

      const ach = ALL_ACHIEVEMENTS.find(a => a.id === newlyUnlocked[0]);
      if (ach) {
        setCelebratingAchievement(ach);
        playChimeSound("unlock");
        confetti({
          particleCount: 200,
          spread: 90,
          origin: { y: 0.4 },
          colors: ["#fbbf24", "#f43f5e", "#10b981", "#6366f1"],
        });
      }
    }
  };

  const completeTaskGamification = (updatedTasks: Task[], completedTask: Task) => {
    let earnedXp = 0;
    const score = calculateRiskScore(completedTask, currentTime);
    const isHighRisk = score >= 80;
    
    const nowMs = currentTime.getTime();
    const deadlineMs = new Date(completedTask.deadline).getTime();
    const isBeforeDeadline = deadlineMs > nowMs && !completedTask.missed;

    let onTimeEarned = false;
    let highRiskEarned = false;
    let earlyEarned = false;
    let daily3BonusEarned = false;

    if (isBeforeDeadline) {
      earnedXp += 100;
      onTimeEarned = true;
    }

    if (isHighRisk) {
      earnedXp += 250;
      highRiskEarned = true;
    }

    const isEarly = deadlineMs - nowMs > 24 * 60 * 60 * 1000;
    if (isEarly && isBeforeDeadline) {
      earnedXp += 150;
      earlyEarned = true;
    }

    const todayStr = new Date().toLocaleDateString("en-CA");
    const completedToday = updatedTasks.filter(
      (t) => t.completed && t.completedAt && t.completedAt.startsWith(todayStr)
    );
    if (completedToday.length === 3) {
      earnedXp += 100;
      daily3BonusEarned = true;
    }

    const newXp = xp + earnedXp;
    setXp(newXp);
    localStorage.setItem("deadline_os_xp", newXp.toString());

    let newStreak = streak;
    if (!lastCompletedDate) {
      newStreak = 1;
    } else {
      const lastDate = new Date(lastCompletedDate);
      const todayDate = new Date(todayStr);
      const diffTime = todayDate.getTime() - lastDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        newStreak = streak + 1;
      } else if (diffDays > 1) {
        newStreak = 1;
      }
    }
    setStreak(newStreak);
    localStorage.setItem("deadline_os_streak", newStreak.toString());
    setLastCompletedDate(todayStr);
    localStorage.setItem("deadline_os_last_completed_date", todayStr);

    playChimeSound("complete");

    const toastDetails: string[] = [];
    if (onTimeEarned) toastDetails.push("+100 XP (On-Time)");
    if (highRiskEarned) toastDetails.push("+250 XP (High-Risk)");
    if (earlyEarned) toastDetails.push("+150 XP (Early Bird)");
    if (daily3BonusEarned) toastDetails.push("+100 XP (Daily Triple Bonus!)");

    showToast(`🎉 Completed "${completedTask.title}"! ${toastDetails.join(" | ")}`, "success");

    let challengeBonus = 0;
    let challengeJustCompleted = false;
    let updatedChallenge = dailyChallenge ? { ...dailyChallenge } : null;

    if (updatedChallenge && !updatedChallenge.completed) {
      let meetsChallenge = false;
      
      if (updatedChallenge.type === "high_risk_2") {
        meetsChallenge = isHighRisk;
      } else if (updatedChallenge.type === "category_complete_2") {
        meetsChallenge = completedTask.category === updatedChallenge.category;
      } else if (updatedChallenge.type === "complete_early_1") {
        meetsChallenge = isEarly;
      } else if (updatedChallenge.type === "complete_any_3" || updatedChallenge.type === "complete_any_2") {
        meetsChallenge = true;
      } else if (updatedChallenge.type === "focus_complete_2") {
        const todaysFocus = getUrgencySortedTasks(updatedTasks)
          .filter((t) => !t.completed && !t.missed)
          .slice(0, 3);
        meetsChallenge = todaysFocus.some(t => t.id === completedTask.id);
      }

      if (meetsChallenge) {
        const val = (updatedChallenge.currentValue || 0) + 1;
        updatedChallenge.currentValue = val;
        
        if (val >= updatedChallenge.targetValue) {
          updatedChallenge.completed = true;
          challengeBonus = updatedChallenge.bonusXp;
          challengeJustCompleted = true;
        }
        
        setDailyChallenge(updatedChallenge);
        localStorage.setItem("deadline_os_daily_challenge", JSON.stringify(updatedChallenge));
      }
    }

    if (challengeJustCompleted) {
      const finalXp = newXp + challengeBonus;
      setXp(finalXp);
      localStorage.setItem("deadline_os_xp", finalXp.toString());
      setTimeout(() => {
        showToast(`🏆 DAILY CHALLENGE COMPLETE! +${challengeBonus} XP!`, "success");
        playChimeSound("unlock");
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.5 },
          colors: ["#3b82f6", "#10b981", "#fbbf24"],
        });
      }, 800);
    }

    checkAndUnlockAchievements(updatedTasks, newStreak, newXp);
  };

  const getLevelDetails = (currentXp: number) => {
    if (currentXp < 500) {
      return {
        title: "Procrastinator 😴",
        minXp: 0,
        maxXp: 500,
        currentProgressXp: currentXp,
        percent: Math.min(100, Math.round((currentXp / 500) * 100)),
      };
    } else if (currentXp < 1500) {
      return {
        title: "Getting There 🌱",
        minXp: 500,
        maxXp: 1500,
        currentProgressXp: currentXp - 500,
        percent: Math.min(100, Math.round(((currentXp - 500) / 1000) * 100)),
      };
    } else if (currentXp < 3000) {
      return {
        title: "On Track 🔥",
        minXp: 1500,
        maxXp: 3000,
        currentProgressXp: currentXp - 1500,
        percent: Math.min(100, Math.round(((currentXp - 1500) / 1500) * 100)),
      };
    } else if (currentXp < 5000) {
      return {
        title: "Deadline Slayer ⚡",
        minXp: 3000,
        maxXp: 5000,
        currentProgressXp: currentXp - 3000,
        percent: Math.min(100, Math.round(((currentXp - 3000) / 2000) * 100)),
      };
    } else {
      return {
        title: "Productivity God 👑",
        minXp: 5000,
        maxXp: 1000000,
        currentProgressXp: currentXp - 5000,
        percent: 100,
      };
    }
  };

  const levelInfo = getLevelDetails(xp);

  // Load user data on startup or login
  const loadUserData = (email: string) => {
    const key = `deadlineos_data_${email}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setTasks(parsed.tasks || []);
        setXp(parsed.xp || 0);
        setStreak(parsed.streak || 0);
        setUnlockedAchievements(parsed.achievements || []);
        setAppOpensSinceComplete(parsed.appOpens || 0);
        setAvgStartLag(parsed.avgStartLag !== undefined ? parsed.avgStartLag : null);
        setHeavyDelayCategory(parsed.heavyDelayCategory !== undefined ? parsed.heavyDelayCategory : null);
        setTasksCompleted(parsed.tasksCompleted || 0);
        setTasksMissed(parsed.tasksMissed || 0);
      } catch (err) {
        console.error("Failed to load user data:", err);
      }
    } else {
      // Create default user data
      setTasks([]);
      setXp(0);
      setStreak(0);
      setUnlockedAchievements([]);
      setAppOpensSinceComplete(0);
      setAvgStartLag(null);
      setHeavyDelayCategory(null);
      setTasksCompleted(0);
      setTasksMissed(0);
      localStorage.setItem(key, JSON.stringify({
        tasks: [],
        xp: 0,
        streak: 0,
        achievements: [],
        appOpens: 0,
        avgStartLag: null,
        heavyDelayCategory: null,
        tasksCompleted: 0,
        tasksMissed: 0,
        level: "Procrastinator",
        createdAt: Date.now()
      }));
    }
  };

  useEffect(() => {
    if (currentUserEmail) {
      if (hasIncrementedAppOpens.current !== currentUserEmail) {
        hasIncrementedAppOpens.current = currentUserEmail;
        const userDataKey = "deadlineos_data_" + currentUserEmail;
        const raw = localStorage.getItem(userDataKey);
        let userData: any = {};
        if (raw) {
          try {
            userData = JSON.parse(raw);
          } catch {}
        }
        userData.appOpens = (userData.appOpens || 0) + 1;
        
        // Ensure all properties exist
        if (userData.tasks === undefined) userData.tasks = [];
        if (userData.xp === undefined) userData.xp = 0;
        if (userData.streak === undefined) userData.streak = 0;
        if (userData.achievements === undefined) userData.achievements = [];
        if (userData.avgStartLag === undefined) userData.avgStartLag = null;
        if (userData.heavyDelayCategory === undefined) userData.heavyDelayCategory = null;
        if (userData.tasksCompleted === undefined) userData.tasksCompleted = 0;
        if (userData.tasksMissed === undefined) userData.tasksMissed = 0;
        if (userData.level === undefined) userData.level = "Procrastinator";

        localStorage.setItem(userDataKey, JSON.stringify(userData));
      }
      loadUserData(currentUserEmail);
    }
  }, [currentUserEmail]);

  // Sync user data to localStorage
  useEffect(() => {
    if (!currentUserEmail) return;
    const key = `deadlineos_data_${currentUserEmail}`;
    localStorage.setItem(key, JSON.stringify({
      tasks,
      xp,
      streak,
      achievements: unlockedAchievements,
      appOpens: appOpensSinceComplete,
      avgStartLag,
      heavyDelayCategory,
      tasksCompleted,
      tasksMissed
    }));
  }, [tasks, xp, streak, unlockedAchievements, appOpensSinceComplete, avgStartLag, heavyDelayCategory, tasksCompleted, tasksMissed, currentUserEmail]);

  // Dynamically calculate and sync behavioral stats when tasks or current time changes
  useEffect(() => {
    if (!currentUserEmail) return;

    // 1. Calculate completed and missed counts
    const completedCount = tasks.filter(t => t.completed).length;
    const missedCount = tasks.filter(t => t.missed).length;
    setTasksCompleted(completedCount);
    setTasksMissed(missedCount);

    // 2. Calculate average start lag
    const startedTasks = tasks.filter(t => t.startedAt && t.createdAt);
    if (startedTasks.length === 0) {
      setAvgStartLag(null);
    } else {
      let totalMs = 0;
      startedTasks.forEach(t => {
        const diff = new Date(t.startedAt!).getTime() - new Date(t.createdAt).getTime();
        totalMs += Math.max(0, diff);
      });
      const avgMs = totalMs / startedTasks.length;
      const avgHours = avgMs / (1000 * 60 * 60);
      let lagStr = "";
      if (avgHours < 1) {
        const avgMins = Math.round(avgHours * 60);
        lagStr = `${avgMins} min${avgMins === 1 ? "" : "s"}`;
      } else if (avgHours < 24) {
        lagStr = `${avgHours.toFixed(1)} hour${avgHours.toFixed(1) === "1.0" ? "" : "s"}`;
      } else {
        const avgDays = avgHours / 24;
        lagStr = `${avgDays.toFixed(1)} day${avgDays.toFixed(1) === "1.0" ? "" : "s"}`;
      }
      setAvgStartLag(lagStr);
    }

    // 3. Calculate heavy delay category
    const active = tasks.filter(t => !t.completed && !t.missed);
    if (active.length === 0) {
      setHeavyDelayCategory(null);
    } else {
      const categoryCounts: Record<string, number> = {};
      active.forEach(t => {
        const ageMs = currentTime.getTime() - new Date(t.createdAt).getTime();
        // If untouched for more than 1 day
        if (ageMs > 24 * 60 * 60 * 1000 && !t.startedAt) {
          categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
        }
      });
      
      let maxCount = 0;
      let maxCat: string | null = null;
      Object.entries(categoryCounts).forEach(([cat, count]) => {
        if (count > maxCount) {
          maxCount = count;
          maxCat = cat;
        }
      });
      setHeavyDelayCategory(maxCat);
    }
  }, [tasks, currentTime, currentUserEmail]);

  // Keep briefing in sync when tasks list is empty
  useEffect(() => {
    if (tasks.length === 0) {
      setBriefing(`Welcome to DeadlineOS, ${currentUserName || "Operator"}! You have no deadlines yet. Add your first task and I'll start managing your schedule.`);
    }
  }, [tasks.length, currentUserName]);

  // Initialize: Load other session parameters on mount
  useEffect(() => {
    // Load saved briefing if present
    const savedBriefing = localStorage.getItem("deadline_os_briefing");
    if (savedBriefing && tasks.length > 0) {
      setBriefing(savedBriefing);
    } else {
      // Default initial welcome briefing
      setBriefing(`Welcome to DeadlineOS, ${currentUserName || "Operator"}! You have no deadlines yet. Add your first task and I'll start managing your schedule.`);
    }

    // Load saved procrastination roast if any
    const savedRoast = localStorage.getItem("deadline_os_procrastination_roast");
    if (savedRoast) {
      setProcrastinationRoast(savedRoast);
    }
  }, []);

  // Sync tasks to state wrapper
  const saveTasks = (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
  };

  // Play dynamic synthesis warning sound on expiry
  const playAlertSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.35);
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
    } catch (e) {
      console.error("Alert audio playback failed:", e);
    }
  };

  // Automatic deadline check logic running every time currentTime ticks (every 60s)
  useEffect(() => {
    const nowMs = currentTime.getTime();
    const expiredActive = tasks.filter(
      (t) => !t.completed && !t.missed && new Date(t.deadline).getTime() <= nowMs
    );

    if (expiredActive.length === 0) return;

    // Play subtle warning synth sound
    playAlertSound();
    playChimeSound("fail");

    // XP Penalty and Streak Reset
    const totalDeduction = expiredActive.length * 50;
    const nextXp = Math.max(0, xp - totalDeduction);
    setXp(nextXp);
    localStorage.setItem("deadline_os_xp", nextXp.toString());
    setStreak(0);
    localStorage.setItem("deadline_os_streak", "0");

    const updatedTasks = tasks.map((task) => {
      const isExpired =
        !task.completed && !task.missed && new Date(task.deadline).getTime() <= nowMs;
      if (isExpired) {
        showToast(`⚠️ '${task.title}' deadline just passed and was marked missed (-50 XP, streak reset!)`, "error");
        return {
          ...task,
          missed: true,
          missedAt: currentTime.toISOString(),
        };
      }
      return task;
    });

    saveTasks(updatedTasks);

    // Trigger domino effect warning for the first newly missed task
    if (expiredActive.length > 0) {
      const firstMissed = expiredActive[0];
      setTimeout(() => {
        runDominoAnalysis(null, firstMissed.id, null);
      }, 500);
    }

    // Fetch live recovery suggestions from Gemini
    expiredActive.forEach(async (task) => {
      try {
        const res = await fetch("/api/recovery-suggestion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task }),
        });
        if (res.ok) {
          const data = await res.json();
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id ? { ...t, recoverySuggestion: data.suggestion } : t
            )
          );
          
          // Sync with localStorage
          const stored = localStorage.getItem("deadline_os_tasks");
          if (stored) {
            const currentStored: Task[] = JSON.parse(stored);
            const updatedStored = currentStored.map((t) =>
              t.id === task.id ? { ...t, recoverySuggestion: data.suggestion } : t
            );
            localStorage.setItem("deadline_os_tasks", JSON.stringify(updatedStored));
          }
        }
      } catch (err) {
        console.error("Failed to generate recovery suggestion:", err);
      }
    });
  }, [currentTime]);

  // Set up clock interval to keep Risk Scores dynamically updated every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Trigger Autopilot Recalculation & Notification Pulse
  const triggerAutopilotPulse = () => {
    const now = new Date();
    setCurrentTime(now);

    const activeTasks = tasks.filter((t) => !t.completed);
    if (activeTasks.length > 0) {
      // Find the one with closest deadline
      const sortedActive = [...activeTasks].sort(
        (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      );
      const topTask = sortedActive[0];
      const hoursLeft = (new Date(topTask.deadline).getTime() - now.getTime()) / (1000 * 60 * 60);

      let timeString = `${Math.ceil(hoursLeft)} hours`;
      if (hoursLeft < 0) {
        timeString = "overdue";
      } else if (hoursLeft < 1) {
        timeString = `${Math.ceil(hoursLeft * 60)} minutes`;
      } else if (hoursLeft > 24) {
        const days = Math.round(hoursLeft / 24);
        timeString = days === 1 ? "1 day" : `${days} days`;
      }

      showToast(
        `DeadlineOS updated your priorities — [${topTask.title}] moved up because its deadline is in ${timeString}`,
        "info"
      );
    } else {
      showToast("DeadlineOS updated your priorities — Your schedule is perfectly clear!", "info");
    }
  };

  const toggleAutopilot = () => {
    const nextVal = !isAutopilotOn;
    setIsAutopilotOn(nextVal);
    localStorage.setItem("deadline_os_autopilot", String(nextVal));
    if (nextVal) {
      showToast("Auto-Pilot Mode activated: AI is watching your schedule", "success");
      setTimeout(() => {
        triggerAutopilotPulse();
      }, 300);
    } else {
      showToast("Auto-Pilot Mode deactivated", "info");
    }
  };

  const handleResetApp = () => {
    saveTasks([]);
    localStorage.removeItem("deadline_os_briefing");
    localStorage.removeItem("deadline_os_procrastination_roast");
    localStorage.removeItem("deadline_os_ai_tone");
    setBriefing("");
    setProcrastinationRoast("");
    setActiveSection("dashboard");
    showToast("Application data reset! Onboarding initialized.", "info");
  };

  const handleSignOut = () => {
    // 1. Save current user data before logging out
    const currentSession = localStorage.getItem('deadlineos_session');
    if (currentSession) {
      try {
        const session = JSON.parse(currentSession);
        // Data is already saved under deadlineos_data_[email]
        // Just clear the session token
      } catch (e) {}
    }

    // 2. Remove ONLY the session (keep user account + data)
    localStorage.removeItem('deadlineos_session');

    // 3. Show brief farewell toast notification:
    // "See you soon! Your progress is saved. 👋"
    // Toast appears bottom-center, auto-dismisses in 2s
    setFarewellToast("See you soon! Your progress is saved. 👋");

    // 4. After 2 seconds, fade out dashboard
    // and redirect to landing page
    setTimeout(() => {
      setIsSigningOut(true);
      setFarewellToast(null);
      setTimeout(() => {
        // fade out current page (opacity 1 to 0, 400ms)
        // then set current view back to 'landing'
        // which shows the landing page again
        setCurrentUserEmail(null);
        setCurrentUserName(null);
        changeView("landing");
        setIsSigningOut(false);
      }, 400);
    }, 2000);
  };

  const handleLogout = handleSignOut;

  // Check Gemini status on mount
  const checkGeminiStatusOnMount = async () => {
    try {
      const res = await fetch("/api/gemini-status");
      if (res.ok) {
        const data = await res.json();
        setGeminiStatus(data.status || "disconnected");
        if (data.error) {
          setGeminiError(data.error);
        }
      } else {
        setGeminiStatus("disconnected");
      }
    } catch (err) {
      setGeminiStatus("disconnected");
    }
  };

  useEffect(() => {
    checkGeminiStatusOnMount();

    const handleFailedApi = () => {
      setHasApiCallFailed(true);
    };

    window.addEventListener("gemini-api-failed", handleFailedApi);
    return () => {
      window.removeEventListener("gemini-api-failed", handleFailedApi);
    };
  }, []);

  useEffect(() => {
    if (!isStatusBannerDismissed && hasApiCallFailed) {
      const timer = setTimeout(() => {
        setIsStatusBannerDismissed(true);
        sessionStorage.setItem("deadline_os_status_banner_dismissed", "true");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isStatusBannerDismissed, hasApiCallFailed]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Auto-pilot interval: recalculate and reorder every 30 minutes when ON
  useEffect(() => {
    if (!isAutopilotOn) return;

    const intervalId = setInterval(() => {
      triggerAutopilotPulse();
    }, 1800000); // 30 minutes

    return () => clearInterval(intervalId);
  }, [isAutopilotOn, tasks]);

  // Utility to fire beautiful toast alerts
  const showToast = (message: string, type: "success" | "info" | "error" = "success") => {
    const newToast: Toast = {
      id: `toast-${Date.now()}`,
      message,
      type,
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 3500);
  };

  // Generate strategic priority briefing via AI
  const handleFetchBriefing = async (currentTasks: Task[]) => {
    if (currentTasks.length === 0) {
      setBriefing(`Welcome to DeadlineOS, ${currentUserName || "Operator"}! You have no deadlines yet. Add your first task and I'll start managing your schedule.`);
      return;
    }
    setBriefingLoading(true);
    try {
      const response = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: currentTasks.map(t => ({
            ...t,
            riskScore: calculateRiskScore(t, currentTime)
          })),
          currentTime: currentTime.toISOString(),
          aiTone: localStorage.getItem("deadline_os_ai_tone") || "balanced",
          userName: currentUserName || "Operator",
        }),
      });
      const data = await response.json();
      if (data.briefing) {
        setBriefing(data.briefing);
        localStorage.setItem("deadline_os_briefing", data.briefing);
        showToast("Strategic briefing compiled by AI Copilot!", "success");
      } else {
        throw new Error("No briefing returned");
      }
    } catch (err) {
      console.error(err);
      showToast("Briefing compiled locally (Offline mode)", "info");
    } finally {
      setBriefingLoading(false);
    }
  };

  // Auto-refresh AI briefing when first load completes, but don't loop
  useEffect(() => {
    if (tasks.length > 0 && !localStorage.getItem("deadline_os_briefing")) {
      handleFetchBriefing(tasks);
    }
  }, [tasks.length === 0]);

  // Task operation: Toggle complete/active
  const handleToggleComplete = (taskId: string) => {
    let completedTaskObj: Task | null = null;
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        const nextState = !t.completed;
        const nowStr = new Date().toISOString();
        if (nextState) {
          completedTaskObj = { ...t, completed: true, completedAt: nowStr, missed: false };
          return completedTaskObj;
        } else {
          return { ...t, completed: false, completedAt: undefined };
        }
      }
      return t;
    });
    
    saveTasks(updated);
    
    if (completedTaskObj) {
      completeTaskGamification(updated, completedTaskObj);
      setAppOpensSinceComplete(0);
    } else {
      showToast(`Restored task to active`, "info");
    }
  };

  // Task operation: Delete
  const handleDeleteTask = (taskId: string) => {
    const taskToDelete = tasks.find((t) => t.id === taskId);
    const updated = tasks.filter((t) => t.id !== taskId);
    saveTasks(updated);
    showToast(`Removed "${taskToDelete?.title || 'task'}"`, "info");
  };

  // Task operation: Start task work
  const handleStartTask = (taskId: string) => {
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        return { ...t, startedAt: new Date().toISOString() };
      }
      return t;
    });
    saveTasks(updated);
    showToast(`Started work on "${tasks.find((t) => t.id === taskId)?.title}"!`, "success");
  };

  // AI Negotiator workload de-escalation action
  const handleApplyRescuePlan = (acceptedSuggestions: RescueSuggestion[]) => {
    let updated = [...tasks];
    let addedTasks: Task[] = [];
    let droppedCount = 0;
    let movedCount = 0;
    let splitCount = 0;

    acceptedSuggestions.forEach((sug) => {
      const taskIndex = updated.findIndex((t) => t.id === sug.taskId);
      if (taskIndex === -1) return;

      const targetTask = updated[taskIndex];

      if (sug.type === "move" && sug.suggestedDeadline) {
        updated[taskIndex] = {
          ...targetTask,
          deadline: sug.suggestedDeadline
        };
        movedCount++;
      } else if (sug.type === "split") {
        // Update original task
        updated[taskIndex] = {
          ...targetTask,
          title: `${targetTask.title} (Part 1)`
        };
        // Create Part 2
        const nextDay = new Date(targetTask.deadline);
        nextDay.setDate(nextDay.getDate() + 1);
        const part2Task: Task = {
          id: `task-${Math.random().toString(36).substring(2, 9)}`,
          title: `${targetTask.title} (Part 2)`,
          category: targetTask.category,
          deadline: nextDay.toISOString(),
          estimatedHours: Math.max(0.5, Math.round(targetTask.estimatedHours / 2)),
          notes: `Split from original task by AI Negotiator. Context: ${targetTask.notes || ""}`,
          completed: false,
          createdAt: new Date().toISOString()
        };
        addedTasks.push(part2Task);
        splitCount++;
      } else if (sug.type === "drop") {
        // Remove task
        updated = updated.filter((t) => t.id !== sug.taskId);
        droppedCount++;
      }
    });

    const finalTasks = [...updated, ...addedTasks];
    saveTasks(finalTasks);

    // Increment negotiation count
    const negCount = parseInt(localStorage.getItem("deadline_os_negotiation_count") || "0");
    const nextNegCount = negCount + 1;
    localStorage.setItem("deadline_os_negotiation_count", nextNegCount.toString());

    showToast(
      `Rescue Plan Applied: Moved ${movedCount}, Split ${splitCount}, Dropped ${droppedCount} tasks! ⚡`,
      "success"
    );

    // Recheck achievements
    checkAndUnlockAchievements(finalTasks, streak, xp);
  };

  // Task operation: Start Focus Sprint
  const handleOpenFocusSprint = (task: Task) => {
    setActiveSprintTask(task);
    setIsSprintModalOpen(true);
    
    // Auto-mark task as started if not yet started
    if (!task.startedAt) {
      const updated = tasks.map((t) => {
        if (t.id === task.id) {
          return { ...t, startedAt: new Date().toISOString() };
        }
        return t;
      });
      saveTasks(updated);
    }
  };

  const handleCompleteSprintTask = (taskId: string, xpBonus: number) => {
    let completedTaskObj: Task | null = null;
    const nowStr = new Date().toISOString();
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        completedTaskObj = { ...t, completed: true, completedAt: nowStr, missed: false };
        return completedTaskObj;
      }
      return t;
    });
    
    saveTasks(updated);
    
    if (completedTaskObj) {
      // Increment completed sprints count
      const sprintCount = parseInt(localStorage.getItem("deadline_os_completed_sprints") || "0");
      localStorage.setItem("deadline_os_completed_sprints", (sprintCount + 1).toString());

      completeTaskGamification(updated, completedTaskObj);
      
      // Award focus sprint bonus XP!
      const finalXp = xp + xpBonus;
      setXp(finalXp);
      localStorage.setItem("deadline_os_xp", finalXp.toString());
      setAppOpensSinceComplete(0);
    }
  };

  const handleAwardXpOnly = (xpBonus: number) => {
    const finalXp = xp + xpBonus;
    setXp(finalXp);
    localStorage.setItem("deadline_os_xp", finalXp.toString());
  };

  // Task operation: Open Stuck modal for a task
  const handleOpenStuckModal = (task: Task) => {
    setStuckTask(task);
    setIsStuckModalOpen(true);
  };

  // Task operation: Split a task into subtasks dynamically
  const handleSplitTask = (originalTaskId: string, subtasks: { title: string; estimatedHours: number }[], replaceOriginal: boolean) => {
    const originalTask = tasks.find((t) => t.id === originalTaskId);
    if (!originalTask) return;

    const newTasks: Task[] = subtasks.map((sub, idx) => ({
      id: `task-${Date.now()}-${idx}`,
      title: sub.title,
      deadline: originalTask.deadline,
      estimatedHours: sub.estimatedHours,
      category: originalTask.category,
      notes: `Subtask of: "${originalTask.title}"`,
      completed: false,
      createdAt: new Date().toISOString(),
    }));

    let updated: Task[];
    if (replaceOriginal) {
      updated = tasks.filter((t) => t.id !== originalTaskId);
      updated = [...newTasks, ...updated];
      showToast(`Split and replaced "${originalTask.title}" with ${subtasks.length} subtasks!`, "success");
    } else {
      // Find index of the original task and insert subtasks after it
      const originalIndex = tasks.findIndex((t) => t.id === originalTaskId);
      const copy = [...tasks];
      copy.splice(originalIndex + 1, 0, ...newTasks);
      updated = copy;
      showToast(`Added ${subtasks.length} subtasks for "${originalTask.title}"!`, "success");
    }

    saveTasks(updated);
  };

  // Domino Effect analyzers
  const runDominoAnalysis = async (movedTaskId: string | null, missedTaskId: string | null, newDeadline: string | null) => {
    try {
      const res = await fetch("/api/domino-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movedTaskId,
          missedTaskId,
          newDeadline,
          allTasks: tasks
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.scheduleComparison && data.scheduleComparison.length > 0) {
          setDominoWarning(data.warningMessage || "⚠️ Domino Alert detected timeline pressure.");
          setDominoAffectedCount(data.affectedCount || 0);
          setDominoComparison(data.scheduleComparison);
          setIsDominoModalOpen(true);
        }
      }
    } catch (err) {
      console.error("Domino Analysis failed:", err);
    }
  };

  const handleApplyDominoReshuffle = (updatedItems: DominoComparisonItem[]) => {
    const updated = tasks.map((task) => {
      const updatedItem = updatedItems.find((item) => item.taskId === task.id);
      if (updatedItem && updatedItem.isChanged) {
        return {
          ...task,
          deadline: updatedItem.suggestedDeadline
        };
      }
      return task;
    });
    saveTasks(updated);
    showToast(`Successfully applied scheduling reshuffle! ⚡`, "success");
  };

  // Task operation: Add or update via Modal
  const handleSaveTask = (taskData: Omit<Task, "id" | "completed" | "createdAt"> & { id?: string }) => {
    if (taskData.id) {
      // Edit mode
      const originalTask = tasks.find(t => t.id === taskData.id);
      const isPostponed = originalTask && new Date(taskData.deadline).getTime() > new Date(originalTask.deadline).getTime();

      const updated = tasks.map((t) => {
        if (t.id === taskData.id) {
          return {
            ...t,
            title: taskData.title,
            deadline: taskData.deadline,
            estimatedHours: taskData.estimatedHours,
            category: taskData.category,
            notes: taskData.notes,
          };
        }
        return t;
      });
      saveTasks(updated);
      showToast(`Updated task: "${taskData.title}"`);

      if (isPostponed) {
        // Trigger domino effect analyzer for moving to a later date
        setTimeout(() => {
          runDominoAnalysis(taskData.id || null, null, taskData.deadline);
        }, 500);
      }
    } else {
      // Create mode
      const newTask: Task = {
        id: `task-${Date.now()}`,
        title: taskData.title,
        deadline: taskData.deadline,
        estimatedHours: taskData.estimatedHours,
        category: taskData.category,
        notes: taskData.notes,
        completed: false,
        createdAt: new Date().toISOString(),
      };
      const updated = [newTask, ...tasks];
      saveTasks(updated);
      showToast(`Created task: "${taskData.title}"`);
    }
  };

  const handleCompleteOnboarding = (
    firstTaskData: Omit<Task, "id" | "createdAt" | "completed">,
    aiTone: "gentle" | "balanced" | "ruthless"
  ) => {
    localStorage.setItem("deadline_os_ai_tone", aiTone);
    
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: firstTaskData.title,
      deadline: firstTaskData.deadline,
      estimatedHours: firstTaskData.estimatedHours,
      category: firstTaskData.category,
      notes: firstTaskData.notes,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    
    saveTasks([newTask]);
    
    localStorage.removeItem("deadline_os_briefing");
    localStorage.removeItem("deadline_os_procrastination_roast");
    
    handleFetchBriefing([newTask]);
    
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.5 },
      colors: ["#6366f1", "#a855f7", "#ec4899", "#10b981"]
    });
    
    showToast("Welcome initialized! DeadlineOS online.", "success");
    changeView("dashboard");
  };

  // Category visual matching details
  const getCategoryTheme = (cat: TaskCategory) => {
    switch (cat) {
      case "Study":
        return {
          bg: "bg-purple-500/10",
          text: "text-purple-400",
          border: "border-purple-500/25",
          icon: GraduationCap,
        };
      case "Work":
        return {
          bg: "bg-blue-500/10",
          text: "text-blue-400",
          border: "border-blue-500/25",
          icon: Briefcase,
        };
      case "Personal":
        return {
          bg: "bg-pink-500/10",
          text: "text-pink-400",
          border: "border-pink-500/25",
          icon: User,
        };
      case "Finance":
        return {
          bg: "bg-emerald-500/10",
          text: "text-emerald-400",
          border: "border-emerald-500/25",
          icon: Wallet,
        };
    }
  };

  // Calculate elapsed time since a task was marked missed
  const getMissedTimeAgo = (missedAtStr?: string) => {
    if (!missedAtStr) return "Some time ago";
    const missedTime = new Date(missedAtStr).getTime();
    const diffMs = currentTime.getTime() - missedTime;
    const diffMin = Math.floor(diffMs / (1000 * 60));
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Draft customized apology/extension request template
  const generateExtensionDraftText = (task: Task) => {
    const isProfessor = task.category === "Study";
    const salutation = isProfessor ? "Dear Professor," : "Hi Team,";
    const body = isProfessor
      ? `Dear Professor,

I hope you are doing well. I am writing to sincerely apologize for missing the deadline for the "${task.title}" assignment today. Unfortunately, I ran into some unexpected complexities during my preparation and fell behind schedule.

I am working diligently to resolve this setback. Would it be possible to request a brief extension until tomorrow to submit my work? I truly appreciate your understanding and support.

Sincerely,
[Your Name]`
      : `Hi Team,

I hope you're having a good day. I wanted to reach out and apologize for missing the deadline for our "${task.title}" task today. I ran into some unexpected bottlenecks and wasn't able to complete it on time.

I have reprioritized my workflow and am working hard to get this completed. I expect to have it fully delivered very shortly. Thank you so much for your patience, and I apologize for any inconvenience caused.

Best regards,
[Your Name]`;
    return body;
  };

  // Urgency sort helper:
  // Active tasks come first, ordered closest deadline first.
  // Overdue active tasks rise to absolute top.
  // Completed tasks sorted by deadline but placed at bottom.
  const getUrgencySortedTasks = (items: Task[]): Task[] => {
    return [...items].sort((a, b) => {
      if (a.completed && !b.completed) return 1;
      if (!a.completed && b.completed) return -1;

      const timeA = new Date(a.deadline).getTime();
      const timeB = new Date(b.deadline).getTime();
      return timeA - timeB;
    });
  };

  // Filter and search computation
  const filteredTasks = getUrgencySortedTasks(tasks).filter((t) => {
    // Exclude missed tasks from main dashboard task list
    if (t.missed) return false;

    // Search match
    const matchesSearch = 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.notes.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status match
    const matchesStatus = 
      statusFilter === "All" ||
      (statusFilter === "Active" && !t.completed) ||
      (statusFilter === "Completed" && t.completed);

    // Category match
    const matchesCategory =
      categoryFilter === "All" || t.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Today's Focus calculation:
  // Get up to 3 of the most urgent, non-completed, non-missed tasks (sorted closest deadline first)
  const todaysFocus = getUrgencySortedTasks(tasks)
    .filter((t) => !t.completed && !t.missed)
    .slice(0, 3);

  // Daily Progress Metrics
  const totalTasksCount = tasks.filter((t) => !t.missed).length;
  const completedTasksCount = tasks.filter((t) => t.completed && !t.missed).length;
  const progressPercent = totalTasksCount === 0 ? 0 : Math.round((completedTasksCount / totalTasksCount) * 100);

  // Procrastination metrics helper functions
  const getAvgTimeToStart = () => {
    const startedTasks = tasks.filter(t => t.startedAt && t.createdAt);
    if (startedTasks.length === 0) return "N/A";
    
    let totalMs = 0;
    startedTasks.forEach(t => {
      const diff = new Date(t.startedAt!).getTime() - new Date(t.createdAt).getTime();
      totalMs += Math.max(0, diff);
    });
    
    const avgMs = totalMs / startedTasks.length;
    const avgHours = avgMs / (1000 * 60 * 60);
    
    if (avgHours < 1) {
      const avgMins = Math.round(avgHours * 60);
      return `${avgMins} min${avgMins === 1 ? "" : "s"}`;
    }
    if (avgHours < 24) {
      return `${avgHours.toFixed(1)} hour${avgHours.toFixed(1) === "1.0" ? "" : "s"}`;
    }
    const avgDays = avgHours / 24;
    return `${avgDays.toFixed(1)} day${avgDays.toFixed(1) === "1.0" ? "" : "s"}`;
  };

  const getMostProcrastinatedCategory = () => {
    const active = tasks.filter(t => !t.completed && !t.missed);
    if (active.length === 0) return "None! 🎉";
    
    const categoryCounts: Record<string, number> = {};
    active.forEach(t => {
      const ageMs = currentTime.getTime() - new Date(t.createdAt).getTime();
      // If untouched for more than 1 day
      if (ageMs > 24 * 60 * 60 * 1000 && !t.startedAt) {
        categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
      }
    });
    
    let maxCount = 0;
    let maxCat = "None! 🎉";
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxCat = cat;
      }
    });
    
    return maxCat;
  };

  const getProcrastinationScore = () => {
    const totalTasks = tasks.length;
    if (totalTasks === 0) return 0;

    const missedRatio = tasksMissed / Math.max(totalTasks, 1);
    const openWithoutComplete = appOpensSinceComplete > 5 && tasksCompleted === 0;
    
    let delayRisk = Math.round(missedRatio * 70);
    if (totalTasks > 0 && tasksMissed === 0) {
      delayRisk = 15; // default low % (10-20%)
    }
    if (openWithoutComplete) {
      delayRisk += 30;
    }
    return Math.min(100, Math.max(0, delayRisk));
  };

  const handleFetchProcrastinationRoast = async () => {
    setRoastLoading(true);
    try {
      const active = tasks.filter(t => !t.completed && !t.missed);
      const avgStart = getAvgTimeToStart();
      const mostProcrastinated = getMostProcrastinatedCategory();
      const score = getProcrastinationScore();
      
      const payload = {
        activeTasks: active.map(t => ({
          title: t.title,
          category: t.category,
          createdAt: t.createdAt,
          startedAt: t.startedAt
        })),
        appOpens: appOpensSinceComplete,
        avgTimeToStart: avgStart,
        mostProcrastinatedCategory: mostProcrastinated,
        procrastinationScore: score,
        aiTone: localStorage.getItem("deadline_os_ai_tone") || "balanced"
      };

      const res = await fetch("/api/procrastination-roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.roast) {
        setProcrastinationRoast(data.roast);
        localStorage.setItem("deadline_os_procrastination_roast", data.roast);
        showToast("AI Accountability Roast refreshed!", "success");
      }
    } catch (err) {
      console.error("Failed to fetch procrastination roast:", err);
      showToast("Using local offline fallback roast.", "info");
    } finally {
      setRoastLoading(false);
    }
  };

  const getInterventionTask = () => {
    const active = tasks.filter(t => !t.completed && !t.missed);
    if (active.length === 0) return null;
    
    // 1. Any task untouched for 3+ days (3 days = 3 * 24 * 60 * 60 * 1000 ms)
    const untouchedLimit = 3 * 24 * 60 * 60 * 1000;
    const untouched = active.filter(t => {
      const age = Date.now() - new Date(t.createdAt).getTime();
      return age >= untouchedLimit && !t.startedAt;
    });
    
    if (untouched.length > 0) {
      return untouched[0];
    }
    
    // 2. Otherwise sort active by risk score descending
    const sorted = [...active].sort((a, b) => {
      const scoreA = calculateRiskScore(a, currentTime);
      const scoreB = calculateRiskScore(b, currentTime);
      return scoreB - scoreA;
    });
    return sorted[0];
  };

  const interventionTask = getInterventionTask();

  const isBannerActive = !isStatusBannerDismissed && hasApiCallFailed;

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans selection:bg-indigo-500/30 selection:text-white ${
      theme === "dark" 
        ? "bg-[#050505] text-slate-300" 
        : "bg-[#f8fafc] text-slate-700"
    }`} id="deadlineos-app-root">
      {/* Toast Alert Layer */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full" id="toast-layer-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center justify-between p-4 rounded-xl border shadow-xl animate-fade-in ${
              theme === "dark" 
                ? "border-white/5 bg-[#0a0a0c] text-slate-300" 
                : "border-slate-200 bg-white text-slate-700"
            }`}
            id={toast.id}
          >
            <div className="flex items-center gap-2.5">
              {toast.type === "success" && (
                <div className="p-1 bg-emerald-500/10 rounded-md">
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
              )}
              {toast.type === "info" && (
                <div className="p-1 bg-indigo-500/10 rounded-md">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                </div>
              )}
              {toast.type === "error" && (
                <div className="p-1 bg-rose-500/10 rounded-md">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                </div>
              )}
              <span className={`text-xs font-medium ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>{toast.message}</span>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-500 hover:text-slate-300 ml-3 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Farewell Toast Notification */}
      {farewellToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-[#16162a] border border-[#2a2a4a] text-slate-100 px-6 py-3 rounded-full shadow-[0_0_50px_rgba(108,59,255,0.4)] flex items-center gap-2 font-sans text-sm animate-bounce">
          <span>{farewellToast}</span>
        </div>
      )}

      {/* Main Container */}
      {hasStarted && (
        <>
        <div 
          className={`flex flex-col min-h-screen transition-[padding] duration-300 ${isSigningOut ? "opacity-0 transition-opacity duration-[400ms] ease-out" : "animate-app-fade-in"}`} 
          style={{ paddingTop: isBannerActive ? "96px" : "60px" }}
          id="main-layout-wrapper"
        >
        {/* API Status Banner */}
        <AnimatePresence>
          {isBannerActive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 36 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed top-0 left-0 right-0 h-9 bg-amber-500/15 border-b border-amber-500/20 text-amber-400 flex items-center justify-between px-6 z-50 text-xs font-semibold overflow-hidden"
              id="gemini-status-warning-banner"
            >
              <div className="flex items-center gap-2">
                <span>⚠️ Gemini API offline — running on local mode</span>
              </div>
              <button
                onClick={() => {
                  setIsStatusBannerDismissed(true);
                  sessionStorage.setItem("deadline_os_status_banner_dismissed", "true");
                }}
                className="text-amber-400/60 hover:text-amber-300 cursor-pointer"
                title="Dismiss warning"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fixed top navbar (60px height): logo left, action buttons right */}
        <nav 
          className="fixed left-0 right-0 h-[60px] bg-[#0f0f1a] border-b border-[#1e1e3a] z-40 flex items-center justify-between px-6 shadow-md shadow-[#0a0a14]/40 transition-[top] duration-300"
          style={{ top: isBannerActive ? "36px" : "0px" }}
        >
          {/* Logo Left */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#16162a]/60 border border-[#2a2a4a]/50 hover:border-indigo-500/50 hover:bg-[#1a1a2e] text-[#a0a0c0] hover:text-white transition-colors cursor-pointer shrink-0"
              title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
              id="hamburger-menu-btn"
            >
              {isSidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 shadow-lg shadow-indigo-500/20 shrink-0">
              <BrainCircuit className="w-4.5 h-4.5 text-white animate-pulse" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[15px] font-bold text-white tracking-wider font-mono leading-none">
                DeadlineOS
              </span>
              <span className="text-[10px] text-[#606080] mt-1 leading-none font-semibold">
                AI-Armed Deadline Manager
              </span>
            </div>
          </div>

          {/* Action Buttons Right */}
          <div className="flex items-center gap-2.5">
            {/* 1. Compact Auto-Pilot Toggle */}
            <button
              onClick={toggleAutopilot}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#16162a]/40 border border-[#2a2a4a]/50 hover:border-indigo-500/50 transition-colors cursor-pointer animate-none"
              title="Toggle Autopilot Mode"
            >
              <span className="text-xs font-semibold text-slate-300">Autopilot</span>
              <div className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ${
                isAutopilotOn ? "bg-indigo-600" : "bg-slate-600"
              }`}>
                <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${
                  isAutopilotOn ? "translate-x-4" : "translate-x-0"
                }`} />
              </div>
            </button>

            {/* 3. Overwhelmed Panic button */}
            <button
              onClick={() => setIsNegotiatorOpen(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-red-900/20"
              id="panic-overwhelmed-btn"
              title="Help, I'm Overwhelmed!"
            >
              <Flame className="w-3.5 h-3.5 text-white animate-pulse" />
              <span className="hidden sm:inline">Help, I'm Overwhelmed</span>
            </button>

            {/* 4. "＋ New Task" Button (Primary Purple, always visible) */}
            <button
              onClick={() => {
                setEditingTask(null);
                setIsModalOpen(true);
              }}
              className="bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs px-3.5 py-1.5 transition-all flex items-center gap-1.5 shadow-md shadow-purple-900/20 cursor-pointer"
              id="global-add-task-btn"
            >
              <span className="font-bold text-sm leading-none">＋</span>
              <span>New Task</span>
            </button>
          </div>
        </nav>

        {/* Sidebar Overlay */}
        <div
          onClick={() => setIsSidebarOpen(false)}
          className={`fixed inset-0 bg-black/50 z-[999] transition-opacity duration-300 ${
            isSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          style={{ transition: "opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)" }}
          id="sidebar-overlay"
        />

        {/* Unified Responsive Sliding Sidebar */}
        <aside
          className="fixed top-0 left-0 w-[260px] h-full bg-[#0f0f1a] border-r border-[#1e1e3a] z-[1000] flex flex-col justify-between py-6 px-4"
          style={{
            transform: isSidebarOpen ? "translateX(0)" : "translateX(-260px)",
            transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          id="sidebar-container"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between px-4 pb-2 border-b border-[#1e1e3a]/40">
              <span className="text-[16px] font-bold text-white font-mono">DeadlineOS</span>
              <button 
                onClick={() => setIsSidebarOpen(false)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#606080] hover:text-white hover:bg-[#16162a] cursor-pointer transition-colors"
                title="Close sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-[1px] text-[#606080] font-bold px-4 block mb-2">
                Systems Navigation
              </span>
              {[
                { id: "dashboard", label: "Dashboard", icon: Home },
                { id: "tasks", label: "My Tasks", icon: CheckCircle2 },
                { id: "focus", label: "Today's Focus", icon: Target },
                { id: "planner", label: "Planner", icon: Calendar },
                { id: "achievements", label: "Achievements", icon: Trophy },
                { id: "stats", label: "My Stats", icon: BarChart2 },
                { id: "settings", label: "Settings", icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id as any);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm cursor-pointer ${
                      isActive
                        ? "bg-indigo-600 text-white font-bold border border-indigo-500/20 shadow-lg shadow-indigo-600/15"
                        : "text-[#a0a0c0] hover:text-[#d0d0e8] hover:bg-[#1a1a2e] border border-transparent"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {/* Thin divider line */}
            <div className="border-t border-[#1a1a2e] mx-4 my-1" />

            {/* User Info Row */}
            <div className="px-4 py-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {/* Purple circle avatar */}
                <div className="w-8 h-8 rounded-full bg-[#6c3bff] flex items-center justify-center text-white font-bold shrink-0 text-sm font-mono">
                  {currentUserName ? currentUserName.charAt(0).toUpperCase() : "U"}
                </div>
                {/* User Details */}
                <div className="min-w-0 flex-1 flex flex-col">
                  <span className="text-[14px] font-bold text-white truncate block">
                    {currentUserName || "User"}
                  </span>
                  <span 
                    className="text-[11px] text-[#666688] truncate block font-mono"
                    title={currentUserEmail || ""}
                  >
                    {currentUserEmail ? (currentUserEmail.length > 20 ? currentUserEmail.slice(0, 17) + "..." : currentUserEmail) : "user@deadlineos"}
                  </span>
                </div>
              </div>
              {/* Sign Out Button */}
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded-lg hover:bg-rose-500/10 text-[#ff4444] transition-colors cursor-pointer shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions (Theme & Settings Modal) */}
            <div className="px-4 py-2.5 flex items-center gap-2 border-t border-[#1e1e3a]/40">
              <button
                onClick={toggleTheme}
                className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg bg-[#0f0f1a] border border-[#1e1e3a] hover:border-slate-500/30 text-xs font-semibold text-[#a0a0c0] hover:text-white transition-all cursor-pointer"
                title="Toggle Theme"
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span>Light</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Dark</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setIsSettingsModalOpen(true);
                  setIsSidebarOpen(false);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg bg-[#0f0f1a] border border-[#1e1e3a] hover:border-slate-500/30 text-xs font-semibold text-[#a0a0c0] hover:text-white transition-all cursor-pointer"
                title="Open Settings Modal"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>Modal</span>
              </button>
            </div>

            {/* Sidebar Footer Info */}
            <div className="px-4 py-3 border-t border-[#1e1e3a]/40 text-[11px] text-[#606080] font-mono flex flex-col gap-1">
              <span>VIGILANCE STATS</span>
              <span className="text-white font-semibold">Streak: {streak} days</span>
              <span className="text-indigo-400 font-semibold">{levelInfo.title}</span>
            </div>
          </div>
        </aside>

        {/* Main content area (remaining width): scrollable, padded 32px */}
        <main className="flex-1 p-8 min-h-full flex flex-col">
          <div className="max-w-[1100px] w-full mx-auto flex-1 flex gap-6 pb-16">
            
            {/* Active view component */}
            <div className="w-full space-y-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  {activeSection === "dashboard" && (
                    currentView === "onboarding" ? (
                      <OnboardingView 
                        onCompleteOnboarding={handleCompleteOnboarding} 
                        currentUserEmail={currentUserEmail} 
                        currentUserName={currentUserName} 
                        onLaunch={() => changeView("dashboard")} 
                      />
                    ) : (
                      <DashboardView
                        levelInfo={levelInfo}
                        xp={xp}
                        streak={streak}
                        tasks={tasks}
                        currentTime={currentTime}
                        briefing={briefing}
                        briefingLoading={briefingLoading}
                        onRefreshBriefing={() => handleFetchBriefing(tasks)}
                        dailyChallenge={dailyChallenge}
                        challengeLoading={challengeLoading}
                        onRefreshChallenge={() => fetchDailyChallenge(tasks)}
                        onToggleComplete={handleToggleComplete}
                        currentUserName={currentUserName}
                        onAddNewTask={() => {
                          setEditingTask(null);
                          setIsModalOpen(true);
                        }}
                      />
                    )
                  )}

                  {activeSection === "tasks" && (
                    <MyTasksView
                      tasks={tasks}
                      searchQuery={searchQuery}
                      setSearchQuery={setSearchQuery}
                      statusFilter={statusFilter}
                      setStatusFilter={setStatusFilter}
                      categoryFilter={categoryFilter}
                      setCategoryFilter={setCategoryFilter}
                      currentTime={currentTime}
                      onToggleComplete={handleToggleComplete}
                      onEditTask={(task) => {
                        setEditingTask(task);
                        setIsModalOpen(true);
                      }}
                      onDeleteTask={handleDeleteTask}
                      onOpenStuckModal={handleOpenStuckModal}
                      onCreateTaskClick={() => {
                        setEditingTask(null);
                        setIsModalOpen(true);
                      }}
                      onStartSprintClick={(task) => {
                        setActiveSprintTask(task);
                        setIsSprintModalOpen(true);
                      }}
                    />
                  )}

                  {activeSection === "focus" && (
                    <TodayFocusView
                      tasks={tasks}
                      currentTime={currentTime}
                      onToggleComplete={handleToggleComplete}
                      onOpenStuckModal={handleOpenStuckModal}
                      onStartSprintClick={(task) => {
                        setActiveSprintTask(task);
                        setIsSprintModalOpen(true);
                      }}
                      interventionTask={interventionTask}
                      appOpensSinceComplete={appOpensSinceComplete}
                    />
                  )}

                  {activeSection === "planner" && (
                    <PlanningView
                      tasks={tasks}
                      currentTime={currentTime.toISOString()}
                      theme={theme}
                      onToggleComplete={handleToggleComplete}
                      onEditTask={(task) => {
                        setEditingTask(task);
                        setIsModalOpen(true);
                      }}
                    />
                  )}

                  {activeSection === "achievements" && (
                    <AchievementsView
                      unlockedAchievements={unlockedAchievements}
                      ALL_ACHIEVEMENTS={ALL_ACHIEVEMENTS}
                      levelTitle={levelInfo.title}
                      streak={streak}
                      tasks={tasks}
                      xp={xp}
                    />
                  )}

                  {activeSection === "stats" && (
                    <MyStatsView
                      procrastinationRoast={procrastinationRoast}
                      roastLoading={roastLoading}
                      onFetchRoast={handleFetchProcrastinationRoast}
                      tasks={tasks}
                      xp={xp}
                      streak={streak}
                      unlockedAchievements={unlockedAchievements}
                      levelTitle={levelInfo.title}
                      getAvgTimeToStart={getAvgTimeToStart}
                      getMostProcrastinatedCategory={getMostProcrastinatedCategory}
                      getProcrastinationScore={getProcrastinationScore}
                      appOpensSinceComplete={appOpensSinceComplete}
                    />
                  )}

                  {activeSection === "settings" && (
                    <SettingsView
                      geminiStatus={geminiStatus}
                      setGeminiStatus={setGeminiStatus}
                      geminiError={geminiError}
                      isAutopilotOn={isAutopilotOn}
                      onToggleAutopilot={toggleAutopilot}
                      showToast={showToast}
                      onResetApp={handleResetApp}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>



          </div>
        </main>

        {/* Footer */}
        <footer className="bg-[#16162a] border-t border-[#2a2a4a] py-6 text-center z-20">
          <div className="max-w-[1100px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#606080]">
            <span>© 2026 DeadlineOS. Built to defy procrastination under extreme pressure.</span>
            <div className="flex items-center gap-1.5 bg-[#0f0f1e] border border-[#2a2a4a] px-3 py-1.5 rounded-full shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#4285F4] animate-pulse" />
              <span className="text-[11px] font-bold text-slate-400">
                Powered by{" "}
                <span className="font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[#4285F4] via-[#9B51E0] to-[#EA4335] tracking-wide font-sans">
                  Gemini
                </span>
              </span>
            </div>
          </div>
        </footer>

      </div>

      {/* Add / Edit Task Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        initialTask={editingTask}
        theme={theme}
        activeTasks={tasks}
      />

      {/* Domino Effect Analyzer Modal */}
      <DominoAlertModal
        isOpen={isDominoModalOpen}
        onClose={() => setIsDominoModalOpen(false)}
        warningMessage={dominoWarning}
        affectedCount={dominoAffectedCount}
        comparisonList={dominoComparison}
        onApplyReshuffle={handleApplyDominoReshuffle}
        theme={theme}
      />

      {/* Stuck Assistant Modal */}
      <StuckModal
        isOpen={isStuckModalOpen}
        task={stuckTask}
        onClose={() => {
          setIsStuckModalOpen(false);
          setStuckTask(null);
        }}
        onSplit={handleSplitTask}
        currentTime={currentTime}
        theme={theme}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        isAutopilotOn={isAutopilotOn}
        onToggleAutopilot={toggleAutopilot}
        theme={theme}
      />

      {/* Focus Sprint Modal */}
      <FocusSprintModal
        isOpen={isSprintModalOpen}
        onClose={() => {
          setIsSprintModalOpen(false);
          setActiveSprintTask(null);
        }}
        task={activeSprintTask}
        onCompleteTask={handleCompleteSprintTask}
        onAwardXpOnly={handleAwardXpOnly}
        theme={theme}
        showToast={showToast}
      />

      {/* AI Negotiator De-escalation Rescue Modal */}
      <AiNegotiatorModal
        isOpen={isNegotiatorOpen}
        onClose={() => setIsNegotiatorOpen(false)}
        tasks={tasks}
        onApplyRescuePlan={handleApplyRescuePlan}
        theme={theme}
        showToast={showToast}
      />

      {/* Request Extension Drawer / Modal */}
      <AnimatePresence>
        {draftExtensionTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" id="extension-modal-overlay">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl relative ${
                theme === "dark" ? "bg-[#0c0c0e] border-white/5" : "bg-white border-slate-200"
              }`}
              id="extension-modal-card"
            >
              <button
                onClick={() => setDraftExtensionTask(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className={`text-md font-bold tracking-tight font-display ${
                      theme === "dark" ? "text-white" : "text-slate-900"
                    }`}>
                      AI Extension Apology Draft
                    </h3>
                    <p className="text-xs text-slate-500">
                      Copy and customize this professional draft to send
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    readOnly
                    value={generateExtensionDraftText(draftExtensionTask)}
                    rows={8}
                    className={`w-full p-4 rounded-xl border font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none ${
                      theme === "dark" 
                        ? "bg-[#050505] border-white/5 text-slate-300" 
                        : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                    id="extension-draft-textarea"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    onClick={() => setDraftExtensionTask(null)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                      theme === "dark" 
                        ? "border-white/5 bg-[#111114] text-slate-300 hover:bg-[#1a1a20]" 
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const text = generateExtensionDraftText(draftExtensionTask);
                      navigator.clipboard.writeText(text);
                      
                      // Increment negotiation count
                      const negCount = parseInt(localStorage.getItem("deadline_os_negotiation_count") || "0");
                      const nextNegCount = negCount + 1;
                      localStorage.setItem("deadline_os_negotiation_count", nextNegCount.toString());

                      showToast("Extension request copied to clipboard!", "success");

                      // Recheck achievements
                      checkAndUnlockAchievements(tasks, streak, xp);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-md shadow-indigo-600/10"
                    id="copy-draft-button"
                  >
                    Copy Message
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Achievements Overlay Panel */}
        {isAchievementsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl relative ${
                theme === "dark" ? "bg-[#0c0c0e] border-white/10 text-white" : "bg-white border-slate-200 text-slate-800"
              }`}
            >
              {/* Close Button */}
              <button
                onClick={() => setIsAchievementsOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-2xl">
                  🏆
                </div>
                <div>
                  <h2 className="text-lg font-bold">System Achievements</h2>
                  <p className="text-xs text-slate-400">Unlock these badges by mastering your deadlines</p>
                </div>
              </div>

              {/* Achievements Grid */}
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {ALL_ACHIEVEMENTS.map((ach) => {
                  const isUnlocked = unlockedAchievements.includes(ach.id);
                  return (
                    <div
                      key={ach.id}
                      className={`flex items-center gap-4 p-3.5 rounded-2xl border transition-all ${
                        isUnlocked
                          ? theme === "dark"
                            ? "bg-indigo-500/5 border-indigo-500/30 shadow-indigo-500/5 shadow-md"
                            : "bg-indigo-50/50 border-indigo-100 shadow-sm"
                          : theme === "dark"
                            ? "bg-slate-900/45 border-white/5 opacity-55"
                            : "bg-slate-50/50 border-slate-100 opacity-60"
                      }`}
                    >
                      <div className={`text-3xl flex items-center justify-center w-12 h-12 rounded-xl border ${
                        isUnlocked
                          ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-400/30"
                          : "bg-slate-800/30 border-dashed border-slate-700/50 grayscale"
                      }`}>
                        {ach.emoji}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-sm font-bold ${isUnlocked ? "text-indigo-400" : "text-slate-400"}`}>
                            {ach.title}
                          </h4>
                          {isUnlocked && (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-1.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-0.5">
                              <span>UNLOCKED</span>
                              <span>✓</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                          {ach.description}
                        </p>
                      </div>

                      {!isUnlocked && (
                        <div className="text-slate-600 dark:text-slate-500 pr-2">
                          <Lock className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setIsAchievementsOpen(false)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-lg shadow-indigo-600/20 transition-all"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Full-Screen Celebration Modal */}
        {celebratingAchievement && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-full max-w-md p-8 rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#16130b] to-[#0a0a0c] text-center shadow-2xl relative overflow-hidden"
            >
              {/* Radial gradient background accent */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.15)_0%,transparent_70%)] pointer-events-none" />

              {/* Animated star sparkles */}
              <div className="text-6xl mb-6 animate-bounce">
                {celebratingAchievement.emoji}
              </div>

              <span className="text-[10px] font-mono font-bold tracking-widest text-amber-500 uppercase">
                🏆 New Achievement Unlocked! 🏆
              </span>

              <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-2 mb-3 tracking-tight">
                {celebratingAchievement.title}
              </h1>

              <p className="text-sm text-slate-300 px-4 leading-relaxed mb-8">
                {celebratingAchievement.description}
              </p>

              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 mb-8 max-w-xs mx-auto">
                <p className="text-xs text-amber-400 font-bold tracking-wide">
                  ⭐ Gained Permanent Rank Prestige ⭐
                </p>
              </div>

              <button
                onClick={() => setCelebratingAchievement(null)}
                className="w-full py-3 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-xl font-bold text-sm tracking-wide shadow-xl shadow-amber-500/20 transition-all transform hover:scale-[1.02] cursor-pointer"
              >
                Triumphant Claim
              </button>
            </motion.div>
          </div>
        )}


      </AnimatePresence>
        </>
      )}

      {/* Landing Page Layer */}
      {landingActive && (
        <div className="fixed inset-0 z-50 overflow-auto bg-[#080810]">
          <LandingPage 
            onGetStarted={() => {
              setIsTransitioning(true);
              setTimeout(() => {
                changeView("auth");
                setIsTransitioning(false);
              }, 400);
            }}
            isTransitioningOut={isTransitioning}
          />
        </div>
      )}

      {/* Auth Screen Layer */}
      {authActive && (
        <div className={`fixed inset-0 z-50 overflow-auto bg-[#080810] ${isTransitioningAuth ? "animate-landing-fade-out" : "animate-app-fade-in"}`}>
          <AuthComponent
            onAuthSuccess={(email, name) => {
              setCurrentUserEmail(email);
              setCurrentUserName(name);
              setIsTransitioningAuth(true);

              const sessionRaw = localStorage.getItem("deadlineos_session");
              let isNew = false;
              if (sessionRaw) {
                try {
                  const parsed = JSON.parse(sessionRaw);
                  isNew = !!parsed.isNewUser;
                } catch {}
              }

              const nextView = isNew ? "onboarding" : "dashboard";
              changeView(nextView);

              setTimeout(() => {
                setIsTransitioningAuth(false);
              }, 400);
            }}
          />
        </div>
      )}
    </div>
  );
}
