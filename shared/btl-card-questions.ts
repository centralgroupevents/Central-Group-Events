// Conversation-card questions for the name cards. Every guest gets a different
// question: a saved one if the admin wrote or locked it, otherwise one picked
// from the pool below by their position (or category), never repeating a
// question until a group's pool runs out.

export type QuestionGroup = "venue" | "planner" | "music" | "creator" | "hospitality" | "business" | "community" | "general";

export const QUESTION_POOL: Record<QuestionGroup, string[]> = {
  venue: [
    "What does a room need before a stranger feels comfortable talking to the person next to them?",
    "What's the one thing renters ask for that you never expected to be asked?",
    "What's a small detail in your space that guests notice before anything else?",
    "What would you build into a venue if cost didn't matter?",
    "What's the quietest night of the week at your place, and what would fill it?",
    "Who's the best event you've ever hosted, and what made the room work?",
  ],
  planner: [
    "What's the part of planning that guests never see but would notice right away if it went wrong?",
    "What's the first thing you do when an event starts falling apart?",
    "What's the best event you've attended as a guest, and what did the planner get right?",
    "What's one trend in New Jersey events you hope disappears, and one you hope sticks around?",
    "How do you decide who gets the first invitation and who gets the last?",
    "What would you plan if you had a free venue and one month?",
  ],
  music: [
    "What's the one track that always changes the energy in a room, and why does it work?",
    "What does a Jersey crowd do that no other crowd does?",
    "What's the hardest room you've ever played, and what won it over?",
    "How do you read a room in the first ten minutes?",
    "What's the song you're tired of being asked for, and the one you never get tired of playing?",
    "Who should every promoter in this room be booking right now?",
  ],
  creator: [
    "What's a piece of content that did far better than you expected, and why do you think it landed?",
    "What's something you've learned about New Jersey audiences that numbers alone can't tell you?",
    "What's the best brand collaboration you've done, and what made it feel real?",
    "How do you decide what's worth posting and what's just noise?",
    "Who in this room would you most like to collaborate with, and on what?",
    "What's a story from this scene that deserves to be told properly?",
  ],
  hospitality: [
    "What's the dish or drink that tells people who you are?",
    "What does hospitality mean to you beyond the food?",
    "What's the best thing a guest has ever said to you after a night?",
    "How do you keep quality steady on the busiest night?",
    "What's one local partner you wish more people in New Jersey knew about?",
    "What would your ideal collaboration with a venue look like?",
  ],
  business: [
    "What's one decision in your career you'd make exactly the same way again?",
    "What's something you know about your industry that most people in this room don't?",
    "What question do you wish more people asked you about your work?",
    "Where do you see the most opportunity in New Jersey over the next three years?",
    "What's the best advice you've received about building something that lasts?",
    "Who here could you help, and what would you need in return?",
  ],
  community: [
    "What's one thing your community needs that the events scene could help with?",
    "What's the best turnout you've ever seen, and what brought people in?",
    "How do you get people to show up twice?",
    "What's a New Jersey story you're proud of that rarely gets told?",
    "Who is quietly doing important work that more people should know?",
    "What would you do with one more hour in the day for your community?",
  ],
  general: [
    "What are you building, or hoping to build, in New Jersey, and what's the first thing you'd need to make it real?",
    "What's the best thing that's happened for you in the last six months?",
    "What brought you here tonight, and who are you hoping to meet?",
    "What's one thing you'd change about how people in New Jersey show up for each other?",
    "What's the best event you've ever been to, and what made it work?",
    "What's a skill you have that people are surprised by?",
    "What's one thing you're learning right now?",
    "Who taught you the most about your work, and what did they teach you?",
    "What's the most underrated spot in New Jersey?",
    "What would make tonight worth your time?",
    "What's a risk you took that paid off?",
    "What's the question you'd most like to ask someone in this room?",
  ],
};

