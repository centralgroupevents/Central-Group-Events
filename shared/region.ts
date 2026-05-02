// Region normalization helpers shared between client and server.
//
// Events come in from CSV imports, the booking form, and admin entries with
// inconsistent casing/spacing — "North NJ", "north", "central jersey",
// "South NJ", "south new jersey". Filtering, badge display, and storage all
// need to treat these as the same canonical region.

export type CanonicalRegion = "North NJ" | "Central NJ" | "South NJ";

const SECTION_RE = /\b(north|central|south)\b/i;

/** Extract the lowercase section keyword from any region-ish string, or null. */
export function regionSection(input: string | null | undefined): "north" | "central" | "south" | null {
  if (!input) return null;
  const m = input.match(SECTION_RE);
  if (!m) return null;
  const s = m[1].toLowerCase();
  if (s === "north" || s === "central" || s === "south") return s;
  return null;
}

/**
 * Canonicalize any region input to "North NJ" / "Central NJ" / "South NJ".
 * Returns the original (trimmed) value if no section keyword is found, so
 * non-NJ entries pass through unchanged rather than being dropped.
 */
export function normalizeRegion(input: string | null | undefined): string {
  if (!input) return "";
  const trimmed = String(input).trim();
  const section = regionSection(trimmed);
  if (!section) return trimmed;
  const titled = section.charAt(0).toUpperCase() + section.slice(1);
  return `${titled} NJ`;
}

/** True if the event region matches the filter region under flexible casing/wording. */
export function regionMatches(eventRegion: string | null | undefined, filter: string): boolean {
  const a = regionSection(eventRegion);
  const b = regionSection(filter);
  if (!a || !b) return false;
  return a === b;
}
