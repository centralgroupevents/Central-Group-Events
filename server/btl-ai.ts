// Suggested card positions for guests who didn't give one. The model only sees
// the clues we already have (name, Instagram handle, category, invite notes) —
// it cannot look anyone up — so it is told to answer with a blank unless the
// clues clearly point to a role. Suggestions are shown as "AI suggested" and
// are always editable; they never overwrite a position a guest typed.

export interface PositionClue {
  key: string;
  name: string;
  ig: string | null;
  category: string | null;
  notes: string | null;
}

export async function suggestPositions(guests: PositionClue[]): Promise<Record<string, string>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("AI isn't set up on the server (GEMINI_API_KEY is missing).");
  if (guests.length === 0) return {};
  const { GoogleGenerativeAI, SchemaType } = await import("@google/generative-ai");
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            key: { type: SchemaType.STRING },
            position: { type: SchemaType.STRING, description: "Short role, max 4 words, or an empty string" },
          },
          required: ["key", "position"],
        },
      },
    },
  });
  const lines = guests.map((g) => JSON.stringify({ key: g.key, name: g.name, instagram: g.ig, category: g.category, notes: g.notes }));
  const prompt = [
    "You label guests for name cards at a New Jersey events-industry networking night.",
    "For each guest, give a SHORT position or role (max 4 words, Title Case), for example: DJ, Event Planner, Venue Owner, Photographer, Chef & Host, Content Creator.",
    "Use ONLY the clues given (name, Instagram handle, category, notes). You cannot look anyone up.",
    "If the clues do not clearly indicate a role, return an empty string for position. Never invent employers, seniority, or credentials.",
    "Return one object per guest, echoing the key exactly.",
    "",
    ...lines,
  ].join("\n");
  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(result.response.text()) as Array<{ key?: string; position?: string }>;
  const out: Record<string, string> = {};
  const valid = new Set(guests.map((g) => g.key));
  for (const row of Array.isArray(parsed) ? parsed : []) {
    const key = String(row.key ?? "");
    const pos = String(row.position ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (valid.has(key) && pos) out[key] = pos;
  }
  return out;
}
