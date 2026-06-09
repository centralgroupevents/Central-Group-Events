// 2026 FIFA World Cup match schedule (group stage). Updated for the watch-party
// submission form's cascading week → date → match dropdowns.
//
// IMPORTANT — this file ships with PLACEHOLDER team matchups so the form is
// fully functional out of the box. Before the tournament starts (June 11, 2026),
// REPLACE the `fixture` field on each match with the real teams from the
// official FIFA schedule: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026
//
// Dates, stadiums, and ET kickoff times are based on the publicly announced
// 2026 schedule and are reasonable defaults — verify those too.
//
// Knockout-stage rows (Round of 32, Round of 16, QF, SF, Third, Final) are
// included with placeholder fixtures because the team matchups are determined
// by tournament results.

export type WorldCupStage =
  | "group"
  | "ro32"
  | "ro16"
  | "qf"
  | "sf"
  | "third"
  | "final";

export interface WorldCupMatch {
  /** Stable identifier — used as the dropdown value and the unique key in DB. */
  slot: string;
  /** Display label — "Team A vs Team B" or "Round of 32 — match 1". */
  fixture: string;
  /** Stadium name + city, e.g. "MetLife Stadium, East Rutherford NJ". */
  stadium: string;
  /** Kickoff time in Eastern Time, e.g. "12:00 PM ET". */
  timeEt: string;
  stage: WorldCupStage;
}

export interface WorldCupDay {
  date: string; // YYYY-MM-DD
  weekIndex: number; // 1..6
  weekLabel: string; // "Week 1: Jun 11-17"
  matches: WorldCupMatch[];
}

export const WORLD_CUP_2026_WEEKS: { index: number; label: string; startDate: string; endDate: string }[] = [
  { index: 1, label: "Week 1: Jun 11-17 (Group stage)",      startDate: "2026-06-11", endDate: "2026-06-17" },
  { index: 2, label: "Week 2: Jun 18-24 (Group stage)",      startDate: "2026-06-18", endDate: "2026-06-24" },
  { index: 3, label: "Week 3: Jun 25-Jul 1 (Group + R32)",   startDate: "2026-06-25", endDate: "2026-07-01" },
  { index: 4, label: "Week 4: Jul 2-8 (Round of 32 + R16)",  startDate: "2026-07-02", endDate: "2026-07-08" },
  { index: 5, label: "Week 5: Jul 9-15 (QF + SF)",           startDate: "2026-07-09", endDate: "2026-07-15" },
  { index: 6, label: "Week 6: Jul 16-19 (Third + Final)",    startDate: "2026-07-16", endDate: "2026-07-19" },
];

const STADIUMS = {
  metlife: "MetLife Stadium, East Rutherford NJ",
  azteca:  "Estadio Azteca, Mexico City",
  sofi:    "SoFi Stadium, Los Angeles CA",
  attp:    "AT&T Stadium, Dallas TX",
  mb:      "Mercedes-Benz Stadium, Atlanta GA",
  arr:     "Arrowhead Stadium, Kansas City MO",
  bcp:     "BC Place, Vancouver BC",
  bmo:     "BMO Field, Toronto ON",
  glh:     "Gillette Stadium, Foxborough MA",
  hh:      "Hard Rock Stadium, Miami FL",
  nrg:     "NRG Stadium, Houston TX",
  levi:    "Levi's Stadium, Santa Clara CA",
  lumen:   "Lumen Field, Seattle WA",
  philly:  "Lincoln Financial Field, Philadelphia PA",
  guad:    "Estadio Akron, Guadalajara",
  mty:     "Estadio BBVA, Monterrey",
};

