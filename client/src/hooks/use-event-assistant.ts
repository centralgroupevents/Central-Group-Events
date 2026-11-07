import { useEffect, useRef, useState } from "react";
import { chatResponseSchema, type AssistantEventSubmission } from "@shared/assistant";
import {
  assistantHistory, readAssistantSession, saveAssistantSession, type AssistantMessage,
} from "@/lib/assistant-session";

export type { AssistantMessage } from "@/lib/assistant-session";

async function postJson(path: string, data: unknown, signal: AbortSignal) {
  const response = await fetch(path, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data), signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : "Something went wrong. Please try again.");
  return body;
}

export function useEventAssistant() {
  const [messages, setMessages] = useState<AssistantMessage[]>(() => {
    try { return readAssistantSession(window.sessionStorage); } catch { return []; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionWarning, setSessionWarning] = useState<string | null>(null);
  const messagesRef = useRef(messages);
  const inFlight = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; abort.current?.abort(); };
  }, []);

  function store(next: AssistantMessage[]) {
    const bounded = next.slice(-24);
    messagesRef.current = bounded;
    setMessages(bounded);
    try {
      if (!saveAssistantSession(window.sessionStorage, bounded)) {
        setSessionWarning("Your browser couldn’t save this chat. It may reset when you leave this page.");
      }
    } catch { setSessionWarning("Chat storage is unavailable in this browser."); }
  }

  async function request<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
    if (inFlight.current) return null;
    inFlight.current = true;
    setLoading(true); setError(null);
    const controller = new AbortController();
    abort.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 45000);
    try {
      return await work(controller.signal);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error && err.name !== "AbortError"
        ? err.message : "The request took too long. Please try again.");
      return null;
    } finally {
      window.clearTimeout(timeout);
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }

  async function sendMessage(raw: string): Promise<boolean> {
    const message = raw.trim();
    if (!message || inFlight.current) return false;
    if (message.length > 1000) { setError("Keep your message under 1,000 characters."); return false; }
    const previous = messagesRef.current;
    const pending: AssistantMessage[] = [...previous, { role: "user", content: message }];
    store(pending);
    const result = await request(async signal => chatResponseSchema.parse(await postJson("/api/assistant/chat", {
      message, history: assistantHistory(previous),
    }, signal)));
    if (!mounted.current) return false;
    if (!result) {
      // Keep failed requests out of history, so retry sends the original context.
      store(previous);
      return false;
    }
    store([...pending, { role: "assistant", content: result.reply, events: result.events, suggestedCriteria: result.suggestedCriteria }]);
    return true;
  }

  async function submitEvent(formData: AssistantEventSubmission): Promise<{ id: number; message: string } | null> {
    return request(async signal => {
      const result = await postJson("/api/assistant/submit-event", formData, signal);
      if (typeof result.id !== "number" || typeof result.message !== "string") throw new Error("Unexpected submission response.");
      // Do not persist organizer contact details in conversation storage.
      if (mounted.current) store([...messagesRef.current, { role: "assistant", content: `${result.message} Event #${result.id}.` }]);
      return { id: result.id, message: result.message };
    });
  }

  function clearMessages() {
    if (!inFlight.current) { store([]); setError(null); }
  }
  return { messages, loading, error, sessionWarning, sendMessage, submitEvent, clearMessages };
}