const MATCHERS: Array<[QuestionGroup, RegExp]> = [
  ["music", /\b(dj|music|producer|artist|singer|rapper|band|audio|sound|beat)/i],
  ["venue", /\b(venue|lounge|space|club|bar|cafe|café|gallery|hall|studio|theat|museum|rental)/i],
  ["hospitality", /\b(chef|food|restaurant|catering|caterer|bakery|kitchen|wine|cocktail|bartend|drink|brew|coffee|hospitality)/i],
  ["planner", /\b(planner|planning|promoter|promotion|events?|curator|coordinator|production|nightlife|festival|organiz)/i],
  ["creator", /\b(influencer|creator|content|photograph|video|media|blog|writer|podcast|brand|marketing|social)/i],
  ["community", /\b(nonprofit|non-profit|community|institution|city|government|council|school|church|foundation|org\b)/i],
  ["business", /\b(founder|owner|ceo|cfo|president|attorney|lawyer|real estate|realtor|agent|consult|tech|engineer|developer|invest|finance|account|manager|director)/i],
];

// Used only when every pool question is taken. Each one names the guest, so
// no two cards can come out identical.
const PERSONAL_TEMPLATES = [
  (f: string, w: string) => `${f}, what's something about ${w} that people outside it never see?`,
  (f: string, w: string) => `${f}, what's the best thing that's happened for you in ${w} this year?`,
  (f: string, w: string) => `${f}, who would you most like to meet tonight, and what would you ask them about ${w}?`,
  (f: string, w: string) => `${f}, what's one thing about ${w} you'd teach everyone in this room?`,
  (f: string, w: string) => `${f}, what would make ${w} easier for someone starting out in New Jersey?`,
  (f: string, w: string) => `${f}, what's a lesson from ${w} that surprised you?`,
];
function personalized(g: { name: string; position: string }, i: number, used: Set<string>): string {
  const parts = g.name.trim().split(/\s+/).filter(Boolean);
  const work = g.position.trim() ? `your work as ${/^[aeiou]/i.test(g.position.trim()) ? "an" : "a"} ${g.position.trim().toLowerCase()}` : "your work";
  // First name first; the full name if that exact text is already on a card.
  for (const who of [parts[0] || "Friend", g.name.trim() || "Friend"]) {
    for (let k = 0; k < PERSONAL_TEMPLATES.length; k++) {
      const q = PERSONAL_TEMPLATES[(i + k) % PERSONAL_TEMPLATES.length](who, work);
      if (!used.has(q.toLowerCase())) return q;
    }
  }
  return PERSONAL_TEMPLATES[i % PERSONAL_TEMPLATES.length](g.name.trim() || "Friend", work);
}

/** Which pool fits this guest, from their position text and/or category. */
export function questionGroupFor(position: string, category?: string | null): QuestionGroup {
  const text = `${position} ${category ?? ""}`;
  for (const [g, re] of MATCHERS) if (re.test(text)) return g;
  if (category === "dj") return "music";
  if (category === "venue_owner") return "venue";
  if (category === "planner") return "planner";
  if (category === "influencer") return "creator";
  if (category === "institutional") return "community";
  return "general";
}

/**
 * Picks a question for every guest without a saved one. Deterministic for a
 * given list (alphabetical), never reuses a question while any unused one
 * remains in the guest's group or the general pool.
 */
export function assignQuestions(
  guests: Array<{ key: string; name: string; position: string; category?: string | null }>,
  saved: Record<string, string>,
): Record<string, string> {
  const used = new Set(Object.values(saved).map((q) => q.trim().toLowerCase()).filter(Boolean));
  const out: Record<string, string> = {};
  const cursor: Partial<Record<QuestionGroup, number>> = {};
  const next = (g: QuestionGroup): string | null => {
    for (const grp of [g, "general" as QuestionGroup]) {
      const pool = QUESTION_POOL[grp];
      for (let i = 0; i < pool.length; i++) {
        const idx = ((cursor[grp] ?? 0) + i) % pool.length;
        if (!used.has(pool[idx].toLowerCase())) {
          cursor[grp] = idx + 1;
          return pool[idx];
        }
      }
    }
    return null;
  };
  let fallbackIdx = 0;
  const ordered = [...guests].sort((a, b) => a.name.localeCompare(b.name));
  for (const g of ordered) {
    if (saved[g.key]?.trim()) continue;
    const q = next(questionGroupFor(g.position, g.category)) ?? personalized(g, fallbackIdx++, used);
    const pick = q;
    used.add(pick.toLowerCase());
    out[g.key] = pick;
  }
  return out;
}