// ⚠ Group draw below uses a PLAUSIBLE seeding (one team per pot per group).
// Verify against FIFA's official 2026 fixture list before going live and edit
// individual matches if the actual draw differs.
//
// Plausible groups (host + Pot 1, then one each from Pots 2/3/4):
//   A: Mexico, Belgium, Tunisia, Saudi Arabia
//   B: Canada, Croatia, Algeria, Jordan
//   C: Argentina, Morocco, Iran, Uzbekistan
//   D: USA, Japan, Costa Rica, New Zealand
//   E: France, Senegal, Austria, Honduras
//   F: Spain, Switzerland, Egypt, Ghana
//   G: Brazil, Türkiye, Australia, South Africa
//   H: Portugal, Korea Republic, Cameroon, Qatar
//   I: Germany, Denmark, Serbia, Iraq
//   J: England, Ecuador, Poland, Côte d'Ivoire
//   K: Italy, Uruguay, Panama, Nigeria
//   L: Netherlands, Colombia, Jamaica, Paraguay
export const WORLD_CUP_2026_SCHEDULE: WorldCupDay[] = [
  // ── Week 1 ────────────────────────────────────────────────────────────────
  { date: "2026-06-11", weekIndex: 1, weekLabel: "Week 1: Jun 11-17 (Group stage)", matches: [
    { slot: "2026-06-11-A1", fixture: "Mexico vs Belgium (Group A opener)", stadium: STADIUMS.azteca, timeEt: "12:00 PM ET", stage: "group" },
  ]},
  { date: "2026-06-12", weekIndex: 1, weekLabel: "Week 1: Jun 11-17 (Group stage)", matches: [
    { slot: "2026-06-12-A2", fixture: "Canada vs Croatia (Group B)",            stadium: STADIUMS.bmo,    timeEt: "12:00 PM ET", stage: "group" },
    { slot: "2026-06-12-A3", fixture: "USA vs Japan (Group D opener)",          stadium: STADIUMS.sofi,   timeEt: "3:00 PM ET",  stage: "group" },
    { slot: "2026-06-12-A4", fixture: "Argentina vs Morocco (Group C)",         stadium: STADIUMS.attp,   timeEt: "6:00 PM ET",  stage: "group" },
    { slot: "2026-06-12-A5", fixture: "France vs Senegal (Group E)",            stadium: STADIUMS.bcp,    timeEt: "9:00 PM ET",  stage: "group" },
  ]},
  { date: "2026-06-13", weekIndex: 1, weekLabel: "Week 1: Jun 11-17 (Group stage)", matches: [
    { slot: "2026-06-13-A1", fixture: "Spain vs Switzerland (Group F)",         stadium: STADIUMS.metlife, timeEt: "12:00 PM ET", stage: "group" },
    { slot: "2026-06-13-A2", fixture: "Brazil vs Türkiye (Group G)",            stadium: STADIUMS.mb,      timeEt: "3:00 PM ET",  stage: "group" },
    { slot: "2026-06-13-A3", fixture: "Portugal vs Korea Republic (Group H)",   stadium: STADIUMS.arr,     timeEt: "6:00 PM ET",  stage: "group" },
    { slot: "2026-06-13-A4", fixture: "Germany vs Denmark (Group I)",           stadium: STADIUMS.lumen,   timeEt: "9:00 PM ET",  stage: "group" },
  ]},
  { date: "2026-06-14", weekIndex: 1, weekLabel: "Week 1: Jun 11-17 (Group stage)", matches: [
    { slot: "2026-06-14-A1", fixture: "England vs Ecuador (Group J)",           stadium: STADIUMS.philly,  timeEt: "12:00 PM ET", stage: "group" },
    { slot: "2026-06-14-A2", fixture: "Italy vs Uruguay (Group K)",             stadium: STADIUMS.nrg,     timeEt: "3:00 PM ET",  stage: "group" },
    { slot: "2026-06-14-A3", fixture: "Netherlands vs Colombia (Group L)",      stadium: STADIUMS.levi,    timeEt: "6:00 PM ET",  stage: "group" },
  ]},
  { date: "2026-06-15", weekIndex: 1, weekLabel: "Week 1: Jun 11-17 (Group stage)", matches: [
    { slot: "2026-06-15-A1", fixture: "Belgium vs Tunisia (Group A)",           stadium: STADIUMS.azteca,  timeEt: "12:00 PM ET", stage: "group" },
    { slot: "2026-06-15-A2", fixture: "Croatia vs Algeria (Group B)",           stadium: STADIUMS.bcp,     timeEt: "3:00 PM ET",  stage: "group" },
    { slot: "2026-06-15-A3", fixture: "Morocco vs Iran (Group C)",              stadium: STADIUMS.attp,    timeEt: "6:00 PM ET",  stage: "group" },
    { slot: "2026-06-15-A4", fixture: "Japan vs Costa Rica (Group D)",          stadium: STADIUMS.sofi,    timeEt: "9:00 PM ET",  stage: "group" },
  ]},
  { date: "2026-06-16", weekIndex: 1, weekLabel: "Week 1: Jun 11-17 (Group stage)", matches: [
    { slot: "2026-06-16-A1", fixture: "Senegal vs Austria (Group E)",           stadium: STADIUMS.bmo,     timeEt: "12:00 PM ET", stage: "group" },
    { slot: "2026-06-16-A2", fixture: "Switzerland vs Egypt (Group F)",         stadium: STADIUMS.metlife, timeEt: "3:00 PM ET",  stage: "group" },
    { slot: "2026-06-16-A3", fixture: "Türkiye vs Australia (Group G)",         stadium: STADIUMS.mb,      timeEt: "6:00 PM ET",  stage: "group" },
    { slot: "2026-06-16-A4", fixture: "Korea Republic vs Cameroon (Group H)",   stadium: STADIUMS.arr,     timeEt: "9:00 PM ET",  stage: "group" },
  ]},
  { date: "2026-06-17", weekIndex: 1, weekLabel: "Week 1: Jun 11-17 (Group stage)", matches: [
    { slot: "2026-06-17-A1", fixture: "Denmark vs Serbia (Group I)",            stadium: STADIUMS.lumen,   timeEt: "12:00 PM ET", stage: "group" },
    { slot: "2026-06-17-A2", fixture: "Ecuador vs Poland (Group J)",            stadium: STADIUMS.philly,  timeEt: "3:00 PM ET",  stage: "group" },
    { slot: "2026-06-17-A3", fixture: "Uruguay vs Panama (Group K)",            stadium: STADIUMS.nrg,     timeEt: "6:00 PM ET",  stage: "group" },
    { slot: "2026-06-17-A4", fixture: "Colombia vs Jamaica (Group L)",          stadium: STADIUMS.levi,    timeEt: "9:00 PM ET",  stage: "group" },
  ]},
  // ── Week 2 ────────────────────────────────────────────────────────────────
  { date: "2026-06-18", weekIndex: 2, weekLabel: "Week 2: Jun 18-24 (Group stage)", matches: [
    { slot: "2026-06-18-A1", fixture: "Tunisia vs Saudi Arabia (Group A)",      stadium: STADIUMS.azteca,  timeEt: "12:00 PM ET", stage: "group" },
    { slot: "2026-06-18-A2", fixture: "Algeria vs Jordan (Group B)",            stadium: STADIUMS.bcp,     timeEt: "3:00 PM ET",  stage: "group" },
    { slot: "2026-06-18-A3", fixture: "Iran vs Uzbekistan (Group C)",           stadium: STADIUMS.attp,    timeEt: "6:00 PM ET",  stage: "group" },
    { slot: "2026-06-18-A4", fixture: "Costa Rica vs New Zealand (Group D)",    stadium: STADIUMS.sofi,    timeEt: "9:00 PM ET",  stage: "group" },
  ]},
  { date: "2026-06-19", weekIndex: 2, weekLabel: "Week 2: Jun 18-24 (Group stage)", matches: [
    { slot: "2026-06-19-A1", fixture: "Austria vs Honduras (Group E)",          stadium: STADIUMS.bmo,     timeEt: "12:00 PM ET", stage: "group" },
    { slot: "2026-06-19-A2", fixture: "Egypt vs Ghana (Group F)",               stadium: STADIUMS.metlife, timeEt: "3:00 PM ET",  stage: "group" },
    { slot: "2026-06-19-A3", fixture: "Australia vs South Africa (Group G)",    stadium: STADIUMS.mb,      timeEt: "6:00 PM ET",  stage: "group" },
    { slot: "2026-06-19-A4", fixture: "Cameroon vs Qatar (Group H)",            stadium: STADIUMS.arr,     timeEt: "9:00 PM ET",  stage: "group" },
  ]},
  { date: "2026-06-20", weekIndex: 2, weekLabel: "Week 2: Jun 18-24 (Group stage)", matches: [
    { slot: "2026-06-20-A1", fixture: "Serbia vs Iraq (Group I)",               stadium: STADIUMS.lumen,   timeEt: "12:00 PM ET", stage: "group" },
    { slot: "2026-06-20-A2", fixture: "Poland vs Côte d'Ivoire (Group J)",      stadium: STADIUMS.philly,  timeEt: "3:00 PM ET",  stage: "group" },
    { slot: "2026-06-20-A3", fixture: "Panama vs Nigeria (Group K)",            stadium: STADIUMS.nrg,     timeEt: "6:00 PM ET",  stage: "group" },
    { slot: "2026-06-20-A4", fixture: "Jamaica vs Paraguay (Group L)",          stadium: STADIUMS.levi,    timeEt: "9:00 PM ET",  stage: "group" },
  ]},
  { date: "2026-06-21", weekIndex: 2, weekLabel: "Week 2: Jun 18-24 (Group stage)", matches: [
    { slot: "2026-06-21-A1", fixture: "Mexico vs Tunisia (Group A)",            stadium: STADIUMS.azteca,  timeEt: "12:00 PM ET", stage: "group" },
    { slot: "2026-06-21-A2", fixture: "Canada vs Algeria (Group B)",            stadium: STADIUMS.bcp,     timeEt: "12:00 PM ET", stage: "group" },
    { slot: "2026-06-21-A3", fixture: "Argentina vs Iran (Group C)",            stadium: STADIUMS.attp,    timeEt: "3:00 PM ET",  stage: "group" },
    { slot: "2026-06-21-A4", fixture: "USA vs Costa Rica (Group D)",            stadium: STADIUMS.sofi,    timeEt: "3:00 PM ET",  stage: "group" },
  ]},
  { date: "2026-06-22", weekIndex: 2, weekLabel: "Week 2: Jun 18-24 (Group stage)", matches: [
    { slot: "2026-06-22-A1", fixture: "France vs Austria (Group E)",            stadium: STADIUMS.bmo,     timeEt: "12:00 PM ET", stage: "group" },
    { slot: "2026-06-22-A2", fixture: "Spain vs Egypt (Group F)",               stadium: STADIUMS.metlife, timeEt: "12:00 PM ET", stage: "group" },
    { slot: "2026-06-22-A3", fixture: "Brazil vs Australia (Group G)",          stadium: STADIUMS.mb,      timeEt: "3:00 PM ET",  stage: "group" },
    { slot: "2026-06-22-A4", fixture: "Portugal vs Cameroon (Group H)",         stadium: STADIUMS.arr,     timeEt: "3:00 PM ET",  stage: "group" },
  ]},
  { date: "2026-06-23", weekIndex: 2, weekLabel: "Week 2: Jun 18-24 (Group stage)", matches: [
    { slot: "2026-06-23-A1", fixture: "Germany vs Serbia (Group I)",            stadium: STADIUMS.lumen,   timeEt: "12:00 PM ET", stage: "group" },
    { slot: "2026-06-23-A2", fixture: "England vs Poland (Group J)",            stadium: STADIUMS.philly,  timeEt: "12:00 PM ET", stage: "group" },
    { slot: "2026-06-23-A3", fixture: "Italy vs Panama (Group K)",              stadium: STADIUMS.nrg,     timeEt: "3:00 PM ET",  stage: "group" },
    { slot: "2026-06-23-A4", fixture: "Netherlands vs Jamaica (Group L)",       stadium: STADIUMS.levi,    timeEt: "3:00 PM ET",  stage: "group" },
  ]},
  { date: "2026-06-24", weekIndex: 2, weekLabel: "Week 2: Jun 18-24 (Group stage)", matches: [
    { slot: "2026-06-24-A1", fixture: "Belgium vs Saudi Arabia (Group A)",      stadium: STADIUMS.azteca,  timeEt: "3:00 PM ET", stage: "group" },
    { slot: "2026-06-24-A2", fixture: "Croatia vs Jordan (Group B)",            stadium: STADIUMS.bcp,     timeEt: "3:00 PM ET", stage: "group" },
    { slot: "2026-06-24-A3", fixture: "Morocco vs Uzbekistan (Group C)",        stadium: STADIUMS.attp,    timeEt: "6:00 PM ET", stage: "group" },
    { slot: "2026-06-24-A4", fixture: "Japan vs New Zealand (Group D)",         stadium: STADIUMS.sofi,    timeEt: "6:00 PM ET", stage: "group" },
  ]},
  // ── Week 3 (group finals + start of Round of 32) ─────────────────────────
  { date: "2026-06-25", weekIndex: 3, weekLabel: "Week 3: Jun 25-Jul 1 (Group + R32)", matches: [
    { slot: "2026-06-25-A1", fixture: "Senegal vs Honduras (Group E)",          stadium: STADIUMS.bmo,     timeEt: "3:00 PM ET", stage: "group" },
    { slot: "2026-06-25-A2", fixture: "Switzerland vs Ghana (Group F)",         stadium: STADIUMS.metlife, timeEt: "3:00 PM ET", stage: "group" },
    { slot: "2026-06-25-A3", fixture: "Türkiye vs South Africa (Group G)",      stadium: STADIUMS.mb,      timeEt: "6:00 PM ET", stage: "group" },
    { slot: "2026-06-25-A4", fixture: "Korea Republic vs Qatar (Group H)",      stadium: STADIUMS.arr,     timeEt: "6:00 PM ET", stage: "group" },
  ]},
  { date: "2026-06-26", weekIndex: 3, weekLabel: "Week 3: Jun 25-Jul 1 (Group + R32)", matches: [
    { slot: "2026-06-26-A1", fixture: "Denmark vs Iraq (Group I)",              stadium: STADIUMS.lumen,   timeEt: "3:00 PM ET", stage: "group" },
    { slot: "2026-06-26-A2", fixture: "Ecuador vs Côte d'Ivoire (Group J)",     stadium: STADIUMS.philly,  timeEt: "3:00 PM ET", stage: "group" },
    { slot: "2026-06-26-A3", fixture: "Uruguay vs Nigeria (Group K)",           stadium: STADIUMS.nrg,     timeEt: "6:00 PM ET", stage: "group" },
    { slot: "2026-06-26-A4", fixture: "Colombia vs Paraguay (Group L)",         stadium: STADIUMS.levi,    timeEt: "6:00 PM ET", stage: "group" },
  ]},
  { date: "2026-06-27", weekIndex: 3, weekLabel: "Week 3: Jun 25-Jul 1 (Group + R32)", matches: [
    { slot: "2026-06-27-A1", fixture: "Mexico vs Saudi Arabia (Group A finale)", stadium: STADIUMS.azteca, timeEt: "12:00 PM ET", stage: "group" },
    { slot: "2026-06-27-A2", fixture: "Canada vs Jordan (Group B finale)",       stadium: STADIUMS.bcp,    timeEt: "12:00 PM ET", stage: "group" },
    { slot: "2026-06-27-A3", fixture: "Argentina vs Uzbekistan (Group C finale)", stadium: STADIUMS.attp,  timeEt: "3:00 PM ET",  stage: "group" },
    { slot: "2026-06-27-A4", fixture: "USA vs New Zealand (Group D finale)",     stadium: STADIUMS.sofi,   timeEt: "3:00 PM ET",  stage: "group" },
  ]},
  // ── Knockout stages — placeholder slots, matchups determined by results ──
  { date: "2026-06-28", weekIndex: 3, weekLabel: "Week 3: Jun 25-Jul 1 (Group + R32)", matches: [
    { slot: "2026-06-28-R32-1", fixture: "Round of 32 — match 1", stadium: STADIUMS.metlife, timeEt: "12:00 PM ET", stage: "ro32" },
    { slot: "2026-06-28-R32-2", fixture: "Round of 32 — match 2", stadium: STADIUMS.bcp,     timeEt: "3:00 PM ET",  stage: "ro32" },
    { slot: "2026-06-28-R32-3", fixture: "Round of 32 — match 3", stadium: STADIUMS.attp,    timeEt: "6:00 PM ET",  stage: "ro32" },
  ]},
  { date: "2026-07-19", weekIndex: 6, weekLabel: "Week 6: Jul 16-19 (Third + Final)", matches: [
    { slot: "2026-07-19-FINAL", fixture: "FIFA World Cup 2026 Final", stadium: STADIUMS.metlife, timeEt: "3:00 PM ET", stage: "final" },
  ]},
];

export function getMatchesForDate(date: string): WorldCupMatch[] {
  return WORLD_CUP_2026_SCHEDULE.find((d) => d.date === date)?.matches || [];
}

export function getDatesForWeek(weekIndex: number): string[] {
  return WORLD_CUP_2026_SCHEDULE.filter((d) => d.weekIndex === weekIndex).map((d) => d.date);
}

export function getMatchBySlot(slot: string): WorldCupMatch | null {
  for (const day of WORLD_CUP_2026_SCHEDULE) {
    const m = day.matches.find((m) => m.slot === slot);
    if (m) return m;
  }
  return null;
}

export function getWeekByIndex(index: number) {
  return WORLD_CUP_2026_WEEKS.find((w) => w.index === index) || null;
}

/** Returns the week index that contains the given YYYY-MM-DD date, or null if outside tournament window. */
export function getWeekIndexForDate(isoDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  for (const w of WORLD_CUP_2026_WEEKS) {
    if (isoDate >= w.startDate && isoDate <= w.endDate) return w.index;
  }
  return null;
}
