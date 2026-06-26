import React, { useState, useEffect, useMemo } from "react";
import { 
  Calendar, Clock, Sparkles, AlertCircle, ChevronLeft, ChevronRight, 
  Layers, CheckCircle2, AlertTriangle, ArrowRight, Flame, Hourglass, Activity, Play, X
} from "lucide-react";
import { Task, TaskCategory } from "../types";
import { calculateRiskScore, formatDeadline, getRiskBadgeDetails } from "../utils";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch as fetch } from "../utils/api";

interface PlanningViewProps {
  tasks: Task[];
  currentTime: string;
  theme: string;
  onToggleComplete: (id: string) => void;
  onEditTask: (task: Task) => void;
  onStartSprintClick?: (task: Task) => void;
}

type TabType = "Today" | "This Week" | "This Month";

export default function PlanningView({
  tasks,
  currentTime,
  theme,
  onToggleComplete,
  onEditTask,
  onStartSprintClick
}: PlanningViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("Today");
  const [insight, setInsight] = useState<string>("");
  const [isInsightLoading, setIsInsightLoading] = useState<boolean>(false);
  
  // Month view states
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    return currentTime ? new Date(currentTime) : new Date();
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  
  // Week view states
  const [expandedWeekDay, setExpandedWeekDay] = useState<number | null>(null);

  const isDark = theme === "dark";
  const refDate = useMemo(() => currentTime ? new Date(currentTime) : new Date(), [currentTime]);
  const aiTone = useMemo(() => localStorage.getItem("deadline_os_ai_tone") || "balanced", []);

  // Fetch planning insight when tasks, current time or active tab changes
  useEffect(() => {
    const fetchInsight = async () => {
      setIsInsightLoading(true);
      try {
        const res = await fetch("/api/planning-insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            tasks, 
            currentTime,
            period: activeTab,
            aiTone 
          })
        });
        if (res.ok) {
          const data = await res.json();
          setInsight(data.insight);
        } else {
          setInsight("Prioritize tasks with higher risk scores to optimize your schedule.");
        }
      } catch (err) {
        setInsight("Unable to load live advice. Rely on risk scores and estimated hours to allocate your energy.");
      } finally {
        setIsInsightLoading(false);
      }
    };

    fetchInsight();
  }, [tasks, currentTime, activeTab, aiTone]);

  // Helper to format remaining time
  const getTimeRemainingText = (deadlineStr: string) => {
    const diffMs = new Date(deadlineStr).getTime() - refDate.getTime();
    const isOverdue = diffMs < 0;
    const absMs = Math.abs(diffMs);
    const hours = Math.floor(absMs / (1000 * 60 * 60));
    const minutes = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (isOverdue) {
      if (hours === 0) return `Overdue by ${minutes}m`;
      return `Overdue by ${hours}h ${minutes}m`;
    } else {
      if (hours === 0) return `${minutes}m remaining`;
      return `${hours}h ${minutes}m remaining`;
    }
  };

  // Helper to check past date status
  const getPastDateStatus = (date: Date, cellTasks: Task[]) => {
    const today = new Date(refDate);
    today.setHours(0, 0, 0, 0);
    const cell = new Date(date);
    cell.setHours(0, 0, 0, 0);

    const isPast = cell.getTime() < today.getTime();
    if (!isPast || cellTasks.length === 0) return null;

    const allComplete = cellTasks.every(t => t.completed);
    return allComplete ? "complete" : "missed";
  };

  // ==========================================
  // TODAY TAB CALCULATIONS
  // ==========================================
  const todayTasks = useMemo(() => {
    const todayDateStr = refDate.toDateString();
    return tasks.filter(t => {
      if (!t.deadline) return false;
      return new Date(t.deadline).toDateString() === todayDateStr;
    }).sort((a, b) => {
      const aScore = calculateRiskScore(a, refDate);
      const bScore = calculateRiskScore(b, refDate);
      return bScore - aScore;
    });
  }, [tasks, refDate]);

  // Generate hourly schedule suggestion starting from current hour
  const timelineSlots = useMemo(() => {
    const startHour = refDate.getHours();
    const slots = [];
    let taskIdx = 0;
    let currentTaskAllocatedHours = 0;
    let nextIsBuffer = false;

    const activeTodayTasks = todayTasks.filter(t => !t.completed && !t.missed);

    for (let h = startHour; h <= 23; h++) {
      const ampm = h >= 12 ? "PM" : "AM";
      const displayHour = h % 12 === 0 ? 12 : h % 12;
      const timeLabel = `${displayHour}:00 ${ampm}`;

      let type: "work" | "buffer" | "empty" = "empty";
      let associatedTask: Task | null = null;

      if (nextIsBuffer) {
        type = "buffer";
        nextIsBuffer = false;
      } else if (taskIdx < activeTodayTasks.length) {
        const currentTask = activeTodayTasks[taskIdx];
        const est = currentTask.estimatedHours || 1;
        
        type = "work";
        associatedTask = currentTask;
        currentTaskAllocatedHours++;

        if (currentTaskAllocatedHours >= est) {
          taskIdx++;
          currentTaskAllocatedHours = 0;
          nextIsBuffer = true;
        }
      }

      slots.push({
        hour: h,
        timeLabel,
        type,
        task: associatedTask
      });
    }
    return slots;
  }, [todayTasks, refDate]);

  // ==========================================
  // WEEK TAB CALCULATIONS
  // ==========================================
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  
  const weekDates = useMemo(() => {
    const day = refDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const diffToMonday = refDate.getDate() - day + (day === 0 ? -6 : 1);
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth(), diffToMonday + i);
      dates.push(d);
    }
    return dates;
  }, [refDate]);

  const weeklyData = useMemo(() => {
    return weekDates.map((date, idx) => {
      const dateStr = date.toDateString();
      const dayTasks = tasks.filter(t => t.deadline && new Date(t.deadline).toDateString() === dateStr);
      const totalHours = dayTasks.reduce((sum, t) => sum + (t.estimatedHours || 1), 0);
      
      let loadStatus: "light" | "moderate" | "overloaded" = "light";
      let loadBarColor = "bg-emerald-500";
      let loadText = "Light Load";
      let loadPercentage = 25;

      if (totalHours > 0) {
        if (totalHours <= 3) {
          loadStatus = "light";
          loadBarColor = "bg-emerald-500";
          loadText = "Light Load";
          loadPercentage = Math.min(100, (totalHours / 8) * 100);
        } else if (totalHours <= 6) {
          loadStatus = "moderate";
          loadBarColor = "bg-amber-500";
          loadText = "Moderate Load";
          loadPercentage = Math.min(100, (totalHours / 8) * 100);
        } else {
          loadStatus = "overloaded";
          loadBarColor = "bg-rose-500";
          loadText = "Overloaded";
          loadPercentage = 100;
        }
      } else {
        loadPercentage = 0;
        loadText = "No Tasks";
      }

      return {
        dayName: weekdays[idx],
        date,
        tasks: dayTasks,
        totalHours,
        loadStatus,
        loadBarColor,
        loadText,
        loadPercentage
      };
    });
  }, [weekDates, tasks]);

  // ==========================================
  // MONTH TAB CALCULATIONS
  // ==========================================
  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  const calendarDays35 = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay(); // 0 = Sun, 6 = Sat
    
    const grid = [];
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDayOfWeek); // Move back to Sunday
    
    // Create exactly 35 cells (5 rows x 7 columns)
    for (let i = 0; i < 35; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      
      const cellTasks = tasks.filter(t => t.deadline && new Date(t.deadline).toDateString() === d.toDateString());
      const pastStatus = getPastDateStatus(d, cellTasks);

      grid.push({
        date: d,
        dayNumber: d.getDate(),
        isCurrentMonth: d.getMonth() === month,
        tasks: cellTasks,
        pastStatus
      });
    }
    return grid;
  }, [currentMonthDate, tasks, refDate]);

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
    setSelectedCalendarDate(null);
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));
    setSelectedCalendarDate(null);
  };

  return (
    <div 
      className={`border rounded-2xl p-6 shadow-xl space-y-6 transition-all duration-300 ${
        isDark ? "border-white/5 bg-[#0a0a0c]" : "border-slate-200 bg-white"
      }`} 
      id="planning-view-module"
    >
      {/* 1. TOP TAB SWITCHER */}
      <div className="flex flex-col items-center justify-center space-y-2">
        <div className="flex justify-center border-b border-slate-200 dark:border-white/5 pb-px w-full max-w-lg">
          <div className="flex gap-2">
            {(["Today", "This Week", "This Month"] as TabType[]).map((tab) => {
              const isSelected = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative w-[140px] py-3 text-sm font-semibold transition-all cursor-pointer text-center ${
                    isSelected
                      ? "text-purple-600 dark:text-purple-400 font-bold"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                  id={`planner-tab-${tab.toLowerCase().replace(" ", "-")}`}
                >
                  {tab}
                  {isSelected && (
                    <motion.div
                      layoutId="plannerUnderline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <p className={`text-xs text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}>
          Dynamic workload projection & deadline schedule
        </p>
      </div>

      {/* 2. TAB CONTENT FRAMES */}
      <div className="relative overflow-hidden min-h-[350px]" id="planning-tab-content-frame">
        <AnimatePresence mode="wait">
          {activeTab === "Today" && (
            <motion.div
              key="today"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col md:flex-row gap-6"
              id="planning-today-content"
            >
              {/* Left Panel (55%): List of today's tasks */}
              <div className="w-full md:w-[55%] space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    Today's Deadlines (Sorted by Risk Score)
                  </h4>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${isDark ? "bg-white/5 text-slate-400" : "bg-slate-100 text-slate-600"}`}>
                    {todayTasks.length} Task{todayTasks.length === 1 ? "" : "s"}
                  </span>
                </div>

                {todayTasks.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center p-12 rounded-2xl border border-dashed text-center space-y-3 ${
                    isDark ? "border-white/5 bg-[#050505]/40 text-slate-400" : "border-slate-200 bg-slate-50/50 text-slate-500"
                  }`}>
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <h5 className="text-xs font-bold uppercase tracking-wider">No immediate pressure</h5>
                    <p className="text-xs max-w-sm leading-relaxed">
                      You have no outstanding deadlines scheduled for today. Enjoy the clear slate or draft future goals.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
                    {todayTasks.map((task) => {
                      const score = calculateRiskScore(task, refDate);
                      const badge = getRiskBadgeDetails(score, task.completed);
                      const timeRemaining = getTimeRemainingText(task.deadline);
                      
                      return (
                        <div 
                          key={task.id}
                          className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                            isDark ? "bg-[#111114] border-white/5 hover:border-white/10" : "bg-slate-50 border-slate-200/60 hover:bg-slate-100/40"
                          }`}
                        >
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <h5 className={`text-sm font-bold truncate ${task.completed ? "line-through text-slate-500" : isDark ? "text-white" : "text-slate-900"}`}>
                                {task.title}
                              </h5>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isDark ? "bg-[#18181b] text-slate-400" : "bg-white text-slate-500"} border dark:border-white/5`}>
                                {task.category}
                              </span>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                              <span className={`flex items-center gap-1 font-semibold ${task.completed ? "text-slate-500" : "text-purple-500 dark:text-purple-400"}`}>
                                <Clock className="w-3.5 h-3.5" />
                                {timeRemaining}
                              </span>
                              <span>•</span>
                              <span>Est: {task.estimatedHours}h</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                              {score}% Risk
                            </span>
                            
                            {!task.completed && (
                              <button
                                onClick={() => onStartSprintClick?.(task)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-extrabold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-md transition-all cursor-pointer active:scale-95"
                                title="Start Focus Sprint"
                              >
                                <Flame className="w-3.5 h-3.5" />
                                Sprint
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Panel (45%): Hourly timeline */}
              <div className="w-full md:w-[45%] space-y-4">
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Hourly Work Projection
                </h4>
                
                <div className={`p-4 rounded-2xl border space-y-4 max-h-[420px] overflow-y-auto custom-scrollbar ${
                  isDark ? "bg-[#111114] border-white/5" : "bg-slate-50 border-slate-200/80"
                }`}>
                  {timelineSlots.map((slot, index) => {
                    return (
                      <div key={index} className="flex items-start gap-3">
                        <span className="text-[10px] font-bold font-mono text-slate-500 w-16 shrink-0 mt-1">
                          {slot.timeLabel}
                        </span>
                        
                        <div className="relative flex-1">
                          {/* Vertical Connector Line */}
                          {index < timelineSlots.length - 1 && (
                            <div className={`absolute left-4 top-8 bottom-0 w-0.5 ${
                              slot.type === "work" 
                                ? "bg-purple-500/20" 
                                : slot.type === "buffer"
                                  ? "bg-slate-400/20"
                                  : "border-l-2 border-dashed border-slate-200 dark:border-white/5"
                            }`} />
                          )}
                          
                          {slot.type === "work" && slot.task ? (
                            <div className={`flex items-center gap-2.5 rounded-xl p-2.5 border transition-all ${
                              isDark 
                                ? "bg-purple-500/10 border-purple-500/25 text-white" 
                                : "bg-purple-50 border-purple-200 text-purple-900 shadow-sm"
                            }`}>
                              <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                                <Flame className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">{slot.task.title}</p>
                                <p className="text-[10px] opacity-75">{slot.task.category} • Work block</p>
                              </div>
                            </div>
                          ) : slot.type === "buffer" ? (
                            <div className={`flex items-center gap-2.5 rounded-xl p-2.5 border transition-all ${
                              isDark 
                                ? "bg-slate-500/5 border-slate-500/10 text-slate-400" 
                                : "bg-slate-100/50 border-slate-200 text-slate-500 shadow-sm"
                            }`}>
                              <div className="w-8 h-8 rounded-full bg-slate-500/10 text-slate-400 flex items-center justify-center shrink-0">
                                <Clock className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold">Buffer Time</p>
                                <p className="text-[10px] opacity-75">Recharging window / Sync offset</p>
                              </div>
                            </div>
                          ) : (
                            <div className={`flex items-center gap-2.5 rounded-xl p-2.5 border border-dashed transition-all ${
                              isDark 
                                ? "border-white/5 text-slate-600 bg-transparent" 
                                : "border-slate-200 text-slate-400 bg-transparent"
                            }`}>
                              <div className="w-8 h-8 rounded-full border border-dashed border-slate-300 dark:border-white/10 text-slate-400 flex items-center justify-center shrink-0">
                                <Activity className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold">Empty Hours</p>
                                <p className="text-[10px] opacity-75">No schedule allocated</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "This Week" && (
            <motion.div
              key="week"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
              id="planning-week-content"
            >
              <div className="flex items-center justify-between">
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  7-Day Calendar Grid
                </h4>
                <span className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  Mon {weekDates[0].toLocaleDateString([], { month: "short", day: "numeric" })} - Sun {weekDates[6].toLocaleDateString([], { month: "short", day: "numeric" })}
                </span>
              </div>

              {/* 7 Column Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
                {weeklyData.map((day, idx) => {
                  const isCurrentDay = day.date.toDateString() === refDate.toDateString();
                  const isExpanded = expandedWeekDay === idx;

                  return (
                    <div 
                      key={day.dayName}
                      onClick={() => setExpandedWeekDay(isExpanded ? null : idx)}
                      className={`p-3 rounded-2xl border flex flex-col justify-between gap-3 relative transition-all cursor-pointer select-none ${
                        isCurrentDay 
                          ? "border-purple-500 dark:border-purple-400 bg-purple-500/5 shadow-md shadow-purple-500/5"
                          : isDark ? "bg-[#111114] border-white/5 hover:border-white/20" : "bg-slate-50 border-slate-200/60 hover:bg-slate-100/50"
                      }`}
                    >
                      {isCurrentDay && (
                        <span className="absolute top-1 right-2 text-[8px] font-extrabold uppercase text-purple-500 dark:text-purple-400">
                          Today
                        </span>
                      )}

                      <div className="space-y-1">
                        <span className={`text-[11px] font-extrabold ${
                          isCurrentDay ? "text-purple-500 dark:text-purple-400" : isDark ? "text-slate-400" : "text-slate-800"
                        }`}>
                          {day.dayName.substring(0, 3)}
                        </span>
                        
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>{day.tasks.length} task{day.tasks.length === 1 ? "" : "s"}</span>
                          <span>{day.totalHours}h</span>
                        </div>
                      </div>

                      {/* Colored Risk Dots */}
                      <div className="flex gap-1 py-1 min-h-[12px]">
                        {day.tasks.map((task) => {
                          const score = calculateRiskScore(task, refDate);
                          let dotColor = "bg-emerald-500";
                          if (score >= 75) dotColor = "bg-rose-500";
                          else if (score >= 40) dotColor = "bg-amber-500";

                          return (
                            <span 
                              key={task.id} 
                              className={`w-2.5 h-2.5 rounded-full ${dotColor}`} 
                              title={`${task.title} (${score}% Risk)`}
                            />
                          );
                        })}
                      </div>

                      {/* Expand / Collapse Indicator */}
                      <span className={`text-[9px] font-semibold text-center uppercase ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                        {isExpanded ? "Collapse" : "Expand"}
                      </span>

                      {/* Animated Task Names Drawer */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t border-slate-200/50 dark:border-white/5 pt-2 space-y-1.5"
                          >
                            {day.tasks.length === 0 ? (
                              <p className="text-[10px] text-slate-500 italic">No tasks due</p>
                            ) : (
                              day.tasks.map((task) => (
                                <div 
                                  key={task.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditTask(task);
                                  }}
                                  className="text-[10px] font-medium truncate py-1 px-1.5 rounded dark:bg-[#050505] bg-white border dark:border-white/5 border-slate-200 hover:border-purple-500/40 hover:text-purple-500 cursor-pointer"
                                >
                                  {task.title}
                                </div>
                              ))
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              {/* Below Grid: Horizontal Load Bars */}
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/5">
                <h5 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Daily Workload Balancer
                </h5>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {weeklyData.map((day) => {
                    return (
                      <div 
                        key={day.dayName}
                        className={`p-3 rounded-xl border flex flex-col gap-2 ${
                          isDark ? "bg-[#111114] border-white/5" : "bg-slate-50 border-slate-200/60"
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{day.dayName}</span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            day.loadStatus === "overloaded" 
                              ? "bg-rose-500/10 text-rose-500" 
                              : day.loadStatus === "moderate" 
                                ? "bg-amber-500/10 text-amber-500" 
                                : "bg-emerald-500/10 text-emerald-500"
                          }`}>
                            {day.loadText} • {day.totalHours}h
                          </span>
                        </div>
                        
                        <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? "bg-white/5" : "bg-slate-200"}`}>
                          <div 
                            className={`h-full rounded-full ${day.loadBarColor} transition-all duration-300`}
                            style={{ width: `${day.loadPercentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "This Month" && (
            <motion.div
              key="month"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
              id="planning-month-content"
            >
              {/* Calendar header with controls */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/5">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-purple-500" />
                  Monthly Timeline Calendar (5 Rows × 7 Columns)
                </span>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handlePrevMonth}
                    className={`p-1.5 border rounded-lg transition-all cursor-pointer ${
                      isDark ? "border-white/5 bg-[#111114] text-slate-400 hover:text-white" : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className={`text-xs font-bold w-28 text-center ${isDark ? "text-white" : "text-slate-900"}`}>
                    {monthNames[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}
                  </span>
                  <button 
                    onClick={handleNextMonth}
                    className={`p-1.5 border rounded-lg transition-all cursor-pointer ${
                      isDark ? "border-white/5 bg-[#111114] text-slate-400 hover:text-white" : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Grid Weekday Labels */}
              <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 pb-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                  <div key={d} className="py-1">{d}</div>
                ))}
              </div>

              {/* 5x7 Calendar Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {calendarDays35.map((cell, idx) => {
                  const isSelected = selectedCalendarDate?.toDateString() === cell.date.toDateString();
                  const isToday = cell.date.toDateString() === refDate.toDateString();
                  
                  // Past styling
                  let tintClass = "";
                  if (cell.pastStatus === "missed") {
                    tintClass = "bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/20";
                  } else if (cell.pastStatus === "complete") {
                    tintClass = "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20";
                  } else {
                    tintClass = cell.isCurrentMonth
                      ? (isDark ? "bg-[#111114] border-white/5 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-800")
                      : (isDark ? "bg-transparent border-transparent text-slate-600 opacity-25" : "bg-transparent border-transparent text-slate-300");
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedCalendarDate(cell.date)}
                      className={`aspect-square p-2 rounded-xl border flex flex-col justify-between transition-all relative cursor-pointer ${
                        isSelected 
                          ? "border-purple-500 bg-purple-500/15 ring-2 ring-purple-500/20 z-10 scale-105" 
                          : isToday
                            ? "border-purple-400 ring-1 ring-purple-400/25"
                            : "hover:border-slate-300 dark:hover:border-white/20"
                      } ${tintClass}`}
                    >
                      <span className="text-[11px] font-mono font-bold">{cell.dayNumber}</span>
                      
                      {/* Red/Yellow/Greendots representing tasks */}
                      <div className="flex items-center justify-center gap-1 mt-auto overflow-hidden">
                        {cell.tasks.slice(0, 3).map((t) => {
                          const score = calculateRiskScore(t, refDate);
                          let dotColor = "bg-emerald-500";
                          if (score >= 75) dotColor = "bg-rose-500";
                          else if (score >= 40) dotColor = "bg-amber-500";
                          return <span key={t.id} className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />;
                        })}
                        {cell.tasks.length > 3 && (
                          <span className="text-[8px] font-bold opacity-70">+{cell.tasks.length - 3}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Date Detail Modal / Popup Overlay */}
              <AnimatePresence>
                {selectedCalendarDate && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl space-y-4 ${
                        isDark ? "bg-[#111114] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                        <div>
                          <h4 className="text-sm font-extrabold text-purple-600 dark:text-purple-400">
                            {selectedCalendarDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                          </h4>
                          <p className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                            Active tasks and deadlines scheduled
                          </p>
                        </div>
                        <button 
                          onClick={() => setSelectedCalendarDate(null)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                        {tasks.filter(t => t.deadline && new Date(t.deadline).toDateString() === selectedCalendarDate.toDateString()).length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-500 italic">
                            No deadlines scheduled for this date.
                          </div>
                        ) : (
                          tasks.filter(t => t.deadline && new Date(t.deadline).toDateString() === selectedCalendarDate.toDateString()).map(task => {
                            const score = calculateRiskScore(task, refDate);
                            const badge = getRiskBadgeDetails(score, task.completed);
                            return (
                              <div 
                                key={task.id}
                                className={`p-3 rounded-xl border space-y-2 transition-all ${
                                  isDark ? "bg-[#050505] border-white/5" : "bg-slate-50 border-slate-200/60"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h5 className={`text-xs font-bold ${task.completed ? "line-through text-slate-500" : ""}`}>
                                      {task.title}
                                    </h5>
                                    <p className="text-[10px] text-slate-400">
                                      Est effort: {task.estimatedHours}h • {task.category}
                                    </p>
                                  </div>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.bg} ${badge.text} ${badge.border}`}>
                                    {score}% Risk
                                  </span>
                                </div>

                                <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-white/5 pt-2">
                                  <button
                                    onClick={() => {
                                      onToggleComplete(task.id);
                                    }}
                                    className={`flex items-center gap-1 text-[10px] font-bold cursor-pointer ${
                                      task.completed ? "text-emerald-500" : "text-slate-400 hover:text-white"
                                    }`}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {task.completed ? "Completed" : "Mark Done"}
                                  </button>

                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        setSelectedCalendarDate(null);
                                        onEditTask(task);
                                      }}
                                      className="text-[10px] font-bold text-purple-400 hover:text-purple-300 cursor-pointer"
                                    >
                                      Edit
                                    </button>
                                    {!task.completed && onStartSprintClick && (
                                      <button
                                        onClick={() => {
                                          setSelectedCalendarDate(null);
                                          onStartSprintClick(task);
                                        }}
                                        className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer flex items-center gap-0.5"
                                      >
                                        <Play className="w-3 h-3" /> Sprint
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={() => setSelectedCalendarDate(null)}
                          className="w-full py-2 text-xs font-bold text-center text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. AI STRATEGIC INSIGHT CARD */}
      <div 
        className="p-4 rounded-xl border-l-4 border-purple-500 transition-colors flex items-start gap-3 w-full bg-purple-500/5 border-slate-200 dark:border-white/5" 
        id="planning-ai-insight"
      >
        <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-0.5 animate-pulse" />
        <div className="flex-1 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500 block">AI Strategic Advisor</span>
          {isInsightLoading ? (
            <div className="space-y-1.5 py-1">
              <div className="h-3 w-3/4 bg-purple-500/10 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-purple-500/10 rounded animate-pulse" />
            </div>
          ) : (
            <p className="text-xs leading-relaxed font-semibold text-slate-800 dark:text-slate-300">
              "{insight || "Analyze your workload distribution using our multi-period tabs."}"
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
