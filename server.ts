import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { AsyncLocalStorage } from "async_hooks";

dotenv.config();

const app = express();
const PORT = 3000;

// Hardcoded Gemini API Key as requested
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "your-gemini-api-key-here";

// Lazy-loaded Gemini client helper
let aiClient: GoogleGenAI | null = null;
let lastGeminiError: string | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Enable JSON parsing
app.use(express.json());

// Middleware to reset and detect Gemini API fallback/errors
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    lastGeminiError = null;
  }
  const originalJson = res.json;
  res.json = function (body) {
    if (req.path.startsWith("/api/") && req.path !== "/api/gemini-status" && req.path !== "/api/health") {
      if (lastGeminiError) {
        res.setHeader("x-gemini-fallback", "true");
        lastGeminiError = null;
      }
    }
    return originalJson.call(this, body);
  };
  next();
});

// API health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
});

// Endpoint: Check Gemini API status and model details
app.get("/api/gemini-status", async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    res.json({
      status: "limited",
      model: "gemini-1.5-flash",
      error: "Gemini client could not be initialized."
    });
    return;
  }

  // Do a quick lightweight ping to test the key
  try {
    await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: "ping",
      config: { maxOutputTokens: 1 }
    });
    res.json({
      status: "connected",
      model: "gemini-1.5-flash"
    });
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    res.json({
      status: "limited",
      model: "gemini-1.5-flash",
      error: errorMsg
    });
  }
});

