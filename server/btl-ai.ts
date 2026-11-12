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

export interface TailorClue {
  key: string;
  name: string;
  position: string;
  ig: string | null;
  about: string;
}
export interface TailoredPrompts { ask: string; share: string; basis: string; flag: string }

/**
 * Two conversation-card questions per guest, written from what we actually
 * know about them (position, Instagram handle, a note typed by the admin). The model must stay inside those facts, say what it based each
 * pair on, and raise a flag when the clues are thin, so the admin can check
 * anything that doesn't fit before it's printed.
 */
export async function tailorQuestions(guests: TailorClue[]): Promise<Record<string, TailoredPrompts>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("AI isn't set up on the server (GEMINI_API_KEY is missing).");
  if (guests.length === 0) return {};
  const { GoogleGenerativeAI, SchemaType } = await import("@google/generative-ai");
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            key: { type: SchemaType.STRING },
            ask: { type: SchemaType.STRING },
            share: { type: SchemaType.STRING },
            basis: { type: SchemaType.STRING, description: "Under 14 words: which fact the questions are built on" },
            flag: { type: SchemaType.STRING, description: "Empty, or a short note when the clues are thin or a question might not fit" },
          },
          required: ["key", "ask", "share", "basis", "flag"],
        },
      },
    },
  });
  const lines = guests.map((g) => JSON.stringify({ key: g.key, name: g.name, position: g.position, instagram: g.ig, background: g.about }));
  const prompt = [
    "You write conversation-card questions for a networking night of New Jersey creators, venue owners, event planners, DJs and community partners (Build to Last, Nov 12, Newark).",
    "For each guest write TWO questions:",
    "  ask   = a question they would love to be asked: it lets them show expertise, unpack their biggest current challenge, or share a recent win.",
    "  share = a question that gets them to give away hard-won advice or critique a common mistake in their field.",
    "Style examples: \"Which content strategy or platform recently outperformed your expectations?\" / \"What's the fastest way for a collaborator to win you over, or turn you off?\" / \"When the crowd isn't locking in, what's your go-to shift to turn the night around?\"",
    "Rules:",
    "- Under 95 characters each, plain and conversational, no preamble. Never reuse an opening across guests.",
    "- Use ONLY the facts given (position, Instagram handle, background). You cannot see their Instagram or the web, so never invent specifics about the person or their business (clients, events, awards, followers, history). Plain general knowledge about their kind of work in New Jersey is fine.",
    "- The Instagram handle is only a hint. Use it when it plainly names their craft or brand (for example a handle with 'rnb' or 'catering' in it); otherwise ignore it.",
    "- Make each question specific to what they do, as far as the given facts support it.",
    "- Do not assume how they operate. If the background does not say, do not assume invite-only or open, paid or free, large or small, a venue or a promoter. Write questions that still make sense if your assumption were wrong.",
    "- Do not mention their Instagram or that you looked anything up.",
    "- basis: under 14 words, naming the fact you used (for example: handle suggests R&B events, role is promoter). If only a generic position is known, write: role only.",
    "- flag: leave empty when the background clearly supports the questions. If you only had a generic position, or a question might not fit, write a short note.",
    "- Echo each key exactly.",
    "",
    ...lines,
  ].join("\n");
  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(result.response.text()) as Array<Partial<TailoredPrompts> & { key?: string }>;
  const valid = new Set(guests.map((g) => g.key));
  const out: Record<string, TailoredPrompts> = {};
  for (const r of Array.isArray(parsed) ? parsed : []) {
    const key = String(r.key ?? "");
    const ask = String(r.ask ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
    const share = String(r.share ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
    if (!valid.has(key) || !ask || !share) continue;
    out[key] = { ask, share, basis: String(r.basis ?? "").trim().slice(0, 120), flag: String(r.flag ?? "").trim().slice(0, 160) };
  }
  return out;
}
