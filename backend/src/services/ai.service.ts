import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { AIActionResult } from "../types";

// ─── Clients ─────────────────────────────────────────────────────────────────

const openai = env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
  : null;

const gemini = env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
  : null;

const AI_PROVIDER = env.AI_PROVIDER; // "openai" | "gemini"

logger.info(`🤖 AI Provider: ${AI_PROVIDER.toUpperCase()}`);

// ─── Helper: parse JSON safely (Gemini sometimes wraps in code fences) ────────

function parseAIResponse(content: string): AIActionResult {
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as AIActionResult;
  } catch {
    // The model returned something that isn't valid JSON (truncated output,
    // stray prose, etc.). Surface a descriptive error instead of a bare
    // SyntaxError so the cause is visible in logs and the API response.
    logger.error("AI response was not valid JSON:", { preview: cleaned.slice(0, 200) });
    const err = new Error("AI returned an invalid response. Please rephrase your command and try again.");
    (err as { isUserFacing?: boolean }).isUserFacing = true;
    throw err;
  }
}

// ─── OpenAI call ──────────────────────────────────────────────────────────────

async function callOpenAI(systemPrompt: string, userMessage: string, maxTokens = 1500): Promise<string> {
  if (!openai) throw new Error("OpenAI client not initialized. Set OPENAI_API_KEY in .env");
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from OpenAI");
  return content;
}

// ─── Gemini call ──────────────────────────────────────────────────────────────

async function callGemini(systemPrompt: string, userMessage: string, maxTokens = 1500): Promise<string> {
  if (!gemini) throw new Error("Gemini client not initialized. Set GEMINI_API_KEY in .env");
  const model = gemini.getGenerativeModel({
    model: "gemini-3.5-flash",   // latest free-tier Flash model (May 2026)
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: maxTokens,
      responseMimeType: "application/json",
    },
  });
  const result = await model.generateContent(userMessage);
  const content = result.response.text();
  if (!content) throw new Error("No response from Gemini");
  return content;
}

// ─── Unified dispatcher ───────────────────────────────────────────────────────

export async function callAI(systemPrompt: string, userMessage: string, maxTokens = 1500): Promise<string> {
  if (AI_PROVIDER === "gemini") return callGemini(systemPrompt, userMessage, maxTokens);
  return callOpenAI(systemPrompt, userMessage, maxTokens);
}

// ─── Error handler ────────────────────────────────────────────────────────────

export function handleAIError(error: unknown): never {
  logger.error("AI service error:", error);
  // Preserve already-descriptive, user-facing errors (e.g. invalid AI JSON)
  // instead of masking them with the generic fallback below.
  if (error instanceof Error && (error as { isUserFacing?: boolean }).isUserFacing) {
    throw error;
  }
  if (error && typeof error === "object") {
    // OpenAI specific
    if ("status" in error) {
      const e = error as { status: number; error?: { code?: string } };
      if (e.status === 429) {
        if (e.error?.code === "insufficient_quota")
          throw new Error("OpenAI quota exceeded. Add billing credits at platform.openai.com");
        throw new Error("AI rate limit reached. Please try again in a moment.");
      }
      if (e.status === 401) throw new Error("Invalid OpenAI API key. Check OPENAI_API_KEY in .env");
    }
    // Gemini specific
    if ("message" in error) {
      const msg = (error as { message: string }).message;
      if (msg.includes("API_KEY_INVALID")) throw new Error("Invalid Gemini API key. Check GEMINI_API_KEY in .env");
      if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) throw new Error("Gemini free-tier quota exceeded. Wait a minute and try again, or upgrade at aistudio.google.com");
      if (msg.includes("PERMISSION_DENIED")) throw new Error("Gemini API key lacks permission. Check aistudio.google.com/api-keys");
    }
    // Gemini HTTP error (GoogleGenerativeAIFetchError has a .status field)
    if ("status" in error) {
      const e = error as { status: number };
      if (e.status === 429) throw new Error("Gemini free-tier quota exceeded. Wait a minute and try again.");
      if (e.status === 404) throw new Error("Gemini model not found. The model name may be invalid for your API key.");
      if (e.status === 400) throw new Error("Invalid request to Gemini API. Check model configuration.");
    }
  }
  throw new Error("Failed to process AI command");
}

// ─── Shared system prompt ─────────────────────────────────────────────────────

