// Conversation-card prompts for the name cards. Every guest gets two:
//   ask    — a question they'd love to be asked (their expertise, a recent win,
//            their biggest current challenge)
//   share  — a question that gets them to hand over hard-won advice
// A saved prompt (written or locked by the admin) always wins; otherwise one
// pair is picked from the pool below by the guest's position or category,
// and no prompt is used twice until the pools run out.
// Kept short on purpose: both have to fit on the back of a 3.5 × 2 in card.
// They must also work for any guest in the group, so none of them assume how
// someone operates (invite-only vs open, rentals, DJs vs other performers...).

export type QuestionGroup = "creator" | "community" | "venue" | "music" | "planner" | "hospitality" | "business" | "general";
export interface CardPrompts { ask: string; share: string }

export const QUESTION_POOL: Record<QuestionGroup, CardPrompts[]> = {
  // Creators & influencers
  creator: [
    { ask: "Which content strategy or platform recently outperformed your expectations?", share: "What's the fastest way for a collaborator to win you over, or turn you off?" },
    { ask: "How do you stay authentic while scaling a personal brand or creative project?", share: "What piece of conventional marketing wisdom would you tell this room to ignore?" },
    { ask: "What's one thing you did this year that drove unexpected growth?", share: "What do brands get wrong when they approach a creator for the first time?" },
    { ask: "What's the most underrated platform or format for Jersey audiences right now?", share: "What's your best tip for turning a one-time collab into a repeat partnership?" },
    { ask: "Which of your posts surprised you most, and why do you think it landed?", share: "What would you tell a creator who's just starting to monetize?" },
    { ask: "How has the New Jersey scene shaped the way you create?", share: "What's one shortcut in content creation that's actually worth taking?" },
  ],
  // Community partners & civic leaders
  community: [
    { ask: "Where's the biggest gap between local community groups and independent creators in NJ?", share: "What underused grant, resource, or local network do most NJ entrepreneurs miss?" },
    { ask: "What's one thing your community needs that the events scene could help with?", share: "How do you get people to show up twice?" },
    { ask: "What's a New Jersey story you're proud of that rarely gets told?", share: "What's the best way for a creator to approach your organization?" },
    { ask: "How are you adapting your programs to navigate current economic shifts?", share: "What's one local network or partner every entrepreneur should know?" },
    { ask: "What's the best turnout you've seen, and what brought people in?", share: "What would make it easier for independent creators to work with community groups?" },
    { ask: "Who is quietly doing important work that more people should know?", share: "What does a good partnership with a community organization look like?" },
  ],
  // Venue owners & space curators
  venue: [
    { ask: "Beyond the vibes, what's the hardest operational or financial reality of keeping a space alive?", share: "What separates a chaotic one-off promoter from a recurring partner who respects the space?" },
    { ask: "What makes a space feel like a community third space, not just a venue?", share: "What do you wish every event organizer knew before working in your space?" },
    { ask: "What's the hardest night to fill at your space, and how would you fill it?", share: "What's one low-cost change that makes a room feel better right away?" },
    { ask: "How has the New Jersey landscape influenced the way you curate your space?", share: "How do you decide which events are a fit and which to turn down?" },
    { ask: "What do clients ask for that you never expected to be asked?", share: "What should every host confirm before event day?" },
    { ask: "What's your biggest operational hurdle heading into next year?", share: "What hard lesson from running a space would you hand to someone opening their own?" },
  ],
  // DJs & live performers
  music: [
    { ask: "When the crowd isn't locking in, what's your go-to shift to turn the night around?", share: "What audio or production mistake do organizers keep making with live events?" },
    { ask: "What's the hardest room you've played, and what won it over?", share: "What do promoters get wrong when they book artists for a night?" },
    { ask: "How do you read a room in the first ten minutes?", share: "What's one rule you'd give a new performer before their first paid gig?" },
    { ask: "What does a New Jersey crowd do that no other crowd does?", share: "What's the one piece of gear or setup you'd never skip?" },
    { ask: "What track always changes the energy in a room, and why does it work?", share: "How should organizers plan the night around the music, not the other way around?" },
    { ask: "Who should every promoter in this room be booking right now?", share: "What's the best way for a venue to make a DJ feel at home?" },
  ],
  planner: [
    { ask: "What's the part of planning guests never see but would notice right away if it went wrong?", share: "What's your first move when an event starts falling apart?" },
    { ask: "What's the most memorable event you've attended recently, and why?", share: "What's one detail every first-time planner overlooks?" },
    { ask: "How has the New Jersey landscape influenced the way you curate your events?", share: "What's your approach to building the right crowd for an event?" },
    { ask: "What's the most valuable cross-industry partnership you've formed so far?", share: "What makes a partner want to work with you again?" },
    { ask: "Which trend in New Jersey events do you hope sticks around?", share: "Which trend should the scene leave behind?" },
    { ask: "What would you plan with a free venue and one month?", share: "What's the most valuable lesson from an event that went wrong?" },
  ],
  hospitality: [
    { ask: "What's the dish or drink that tells people who you are?", share: "What does hospitality mean to you beyond the food?" },
    { ask: "What's the hardest part of keeping quality steady on your busiest night?", share: "What should event hosts ask a food partner before booking?" },
    { ask: "How are you adapting your menu or pricing to current economic shifts?", share: "What simple move makes a small bite feel premium?" },
    { ask: "What's the best thing a guest has ever said to you after a night?", share: "How should a venue and a food partner split the work?" },
    { ask: "Which local partner do you wish more people in New Jersey knew about?", share: "What's the best way to plan food for a crowd that mingles?" },
    { ask: "What would your ideal collaboration with a venue look like?", share: "What lesson from a service mistake would you pass on?" },
  ],
  // Founders, owners, attorneys, real estate, tech, finance…
  business: [
    { ask: "What's your biggest operational focus or hurdle heading into next year?", share: "What's one decision about building something that lasts you'd make the same way again?" },
    { ask: "How are you adapting your business model to current economic shifts?", share: "What do first-time founders in New Jersey most often get wrong?" },
    { ask: "What does a sustainable business mean to you versus a fast-growth one?", share: "Which resource or network do most entrepreneurs here not realize they have?" },
    { ask: "Where do you see the most opportunity in New Jersey over the next three years?", share: "What lesson from a deal or contract that went wrong would you pass on?" },
    { ask: "What's the most valuable cross-industry partnership you've formed so far?", share: "What question should every founder ask before signing something?" },
    { ask: "What question do you wish more people asked about your work?", share: "What's the best advice you've received about building something that lasts?" },
  ],
  general: [
    { ask: "If you could collaborate with anyone in New Jersey, who would it be?", share: "What can you offer someone in this room tomorrow?" },
    { ask: "What brought you here tonight, and who are you hoping to meet?", share: "What's one thing you've learned this year that you'd pass on?" },
    { ask: "What's the most memorable event experience you've had recently, and why?", share: "What made it work that organizers could copy?" },
    { ask: "What are you building, or hoping to build, in New Jersey?", share: "What's the first thing you'd need to make it real, and who here could help?" },
    { ask: "What's a piece of conventional wisdom you chose to ignore?", share: "What's the best risk you've taken?" },
    { ask: "What makes a space feel like a community third space?", share: "What's one thing every host can do to get strangers talking?" },
    { ask: "How has New Jersey shaped the way you work?", share: "What's the most underrated spot in the state?" },
    { ask: "What's your biggest hurdle heading into next year?", share: "What help would make the biggest difference to you right now?" },
    { ask: "Who taught you the most about your work?", share: "What did they teach you that you still use?" },
    { ask: "What's the best thing that's happened for you in the last six months?", share: "What lesson from it could others use?" },
    { ask: "What does building something sustainable mean to you?", share: "What would you tell someone starting out today?" },
    { ask: "What's a skill you have that people are surprised by?", share: "How could you put it to work for someone here?" },
  ],
};