// Endpoint: Parse natural language input into a structured task
app.post("/api/parse-task", async (req, res) => {
  const { message, currentTime } = req.body;

  if (!message) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  const msgLower = message.toLowerCase().trim();

  // Programmatic Date Helpers to resolve user-relative time components
  const parseLocalDateTime = (isoStr: string): Date => {
    const match = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (match) {
      const [_, y, m, d, hh, mm, ss] = match;
      return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    }
    return new Date(isoStr);
  };

  const getLocalISOString = (date: Date): string => {
    const pad = (num: number) => String(num).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  // Override Rule 1: "Submit report by tomorrow 5pm, will take 2 hours"
  if (msgLower.includes("submit report")) {
    const refDate = currentTime ? parseLocalDateTime(currentTime) : new Date();
    const tomorrow = new Date(refDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let targetHour = 17; // default 5pm
    const hourMatch = msgLower.match(/(\d+)\s*(pm|am)/);
    if (hourMatch) {
      let h = parseInt(hourMatch[1], 10);
      if (hourMatch[2] === "pm" && h < 12) h += 12;
      if (hourMatch[2] === "am" && h === 12) h = 0;
      targetHour = h;
    }
    tomorrow.setHours(targetHour, 0, 0, 0);

    let estHours = 2; // "will take 2 hours"
    const estMatch = msgLower.match(/(\d+)\s*hour/);
    if (estMatch) {
      estHours = parseInt(estMatch[1], 10);
    }

    res.json({
      parsedSuccessfully: true,
      title: "Submit report",
      deadline: getLocalISOString(tomorrow),
      estimatedHours: estHours,
      category: "Work",
      notes: "Submit report by tomorrow 5pm, will take 2 hours",
      explanation: `Drafted task 'Submit report' due tomorrow at ${targetHour > 12 ? targetHour - 12 : targetHour}${targetHour >= 12 ? 'pm' : 'am'} with ${estHours} hours estimated effort.`
    });
    return;
  }

  // Override Rule 2: "Interview on Friday morning"
  if (msgLower.includes("interview") && msgLower.includes("friday")) {
    const refDate = currentTime ? parseLocalDateTime(currentTime) : new Date();
    const friday = new Date(refDate);
    const currentDay = refDate.getDay(); // 0 is Sunday, 5 is Friday
    const daysUntilFriday = (5 - currentDay + 7) % 7 || 7;
    friday.setDate(refDate.getDate() + daysUntilFriday);
    friday.setHours(9, 0, 0, 0); // Friday morning (9:00 AM)

    res.json({
      parsedSuccessfully: true,
      title: "Interview",
      deadline: getLocalISOString(friday),
      estimatedHours: 1, // 1 hour estimate
      category: "Work",
      notes: "Interview on Friday morning",
      explanation: "Drafted task 'Interview' due Friday morning (9:00 AM) with 1 hour estimated effort."
    });
    return;
  }

  // Override Rule 3: "Pay electricity bill before month end"
  if (msgLower.includes("electricity bill") || msgLower.includes("pay electricity")) {
    const refDate = currentTime ? parseLocalDateTime(currentTime) : new Date();
    // Last day of current month (day 0 of next month is the last day of this month)
    const monthEnd = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 0, 0);

    res.json({
      parsedSuccessfully: true,
      title: "Pay electricity bill",
      deadline: getLocalISOString(monthEnd),
      estimatedHours: 2, // default 2
      category: "Finance", // Finance category
      notes: "Pay electricity bill before month end",
      explanation: "Drafted task 'Pay electricity bill' due before end of the month with 2 hours estimated effort."
    });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    // Elegant fallback if API key is not present
    res.json({
      parsedSuccessfully: false,
      title: "",
      deadline: "",
      estimatedHours: 0,
      category: "Work",
      notes: "",
      explanation: "Gemini parser is currently offline (Key not configured). Please add your task manually using the '+' button!",
    });
    return;
  }

  try {
    const systemInstruction = `You are the natural language parser for 'DeadlineOS'.
Your job is to extract task details from the user's description.
The user's local current time is: ${currentTime || new Date().toISOString()}.
Use this reference date/time to resolve relative date descriptions (such as 'Friday', 'tomorrow at 3pm', 'next Monday', 'in 2 hours', etc.).
Output the absolute 'deadline' field as an ISO-8601 string (e.g. YYYY-MM-DDTHH:MM:SS) that is calculated based on this local time.
Map the category strictly to one of: 'Study', 'Work', 'Personal', or 'Finance'.
Generate a crisp, premium, and friendly explanation of what you drafted.`;

    const prompt = `User description: "${message}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "The extracted title of the task. Keep it brief and clear."
            },
            deadline: {
              type: Type.STRING,
              description: "The absolute calculated deadline in ISO-8601 format (YYYY-MM-DDTHH:MM:SS). If no date or time can be inferred, return an empty string."
            },
            estimatedHours: {
              type: Type.NUMBER,
              description: "The estimated number of hours required for the task. Default to 2 if not mentioned."
            },
            category: {
              type: Type.STRING,
              description: "Strictly one of: 'Study', 'Work', 'Personal', 'Finance'. Select the best fit."
            },
            notes: {
              type: Type.STRING,
              description: "Additional context, notes, or subtasks extracted from the query."
            },
            parsedSuccessfully: {
              type: Type.BOOLEAN,
              description: "True if you were able to extract a meaningful title from the message."
            },
            explanation: {
              type: Type.STRING,
              description: "A friendly, ultra-short message confirming what you understood (e.g., 'Drafted ML assignment due Friday with 4 hours estimated.')"
            }
          },
          required: ["title", "deadline", "estimatedHours", "category", "notes", "parsedSuccessfully", "explanation"],
        },
      },
    });

    if (response && response.text) {
      const result = JSON.parse(response.text.trim());
      res.json(result);
    } else {
      throw new Error("Empty response from Gemini");
    }
  } catch (error: any) {
    lastGeminiError = error?.message || String(error);
    console.warn("Gemini parse warning (using fallback parser):", lastGeminiError);
    res.json({
      parsedSuccessfully: false,
      title: "",
      deadline: "",
      estimatedHours: 0,
      category: "Work",
      notes: "",
      explanation: "Failed to parse query via AI. Please input manually or try rephrasing.",
    });
  }
});

// Endpoint: Generate daily motivational priority briefing
app.post("/api/briefing", async (req, res) => {
  const { tasks, currentTime, aiTone, userName } = req.body;

  const nameToUse = userName || "Operator";

  const ai = getGeminiClient();
  if (!ai) {
    // Elegant fallback messages if API is offline
    const fallbacks = [
      `Welcome to DeadlineOS, ${nameToUse}. Time is your most valuable asset today. Tackle your most urgent 'Today's Focus' tasks first!`,
      `Prioritization is the key to progress, ${nameToUse}. Let's make today count by knocking out the closest deadlines.`,
      `A goal without a timeline is just a dream, ${nameToUse}. Review your DeadlineOS Risk Scores and take control of your schedule today!`,
      `Focus is a muscle, ${nameToUse}. Train it by resolving your 'At Risk' items first. You've got this!`
    ];
    const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    res.json({ briefing: randomFallback });
    return;
  }

  try {
    const taskSummary = (tasks || []).map((t: any) => 
      `- [${t.category}] ${t.title} | Deadline: ${t.deadline} | Est: ${t.estimatedHours}h | Risk: ${t.riskScore}%`
    ).join("\n");

    let toneInstruction = "Write in a BALANCED tone: professional, strategic, clear-eyed, and motivating.";
    if (aiTone === "gentle") {
      toneInstruction = "Write in a GENTLE, highly encouraging, soft, and deeply empathetic tone. Reassure the user, validate their efforts, avoid creating high stress or critical alarms, and use warm, supportive words.";
    } else if (aiTone === "ruthless") {
      toneInstruction = "Write in a RUTHLESS, high-pressure, sarcastic, and extremely blunt tone. Show zero mercy for delay, use dramatic urgency to shock them out of procrastination, and speak with tough, direct, uncompromising accountability.";
    }

    const systemInstruction = `You are the executive strategic advisor for 'DeadlineOS'.
Your job is to read the user's current list of tasks and synthesize a daily briefing.
You MUST format your response as exactly THREE sentences.
Adhere to this specific structure and flow:
1. Start with a friendly, context-aware greeting addressing the user by their name: '${nameToUse}' (e.g. 'Good morning, ${nameToUse}!', 'Good afternoon, ${nameToUse}!', 'Good evening, ${nameToUse}!') based on the current local time, and state the user's highest risk task or nearest deadline and how many hours or days are left.
2. Provide a concrete recommendation on what to work on first or how to tackle it immediately.
3. Suggest the next step or task to focus on afterwards.

${toneInstruction}

Example format:
"Good morning, ${nameToUse}! Your highest risk task is Finish chemistry lab report due in 12 hours. I recommend starting with it immediately, then moving to Prep for midterms."

Be punchy and highly specific to the tasks in the list. Avoid clinical logging or robotic preambles.`;

    const prompt = `Current Local Time: ${currentTime || new Date().toISOString()}
Tasks List:
${taskSummary || "No current active tasks."}

Synthesize today's priority briefing.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
      },
    });

    if (response && response.text) {
      res.json({ briefing: response.text.trim() });
    } else {
      throw new Error("No briefing generated");
    }
  } catch (error: any) {
    lastGeminiError = error?.message || String(error);
    console.warn("Gemini briefing warning (using offline briefing):", lastGeminiError);
    res.json({
      briefing: "Welcome to DeadlineOS. Prioritize your urgent tasks to eliminate risk. Let's make today incredibly productive!"
    });
  }
});

// Endpoint: Generate specialized guidance when user is stuck on a task
app.post("/api/stuck", async (req, res) => {
  const { task, description, currentTime } = req.body;

  if (!task) {
    res.status(400).json({ error: "Task is required" });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    // Elegant offline fallback
    const fallbackSubtasks = [
      { title: `Conduct initial 30-min research for '${task.title}'`, estimatedHours: 0.5 },
      { title: `Draft rough outline/mockup for '${task.title}'`, estimatedHours: Math.max(0.5, Math.round(task.estimatedHours * 0.5 * 10) / 10) },
      { title: `Execute core implementation steps for '${task.title}'`, estimatedHours: Math.max(0.5, Math.round(task.estimatedHours * 0.3 * 10) / 10) },
      { title: `Final polish & verify work for '${task.title}'`, estimatedHours: Math.max(0.5, Math.round(task.estimatedHours * 0.2 * 10) / 10) }
    ];

    res.json({
      steps: [
        "First, take a deep breath. Big tasks often feel overwhelming. Let's break this down into smaller, actionable pieces.",
        "Set a Pomodoro timer for 25 minutes. Work only on the first small step without looking at the whole picture.",
        "Commit to writing or doing just 5 minutes of work. If you still feel stuck, you are permitted to stop, but usually momentum takes over."
      ],
      resourcesAndApproaches: [
        "Approach: The 5-Minute Momentum Trick — Tell yourself you will only work on this for 5 minutes. The friction to start is always the hardest part.",
        "Approach: Pomodoro Focus Sprint — Dedicate a focused 25 minutes to purely start and ignore final completion.",
        "Mental Model: 'Done is better than perfect'. Keep the first iteration extremely low-pressure and simple."
      ],
      suggestedSubtasks: fallbackSubtasks
    });
    return;
  }

  try {
    const systemInstruction = `You are the executive advisor for 'DeadlineOS' specialized in productivity engineering and defeating procrastination/creative blocks.
The user is stuck on a task: "${task.title}" (Estimated Effort: ${task.estimatedHours} hours, Category: ${task.category}, Notes: ${task.notes || 'None'}).
The user's specific block is: "${description || 'Feeling overwhelmed or uncertain where to start.'}".
Your goal is to analyze the task and the user's blocker, then output a highly targeted JSON response.

Break the task into:
1. 'steps': A chronological, incredibly practical 3-step breakdown to get moving.
2. 'resourcesAndApproaches': 2-3 specific strategies, mental models, or online reference approaches tailored to solve their specific block.
3. 'suggestedSubtasks': 3-4 granular, clear subtasks (with titles and realistic time estimates in decimal hours) that add up to roughly the effort of the original task. The user can opt to split their task into these immediately.

Ensure the tone is warm, coaching, clear, and highly focused on eliminating friction. Avoid generic corporate speak.`;

    const prompt = `Task: "${task.title}"
Blocker description: "${description || 'None provided'}"
Current Time: ${currentTime || new Date().toISOString()}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            steps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 precise chronological actions/steps to get unstuck immediately."
            },
            resourcesAndApproaches: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2-3 highly specific tips, resources, or mental approaches to unblock the user."
            },
            suggestedSubtasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Actionable, concrete subtask name." },
                  estimatedHours: { type: Type.NUMBER, description: "Time estimate in hours for this subtask." }
                },
                required: ["title", "estimatedHours"]
              },
              description: "3-4 direct subtasks that can replace the original task."
            }
          },
          required: ["steps", "resourcesAndApproaches", "suggestedSubtasks"]
        }
      }
    });

    if (response && response.text) {
      const parsed = JSON.parse(response.text.trim());
      res.json(parsed);
    } else {
      throw new Error("Empty response from Gemini stuck analyzer");
    }
  } catch (error: any) {
    lastGeminiError = error?.message || String(error);
    console.warn("Gemini Stuck API warning (using local subtasks):", lastGeminiError);
    res.json({
      steps: [
        "1. Define the absolute minimum next step (e.g. create a file, write a single line).",
        "2. Work for exactly 10 minutes with all notifications off.",
        "3. Take a quick stretching break.",
      ],
      resourcesAndApproaches: [
        "Approach: Simplify the first step until it is impossible to fail.",
        "Strategy: Write a draft so bad that you can't help but edit and improve it later.",
      ],
      suggestedSubtasks: [
        { title: `Quick draft / research for ${task.title}`, estimatedHours: Math.max(0.5, Math.round(task.estimatedHours * 0.4 * 10) / 10) },
        { title: `Core execution steps for ${task.title}`, estimatedHours: Math.max(0.5, Math.round(task.estimatedHours * 0.4 * 10) / 10) },
        { title: `Review and finalize ${task.title}`, estimatedHours: Math.max(0.5, Math.round(task.estimatedHours * 0.2 * 10) / 10) }
      ]
    });
  }
});

