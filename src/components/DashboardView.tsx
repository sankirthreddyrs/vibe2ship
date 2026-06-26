import React from "react";
import { Sparkles, ShieldCheck, Calendar, Circle, CheckCircle2 } from "lucide-react";
import { Task, DailyChallenge } from "../types";
import { calculateRiskScore, getRiskBadgeDetails, formatDeadline } from "../utils";
import BriefingCard from "./BriefingCard";

interface DashboardViewProps {
  levelInfo: {
    title: string;
    currentProgressXp: number;
    maxXp: number;
    minXp: number;
    percent: number;
  };
  xp: number;
  streak: number;
  tasks: Task[];
  currentTime: Date;
  briefing: string;
  briefingLoading: boolean;
  onRefreshBriefing: () => void;
  dailyChallenge: DailyChallenge | null;
  challengeLoading: boolean;
  onRefreshChallenge: () => void;
  onToggleComplete: (id: string) => void;
  currentUserName?: string | null;
  onAddNewTask: () => void;
}

const getCategoryTheme = (cat: string) => {
  switch (cat) {
    case "Study":
      return { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" };
    case "Work":
      return { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" };
    case "Personal":
      return { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" };
    case "Finance":
      return { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" };
    default:
      return { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" };
  }
};

export default function DashboardView({
  levelInfo,
  xp,
  streak,
  tasks,
  currentTime,
  briefing,
  briefingLoading,
  onRefreshBriefing,
  dailyChallenge,
  challengeLoading,
  onRefreshChallenge,
  onToggleComplete,
  currentUserName,
  onAddNewTask,
}: DashboardViewProps) {
  // Filter for active tasks due today
  const activeTasks = tasks.filter((t) => !t.completed);
  
  // Tasks done today calculation
  const completedToday = tasks.filter(
    (t) => t.completed && !t.missed
  ).length;
  const totalToday = tasks.filter((t) => !t.missed).length;
  const progressPercent = totalToday === 0 ? 0 : Math.round((completedToday / totalToday) * 100);

  // Focus tasks (active, high priority)
  const todaysFocus = tasks
    .filter((t) => !t.completed)
    .sort((a, b) => {
      const scoreA = calculateRiskScore(a, currentTime);
      const scoreB = calculateRiskScore(b, currentTime);
      return scoreB - scoreA;
    });

  const CARD_CLASS = "bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl p-5 shadow-xl transition-all duration-300";

  return (
    <div className="space-y-5 animate-fade-in" id="dashboard-view-container">
      {/* Top Row: 3 Stat Cards Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5" id="dashboard-top-stats-row">
        {/* Card 1: XP / Level */}
        <div className={CARD_CLASS} id="dashboard-xp-card">
          <span className="text-[11px] uppercase tracking-[1px] text-[#606080] block mb-1">
            {currentUserName ? `${currentUserName}'s Rank` : "Rank & Experience"}
          </span>
          <h3 className="text-[16px] font-semibold text-[#a0a0c0] mb-2">{levelInfo.title}</h3>
          <div className="space-y-2 mt-4">
            <div className="flex justify-between text-[11px] uppercase tracking-[1px] text-[#606080] font-mono">
              <span>{xp} XP Total</span>
              <span>{xp >= 5000 ? "MAX" : `${levelInfo.currentProgressXp} / ${levelInfo.maxXp - levelInfo.minXp} XP`}</span>
            </div>
            <div className="w-full bg-[#0f0f1e] rounded-full h-2 overflow-hidden border border-[#2a2a4a]">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${levelInfo.percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Streak */}
        <div className={CARD_CLASS} id="dashboard-streak-card">
          <span className="text-[11px] uppercase tracking-[1px] text-[#606080] block mb-1">Consistency Tracker</span>
          <h3 className="text-[16px] font-semibold text-[#a0a0c0] mb-2">Vigilance Streak</h3>
          <div className="flex items-center gap-4 mt-3">
            <div className="text-3xl animate-pulse">🔥</div>
            <div>
              <span className="text-[24px] font-bold text-white block leading-none">
                {streak === 0 ? "Start your streak!" : `${streak} Days`}
              </span>
              <p className="text-[14px] text-[#d0d0e8] mt-1">Days without missed tasks</p>
            </div>
          </div>
        </div>

        {/* Card 3: Tasks Done Today */}
        <div className={CARD_CLASS} id="dashboard-tasks-done-card">
          <span className="text-[11px] uppercase tracking-[1px] text-[#606080] block mb-1">Progress</span>
          <h3 className="text-[16px] font-semibold text-[#a0a0c0] mb-2">Tasks Done Today</h3>
          <div className="flex items-center justify-between gap-3 mt-3">
            <div>
              <span className="text-[24px] font-bold text-white block leading-none">
                {tasks.length === 0 ? "0 / 0" : `${completedToday} / ${totalToday}`}
              </span>
              <p className="text-[14px] text-[#d0d0e8] mt-1.5">
                {tasks.length === 0 ? "Add tasks to track progress" : "Resolved deadlines"}
              </p>
            </div>
            <div className="text-[14px] font-semibold text-white font-mono bg-[#0f0f1e] border border-[#2a2a4a] px-2.5 py-1.5 rounded-lg">
              {tasks.length === 0 ? 0 : progressPercent}%
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row: AI Daily Briefing (full width) */}
      <div className="w-full" id="dashboard-briefing-row">
        <BriefingCard
          briefing={briefing}
          isLoading={briefingLoading}
          onRefresh={onRefreshBriefing}
          theme="dark"
        />
      </div>

      {/* Bottom Row: Today's Focus (left 60%) + AI Daily Challenge (right 40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-5" id="dashboard-bottom-interactive-row">
        {/* Today's Focus (left 60% = col-span-6) */}
        <div className="lg:col-span-6 space-y-4" id="dashboard-focus-section">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[1px] text-[#606080]">Today's Focus</span>
            <span className="text-[11px] font-mono text-[#606080]">{todaysFocus.length} Urgent</span>
          </div>

          {todaysFocus.length === 0 ? (
            <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl p-6 shadow-xl text-center py-12 space-y-4" id="dashboard-focus-empty">
              <div className="text-[48px] leading-none select-none">✨</div>
              <h4 className="text-[16px] font-semibold text-white">No urgent tasks yet</h4>
              <p className="text-[13px] text-[#8888aa]">Add your first deadline to get started</p>
              <button
                onClick={onAddNewTask}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs shadow-md shadow-purple-900/20 transition-all cursor-pointer"
              >
                + Add Your First Task
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="dashboard-focus-grid">
              {todaysFocus.slice(0, 4).map((task) => {
                const score = calculateRiskScore(task, currentTime);
                const risk = getRiskBadgeDetails(score, task.completed);
                const catInfo = getCategoryTheme(task.category);

                return (
                  <div
                    key={`dash-focus-${task.id}`}
                    className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl p-4 flex flex-col justify-between h-40 relative group overflow-hidden hover:border-indigo-500/40 transition-all duration-300"
                    id={`task-card-dash-${task.id}`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${catInfo.bg} ${catInfo.text} ${catInfo.border}`}>
                          {task.category}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${risk.bg} ${risk.text} ${risk.border}`}>
                          {score}%
                        </span>
                      </div>
                      <h4 className="text-[14px] font-semibold text-white line-clamp-2 leading-snug group-hover:text-indigo-400 transition-all">
                        {task.title}
                      </h4>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[#2a2a4a]/40">
                      <span className="text-[11px] text-[#a0a0c0] font-mono flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDeadline(task.deadline, currentTime)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onToggleComplete(task.id)}
                          className="p-1 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                          title="Complete Task"
                        >
                          <Circle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Daily Challenge (right 40% = col-span-4) */}
        <div className="lg:col-span-4" id="dashboard-challenge-section">
          <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl p-5 shadow-xl h-full flex flex-col justify-between" id="dashboard-challenge-card">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] uppercase tracking-[1px] text-[#606080]">Intelligence Target</span>
                <span className="text-[10px] font-mono text-indigo-400 font-semibold uppercase tracking-wider">AI Challenge</span>
              </div>

              {tasks.length === 0 ? (
                <div className="py-8 text-center text-[#8888aa] text-sm leading-relaxed" id="dashboard-challenge-empty-state">
                  Add at least 1 task to unlock your daily challenge!
                </div>
              ) : challengeLoading ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-500 border-t-transparent" />
                  <span className="text-xs text-slate-400 font-mono">Formulating daily goal...</span>
                </div>
              ) : dailyChallenge ? (
                <div className="space-y-3">
                  <p className="text-[14px] text-[#d0d0e8] leading-relaxed italic">
                    "{dailyChallenge.text}"
                  </p>
                </div>
              ) : (
                <p className="text-[14px] text-slate-400">No active challenge.</p>
              )}
            </div>

            {tasks.length > 0 && dailyChallenge && !challengeLoading && (
              <div className="pt-4 border-t border-[#2a2a4a]/40 mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#606080] uppercase tracking-[1px]">Progress</span>
                  <span className="text-[14px] font-bold text-white font-mono">
                    {dailyChallenge.currentValue || 0} / {dailyChallenge.targetValue}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  {dailyChallenge.completed ? (
                    <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md flex items-center gap-1">
                      <span>RESOLVED ✅</span>
                    </span>
                  ) : (
                    <>
                      <span className="text-xs text-amber-400 font-bold font-mono">
                        +{dailyChallenge.bonusXp} XP BONUS
                      </span>
                      <button
                        onClick={onRefreshChallenge}
                        className="text-xs text-[#a0a0c0] hover:text-white flex items-center gap-1 bg-[#0f0f1e] border border-[#2a2a4a] px-2 py-1 rounded cursor-pointer"
                        title="Reroll challenge"
                      >
                        🔄 Reroll
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
