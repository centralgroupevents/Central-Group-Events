// Build to Last — editable page copy. Every block of prose on /build-to-last
// lives here as a default; the admin can override any field from the
// Build to Last → Page view (stored in app_settings as "btl.page.<key>").
// An override left blank falls back to the default below, so clearing a
// field in the editor restores the original copy.

export interface BtlPageField {
  key: string;
  label: string;
  help: string;
  multiline: boolean;
}

export const BTL_PAGE_FIELDS: BtlPageField[] = [
  { key: "heroDate", label: "Hero — date line", help: "The uppercase date line under the title.", multiline: false },
  { key: "heroSubtitle", label: "Hero — subtitle", help: "The one-sentence description under the date.", multiline: false },
  { key: "premiseLead", label: "Premise — lead paragraph", help: "The big serif opening paragraph.", multiline: true },
  { key: "premiseBody", label: "Premise — supporting paragraph", help: "The smaller paragraph under the lead.", multiline: true },
  { key: "expect", label: "What to Expect", help: "One bullet per line. Text before \" — \" renders bold.", multiline: true },
  { key: "walkAway", label: "You'll Walk Away With", help: "One bullet per line.", multiline: true },
  { key: "essentials", label: "The Essentials", help: "One bullet per line.", multiline: true },
  { key: "flow", label: "Event Flow", help: "One line per slot. The time before \" — \" renders bold.", multiline: true },
  { key: "dressCode", label: "Dress code + venue line", help: "Shown under the event flow, after the gold DRESS CODE label.", multiline: true },
  { key: "rsvpFootnote", label: "RSVP footnote", help: "The small line under the RSVP button.", multiline: true },
];

export const BTL_PAGE_DEFAULTS: Record<string, string> = {
  heroDate: "Thursday, November 12, 2026 · Newark",
  heroSubtitle: "An invite-only mixer for the planners, venue owners, and creators building across New Jersey.",
  premiseLead:
    "Promoting events across New Jersey, we've come across so many influential, hardworking people who chose to curate spaces and places here — and who believe this state is only going to present more opportunities for people like us.",
  premiseBody:
    "The best habit any of us can keep is an informed, active network that learns from one another. Build to Last is that habit, in person — one room, an intentionally set crowd.",
  expect: [
    "An intentionally set crowd — planners, venue owners, and creators from across the state.",
    "Moderated conversations — on event planning, spaces, and brand building in New Jersey.",
    "Organic networking — with people building the same things you are.",
    "A professionally photographed night — you'll get the photos after.",
  ].join("\n"),
  walkAway: [
    "Relationships worth keeping — people you'll actually hear from again",
    "A sharper sense of where New Jersey is heading, from the people building it",
    "Perspectives you didn't walk in with",
  ].join("\n"),
  essentials: ["Open bar", "Small bites", "Programming + networking", "Free · RSVP required"].join("\n"),
  flow: [
    "6:00 PM — Doors open. Introductions and open bar.",
    "7:00 PM — Moderated conversations centered around event planning, spaces, and brand building in NJ",
    "8:30 PM — Night cap",
  ].join("\n"),
  dressCode: "Come as yourself — we know plenty of you are coming straight from work. Business casual is perfect. · Equal Space, Newark",
  rsvpFootnote: "Free · RSVP required · You'll get event updates by email from Anthony; every email has a one-click unsubscribe.",
};
