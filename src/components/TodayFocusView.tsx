import React from "react";
import { Play, CheckCircle2, Circle, Calendar, ShieldCheck, AlertTriangle, Brain } from "lucide-react";
import { Task } from "../types";
import { calculateRiskScore, getRiskBadgeDetails, formatDeadline } from "../utils";

interface TodayFocusViewProps {
  tasks: Task[];
  currentTime: Date;
  onToggleComplete: (id: string) => void;
  onOpenStuckModal: (task: Task) => void;
  onStartSprintClick: (task: Task) => void;
  interventionTask: Task | null;
  appOpensSinceComplete: number;
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

export default function TodayFocusView({
  tasks,
  currentTime,
  onToggleComplete,
  onOpenStuckModal,
  onStartSprintClick,
  interventionTask,
  appOpensSinceComplete,
}: TodayFocusViewProps) {
  
  // Urgent/high priority tasks first
  const todaysFocus = tasks
    .filter((t) => !t.completed)
    .sort((a, b) => {
      const scoreA = calculateRiskScore(a, currentTime);
      const scoreB = calculateRiskScore(b, currentTime);
      return scoreB - scoreA;
    });

  return (
    <div className="space-y-5 animate-fade-in" id="todayfocus-view-container">
      <div>
        <h2 className="text-[24px] font-bold text-white tracking-tight">Today's Focus Control</h2>
        <p className="text-[14px] text-[#d0d0e8]">Eliminate noise. Start high-yield focused work sprints and conquer risk.</p>
      </div>

      {/* Gentle Intervention Banner inside Focus View */}
      {interventionTask && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4" id="watchdog-intervention-banner">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[14px] font-semibold text-amber-200">Anti-Procrastination Watchdog</h4>
              <p className="text-xs text-amber-300/80 mt-1 leading-relaxed">
                Hey, you've opened DeadlineOS <span className="font-bold underline">{appOpensSinceComplete}</span> times today without resolving any milestones.
                Let's build momentum on <span className="font-bold underline">"{interventionTask.title}"</span>. I can break it into small, micro steps right now!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenStuckModal(interventionTask)}
              className="bg-amber-500 text-black px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-400 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              id="watchdog-stuck-breakdown-btn"
            >
              <Brain className="w-3.5 h-3.5" />
              Break it down!
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Today's Focus List (col-span-7) */}
        <div className="lg:col-span-7 space-y-4" id="todayfocus-list-col">
          <h3 className="text-[16px] font-semibold text-[#a0a0c0]">Active High-Risk Deadlines</h3>
          {todaysFocus.length === 0 ? (
            <div className="bg-[#121224]/30 border border-[#2a2a4a]/25 rounded-2xl p-8 text-center py-16 space-y-3.5 shadow-none" id="todayfocus-empty-state">
              <div className="text-[48px] leading-none select-none">🎯</div>
              <h4 className="text-[16px] font-bold text-white tracking-tight">Nothing due today</h4>
              <p className="text-xs text-[#8888aa] max-w-sm mx-auto leading-relaxed">
                Enjoy the calm — or get ahead by adding tomorrow's tasks
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {todaysFocus.map((task) => {
                const score = calculateRiskScore(task, currentTime);
                const risk = getRiskBadgeDetails(score, task.completed);
                const catInfo = getCategoryTheme(task.category);

                return (
                  <div key={`focus-detail-${task.id}`} className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl p-5 shadow-xl flex items-center justify-between gap-4" id={`focus-item-detail-${task.id}`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${catInfo.bg} ${catInfo.text} ${catInfo.border}`}>
                          {task.category}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${risk.bg} ${risk.text} ${risk.border}`}>
                          Risk Score: {score}%
                        </span>
                      </div>
                      <h4 className="text-[16px] font-semibold text-white">{task.title}</h4>
                      <p className="text-xs text-slate-400">Due {formatDeadline(task.deadline, currentTime)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onStartSprintClick(task)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/15 cursor-pointer"
                        id={`start-sprint-btn-${task.id}`}
                      >
                        <Play className="w-3 h-3 text-white fill-white" />
                        Start Sprint
                      </button>
                      <button
                        onClick={() => onToggleComplete(task.id)}
                        className="p-2 text-[#606080] hover:text-emerald-400 hover:bg-[#0f0f1e] rounded-xl border border-transparent hover:border-[#2a2a4a] cursor-pointer"
                      >
                        <Circle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Focus Sprint Dashboard Card (col-span-5) */}
        <div className="lg:col-span-5 space-y-4" id="todayfocus-utility-col">
          <h3 className="text-[16px] font-semibold text-[#a0a0c0]">Focused Sprint Utility</h3>
          <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl p-5 shadow-xl space-y-4" id="todayfocus-utility-card">
            <span className="text-[11px] uppercase tracking-[1px] text-[#606080]">Time Boxing Engine</span>
            <h4 className="text-[16px] font-semibold text-white">Pomodoro Sprints</h4>
            <p className="text-[14px] text-[#d0d0e8] leading-relaxed">
              Unlock high-efficiency mental flow. Time-boxing deadlines forces immediate resolution and rewards massive XP boosts.
            </p>
            <button
              onClick={() => {
                if (todaysFocus.length > 0) {
                  onStartSprintClick(todaysFocus[0]);
                }
              }}
              disabled={todaysFocus.length === 0}
              className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer ${
                todaysFocus.length === 0
                  ? "bg-slate-800 border border-[#2a2a4a]/40 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white hover:opacity-95"
              }`}
              id="todayfocus-launch-sprint-btn"
            >
              <Play className="w-4 h-4 text-white fill-white animate-pulse" />
              <span>Launch Priority Sprint</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