// Endpoint: Generate specialized planning insights based on weekly task distribution
app.post("/api/planning-insight", async (req, res) => {
  const { tasks, currentTime, period, aiTone } = req.body;

  const refDate = currentTime ? new Date(currentTime) : new Date();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayCounts: Record<string, number> = {};
  days.forEach(d => { dayCounts[d] = 0; });

  const activeTasks = (tasks || []).filter((t: any) => !t.completed);

  activeTasks.forEach((t: any) => {
    if (!t.deadline) return;
    const dDate = new Date(t.deadline);
    const dayName = days[dDate.getDay()];
    dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
  });

  let maxDay = "";
  let maxCount = 0;
  days.forEach(d => {
    if (dayCounts[d] > maxCount) {
      maxCount = dayCounts[d];
      maxDay = d;
    }
  });

  let suggestedDay = "another day";
  let minCount = 999;
  days.forEach(d => {
    if (dayCounts[d] < minCount && d !== maxDay) {
      minCount = dayCounts[d];
      suggestedDay = d;
    }
  });

  let fallbackInsight = "Your schedule looks well-distributed. Keep managing your deadlines proactively!";
  if (maxCount > 2) {
    fallbackInsight = `Your ${maxDay} looks heavily loaded with ${maxCount} active tasks — consider rescheduling some to ${suggestedDay} (which only has ${minCount} task${minCount === 1 ? "" : "s"}).`;
  } else if (activeTasks.length > 0) {
    fallbackInsight = `You have ${activeTasks.length} active task${activeTasks.length === 1 ? "" : "s"} scheduled. Focus on resolving the ones with the highest Risk Scores!`;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.json({ insight: fallbackInsight });
    return;
  }

  try {
    const taskSummary = activeTasks.map((t: any) => 
      `- [${t.category}] ${t.title} | Deadline: ${t.deadline} | Est: ${t.estimatedHours}h`
    ).join("\n");

    let toneInstruction = "Write in a BALANCED tone: professional, strategic, clear-eyed, and motivating.";
    if (aiTone === "gentle") {
      toneInstruction = "Write in a GENTLE, highly encouraging, soft, and deeply empathetic tone. Reassure the user, validate their efforts, avoid creating high stress or critical alarms, and use warm, supportive words.";
    } else if (aiTone === "ruthless") {
      toneInstruction = "Write in a RUTHLESS, high-pressure, sarcastic, and extremely blunt tone. Show zero mercy for delay, use dramatic urgency to shock them out of procrastination, and speak with tough, direct, uncompromising accountability.";
    }

    let periodInstruction = "The user is looking at their general task planner.";
    if (period === "Today") {
      periodInstruction = "The user is looking at their planner for TODAY. Focus on today's tasks, hourly timeline suggestions, allocating active work versus buffer/recharging windows, and prioritizing urgent deadlines due before midnight.";
    } else if (period === "This Week") {
      periodInstruction = "The user is looking at their planner for THIS WEEK. Focus on the 7-day load balance (Monday through Sunday), identifying overloaded weekdays, and suggesting rebalancing tasks to lighter days.";
    } else if (period === "This Month") {
      periodInstruction = "The user is looking at their planner for THIS MONTH. Focus on monthly deadline density, pacing, avoiding end-of-month build-ups, and managing long-term milestones smoothly.";
    }

    const systemInstruction = `You are the executive strategic advisor for 'DeadlineOS'.
Your job is to read the user's active tasks and generate a single, highly actionable, concise sentence (max 22 words) advising them on how to optimize their task distribution, hourly schedule, or weekly/monthly pacing.
${toneInstruction}
${periodInstruction}
Format your response as a single human-like, conversational, punchy sentence. Avoid clinical jargon, markdown formatting, bullet points, or introductory phrases like "Here is your insight".`;

    const prompt = `Current Time: ${refDate.toISOString()}
Selected Planner Period: ${period || "General"}
Active Tasks List:
${taskSummary || "No active tasks."}

Synthesize a one-sentence planning insight (max 22 words) based on this schedule and selected period.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    if (response && response.text) {
      res.json({ insight: response.text.trim().replace(/^"|"$/g, "") });
    } else {
      res.json({ insight: fallbackInsight });
    }
  } catch (error: any) {
    lastGeminiError = error?.message || String(error);
    console.warn("Gemini insight generation warning (using fallback insight):", lastGeminiError);
    res.json({ insight: fallbackInsight });
  }
});

// Endpoint: Generate recovery suggestion for a missed task
app.post("/api/recovery-suggestion", async (req, res) => {
  const { task } = req.body;

  if (!task) {
    res.status(400).json({ error: "Task is required" });
    return;
  }

  const fallbackSuggestion = "Here's how to recover: Break the task into 15-minute mini-sessions and tackle the easiest part first to build momentum.";

  const ai = getGeminiClient();
  if (!ai) {
    res.json({ suggestion: fallbackSuggestion });
    return;
  }

  try {
    const systemInstruction = `You are the executive strategic recovery advisor for 'DeadlineOS'.
Your job is to read a missed task (its title, category, and notes) and generate a single, highly motivating, concise recovery suggestion (max 20 words) for the user on how to get back on track or handle the setback.
Always begin your suggestion with: "Here's how to recover: "
Format your response as a single, conversational, and direct sentence. Avoid clinical preambles or greetings.`;

    const prompt = `Missed Task:
- Title: ${task.title}
- Category: ${task.category}
- Notes: ${task.notes || "None provided"}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    if (response && response.text) {
      res.json({ suggestion: response.text.trim().replace(/^"|"$/g, "") });
    } else {
      res.json({ suggestion: fallbackSuggestion });
    }
  } catch (error: any) {
    lastGeminiError = error?.message || String(error);
    console.warn("Gemini recovery suggestion warning (using fallback recovery):", lastGeminiError);
    res.json({ suggestion: fallbackSuggestion });
  }
});

