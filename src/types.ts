export type TaskCategory = "Study" | "Work" | "Personal" | "Finance";

export interface Task {
  id: string;
  title: string;
  deadline: string; // ISO-8601 string (YYYY-MM-DDTHH:MM:SS)
  estimatedHours: number;
  category: TaskCategory;
  notes: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
  startedAt?: string;
  missed?: boolean;
  missedAt?: string;
  recoverySuggestion?: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  draftedTask?: Partial<Task> & { parsedSuccessfully?: boolean; explanation?: string };
}

export interface DailyChallenge {
  text: string;
  type: "high_risk_2" | "category_complete_2" | "complete_early_1" | "complete_any_3" | "focus_complete_2" | "complete_any_2";
  targetValue: number;
  bonusXp: number;
  category?: TaskCategory | null;
  completed?: boolean;
  currentValue?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  locked: boolean;
  xpReward?: number;
}

export interface GamificationState {
  xp: number;
  streak: number;
  lastCompletedDate?: string; // YYYY-MM-DD
  unlockedAchievements: string[]; // List of Achievement IDs
  dailyChallenge: DailyChallenge | null;
  challengeDate?: string; // YYYY-MM-DD
}
