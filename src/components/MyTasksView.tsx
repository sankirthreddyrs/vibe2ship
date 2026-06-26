import React from "react";
import { 
  Plus, Search, Calendar, Circle, CheckCircle2, Edit, Trash2, 
  Brain, X, Zap, ChevronDown, ChevronUp, Loader2, Sparkles, Check 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Task, TaskCategory } from "../types";
import { calculateRiskScore, getRiskBadgeDetails, formatDeadline } from "../utils";
import { apiFetch as fetch } from "../utils/api";

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  estimatedHours: number;
}

interface MyTasksViewProps {
  tasks: Task[];
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  statusFilter: "All" | "Active" | "Completed";
  setStatusFilter: (val: "All" | "Active" | "Completed") => void;
  categoryFilter: "All" | TaskCategory;
  setCategoryFilter: (val: "All" | TaskCategory) => void;
  currentTime: Date;
  onToggleComplete: (id: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onOpenStuckModal: (task: Task) => void;
  onCreateTaskClick: () => void;
  onStartSprintClick?: (task: Task) => void;
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

function getHumanRemainingTime(deadlineStr: string, current: Date): string {
  const deadline = new Date(deadlineStr);
  const diffMs = deadline.getTime() - current.getTime();
  
  if (diffMs <= 0) {
    const absMs = Math.abs(diffMs);
    const hours = Math.round(absMs / (1000 * 60 * 60));
    if (hours < 1) return "overdue now";
    if (hours < 24) return `overdue by ${hours}h`;
    const days = Math.round(hours / 24);
    return `overdue by ${days}d`;
  }
  
  const remainingHours = diffMs / (1000 * 60 * 60);
  
  if (remainingHours < 1) {
    const mins = Math.round(remainingHours * 60);
    return `in ${mins} mins`;
  }
  if (remainingHours < 24) {
    const hrs = Math.round(remainingHours);
    if (hrs === 1) return "in 1 hour";
    return `in ${hrs} hours`;
  }
  
  const remainingDays = Math.round(remainingHours / 24);
  if (remainingDays === 1) {
    return "tomorrow";
  }
  return `in ${remainingDays} days`;
}

export default function MyTasksView({
  tasks,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  categoryFilter,
  setCategoryFilter,
  currentTime,
  onToggleComplete,
  onEditTask,
  onDeleteTask,
  onOpenStuckModal,
  onCreateTaskClick,
  onStartSprintClick,
}: MyTasksViewProps) {
  
  // Local nested subtasks store mapped by parent task ID
  const [taskSubtasks, setTaskSubtasks] = React.useState<Record<string, Subtask[]>>(() => {
    const saved = localStorage.getItem("deadlineos_nested_subtasks");
    return saved ? JSON.parse(saved) : {};
  });

  // Track expanded tasks
  const [expandedTaskIds, setExpandedTaskIds] = React.useState<Record<string, boolean>>({});
  
  // Track loading state for inline Gemini generation
  const [loadingTaskIds, setLoadingTaskIds] = React.useState<Record<string, boolean>>({});

  // Sync subtasks to localStorage
  React.useEffect(() => {
    localStorage.setItem("deadlineos_nested_subtasks", JSON.stringify(taskSubtasks));
  }, [taskSubtasks]);

  // Toggle single subtask completion state
  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    setTaskSubtasks(prev => {
      const list = prev[taskId] || [];
      const updated = list.map(sub => {
        if (sub.id === subtaskId) {
          return { ...sub, completed: !sub.completed };
        }
        return sub;
      });
      return { ...prev, [taskId]: updated };
    });
  };

  // Trigger inline Gemini-powered subtask generation
  const handleBreakdownTask = async (task: Task) => {
    setLoadingTaskIds(prev => ({ ...prev, [task.id]: true }));
    try {
      const response = await fetch("/api/stuck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          description: "Please break this down into 3-4 granular, actionable subtasks with estimated hours.",
          currentTime: currentTime.toISOString(),
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.suggestedSubtasks && data.suggestedSubtasks.length > 0) {
          const generated: Subtask[] = data.suggestedSubtasks.map((sub: any, idx: number) => ({
            id: `subtask-${task.id}-${idx}-${Date.now()}`,
            title: sub.title,
            completed: false,
            estimatedHours: sub.estimatedHours || 1
          }));
          
          setTaskSubtasks(prev => ({
            ...prev,
            [task.id]: generated
          }));
          
          // Expand the task to show subtasks
          setExpandedTaskIds(prev => ({
            ...prev,
            [task.id]: true
          }));
        }
      }
    } catch (error) {
      console.error("Error generating subtasks with Gemini:", error);
    } finally {
      setLoadingTaskIds(prev => ({ ...prev, [task.id]: false }));
    }
  };

