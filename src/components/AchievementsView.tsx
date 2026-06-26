import React, { useMemo } from "react";
import { Lock, Trophy, Sparkles, CheckCircle2, ChevronRight, Award } from "lucide-react";
import { Achievement, Task } from "../types";

interface AchievementsViewProps {
  unlockedAchievements: string[];
  ALL_ACHIEVEMENTS: Achievement[];
  levelTitle: string;
  streak: number;
  tasks: Task[];
  xp: number;
}

export default function AchievementsView({
  unlockedAchievements,
  ALL_ACHIEVEMENTS,
  levelTitle,
  streak,
  tasks,
  xp,
}: AchievementsViewProps) {

  // Helper to compute actual progress for any given achievement ID
  const getAchievementProgress = (id: string): { current: number; target: number; label: string } => {
    switch (id) {
      case "early_bird": {
        const earlyCompletedCount = tasks.filter(t => {
          if (!t.completed || !t.completedAt) return false;
          const dMs = new Date(t.deadline).getTime();
          const cMs = new Date(t.completedAt).getTime();
          return dMs - cMs >= 24 * 60 * 60 * 1000;
        }).length;
        return { current: earlyCompletedCount, target: 5, label: "early completed tasks" };
      }
      
      case "fire_streak":
        return { current: streak, target: 7, label: "days streak" };
        
      case "comeback_kid": {
        const missedDeadlines = tasks.filter(t => t.missed && t.missedAt);
        let completedAfterLastMissed = 0;
        if (missedDeadlines.length > 0) {
          const lastMissed = missedDeadlines.sort(
            (a, b) => new Date(b.missedAt!).getTime() - new Date(a.missedAt!).getTime()
          )[0];
          completedAfterLastMissed = tasks.filter(t => {
            if (!t.completed || !t.completedAt) return false;
            return new Date(t.completedAt).getTime() > new Date(lastMissed.missedAt!).getTime();
          }).length;
        }
        return { current: completedAfterLastMissed, target: 3, label: "recovery tasks done" };
      }
      
      case "zero_miss_week": {
        // Tied to maintaining a streak without missed tasks
        return { current: Math.min(7, streak), target: 7, label: "days flawless" };
      }
      
      case "speed_runner": {
        const hasSpeedRun = tasks.some(t => {
          if (!t.completed || !t.completedAt) return false;
          return new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime() <= 60 * 60 * 1000;
        });
        return { current: hasSpeedRun ? 1 : 0, target: 1, label: "tasks speed-run" };
      }
      
      case "pro_planner":
        return { current: tasks.length, target: 10, label: "tasks in backlog" };
        
      case "focus_legend": {
        const sprintsCount = parseInt(localStorage.getItem("deadline_os_completed_sprints") || "0");
        return { current: sprintsCount, target: 5, label: "focus sprints" };
      }
      
      case "domino_defier": {
        const completedHighRiskCount = tasks.filter(t => {
          if (!t.completed) return false;
          // Simple estimate of risk score at creation:
          const hoursLimit = t.estimatedHours || 1;
          const dMs = new Date(t.deadline).getTime();
          const crMs = new Date(t.createdAt).getTime();
          const totalAvailableHours = (dMs - crMs) / (1000 * 60 * 60);
          const ratio = totalAvailableHours > 0 ? hoursLimit / totalAvailableHours : 1;
          return Math.min(100, Math.round(ratio * 100)) >= 80;
        }).length;
        return { current: completedHighRiskCount, target: 3, label: "crisis-level rescues" };
      }
      
      case "elite_level":
        return { current: xp, target: 1000, label: "XP accumulated" };
        
      case "negotiation_master": {
        const negCount = parseInt(localStorage.getItem("deadline_os_negotiation_count") || "0");
        return { current: negCount, target: 3, label: "negotiations applied" };
      }
      
      default:
        return { current: 0, target: 1, label: "" };
    }
  };

  const unlockedCount = unlockedAchievements.length;
  const totalCount = ALL_ACHIEVEMENTS.length || 10;

  return (
    <div className="space-y-6 animate-fade-in" id="achievements-view-container">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500 animate-bounce" />
            Your Badges
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {unlockedCount} / {totalCount} Unlocked &bull; Current Level: <span className="text-indigo-400 font-bold">{levelTitle}</span>
          </p>
        </div>
        
        {/* Progress stat block */}
        <div className="bg-[#11111e]/80 border border-slate-800 px-4 py-2.5 rounded-xl text-xs font-bold text-white font-mono flex flex-col justify-center shrink-0 min-w-[140px]">
          <div className="flex justify-between mb-1.5">
            <span className="text-slate-400">Completion</span>
            <span className="text-indigo-400">{Math.round((unlockedCount / totalCount) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
            <div 
              className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
              style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Empty state banner when no achievements are unlocked */}
      {unlockedCount === 0 && (
        <div className="bg-[#1c1c38]/40 border border-indigo-500/20 rounded-2xl p-5 flex items-center gap-4 text-indigo-200 text-sm animate-fade-in shadow-lg shadow-indigo-950/10" id="achievements-empty-banner">
          <div className="p-2.5 bg-indigo-600/10 border border-indigo-500/30 rounded-xl">
            <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-white tracking-tight text-[15px]">Locked Achievements</h4>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Your journey starts now. Complete tasks to earn badges.
            </p>
          </div>
        </div>
      )}

      {/* 2-COLUMN GRID OF ACHIEVEMENT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="achievements-grid">
        {ALL_ACHIEVEMENTS.map((ach) => {
          const isUnlocked = unlockedAchievements.includes(ach.id);
          const prog = getAchievementProgress(ach.id);
          const progressPercent = Math.min(100, Math.round((prog.current / prog.target) * 100));

          return (
            <div
              key={ach.id}
              className={`relative bg-[#11111e]/90 border rounded-2xl p-5 shadow-xl transition-all duration-300 flex flex-col justify-between ${
                isUnlocked 
                  ? "border-emerald-500/30 hover:border-emerald-500/50 shadow-emerald-950/10 hover:shadow-emerald-500/5" 
                  : "border-slate-800 hover:border-slate-700 shadow-black/30"
              }`}
              id={`achievement-card-${ach.id}`}
            >
              <div className="flex gap-4">
                {/* 64px Emoji Icon */}
                <div 
                  className={`w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center text-4xl border select-none ${
                    isUnlocked
                      ? "bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border-indigo-500/30 shadow-lg shadow-indigo-500/5"
                      : "bg-slate-900/60 border-slate-800/80 grayscale opacity-45"
                  }`}
                >
                  {ach.emoji}
                </div>

                {/* Info Text */}
                <div className="flex-1 min-w-0 pr-12">
                  <div className="flex items-start gap-1.5 flex-wrap">
                    <h4 className={`text-base font-bold tracking-tight ${isUnlocked ? "text-indigo-300" : "text-slate-400"}`}>
                      {ach.title}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {ach.description}
                  </p>
                </div>
              </div>

              {/* Progress and Reward Area */}
              <div className="mt-5 pt-3 border-t border-slate-800/40 flex items-center justify-between">
                
                {/* Progress bar or Unlocked badge */}
                <div className="flex-1 max-w-[65%] pr-4">
                  {isUnlocked ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/25">
                      UNLOCKED ✓
                    </span>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold font-mono">
                        <span className="text-slate-500 capitalize">{prog.label || "progress"}</span>
                        <span className="text-slate-400">{prog.current} / {prog.target}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-950/80 overflow-hidden border border-slate-900">
                        <div 
                          className="h-full bg-slate-500 rounded-full transition-all duration-500" 
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* XP Reward (Bottom Right) & Lock Indicator */}
                <div className="flex items-center gap-3 shrink-0 text-right">
                  {ach.xpReward && (
                    <div className="font-mono text-xs font-black">
                      <span className={isUnlocked ? "text-emerald-400" : "text-slate-500"}>
                        +{ach.xpReward} XP
                      </span>
                    </div>
                  )}

                  {!isUnlocked && (
                    <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-500" title="Locked">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
