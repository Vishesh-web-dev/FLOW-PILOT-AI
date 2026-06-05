import { logger } from "../utils/logger";
import { callAI, handleAIError } from "./ai.service";

export interface ScheduleAIResult {
  name: string;
  description: string;
  type: "DAILY" | "WEEKLY" | "MONTHLY";
  startDate?: string; // "YYYY-MM-DD" — only when a specific start date is clearly mentioned
  endDate?: string;   // "YYYY-MM-DD" — only when a specific end date / duration is clearly mentioned
  items: Array<{
    title: string;
    description?: string;
    timeOfDay?: string;
    category?: string;
  }>;
}

const SCHEDULE_SYSTEM_PROMPT = `You are a productivity coach AI. Create structured schedules from user prompts.

Respond ONLY with valid JSON — no markdown, no explanation.

JSON format:
{
  "name": "Schedule name",
  "description": "Brief description",
  "type": "DAILY",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "items": [
    { "title": "Wake up", "description": "Optional detail", "timeOfDay": "06:00", "category": "health" }
  ]
}

Rules:
- Create 5–12 meaningful, actionable items (keep descriptions under 10 words)
- timeOfDay in "HH:MM" 24h format — include when time is mentioned or implied
- category: health | work | personal | learning | fitness | mindfulness
- type: DAILY | WEEKLY | MONTHLY (infer from prompt, default DAILY)
- Order items chronologically
- startDate / endDate (both optional, format "YYYY-MM-DD"):
    • Only include startDate when the user explicitly mentions a start date
    • Only include endDate when the user explicitly mentions an end date or duration (e.g. "for 30 days", "until Dec 31")
    • If neither date is mentioned, omit both fields entirely (lifetime schedule)
    • Never invent dates that are not implied by the prompt
- Today: ${new Date().toISOString().split("T")[0]}`;

function parseScheduleResponse(content: string): ScheduleAIResult {
  // Strip markdown code fences if present
  let cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // Extract the first complete JSON object via regex as a fallback
  // (handles cases where the AI prepends/appends extra text)
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  const parsed = JSON.parse(cleaned) as ScheduleAIResult;
  if (!parsed.name || !Array.isArray(parsed.items)) {
    throw new Error("Invalid schedule format returned by AI");
  }
  return parsed;
}

export const scheduleAIService = {
  async generate(prompt: string): Promise<ScheduleAIResult> {
    try {
      const content = await callAI(SCHEDULE_SYSTEM_PROMPT, prompt, 2500);
      const parsed = parseScheduleResponse(content);
      logger.info(`AI generated schedule: "${parsed.name}" with ${parsed.items.length} items`);
      return parsed;
    } catch (error: unknown) {
      return handleAIError(error);
    }
  },
};