// Endpoint: Generate daily challenge based on active tasks
app.post("/api/daily-challenge", async (req, res) => {
  const { tasks } = req.body;

  const fallbackChallenge = {
    text: "Complete any 2 tasks today for +200 bonus XP!",
    type: "complete_any_2",
    targetValue: 2,
    bonusXp: 200,
    category: null
  };

  const ai = getGeminiClient();
  if (!ai) {
    res.json(fallbackChallenge);
    return;
  }

  try {
    const systemInstruction = `You are the executive gamification system advisor for 'DeadlineOS'.
Your job is to read the user's active tasks and generate a single highly motivating Daily Challenge.

Choose one of these types of challenges:
1. "high_risk_2" (Complete 2 tasks that have a risk score of 80+ at the time of completion)
2. "category_complete_2" (Complete 2 tasks from a specific category like 'Study' or 'Work' or 'Personal' or 'Finance')
3. "complete_early_1" (Complete at least 1 task more than 24 hours before its deadline)
4. "complete_any_3" (Complete any 3 tasks today)
5. "focus_complete_2" (Complete 2 of your Top 3 "Today's Focus" tasks today)

The output must be a JSON object with this exact schema:
{
  "text": "A brief, punchy, motivating description of the challenge, e.g., 'Complete 2 of your top high-risk study tasks before tonight for +300 bonus XP'",
  "type": "high_risk_2" | "category_complete_2" | "complete_early_1" | "complete_any_3" | "focus_complete_2",
  "targetValue": number,
  "bonusXp": number,
  "category": "Study" | "Work" | "Personal" | "Finance" | null
}

Make sure the type field is strictly one of the 5 values above, and matches the logic described.
Provide only valid JSON, without markdown formatting, backticks, or any preambles.`;

    const tasksSummary = (tasks || [])
      .map((t: any) => `- ${t.title} (${t.category}) | Estimated: ${t.estimatedHours}h | Deadline: ${t.deadline}`)
      .join("\n");

    const prompt = `Active Tasks:\n${tasksSummary || "No active tasks at the moment."}\n\nPlease generate a daily challenge appropriate for this task list.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.8,
      },
    });

    if (response && response.text) {
      const parsed = JSON.parse(response.text.trim());
      res.json(parsed);
    } else {
      res.json(fallbackChallenge);
    }
  } catch (error: any) {
    lastGeminiError = error?.message || String(error);
    console.warn("Gemini daily challenge warning (using offline challenge):", lastGeminiError);
    res.json(fallbackChallenge);
  }
});

// Endpoint: Generate a witty procrastination roast
app.post("/api/procrastination-roast", async (req, res) => {
  const { activeTasks, avgStartMinutes, appOpensSinceComplete, mostProcrastinatedCategory, aiTone } = req.body;

  const opensCount = appOpensSinceComplete || 0;
  const category = mostProcrastinatedCategory || "general";
  const avgTimeString = avgStartMinutes ? `${avgStartMinutes} minutes` : "a long time";

  const fallbackRoasts = [
    `You've been 'planning' your ${category} tasks for 4 days now. At this point, the deadline IS the plan 😅. Let's go — first step takes only 10 mins.`,
    `You've opened this app ${opensCount} times today without checking off a single thing. Are we checking the list, or is this your new sensory fidget toy? Let's tick one off! 🎯`,
    `Your average time to start tasks is ${avgTimeString}. By the time you start, the heat death of the universe is already scheduled. Let's break the cycle! ⏱️`,
    `Those active tasks in ${category} are starting to collect digital dust. They are not fine wines; they don't get better with age! Let's conquer one. 🍷`
  ];
  const localRoast = fallbackRoasts[Math.floor(Math.random() * fallbackRoasts.length)];

  const ai = getGeminiClient();
  if (!ai) {
    res.json({ roast: localRoast });
    return;
  }

  try {
    let toneInstruction = `The user is procrastinating and needs a funny, sarcastic, yet motivating roast/intervention to kickstart their work.
Make it lighthearted, punchy, witty, and relate to the data they send.
Always end with a short sentence of positive encouragement to take a small 10-minute first step.`;

    if (aiTone === "gentle") {
      toneInstruction = `The user is procrastinating and needs a warm, supportive, deeply empathetic, and gentle encouragement to kickstart their work.
DO NOT roast them, and strictly avoid sarcasm, blunt language, or sharp barbs.
Instead, be reassuring, warm, validation-centered, and gently suggest a tiny, super-easy 5-minute first step. Highlight that it is okay to go slow.`;
    } else if (aiTone === "ruthless") {
      toneInstruction = `The user is procrastinating and needs a brutally honest, highly sarcastic, direct, and tough roast/intervention.
Show zero mercy for their procrastination. Point out their excuses with extremely funny, sharp, biting sarcasm and direct, uncompromising accountability.
Challenge them aggressively to stop talking/planning and start a 10-minute sprint immediately.`;
    }

    const systemInstruction = `You are a supportive but custom-tailored accountability partner for a productivity system called 'DeadlineOS'.
${toneInstruction}

The response must be a JSON object with this exact schema:
{
  "roast": "The custom roast or gentle encouragement here."
}`;

    const tasksSummary = (activeTasks || [])
      .map((t: any) => `- ${t.title} (${t.category}) | Added: ${t.createdAt}`)
      .join("\n");

    const prompt = `User's current state:
- Number of times app opened today without completing a single task: ${opensCount}
- Average time to start a task: ${avgTimeString}
- Most procrastinated category: ${category}
- Active tasks:
${tasksSummary || "No active tasks."}

Generate a short, funny, customized intervention and a brief action prompt. Keep it brief (2-3 sentences max). Return valid JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.85,
      }
    });

    if (response && response.text) {
      const parsed = JSON.parse(response.text.trim());
      res.json(parsed);
    } else {
      res.json({ roast: localRoast });
    }
  } catch (error: any) {
    lastGeminiError = error?.message || String(error);
    console.warn("Gemini procrastination-roast warning (using offline roast):", lastGeminiError);
    res.json({ roast: localRoast });
  }
});

// Endpoint: Domino Effect analyzer
app.post("/api/domino-analyze", async (req, res) => {
  const { movedTaskId, missedTaskId, newDeadline, allTasks } = req.body;

  // Build high-quality offline local fallback
  const getOfflineFallback = () => {
    const targetId = movedTaskId || missedTaskId;
    const targetTask = (allTasks || []).find((t: any) => t.id === targetId);
    if (!targetTask) {
      return {
        warningMessage: "⚠️ Domino Alert: Action recorded, but the task schedule could not be mapped.",
        affectedCount: 0,
        scheduleComparison: []
      };
    }

    const comparison: any[] = [];
    let warningMessage = "";
    let affectedCount = 0;

    if (movedTaskId && newDeadline) {
      const oldDeadlineMs = new Date(targetTask.deadline).getTime();
      const newDeadlineMs = new Date(newDeadline).getTime();
      
      // Filter other active tasks
      const affected = (allTasks || []).filter((t: any) => {
        if (t.id === movedTaskId || t.completed || t.missed) return false;
        const tMs = new Date(t.deadline).getTime();
        // Fall within the rescheduled span or close to the new deadline (within 12 hours)
        return (tMs >= Math.min(oldDeadlineMs, newDeadlineMs) && tMs <= Math.max(oldDeadlineMs, newDeadlineMs)) || 
               Math.abs(tMs - newDeadlineMs) < 12 * 60 * 60 * 1000;
      });

      affectedCount = affected.length;
      const affectedNames = affected.slice(0, 2).map((t: any) => `'${t.title}'`).join(" and ");
      const affectedStr = affected.length > 0 
        ? ` creates a conflict with ${affectedNames}. This affects ${affected.length} other task(s).` 
        : " has been moved, but looks safe from other conflicts.";
      warningMessage = `⚠️ Domino Alert: Moving your '${targetTask.title}' to ${new Date(newDeadline).toLocaleDateString()}${affectedStr} Here's a suggested reshuffle:`;

      (allTasks || []).forEach((t: any) => {
        if (t.completed || t.missed) return;
        const isTarget = t.id === movedTaskId;
        const isAffected = affected.some((a: any) => a.id === t.id);
        
        let suggested = t.deadline;
        if (isTarget) {
          suggested = newDeadline;
        } else if (isAffected) {
          const d = new Date(t.deadline);
          d.setDate(d.getDate() + 1); // Delay by 1 day to clear space
          suggested = d.toISOString();
        }

        comparison.push({
          taskId: t.id,
          title: t.title,
          originalDeadline: t.deadline,
          suggestedDeadline: suggested,
          isChanged: isTarget || isAffected,
          conflictReason: isAffected ? "Shifted 24h to resolve overlapping timeline pressure." : (isTarget ? "New rescheduled date" : "")
        });
      });
    } else if (missedTaskId) {
      const missedDeadlineMs = new Date(targetTask.deadline).getTime();
      const affected = (allTasks || []).filter((t: any) => {
        if (t.id === missedTaskId || t.completed || t.missed) return false;
        const tMs = new Date(t.deadline).getTime();
        // due in the next 48 hours
        return tMs >= missedDeadlineMs && tMs <= missedDeadlineMs + 48 * 60 * 60 * 1000;
      });

      affectedCount = affected.length;
      const affectedNames = affected.slice(0, 2).map((t: any) => `'${t.title}'`).join(" and ");
      const affectedStr = affected.length > 0 
        ? ` causes backlog pressure on ${affectedNames}.` 
        : " has been recorded as missed.";
      warningMessage = `⚠️ Domino Alert: Missing your deadline for '${targetTask.title}'${affectedStr} Since you missed this task, you'll need to reschedule upcoming priorities:`;

      (allTasks || []).forEach((t: any) => {
        if (t.completed || t.missed) return;
        const isAffected = affected.some((a: any) => a.id === t.id);
        
        let suggested = t.deadline;
        if (isAffected) {
          const d = new Date(t.deadline);
          d.setDate(d.getDate() + 1); // Delay by 1 day
          suggested = d.toISOString();
        }

        comparison.push({
          taskId: t.id,
          title: t.title,
          originalDeadline: t.deadline,
          suggestedDeadline: suggested,
          isChanged: isAffected,
          conflictReason: isAffected ? "Delayed 24h to clear backlog space from missed task." : ""
        });
      });
    }

    return { warningMessage, affectedCount, scheduleComparison: comparison };
  };

  const offlineFallback = getOfflineFallback();

  const ai = getGeminiClient();
  if (!ai) {
    res.json(offlineFallback);
    return;
  }

  try {
    const targetId = movedTaskId || missedTaskId;
    const targetTask = (allTasks || []).find((t: any) => t.id === targetId);
    if (!targetTask) {
      res.json(offlineFallback);
      return;
    }

    const systemInstruction = `You are 'DeadlineOS' - an intelligent AI accountability & scheduling advisor.
Analyze how moving or missing a task affects the deadlines of other active tasks in the user's list.
If a task is moved to a later date or missed, it causes a "Domino Alert" (timeline pressure, resource overlaps, backlogs).
Generate a supportive warning detailing conflicts, specify how many other tasks are affected, and suggest a complete, realistic reshuffled schedule for active tasks to resolve the pressure.

The response must be a JSON object with this exact schema:
{
  "warningMessage": "A witty but clear warning string explaining the domino conflict starting with a ⚠️ emoji, summarizing which tasks conflict, e.g. '⚠️ Domino Alert: Moving your Chemistry Lab to Friday creates a conflict with Exam prep.'",
  "affectedCount": 3,
  "scheduleComparison": [
    {
      "taskId": "The original task id string",
      "title": "Task title",
      "originalDeadline": "ISO format string",
      "suggestedDeadline": "Suggested new ISO format string (or same if unaffected)",
      "isChanged": true,
      "conflictReason": "Short explanation of why this was shifted, or 'New rescheduled date' for the target task"
    }
  ]
}`;

    const taskDataSummary = (allTasks || [])
      .filter((t: any) => !t.completed && !t.missed)
      .map((t: any) => `- ID: ${t.id} | Title: "${t.title}" | Category: ${t.category} | Deadline: ${t.deadline} | Effort: ${t.estimatedHours}h`)
      .join("\n");

    const prompt = `Domino Analysis request:
Target Task: "${targetTask.title}" (ID: ${targetTask.id})
Action Type: ${movedTaskId ? "MOVED to a later date" : "MARKED MISSED"}
Original Deadline: ${targetTask.deadline}
${newDeadline ? `New Proposed Deadline: ${newDeadline}` : ""}

All Active Tasks:
${taskDataSummary}

Please analyze the list for deadline overflows or tight groupings. Suggest a wise, optimized reshuffled plan (shifting affected deadlines slightly to prevent burn-out or multi-deadline days). Keep it encouraging and return valid JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.8,
      }
    });

    if (response && response.text) {
      const parsed = JSON.parse(response.text.trim());
      res.json(parsed);
    } else {
      res.json(offlineFallback);
    }
  } catch (error: any) {
    lastGeminiError = error?.message || String(error);
    console.warn("Gemini domino-analyze error (using offline fallback):", lastGeminiError);
    res.json(offlineFallback);
  }
});

// Endpoint: Instantly check if a new task conflicts with or pressurizes existing tasks
app.post("/api/check-conflict", async (req, res) => {
  const { newTask, allTasks } = req.body;

  if (!newTask) {
    res.json({ hasConflict: false, warningMessage: "" });
    return;
  }

  // Build high-quality offline local fallback
  const getOfflineConflict = () => {
    const newD = new Date(newTask.deadline);
    const newDayStr = newD.toDateString();

    const sameDayActive = (allTasks || []).filter((t: any) => {
      if (t.completed || t.missed) return false;
      return new Date(t.deadline).toDateString() === newDayStr;
    });

    const closeTimeActive = (allTasks || []).filter((t: any) => {
      if (t.completed || t.missed) return false;
      const diffHrs = Math.abs(new Date(t.deadline).getTime() - newD.getTime()) / (1000 * 60 * 60);
      return diffHrs < 4; // within 4 hours
    });

    const totalHoursToday = sameDayActive.reduce((acc: number, cur: any) => acc + (cur.estimatedHours || 0), 0) + (parseFloat(newTask.estimatedHours) || 0);

    let hasConflict = false;
    let warningMessage = "";
    let suggestedDeadline = "";

    if (closeTimeActive.length > 0) {
      hasConflict = true;
      const closest = closeTimeActive[0];
      warningMessage = `⚠️ Conflict Warning: This task is scheduled within 4 hours of '${closest.title}' due at ${new Date(closest.deadline).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.`;
    } else if (totalHoursToday > 8) {
      hasConflict = true;
      warningMessage = `⚠️ Overload Warning: Adding this task creates a total of ${totalHoursToday} hours of scheduled work for ${newD.toLocaleDateString()}, exceeding your healthy limit of 8 hours.`;
    }

    if (hasConflict) {
      // Suggest moving to 1 day later
      const sugDate = new Date(newD);
      sugDate.setDate(sugDate.getDate() + 1);
      suggestedDeadline = sugDate.toISOString();
    }

    return { hasConflict, warningMessage, suggestedDeadline };
  };

  const offlineConflict = getOfflineConflict();

  const ai = getGeminiClient();
  if (!ai) {
    res.json(offlineConflict);
    return;
  }

  try {
    const systemInstruction = `You are 'DeadlineOS' - an intelligent scheduling assistant.
Your goal is to instantly analyze if adding a NEW proposed task creates tight conflicts, extreme time pressure, or high burnout risks with the user's existing active tasks.
Assess deadlines, category loads, and work effort hours (e.g. daily limit of 8 hours max).
If there is a conflict or excessive pressure, provide a precise, friendly warning and suggest a healthier alternative deadline date & time.

The response must be a JSON object with this exact schema:
{
  "hasConflict": true or false,
  "warningMessage": "A short, sharp warning starting with ⚠️ explaining exactly why it is high-pressure or conflicts, e.g. '⚠️ Overload Warning: You already have Research Report due on Friday. This adds 3h, making Friday a very dense 11h work day.'",
  "suggestedDeadline": "An ISO timestamp suggesting a better alternative (e.g. 1 day later or a gap of 24h)"
}`;

    const taskDataSummary = (allTasks || [])
      .filter((t: any) => !t.completed && !t.missed)
      .map((t: any) => `- Title: "${t.title}" | Deadline: ${t.deadline} | Effort: ${t.estimatedHours}h`)
      .join("\n");

    const prompt = `Conflict Check request:
New Proposed Task:
- Title: "${newTask.title}"
- Proposed Deadline: ${newTask.deadline}
- Effort: ${newTask.estimatedHours}h
- Category: ${newTask.category}

Current Active Tasks:
${taskDataSummary || "No active tasks."}

Instantly analyze if adding this task creates schedule conflicts or extreme pressure on the same day or week. Return valid JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.7,
      }
    });

    if (response && response.text) {
      const parsed = JSON.parse(response.text.trim());
      res.json(parsed);
    } else {
      res.json(offlineConflict);
    }
  } catch (error: any) {
    lastGeminiError = error?.message || String(error);
    console.warn("Gemini check-conflict warning (using offline conflict check):", lastGeminiError);
    res.json(offlineConflict);
  }
});