const buildSystemPrompt = (contextData?: {
  projects?: Array<{ id: string; name: string }>;
  members?: Array<{ name: string; email: string }>;
  sprints?: Array<{ id: string; name: string }>;
}) => {
  let projectsSection = "";
  if (contextData?.projects && contextData.projects.length > 0) {
    projectsSection = `\n\nAvailable projects (use exact name in projectName field):\n${contextData.projects.map((p) => `- "${p.name}" (id: ${p.id})`).join("\n")}`;
  }

  let membersSection = "";
  if (contextData?.members && contextData.members.length > 0) {
    membersSection = `\n\nTeam members available for assignment (use name in assigneeName field):\n${contextData.members.map((m) => `- ${m.name} (${m.email})`).join("\n")}`;
  }

  let sprintsSection = "";
  if (contextData?.sprints && contextData.sprints.length > 0) {
    sprintsSection = `\n\nAvailable sprints (use exact name in sprintName field):\n${contextData.sprints.map((s) => `- "${s.name}" (id: ${s.id})`).join("\n")}`;
  }

  return `You are FlowPilot AI, an intelligent workflow automation assistant.
Your job is to parse user commands and convert them into structured JSON actions.

You MUST respond with valid JSON only. No explanations, no markdown, just raw JSON.

Supported action types:
- CREATE_TASK: Create a single task
- CREATE_TASKS: Create multiple tasks
- CREATE_REMINDER: Set a reminder
- SUMMARIZE: Summarize tasks/activities
- CREATE_SPRINT: Create a sprint with tasks
- BREAKDOWN_TASK: Break down a complex task into subtasks
- SCHEDULE_EVENT: Schedule a calendar event/meeting
- UPDATE_TASK_STATUS: Move one or more tasks to a different status column
- UPDATE_TASK: Update fields of a task (priority, due date, labels, description)
- DELETE_TASK: Delete a single task by title
- DELETE_TASKS: Delete multiple tasks by title
- COMPLETE_TASKS: Mark one or more tasks as DONE
- MOVE_TASKS_TO_SPRINT: Assign tasks to a sprint by name
- UNKNOWN: When the command is unclear

Priority levels: LOW, MEDIUM, HIGH, URGENT
Task status: TODO, IN_PROGRESS, IN_REVIEW, DONE

Date format for dueDate: ISO 8601 (e.g., "${new Date().toISOString()}")
Today's date: ${new Date().toISOString()}
${projectsSection}${membersSection}${sprintsSection}

Response format examples:

For CREATE_TASK (with optional project, assignee, and sprint):
{"type":"CREATE_TASK","tasks":[{"title":"...","description":"...","priority":"HIGH","status":"IN_PROGRESS","dueDate":"...","labels":["backend"],"estimatedHours":2,"projectName":"Product Redesign","assigneeName":"John Doe","sprintName":"Sprint 1"}],"message":"Created task: ..."}

For CREATE_TASKS:
{"type":"CREATE_TASKS","tasks":[{"title":"...","priority":"HIGH","status":"TODO","projectName":"Product Redesign"},{"title":"...","priority":"MEDIUM","status":"IN_PROGRESS"}],"message":"Created X tasks"}

For UPDATE_TASK_STATUS:
{"type":"UPDATE_TASK_STATUS","taskTitles":["Fix login bug"],"newStatus":"IN_PROGRESS","projectName":"Product Redesign","message":"Moved task to In Progress"}

For COMPLETE_TASKS:
{"type":"COMPLETE_TASKS","taskTitles":["Fix login bug","Write tests"],"message":"Marked 2 tasks as complete"}

For DELETE_TASK:
{"type":"DELETE_TASK","taskTitle":"Fix login bug","message":"Deleted task: Fix login bug"}

For DELETE_TASKS:
{"type":"DELETE_TASKS","taskTitles":["Old task 1","Old task 2"],"message":"Deleted 2 tasks"}

For UPDATE_TASK:
{"type":"UPDATE_TASK","taskTitle":"Fix login bug","updates":{"priority":"URGENT","dueDate":"...","labels":["backend","hotfix"],"assigneeName":"Jane Smith"},"message":"Updated task: Fix login bug"}

For MOVE_TASKS_TO_SPRINT:
{"type":"MOVE_TASKS_TO_SPRINT","taskTitles":["Task 1","Task 2"],"sprintName":"Sprint 1","message":"Moved 2 tasks to Sprint 1"}

For CREATE_REMINDER:
{"type":"CREATE_REMINDER","reminder":{"title":"...","description":"...","remindAt":"...ISO date..."},"message":"Reminder set for ..."}

For BREAKDOWN_TASK:
{"type":"BREAKDOWN_TASK","tasks":[{"title":"Subtask 1","priority":"HIGH","estimatedHours":2,"labels":["backend"],"projectName":"Product Redesign"}],"message":"Breakdown into X subtasks"}

For CREATE_SPRINT:
{"type":"CREATE_SPRINT","sprint":{"name":"Sprint 1","goal":"...","startDate":"...","endDate":"...","tasks":[{"title":"...","priority":"HIGH","estimatedHours":4}]},"projectName":"Product Redesign","message":"Created sprint with X tasks"}

For SUMMARIZE:
{"type":"SUMMARIZE","summary":"Today you...","message":"Summary generated"}

Be smart about:
- If user mentions a project name, set "projectName" to match the closest available project name exactly
- If user mentions assigning to someone, set "assigneeName" to the closest matching team member name
- "tomorrow" = next day, "next week" = 7 days from now, "Friday" = next Friday
- "high priority" = HIGH, "urgent" = URGENT
- "bug" tasks should have HIGH priority by default
- "meeting" or "review" → labels: ["meeting"]
- "backend" → labels: ["backend"], "frontend" → labels: ["frontend"]
- "move X to in progress" → UPDATE_TASK_STATUS with newStatus: "IN_PROGRESS"
- "create a task in progress / in review / done" → CREATE_TASK with status set accordingly (TODO is default)
- If user says "in review", "in progress", "done" while creating a task, set status in the tasks array
- "mark X as done" / "complete X" → COMPLETE_TASKS
- "delete X" / "remove X" → DELETE_TASK or DELETE_TASKS
- "move X to sprint Y" → MOVE_TASKS_TO_SPRINT
- Use taskTitle (singular) when only one task, taskTitles (array) when multiple
- Match task names from context if available — use the closest matching title`;
};

