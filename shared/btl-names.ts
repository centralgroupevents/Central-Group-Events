// Name clean-up for the guest list: "john SMITH" → "John Smith",
// "MARIA o'brien" → "Maria O'Brien". Conservative on purpose — a token that is
// already mixed-case ("DeShawn", "McKay", "iPhone") is left alone, and short
// ALL-CAPS tokens (one or two letters) in an otherwise mixed name ("TC", "AJ") stay as
// typed. Only all-lowercase tokens (or a name typed entirely in one case)
// are rewritten.

const KEEP_UPPER = new Set([
  "DJ", "MC", "LLC", "INC", "CEO", "CFO", "COO", "CTO", "NJ", "NY", "NYC", "USA", "US", "II", "III", "IV", "MD", "JD", "PHD",
  "CIGI", "CGE", "CPA", "PR", "HR", "VIP", "LGBTQ", "BBQ", "TV", "AI",
]);
const KEEP_LOWER = new Set(["de", "da", "di", "del", "della", "van", "von", "der", "den", "la", "le", "bin", "al", "el", "of", "and", "the", "y"]);

function capWord(w: string): string {
  const lower = w.toLowerCase();
  // O'Brien, De'Andre, D'Angelo — capitalize after an apostrophe too.
  return lower
    .split("-")
    .map((part) =>
      part
        .split(/(['’])/)
        .map((seg) => (seg === "'" || seg === "’" ? seg : seg.charAt(0).toUpperCase() + seg.slice(1)))
        .join("")
        // McDonald / McKay (not "Mac": MacDonald and Mack are both real).
        .replace(/^Mc([a-z])/, (_m, c: string) => `Mc${c.toUpperCase()}`),
    )
    .join("-");
}

const isLetter = (c: string) => c.toLowerCase() !== c.toUpperCase();
const hasLower = (s: string) => /[a-z]/.test(s);
const hasUpper = (s: string) => /[A-Z]/.test(s);

export function normalizePersonName(raw: string): string {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!name) return name;
  const letters = Array.from(name).filter(isLetter).join("");
  const wholeNameOneCase = !!letters && (letters === letters.toLowerCase() || letters === letters.toUpperCase());
  const tokens = name.split(" ");
  return tokens
    .map((tok, i) => {
      const bare = tok.replace(/[^A-Za-z]/g, "");
      if (!bare) return tok; // numbers / symbols only
      if (KEEP_UPPER.has(bare.toUpperCase()) && (bare === bare.toUpperCase() || wholeNameOneCase)) return tok.replace(/[A-Za-z]+/g, (m) => (KEEP_UPPER.has(m.toUpperCase()) ? m.toUpperCase() : m));
      const tokenOneCase = !(hasLower(bare) && hasUpper(bare));
      if (!tokenOneCase) return tok; // already mixed: McKay, DeShawn — leave it
      const allUpper = bare === bare.toUpperCase();
      // One- and two-letter ALL-CAPS tokens in a mixed-case name are initials ("TC", "AJ") — keep.
      if (allUpper && !wholeNameOneCase && bare.length <= 2) return tok;
      if (i > 0 && KEEP_LOWER.has(bare.toLowerCase())) return tok.toLowerCase();
      return capWord(tok);
    })
    .join(" ");
}

/** A single all-lowercase word with no spaces reads like a brand or handle
 *  ("brwnbox"), not a person — the clean-up preview leaves those unticked. */
export function looksLikeBrandOrHandle(name: string): boolean {
  const n = name.trim();
  return !/\s/.test(n) && n === n.toLowerCase() && /[a-z]/.test(n) && (n.length > 3 || /[._\d]/.test(n));
}