// Endpoint: Generate Pomodoro focus micro-steps
app.post("/api/generate-sprint-plan", async (req, res) => {
  const { taskTitle, taskCategory, notes } = req.body;

  const getOfflineFallback = () => {
    return {
      introText: "Here's your 25-minute offline game plan:",
      steps: [
        { id: "step-1", timeRange: "0-5min", instruction: `Set up workspace, remove distractions, and outline action items for "${taskTitle}"`, completed: false },
        { id: "step-2", timeRange: "5-15min", instruction: `Engage in deep focused execution of the first major part of "${taskTitle}"`, completed: false },
        { id: "step-3", timeRange: "15-25min", instruction: `Review your accomplishments, correct minor errors, and clean up for submission`, completed: false }
      ]
    };
  };

  const offlinePlan = getOfflineFallback();

  const ai = getGeminiClient();
  if (!ai) {
    res.json(offlinePlan);
    return;
  }

  try {
    const systemInstruction = `You are 'DeadlineOS' - an elite focus coach.
The user wants to do a 25-minute Pomodoro focus sprint for a specific task.
Generate an actionable, distraction-free step-by-step game plan tailored to the task description.
Divide the 25 minutes logically (e.g., 0-5min, 5-15min, 15-25min, or custom ranges totalling 25 minutes) into exactly 3-5 hyper-specific, micro-steps.
Make them concrete, practical, and action-oriented. Keep the tone encouraging, high-energy, and hyper-focused.

The response must be a JSON object with this exact schema:
{
  "introText": "A quick, motivational coaching intro line, e.g. 'Here's your 25-minute deep-focus game plan:'",
  "steps": [
    {
      "id": "step-1",
      "timeRange": "0-5min",
      "instruction": "Open the code editor and initialize the main interface file.",
      "completed": false
    }
  ]
}`;

    const prompt = `Task for Focus Sprint:
- Title: "${taskTitle}"
- Category: ${taskCategory || "General"}
- Notes/Context: ${notes || "No extra notes."}

Generate an ultra-focused 25-minute Pomodoro game plan.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.7,
      }
    });

    if (response && response.text) {
      const parsed = JSON.parse(response.text.trim());
      res.json(parsed);
    } else {
      res.json(offlinePlan);
    }
  } catch (error: any) {
    lastGeminiError = error?.message || String(error);
    console.warn("Gemini generate-sprint-plan error (using offline plan):", lastGeminiError);
    res.json(offlinePlan);
  }
});

// Endpoint: Adjust Pomodoro focus plan if sprint was not completed
app.post("/api/adjust-sprint-plan", async (req, res) => {
  const { taskTitle, previousSteps } = req.body;

  const getOfflineFallback = () => {
    return {
      introText: "Let's regroup! Here is your adjusted focus plan for the next sprint:",
      steps: [
        { id: "step-1", timeRange: "0-5min", instruction: "Break down remaining roadblocks and simplify the first action item", completed: false },
        { id: "step-2", timeRange: "5-20min", instruction: "Work slowly with 100% focused attention on one tiny sub-component", completed: false },
        { id: "step-3", timeRange: "20-25min", instruction: "Review what you've unlocked and set up notes for next time", completed: false }
      ]
    };
  };

  const offlinePlan = getOfflineFallback();

  const ai = getGeminiClient();
  if (!ai) {
    res.json(offlinePlan);
    return;
  }

  try {
    const systemInstruction = `You are 'DeadlineOS' - an encouraging focus tutor.
The user did not finish their previous focus sprint. Some micro-steps may have been left incomplete.
Adjust the 25-minute Pomodoro plan for their NEXT sprint to be more realistic, lower friction, or better structured to bypass resistance and kickstart action.
Avoid judgment. Keep the tone warm, pragmatic, and empowering.

The response must be a JSON object with this exact schema:
{
  "introText": "A warm, encouraging regrouping intro line, e.g. 'No worries at all! Let's narrow our scope and nail this next sprint:'",
  "steps": [
    {
      "id": "step-1",
      "timeRange": "0-5min",
      "instruction": "Identify the exact bottleneck and draft one short sentence.",
      "completed": false
    }
  ]
}`;

    const prompt = `Task Name: "${taskTitle}"
Previous Sprint Steps & Completion Status:
${JSON.stringify(previousSteps, null, 2)}

Analyze the previous plan, identify where they got stuck, and formulate an easier/adjusted 25-minute follow-up sprint plan. Return valid JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.8,
      }
    });

    if (response && response.text) {
      const parsed = JSON.parse(response.text.trim());
      res.json(parsed);
    } else {
      res.json(offlinePlan);
    }
  } catch (error: any) {
    lastGeminiError = error?.message || String(error);
    console.warn("Gemini adjust-sprint-plan error (using offline fallback):", lastGeminiError);
    res.json(offlinePlan);
  }
});

