import { z } from "zod";
import { assistantEventSchema } from "@shared/assistant";

export const ASSISTANT_SESSION_KEY = "cge-assistant-session-v1";
export const assistantMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
  events: z.array(assistantEventSchema).max(8).optional(),
  suggestedCriteria: z.array(z.string().max(100)).max(3).optional(),
});
export type AssistantMessage = z.infer<typeof assistantMessageSchema>;
const messagesSchema = z.array(assistantMessageSchema).max(24);

export function readAssistantSession(storage: Pick<Storage, "getItem">): AssistantMessage[] {
  try {
    const raw = storage.getItem(ASSISTANT_SESSION_KEY);
    if (!raw || raw.length > 200000) return [];
    const parsed = messagesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch { return []; }
}
export function saveAssistantSession(storage: Pick<Storage, "setItem">, messages: AssistantMessage[]): boolean {
  try {
    storage.setItem(ASSISTANT_SESSION_KEY, JSON.stringify(messages.slice(-24)));
    return true;
  } catch { return false; }
}
export function assistantHistory(messages: AssistantMessage[]) {
  return messages.slice(-12).map(({ role, content }) => ({ role, content }));
}
