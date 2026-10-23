// Canonical event types — the 12 buckets every event genre folds into.
// Events keep whatever free-form genre they were imported with; the public
// filter dropdown and matching both go through normalizeEventType(), so a
// messy import ("R&B brunch vibes") still lands in the right bucket.

export const EVENT_TYPES = [
  "Brunch",
  "Day Party",
  "Nightlife & DJ Sets",
  "Concerts & Live Music",
  "Happy Hour",
  "Festivals & Markets",
  "Comedy",
  "Watch Parties & Sports",
  "Arts & Culture",
  "Food & Drink",
  "Classes & Wellness",
  "Community & Special Events",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

// Ordered keyword rules — first hit wins, so the more specific buckets
// (brunch, day party, happy hour…) sit above the generic ones (party →
// nightlife). Everything unmatched lands in Community & Special Events.
const RULES: Array<[EventType, string[]]> = [
  ["Brunch", ["brunch"]],
  ["Day Party", ["day party", "dayparty", "day fete", "day rave"]],
  ["Happy Hour", ["happy hour", "after work", "after-work"]],
  ["Watch Parties & Sports", ["watch part", "game night", "fight night", "sports", "football", "basketball", "soccer", "world cup", "playoff"]],
  ["Comedy", ["comedy", "stand-up", "standup", "stand up", "improv", "open mic comedy"]],
  ["Festivals & Markets", ["festival", "fest", "market", "fair", "expo", "bazaar", "pop-up", "popup", "block party", "carnival"]],
  ["Classes & Wellness", ["class", "yoga", "fitness", "workout", "wellness", "run club", "pilates", "meditation"]],
  ["Arts & Culture", ["art", "gallery", "museum", "theater", "theatre", "film", "movie", "poetry", "paint", "exhibit", "culture", "fashion"]],
  ["Food & Drink", ["food", "tasting", "wine", "dinner", "brewery", "distillery", "cook", "chef", "eat", "restaurant week"]],
  ["Concerts & Live Music", ["concert", "live music", "live band", "band", "jazz", "r&b night", "music", "performance", "showcase", "karaoke"]],
  ["Nightlife & DJ Sets", ["dj", "night", "club", "party", "fete", "rave", "lounge", "afrobeats", "amapiano", "reggae", "soca", "latin", "silent disco", "mixer"]],
];

/** Fold a free-form genre string into one of the 12 canonical types. */
export function normalizeEventType(raw: string | null | undefined): EventType {
  const g = (raw || "").trim().toLowerCase();
  if (!g) return "Community & Special Events";
  // An exact canonical name always wins (events created via the admin
  // dropdown store these verbatim).
  const exact = EVENT_TYPES.find((t) => t.toLowerCase() === g);
  if (exact) return exact;
  for (const [type, keywords] of RULES) {
    if (keywords.some((k) => g.includes(k))) return type;
  }
  return "Community & Special Events";
}