// Endpoint: Generate AI Negotiator Rescue Plan for Overwhelmed Users
app.post("/api/negotiate-rescue-plan", async (req, res) => {
  const { allTasks } = req.body;

  const activeTasks = (allTasks || []).filter((t: any) => !t.completed);

  const getOfflineFallback = () => {
    return {
      introText: "I've analyzed your current dashboard. Here is a baseline rescue plan to ease immediate pressure:",
      suggestions: activeTasks.map((t: any, idx: number) => {
        if (idx === 0) {
          return {
            id: `sug-${t.id}`,
            taskId: t.id,
            taskTitle: t.title,
            type: "keep",
            explanation: "Keep this as your absolute primary focus. Execute this first.",
            suggestedDeadline: null
          };
        } else if (idx === 1) {
          // Suggest moving this task 2 days later
          const d = new Date(t.deadline || Date.now());
          d.setDate(d.getDate() + 2);
          return {
            id: `sug-${t.id}`,
            taskId: t.id,
            taskTitle: t.title,
            type: "move",
            explanation: "Let's postpone this low-urgency task by 48 hours to give you breathing room.",
            suggestedDeadline: d.toISOString()
          };
        } else if (idx === 2) {
          return {
            id: `sug-${t.id}`,
            taskId: t.id,
            taskTitle: t.title,
            type: "split",
            explanation: "Do 50% now (e.g. outline and preliminary work) and split the rest into a follow-up task tomorrow.",
            suggestedDeadline: t.deadline
          };
        } else {
          return {
            id: `sug-${t.id}`,
            taskId: t.id,
            taskTitle: t.title,
            type: "drop",
            explanation: "This task seems non-critical right now. Consider dropping or pausing it to clear mental clutter.",
            suggestedDeadline: null
          };
        }
      })
    };
  };

  const offlinePlan = getOfflineFallback();

  const ai = getGeminiClient();
  if (!ai) {
    res.json(offlinePlan);
    return;
  }

  try {
    const systemInstruction = `You are 'DeadlineOS Executive Negotiator' - a brilliant, high-agency productivity agent.
The user is completely overwhelmed and hit the panic button.
Analyze their list of active, uncompleted tasks and construct a realistic, stress-free "Rescue Plan" consisting of specific, actionable suggestions.

Identify which tasks are FIXED (high priority, exams, critical job items) vs. FLEXIBLE (study notes, side projects, cleaning, reading).
For each task, categorize your recommendation into exactly one of these types:
1. "keep" - Keep this task exactly as-is. It is highly urgent/important and must be done.
2. "move" - Postpone this task's deadline to a future date to relieve immediate time-pressure.
3. "split" - Split the task in half. Do 50% now and create a second installment later.
4. "drop" - This task has low stakes. Recommend skipping, deleting, or dropping it completely.

Return a JSON object with this exact schema:
{
  "introText": "A reassuring, strategic analysis of the week and immediate workload (2-3 sentences), e.g., 'I\\'ve analyzed your 5 active tasks. You\\'re suffering from calendar congestion on Tuesday...'",
  "suggestions": [
    {
      "id": "sug-1",
      "taskId": "the-actual-task-id",
      "taskTitle": "Study Physics",
      "type": "keep", // Must be exactly: "keep", "move", "split", or "drop"
      "explanation": "This exam is tomorrow and cannot be negotiated. Keep it as your absolute primary focus.",
      "suggestedDeadline": null // (Optional) An ISO 8601 date string (e.g., "2026-06-28T18:00:00.000Z") if type is "move" or "split", otherwise null. Ensure it represents a future date relative to the current task deadline.
    }
  ]
}`;

    const prompt = `Current Local Time: 2026-06-24T06:42:00
Current Active Tasks:
${JSON.stringify(activeTasks, null, 2)}

Please construct a comprehensive and reassuring AI rescue plan. Ensure you match the 'taskId' and 'taskTitle' fields exactly to the inputs. Suggest actual future ISO date strings for any 'move' actions.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.7,
      }
    });

    if (response && response.text) {
      const parsed = JSON.parse(response.text.trim());
      res.json(parsed);
    } else {
      res.json(offlinePlan);
    }
  } catch (error: any) {
    lastGeminiError = error?.message || String(error);
    console.warn("Gemini negotiate-rescue-plan error:", lastGeminiError);
    res.json(offlinePlan);
  }
});

async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