  const getUrgencySortedTasks = (list: Task[]) => {
    return [...list].sort((a, b) => {
      if (a.completed && !b.completed) return 1;
      if (!a.completed && b.completed) return -1;
      const scoreA = calculateRiskScore(a, currentTime);
      const scoreB = calculateRiskScore(b, currentTime);
      return scoreB - scoreA;
    });
  };

  const filteredTasks = getUrgencySortedTasks(tasks).filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.notes || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Active" && !t.completed) ||
      (statusFilter === "Completed" && t.completed);

    const matchesCategory =
      categoryFilter === "All" || t.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const activeCount = tasks.filter((t) => !t.completed).length;
  const completedCount = tasks.filter((t) => t.completed).length;

  // Frame motion animation config
  const listContainerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.98 },
    show: { 
      opacity: 1, 
      y: 0, 
      scale: 1, 
      transition: { type: "spring", stiffness: 110, damping: 14 } 
    },
    exit: { 
      opacity: 0, 
      scale: 0.96, 
      y: -10, 
      transition: { duration: 0.2 } 
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="mytasks-view-container">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2a2a4a]/20 pb-4">
        <div>
          <h2 className="text-[22px] font-extrabold text-white tracking-tight font-mono">My Deadlines Database</h2>
          <p className="text-[13px] text-slate-400 font-medium">Interact, edit, and track risk levels for your active milestones.</p>
        </div>
        {tasks.length > 0 && (
          <button
            onClick={onCreateTaskClick}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all flex items-center justify-center gap-1.5 border border-white/5 cursor-pointer self-start sm:self-auto shadow-none"
            id="tasks-add-task-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 px-6 max-w-lg mx-auto space-y-6 animate-fade-in" id="tasks-global-empty-state">
          <div className="text-[48px] leading-none select-none">📋</div>

          <div className="space-y-2">
            <h3 className="text-xl font-extrabold text-white tracking-tight">No deadlines added yet</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
              Your tasks will appear here once you add them
            </p>
          </div>

          <button
            onClick={onCreateTaskClick}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-purple-600/20 active:scale-95 border border-purple-500/30"
            id="tasks-empty-add-btn"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create First Deadline</span>
          </button>
        </div>
      ) : (
        <>
          {/* Top controls: Status toggle, Category pills, Search, Task Count */}
          <div className="flex flex-col gap-4 py-1" id="tasks-filters-bar">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* 1. Active | Completed | All Toggle (Pill style) */}
                <div className="flex items-center gap-1 bg-[#121224]/60 p-1 border border-[#2a2a4a]/30 rounded-full shrink-0">
                  {(["Active", "Completed", "All"] as const).map((filter) => {
                    const isSelected = statusFilter === filter;
                    return (
                      <button
                        key={filter}
                        onClick={() => setStatusFilter(filter)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-indigo-600 text-white"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {filter}
                      </button>
                    );
                  })}
                </div>

                {/* 2. Category Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(["All", "Study", "Work", "Personal", "Finance"] as const).map((cat) => {
                    const isSelected = categoryFilter === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-full text-xs transition-all border cursor-pointer font-semibold ${
                          isSelected
                            ? "bg-[#1d1d3d] border-indigo-500/30 text-indigo-300 font-extrabold"
                            : "bg-[#121224]/30 border-[#2a2a4a]/40 text-slate-400 hover:text-white hover:border-slate-500/30"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Search Bar */}
              <div className="relative w-full lg:w-[240px] shrink-0">
                <input
                  type="text"
                  placeholder="Search deadlines..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-[#121224]/40 border border-[#2a2a4a]/40 text-white placeholder-slate-500 rounded-full text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
                />
                <Search className="absolute left-3.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-2 text-slate-500 hover:text-slate-300 cursor-pointer p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 4. Task Counts */}
            <div className="flex items-center justify-between pt-1 border-t border-[#2a2a4a]/10">
              <div className="text-xs text-slate-400 font-mono">
                {activeCount} active &middot; {completedCount} done
              </div>
            </div>
          </div>

          {/* Animated Interactive Task List Container */}
          <motion.div 
            variants={listContainerVariants}
            initial="hidden"
            animate="show"
            className="space-y-4" 
            id="tasks-list-container"
          >
            {filteredTasks.length === 0 ? (
              <div className="bg-[#121224]/20 border border-[#2a2a4a]/25 rounded-2xl p-8 text-center py-16 space-y-3 shadow-none" id="tasks-empty-state">
                <Search className="w-8 h-8 text-slate-500 mx-auto" />
                <h4 className="text-[15px] font-bold text-slate-400 font-mono">No milestones matched</h4>
                <p className="text-xs text-slate-500 font-medium">Clear filters or add your next critical deadline!</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredTasks.map((task) => {
                  const score = calculateRiskScore(task, currentTime);
                  const risk = getRiskBadgeDetails(score, task.completed);
                  const catInfo = getCategoryTheme(task.category);
                  const subtaskList = taskSubtasks[task.id] || [];
                  const isExpanded = !!expandedTaskIds[task.id];
                  const isLoadingSubtasks = !!loadingTaskIds[task.id];

                  // Map task status explicitly
                  let taskStatusLabel = "in-progress";
                  let taskStatusColor = "bg-blue-500/10 border-blue-500/20 text-blue-400";

                  if (task.completed) {
                    taskStatusLabel = "completed";
                    taskStatusColor = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
                  } else if (task.missed) {
                    taskStatusLabel = "failed";
                    taskStatusColor = "bg-rose-500/10 border-rose-500/20 text-rose-400";
                  } else if (subtaskList.length > 0 || score >= 70) {
                    taskStatusLabel = "need-help";
                    taskStatusColor = "bg-amber-500/10 border-amber-500/20 text-amber-400";
                  }

                  return (
                    <motion.div
                      key={task.id}
                      variants={cardVariants}
                      layout="position"
                      className={`border border-[#2a2a4a]/30 rounded-2xl overflow-hidden bg-[#121224]/15 shadow-xl shadow-indigo-950/5 transition-all duration-300 ${
                        task.completed ? "opacity-75" : ""
                      }`}
                      id={`task-item-card-${task.id}`}
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-10 items-center gap-4 py-5 px-6 group hover:bg-[#1a1a36]/15 transition-all">
                        {/* LEFT SIDE (takes 5 cols on desktop) */}
                        <div className="lg:col-span-5 flex items-start gap-4 min-w-0">
                          {/* Circular Checkbox (24px) */}
                          <button
                            onClick={() => onToggleComplete(task.id)}
                            className={`mt-1.5 w-6 h-6 rounded-full border flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                              task.completed
                                ? "bg-emerald-600/20 border-emerald-500 text-emerald-400"
                                : "bg-[#121224]/30 border-[#2a2a4a] text-transparent hover:border-indigo-500 hover:text-indigo-400"
                            }`}
                            title={task.completed ? "Mark incomplete" : "Mark complete"}
                          >
                            <Check className={`w-3.5 h-3.5 stroke-[3px] transition-opacity ${task.completed ? "opacity-100" : "opacity-0"}`} />
                          </button>
                          
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              {/* Task Name (16px bold) */}
                              <h4 className={`text-[16px] font-bold tracking-tight truncate ${
                                task.completed ? "line-through text-slate-500 font-medium" : "text-slate-100 group-hover:text-indigo-400"
                              } transition-colors`}>
                                {task.title}
                              </h4>
                              
                              {task.startedAt && !task.completed && (
                                <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 leading-none">
                                  <span className="w-1 h-1 bg-indigo-400 rounded-full animate-pulse"></span>
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Category pill badge */}
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${catInfo.bg} ${catInfo.text} ${catInfo.border} leading-none`}>
                                {task.category}
                              </span>

                              {/* Status Badge */}
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${taskStatusColor} leading-none`}>
                                {taskStatusLabel}
                              </span>

                              {/* Nested subtasks progress indicator */}
                              {subtaskList.length > 0 && (
                                <span className="bg-[#121224]/60 border border-[#2a2a4a]/40 text-slate-400 text-[10px] px-2 py-0.5 rounded leading-none font-mono">
                                  {subtaskList.filter(s => s.completed).length}/{subtaskList.length} steps
                                </span>
                              )}
                            </div>

                            {/* Notes/Description text */}
                            {task.notes && (
                              <p className="text-[12px] text-slate-400 font-normal truncate max-w-full leading-relaxed" title={task.notes}>
                                {task.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* MIDDLE SECTION (takes 3 cols on desktop) */}
                        <div className="lg:col-span-3 grid grid-cols-2 lg:flex lg:flex-col gap-2 lg:gap-1.5 text-left min-w-0 lg:pl-4">
                          {/* "Due" label + deadline date/time */}
                          <div className="flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-1.5 min-w-0">
                            <span className="text-[10px] uppercase tracking-[1px] text-slate-500 font-bold leading-none">Due</span>
                            <span className="text-xs text-slate-200 font-bold font-mono truncate">
                              {formatDeadline(task.deadline, currentTime)}
                            </span>
                          </div>
                          {/* "Effort" label + hours */}
                          <div className="flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-1.5 min-w-0">
                            <span className="text-[10px] uppercase tracking-[1px] text-slate-500 font-bold leading-none">Effort</span>
                            <span className="text-xs text-indigo-400 font-bold font-mono truncate">
                              {task.estimatedHours}h effort
                            </span>
                          </div>
                          {/* Time remaining in human format */}
                          <div className="col-span-2 mt-0.5">
                            <span className="inline-flex items-center text-[10px] font-bold tracking-wide uppercase font-mono px-2 py-0.5 rounded bg-slate-800/40 text-slate-300">
                              ⏳ {getHumanRemainingTime(task.deadline, currentTime)}
                            </span>
                          </div>
                        </div>

                        {/* RIGHT SIDE (takes 2 cols on desktop) */}
                        <div className="lg:col-span-2 flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-3 shrink-0">
                          {/* Risk Badge with Danger/Moderate/Safe and % */}
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${risk.bg} ${risk.text} ${risk.border}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                              {risk.label} {score}%
                            </span>
                          </div>

                          {/* Action buttons: Sprint ⚡ | Stuck? | Edit | Delete */}
                          <div className="flex items-center gap-1 bg-[#121224]/40 border border-[#2a2a4a]/20 rounded-xl p-1 shrink-0">
                            {/* Sprint ⚡ */}
                            <button
                              onClick={() => onStartSprintClick && onStartSprintClick(task)}
                              disabled={task.completed}
                              className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                                task.completed
                                  ? "opacity-30 cursor-not-allowed text-slate-600"
                                  : "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                              }`}
                              title="Sprint: Start focus session ⚡"
                            >
                              <Zap className="w-4 h-4 fill-current" />
                            </button>

                            {/* Stuck? / Break it down */}
                            <button
                              onClick={() => {
                                if (subtaskList.length > 0) {
                                  setExpandedTaskIds(prev => ({ ...prev, [task.id]: !prev[task.id] }));
                                } else {
                                  handleBreakdownTask(task);
                                }
                              }}
                              disabled={task.completed || isLoadingSubtasks}
                              className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center relative ${
                                task.completed
                                  ? "opacity-30 cursor-not-allowed text-slate-600"
                                  : isLoadingSubtasks
                                  ? "text-indigo-400 animate-pulse"
                                  : "text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                              }`}
                              title="🔴 Stuck? Expand or auto breakdown"
                            >
                              {isLoadingSubtasks ? (
                                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                              ) : (
                                <Brain className="w-4 h-4" />
                              )}
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => onEditTask(task)}
                              className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg cursor-pointer flex items-center justify-center"
                              title="Edit Deadline"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => onDeleteTask(task.id)}
                              className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer flex items-center justify-center"
                              title="Delete Deadline"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Subtask List Section */}
                      <AnimatePresence initial={false}>
                        {(isExpanded || subtaskList.length > 0 || isLoadingSubtasks) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ 
                              height: isExpanded || isLoadingSubtasks ? "auto" : 0, 
                              opacity: isExpanded || isLoadingSubtasks ? 1 : 0 
                            }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                            className="overflow-hidden border-t border-[#1e1e35]/30 bg-[#090912]/40"
                          >
                            <div className="py-4 pl-12 pr-6">
                              {isLoadingSubtasks ? (
                                <div className="flex items-center gap-3 py-6 px-4" id={`loading-${task.id}`}>
                                  <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                                  <div className="space-y-0.5">
                                    <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1 font-mono">
                                      Generating Subtasks with Gemini...
                                    </span>
                                    <p className="text-[10px] text-slate-500 leading-none">Breaking your goal into low-friction steps</p>
                                  </div>
                                </div>
                              ) : subtaskList.length === 0 ? (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                                  <div className="flex items-center gap-3">
                                    <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                                    <div>
                                      <h5 className="text-xs font-bold text-white">Generate actionable subtasks?</h5>
                                      <p className="text-[10px] text-slate-400">Let Gemini automatically structure this task into achievable steps.</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleBreakdownTask(task)}
                                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                  >
                                    <Brain className="w-3.5 h-3.5" />
                                    Break it down! 🪄
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-3 relative">
                                  {/* Dashed Vertical Connecting Line */}
                                  <div className="absolute top-2 bottom-6 left-3.5 border-l border-dashed border-[#2c2c50]/80 z-0" />
                                  
                                  <div className="flex items-center justify-between pb-1.5">
                                    <span className="text-[11px] font-mono font-bold tracking-wider text-[#606080] uppercase flex items-center gap-1.5">
                                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                                      Decomposed Subtasks
                                    </span>
                                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                                      {subtaskList.filter(s => s.completed).length} of {subtaskList.length} completed
                                    </span>
                                  </div>

                                  <div className="space-y-2.5 z-10 relative">
                                    {subtaskList.map((sub, idx) => (
                                      <motion.div
                                        key={sub.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="flex items-center justify-between p-2.5 rounded-xl bg-[#121226]/40 border border-[#2a2a4c]/20 hover:border-indigo-500/20 hover:bg-[#1a1a36]/25 transition-all group/subtask"
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          {/* Subtask Circle Checkbox */}
                                          <button
                                            onClick={() => handleToggleSubtask(task.id, sub.id)}
                                            className={`w-5 h-5 rounded-full border flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                                              sub.completed
                                                ? "bg-indigo-600/20 border-indigo-500 text-indigo-400"
                                                : "bg-[#090912] border-[#2a2a4a] text-transparent hover:border-indigo-500 hover:text-indigo-400"
                                            }`}
                                          >
                                            <Check className={`w-3 h-3 stroke-[3px] transition-opacity ${sub.completed ? "opacity-100" : "opacity-0"}`} />
                                          </button>

                                          <span className={`text-xs font-semibold truncate ${
                                            sub.completed ? "line-through text-slate-500 font-medium" : "text-slate-200 group-hover/subtask:text-white"
                                          }`}>
                                            {sub.title}
                                          </span>
                                        </div>

                                        <span className="text-[10px] font-mono text-slate-400 bg-[#121224]/80 px-2 py-0.5 rounded border border-[#2a2a4a]/20">
                                          {sub.estimatedHours}h
                                        </span>
                                      </motion.div>
                                    ))}
                                  </div>

                                  <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                                    <button 
                                      onClick={() => {
                                        setTaskSubtasks(prev => {
                                          const copy = { ...prev };
                                          delete copy[task.id];
                                          return copy;
                                        });
                                      }}
                                      className="hover:text-rose-400 transition-colors cursor-pointer"
                                    >
                                      Reset breakdown
                                    </button>
                                    <button
                                      onClick={() => setExpandedTaskIds(prev => ({ ...prev, [task.id]: false }))}
                                      className="hover:text-white transition-colors cursor-pointer flex items-center gap-0.5 font-semibold"
                                    >
                                      Collapse list <ChevronUp className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}
