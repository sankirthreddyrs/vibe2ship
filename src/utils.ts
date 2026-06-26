import { Task } from "./types";

/**
 * Calculates the DeadlineOS dynamic Risk Score (0-100)
 * Risk increases as the remaining time approaches the estimated effort.
 */
export function calculateRiskScore(task: Task, currentTime: Date = new Date()): number {
  if (task.completed) return 0;

  const deadlineTime = new Date(task.deadline).getTime();
  const currentMs = currentTime.getTime();
  const remainingMs = deadlineTime - currentMs;

  // Overdue tasks are at maximum risk
  if (remainingMs <= 0) return 100;

  const remainingHours = remainingMs / (1000 * 60 * 60);

  // 1. If deadline is within 24 hours: score 90-100 (red)
  if (remainingHours <= 24) {
    const ratio = 1 - (remainingHours / 24);
    return Math.min(100, Math.max(90, 90 + Math.round(ratio * 10)));
  }

  // 2. If deadline is within 3 days AND estimated hours > 3: score 70-89 (orange)
  if (remainingHours <= 72 && task.estimatedHours > 3) {
    const ratio = (72 - remainingHours) / (72 - 24);
    return Math.min(89, Math.max(70, 70 + Math.round(ratio * 19)));
  }

  // 3. If deadline is within 7 days: score 40-69 (yellow)
  if (remainingHours <= 168) {
    const ratio = (168 - remainingHours) / (168 - 24);
    return Math.min(69, Math.max(40, 40 + Math.round(ratio * 29)));
  }

  // 4. All others: score 0-39 (green)
  const maxTrackedHours = 720; // 30 days
  if (remainingHours >= maxTrackedHours) {
    return 0;
  } else {
    const ratio = (maxTrackedHours - remainingHours) / (maxTrackedHours - 168);
    return Math.min(39, Math.max(0, Math.round(ratio * 39)));
  }
}

/**
 * Maps the risk score to semantic colors and labels
 */
export function getRiskBadgeDetails(score: number, isCompleted: boolean) {
  if (isCompleted) {
    return {
      text: "text-gray-400",
      bg: "bg-gray-500/10",
      border: "border-gray-500/10",
      label: "Completed",
    };
  }

  if (score >= 90) {
    return {
      text: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/25",
      label: "Danger",
    };
  } else if (score >= 70) {
    return {
      text: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/25",
      label: "High Risk",
    };
  } else if (score >= 40) {
    return {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/25",
      label: "Moderate",
    };
  } else {
    return {
      text: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/25",
      label: "Safe",
    };
  }
}

/**
 * Formats a deadline date into an elegant, human-readable relative/absolute string
 */
export function formatDeadline(dateString: string, currentTime: Date = new Date()): string {
  try {
    const deadline = new Date(dateString);
    if (isNaN(deadline.getTime())) return "No deadline";

    const diffMs = deadline.getTime() - currentTime.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Time formatting options
    const timeString = deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const today = new Date(currentTime);
    const tomorrow = new Date(currentTime);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isSameDay = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    if (isSameDay(deadline, today)) {
      return `Today at ${timeString}`;
    } else if (isSameDay(deadline, tomorrow)) {
      return `Tomorrow at ${timeString}`;
    } else if (diffDays > 1 && diffDays < 7) {
      const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return `${weekdays[deadline.getDay()]} at ${timeString}`;
    } else {
      return `${deadline.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeString}`;
    }
  } catch {
    return "Invalid date";
  }
}

/**
 * Generates initial mock data for the application if localStorage is empty
 */
export function getInitialTasks(): Task[] {
  return [];
}