const MATCHERS: Array<[QuestionGroup, RegExp]> = [
  ["music", /\b(dj|music|producer|artist|singer|rapper|band|audio|sound|beat|performer)/i],
  ["venue", /\b(venue|lounge|space|club|bar|cafe|café|gallery|hall|studio|theat|museum|rental)/i],
  ["hospitality", /\b(chef|food|restaurant|catering|caterer|bakery|kitchen|wine|cocktail|bartend|drink|brew|coffee|hospitality)/i],
  ["planner", /\b(planner|planning|promoter|promotion|events?|curator|coordinator|production|nightlife|festival|organiz)/i],
  ["creator", /\b(influencer|creator|content|photograph|video|media|blog|writer|podcast|brand|marketing|social)/i],
  ["community", /\b(nonprofit|non-profit|community|institution|civic|city|government|council|school|church|foundation|org\b)/i],
  ["business", /\b(founder|owner|ceo|cfo|president|attorney|lawyer|real estate|realtor|agent|consult|tech|engineer|developer|invest|finance|account|manager|director|entrepreneur)/i],
];

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

// Used only when every pool pair is taken. Each one names the guest, so no two
// cards can come out identical.
const PERSONAL_ASK = [
  (f: string, w: string) => `${f}, what's something about ${w} that people outside it never see?`,
  (f: string, w: string) => `${f}, what's the best thing that's happened for you in ${w} this year?`,
  (f: string, w: string) => `${f}, what's your biggest hurdle in ${w} heading into next year?`,
  (f: string, w: string) => `${f}, what's a lesson from ${w} that surprised you?`,
];
const PERSONAL_SHARE = [
  (f: string, w: string) => `${f}, what's one thing about ${w} you'd teach everyone in this room?`,
  (f: string, w: string) => `${f}, what would make ${w} easier for someone starting out in New Jersey?`,
  (f: string, w: string) => `${f}, who here could you help with ${w}, and how?`,
  (f: string, w: string) => `${f}, what's a mistake in ${w} you'd save someone from making?`,
];
function personalized(g: { name: string; position: string }, i: number, used: Set<string>): CardPrompts {
  const parts = g.name.trim().split(/\s+/).filter(Boolean);
  const work = g.position.trim() ? `your work as ${/^[aeiou]/i.test(g.position.trim()) ? "an" : "a"} ${g.position.trim().toLowerCase()}` : "your work";
  const pick = (list: Array<(f: string, w: string) => string>, offset: number) => {
    for (const who of [parts[0] || "Friend", g.name.trim() || "Friend"]) {
      for (let k = 0; k < list.length; k++) {
        const q = list[(i + offset + k) % list.length](who, work);
        if (!used.has(q.toLowerCase())) return q;
      }
    }
    return list[(i + offset) % list.length](g.name.trim() || "Friend", work);
  };
  return { ask: pick(PERSONAL_ASK, 0), share: pick(PERSONAL_SHARE, 1) };
}