// ─── Exported service ─────────────────────────────────────────────────────────

export const aiService = {
  async processCommand(
    userInput: string,
    contextData?: {
      tasks?: Array<{ title: string; status: string; priority: string }>;
      recentActivities?: string[];
      projects?: Array<{ id: string; name: string }>;
      members?: Array<{ name: string; email: string }>;
      sprints?: Array<{ id: string; name: string }>;
    }
  ): Promise<AIActionResult> {
    try {
      let contextMessage = "";
      if (contextData?.tasks && contextData.tasks.length > 0) {
        contextMessage = `\n\nCurrent tasks context:\n${contextData.tasks
          .slice(0, 10)
          .map((t) => `- ${t.title} (${t.status}, ${t.priority})`)
          .join("\n")}`;
      }
      if (contextData?.recentActivities && contextData.recentActivities.length > 0) {
        contextMessage += `\n\nRecent activities:\n${contextData.recentActivities.slice(0, 5).join("\n")}`;
      }

      const content = await callAI(
        buildSystemPrompt({ projects: contextData?.projects, members: contextData?.members, sprints: contextData?.sprints }),
        userInput + contextMessage
      );
      const parsed = parseAIResponse(content);
      logger.info(`AI (${AI_PROVIDER}) processed command:`, { input: userInput, type: parsed.type });
      return parsed;
    } catch (error: unknown) {
      return handleAIError(error);
    }
  },

  async generateSummary(
    tasks: Array<{ title: string; status: string; priority: string; createdAt: Date }>,
    activities: Array<{ description: string; createdAt: Date }>
  ): Promise<string> {
    try {
      const tasksText = tasks.slice(0, 20).map((t) => `- ${t.title} (${t.status})`).join("\n");
      const activitiesText = activities.slice(0, 10).map((a) => `- ${a.description}`).join("\n");

      const systemPrompt =
        "You are FlowPilot AI. Generate a concise, professional daily summary in 2-3 sentences. Be specific about numbers and accomplishments. Respond with plain text only, no JSON.";

      const content = await callAI(
        systemPrompt,
        `Generate a daily summary based on:\n\nTasks:\n${tasksText}\n\nActivities:\n${activitiesText}`
      );
      return content.trim() || "No summary available";
    } catch (error) {
      logger.error("Generate summary error:", error);
      return "Unable to generate summary at this time";
    }
  },

  async generateSprintPlan(goal: string, durationDays: number = 14): Promise<AIActionResult> {
    const prompt = `Plan a ${durationDays}-day sprint for: "${goal}". Create 5-8 well-structured tasks with priorities and time estimates.`;
    return this.processCommand(prompt);
  },

  /** Returns which AI provider is currently active */
  getProvider(): string {
    return AI_PROVIDER;
  },
};
