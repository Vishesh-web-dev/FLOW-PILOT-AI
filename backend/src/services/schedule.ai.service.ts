import { logger } from "../utils/logger";
import { callAI, handleAIError } from "./ai.service";

export interface ScheduleAIResult {
  name: string;
  description: string;
  type: "DAILY" | "WEEKLY" | "MONTHLY";
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
- Today: ${new Date().toISOString()}`;

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