/**
 * Picks a pair for every guest without saved prompts. Deterministic for a
 * given list (alphabetical); never reuses a question while any unused pair
 * remains in the guest's group or the general pool.
 */
export function assignQuestions(
  guests: Array<{ key: string; name: string; position: string; category?: string | null }>,
  saved: Record<string, { ask?: string; share?: string }>,
): Record<string, CardPrompts> {
  const used = new Set<string>();
  for (const v of Object.values(saved)) for (const q of [v.ask, v.share]) if (q?.trim()) used.add(q.trim().toLowerCase());
  const out: Record<string, CardPrompts> = {};
  const cursor: Partial<Record<QuestionGroup, number>> = {};
  const next = (g: QuestionGroup): CardPrompts | null => {
    for (const grp of [g, "general" as QuestionGroup]) {
      const pool = QUESTION_POOL[grp];
      for (let i = 0; i < pool.length; i++) {
        const idx = ((cursor[grp] ?? 0) + i) % pool.length;
        const pair = pool[idx];
        if (!used.has(pair.ask.toLowerCase()) && !used.has(pair.share.toLowerCase())) {
          cursor[grp] = idx + 1;
          return pair;
        }
      }
    }
    return null;
  };
  let fallbackIdx = 0;
  const ordered = [...guests].sort((a, b) => a.name.localeCompare(b.name));
  for (const g of ordered) {
    const have = saved[g.key] ?? {};
    const needAsk = !have.ask?.trim();
    const needShare = !have.share?.trim();
    if (!needAsk && !needShare) continue;
    const pair = next(questionGroupFor(g.position, g.category)) ?? personalized(g, fallbackIdx++, used);
    const result: CardPrompts = { ask: needAsk ? pair.ask : have.ask!.trim(), share: needShare ? pair.share : have.share!.trim() };
    used.add(result.ask.toLowerCase());
    used.add(result.share.toLowerCase());
    out[g.key] = result;
  }
  return out;
}
