import React, { useState, useEffect } from "react";
import { X, Calendar, Clock, Sparkles, AlertTriangle, Check, RefreshCw } from "lucide-react";
import { Task, TaskCategory } from "../types";
import { apiFetch as fetch } from "../utils/api";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Omit<Task, "id" | "completed" | "createdAt"> & { id?: string }) => void;
  initialTask?: Partial<Task> | null;
  theme?: string;
  activeTasks?: Task[];
}

export default function TaskModal({
  isOpen,
  onClose,
  onSave,
  initialTask,
  theme = "dark",
  activeTasks = []
}: TaskModalProps) {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [estimatedHours, setEstimatedHours] = useState<number>(2);
  const [category, setCategory] = useState<TaskCategory>("Work");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Conflict state
  const [conflictWarning, setConflictWarning] = useState<string>("");
  const [suggestedDeadline, setSuggestedDeadline] = useState<string>("");
  const [checkingConflict, setCheckingConflict] = useState<boolean>(false);

  const isDark = theme === "dark";

  useEffect(() => {
    if (isOpen) {
      setConflictWarning("");
      setSuggestedDeadline("");
      if (initialTask) {
        setTitle(initialTask.title || "");
        
        // Format ISO string back to datetime-local expected format (YYYY-MM-DDTHH:MM)
        if (initialTask.deadline) {
          try {
            const date = new Date(initialTask.deadline);
            const pad = (num: number) => String(num).padStart(2, "0");
            const formattedDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
            const formattedTime = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
            setDeadlineDate(formattedDate);
            setDeadlineTime(formattedTime);
            setDeadline(`${formattedDate}T${formattedTime}`);
          } catch {
            setDeadlineDate("");
            setDeadlineTime("");
            setDeadline("");
          }
        } else {
          setDeadlineDate("");
          setDeadlineTime("");
          setDeadline("");
        }
        
        setEstimatedHours(initialTask.estimatedHours || 2);
        setCategory(initialTask.category || "Work");
        setNotes(initialTask.notes || "");
      } else {
        // Set defaults for new task
        setTitle("");
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setMinutes(0);
        const pad = (num: number) => String(num).padStart(2, "0");
        const formattedDate = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
        const formattedTime = `${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;
        setDeadlineDate(formattedDate);
        setDeadlineTime(formattedTime);
        setDeadline(`${formattedDate}T${formattedTime}`);
        setEstimatedHours(2);
        setCategory("Work");
        setNotes("");
      }
      setErrors({});
    }
  }, [isOpen, initialTask]);

  // Dynamic conflict checking
  useEffect(() => {
    if (!isOpen || !title.trim() || !deadline) {
      setConflictWarning("");
      setSuggestedDeadline("");
      return;
    }

    const handler = setTimeout(async () => {
      setCheckingConflict(true);
      try {
        const isoDeadline = new Date(deadline).toISOString();
        // Exclude the currently editing task from the conflict check
        const otherActiveTasks = activeTasks.filter(t => t.id !== initialTask?.id);

        const res = await fetch("/api/check-conflict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newTask: {
              title: title.trim(),
              deadline: isoDeadline,
              estimatedHours,
              category
            },
            allTasks: otherActiveTasks
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.hasConflict) {
            setConflictWarning(data.warningMessage);
            setSuggestedDeadline(data.suggestedDeadline || "");
          } else {
            setConflictWarning("");
            setSuggestedDeadline("");
          }
        }
      } catch (err) {
        console.error("Conflict check failed:", err);
      } finally {
        setCheckingConflict(false);
      }
    }, 600);

    return () => clearTimeout(handler);
  }, [title, deadline, estimatedHours, category, isOpen, activeTasks, initialTask]);

  if (!isOpen) return null;

  const handleAutoAdjust = () => {
    if (suggestedDeadline) {
      try {
        const date = new Date(suggestedDeadline);
        const pad = (num: number) => String(num).padStart(2, "0");
        const formattedDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        const formattedTime = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
        setDeadlineDate(formattedDate);
        setDeadlineTime(formattedTime);
        setDeadline(`${formattedDate}T${formattedTime}`);
        setConflictWarning("");
        setSuggestedDeadline("");
      } catch (err) {
        console.error("Failed to adjust deadline:", err);
      }
    }
  };

  const handleDateChange = (newDate: string) => {
    setDeadlineDate(newDate);
    if (newDate && deadlineTime) {
      setDeadline(`${newDate}T${deadlineTime}`);
    } else if (newDate) {
      setDeadline(`${newDate}T18:00`); // default to 18:00
      setDeadlineTime("18:00");
    } else {
      setDeadline("");
    }
  };

  const handleTimeChange = (newTime: string) => {
    setDeadlineTime(newTime);
    if (deadlineDate && newTime) {
      setDeadline(`${deadlineDate}T${newTime}`);
    } else if (newTime) {
      const today = new Date();
      const pad = (num: number) => String(num).padStart(2, "0");
      const formattedDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
      setDeadlineDate(formattedDate);
      setDeadline(`${formattedDate}T${newTime}`);
    } else {
      setDeadline("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = "Task name is required";
    }
    if (!deadline) {
      newErrors.deadline = "Deadline date & time is required";
    }
    if (estimatedHours <= 0) {
      newErrors.estimatedHours = "Estimated effort must be at least 0.5 hours";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Convert local deadline to ISO string
    const isoDeadline = new Date(deadline).toISOString();

    onSave({
      id: initialTask?.id,
      title: title.trim(),
      deadline: isoDeadline,
      estimatedHours,
      category,
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" id="task-modal-overlay">
      <div 
        className={`w-full max-w-lg overflow-hidden border rounded-2xl shadow-2xl transition-colors ${
          isDark ? "border-white/5 bg-[#0a0a0c]" : "border-slate-200 bg-white"
        }`}
        id="task-modal-container"
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? "border-white/5 bg-[#050505]/40" : "border-slate-200 bg-slate-50/50"
        }`}>
          <div className="flex items-center gap-2">
            {initialTask?.id ? (
              <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Edit Task Details</h3>
            ) : (
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                </div>
                <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Create New Task</h3>
              </div>
            )}
          </div>
          <button 
            onClick={onClose}
            className={`p-1 rounded-lg text-slate-500 transition-colors cursor-pointer ${
              isDark ? "hover:text-white hover:bg-[#050505]" : "hover:text-slate-900 hover:bg-slate-100"
            }`}
            id="close-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Real-time Conflict Alert banner */}
          {conflictWarning && (
            <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 transition-all animate-fade-in ${
              isDark 
                ? "bg-amber-500/10 border-amber-500/20 text-amber-200" 
                : "bg-amber-50 border-amber-200 text-amber-950"
            }`} id="new-task-conflict-banner">
              <div className="flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed">{conflictWarning}</span>
              </div>
              {suggestedDeadline && (
                <button
                  type="button"
                  onClick={handleAutoAdjust}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg shrink-0 transition-all flex items-center gap-1 cursor-pointer hover:scale-102 ${
                    isDark
                      ? "bg-amber-500 text-black hover:bg-amber-400"
                      : "bg-amber-600 text-white hover:bg-amber-700"
                  }`}
                  id="auto-adjust-deadline"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  Auto-adjust
                </button>
              )}
            </div>
          )}

          {/* Task Name */}
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Task Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Finish chemistry lab report"
              className={`w-full px-4 py-2.5 rounded-xl border text-xs transition-all ${
                isDark 
                  ? "bg-[#050505] text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
                  : "bg-slate-50 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              } ${errors.title ? "border-rose-500" : (isDark ? "border-white/5" : "border-slate-200")}`}
              id="input-task-title"
            />
            {errors.title && <p className="mt-1 text-xs text-rose-500">{errors.title}</p>}
          </div>

          {/* Grid: Deadline & Estimated Hours */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Deadline */}
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Deadline <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {/* Date Input */}
                <div className="relative">
                  <input
                    type="date"
                    value={deadlineDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className={`w-full pl-9 pr-2 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                      isDark 
                        ? "bg-[#050505] text-white [color-scheme:dark]" 
                        : "bg-slate-50 text-slate-900"
                    } ${errors.deadline ? "border-rose-500" : (isDark ? "border-white/5" : "border-slate-200")}`}
                    id="input-task-deadline-date"
                  />
                  <Calendar className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
                </div>
                {/* Time Input */}
                <div className="relative">
                  <input
                    type="time"
                    value={deadlineTime}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className={`w-full pl-9 pr-2 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                      isDark 
                        ? "bg-[#050505] text-white [color-scheme:dark]" 
                        : "bg-slate-50 text-slate-900"
                    } ${errors.deadline ? "border-rose-500" : (isDark ? "border-white/5" : "border-slate-200")}`}
                    id="input-task-deadline-time"
                  />
                  <Clock className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
              {errors.deadline && <p className="mt-1 text-xs text-rose-500">{errors.deadline}</p>}
            </div>

            {/* Estimated Hours */}
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Estimated Effort (Hours) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="100"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(parseFloat(e.target.value) || 0)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                    isDark 
                      ? "bg-[#050505] text-white" 
                      : "bg-slate-50 text-slate-900"
                  } ${errors.estimatedHours ? "border-rose-500" : (isDark ? "border-white/5" : "border-slate-200")}`}
                  id="input-task-estimated-hours"
                />
                <Clock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
              {errors.estimatedHours && <p className="mt-1 text-xs text-rose-500">{errors.estimatedHours}</p>}
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Category
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["Study", "Work", "Personal", "Finance"] as TaskCategory[]).map((cat) => {
                const isSelected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                        : (isDark 
                            ? "bg-[#050505] border-white/5 text-slate-400 hover:text-white hover:border-white/10" 
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300")
                    }`}
                    id={`category-btn-${cat.toLowerCase()}`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Notes & Reminders
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add subtasks, links, or context details..."
              className={`w-full px-4 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none ${
                isDark 
                  ? "bg-[#050505] border-white/5 text-white placeholder-slate-600" 
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
              }`}
              id="input-task-notes"
            />
          </div>

          {/* Actions */}
          <div className={`flex items-center justify-end gap-3 pt-4 border-t ${isDark ? "border-white/5" : "border-slate-100"}`}>
            {checkingConflict && (
              <span className={`text-[10px] mr-auto ${isDark ? "text-slate-500" : "text-slate-400"} flex items-center gap-1`}>
                <RefreshCw className="w-3 h-3 animate-spin" />
                Analyzing scheduling conflicts...
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                isDark ? "text-slate-500 hover:text-white hover:bg-[#050505]" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
              id="cancel-modal-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/10 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
              id="save-task-btn"
            >
              {initialTask?.id ? "Save Changes" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
