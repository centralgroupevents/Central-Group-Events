// 2026 NBA Finals schedule — games 4 through 7. Games 5-7 are conditional
// ("if necessary") since the Finals end as soon as one team clinches 4 wins.
//
// IMPORTANT — team names and exact dates are PLACEHOLDERS. Update each game's
// `fixture` and `date` fields once the actual Finals matchup is locked and the
// official schedule is published by the NBA.

export interface NbaFinalsGame {
  /** Game number in the series (4-7). */
  gameNumber: number;
  /** Display label — "Game 4: Eastern Champion @ Western Champion". */
  fixture: string;
  /** ISO date string YYYY-MM-DD. */
  date: string;
  /** Tip-off time in Eastern Time. */
  timeEt: string;
  /** Stadium / arena name + city. */
  arena: string;
  /** True if this game only happens when the series isn't already decided. */
  ifNecessary: boolean;
}

export const NBA_FINALS_2026_GAMES: NbaFinalsGame[] = [
  {
    gameNumber: 4,
    fixture: "Game 4: Western Champion @ Eastern Champion",
    date: "2026-06-12",
    timeEt: "8:30 PM ET",
    arena: "Eastern Champion's home arena",
    ifNecessary: false,
  },
  {
    gameNumber: 5,
    fixture: "Game 5: Eastern Champion @ Western Champion",
    date: "2026-06-15",
    timeEt: "8:00 PM ET",
    arena: "Western Champion's home arena",
    ifNecessary: true,
  },
  {
    gameNumber: 6,
    fixture: "Game 6: Western Champion @ Eastern Champion",
    date: "2026-06-18",
    timeEt: "8:30 PM ET",
    arena: "Eastern Champion's home arena",
    ifNecessary: true,
  },
  {
    gameNumber: 7,
    fixture: "Game 7: Eastern Champion @ Western Champion",
    date: "2026-06-21",
    timeEt: "8:00 PM ET",
    arena: "Western Champion's home arena",
    ifNecessary: true,
  },
];

export function getNbaGameByNumber(num: number): NbaFinalsGame | null {
  return NBA_FINALS_2026_GAMES.find((g) => g.gameNumber === num) || null;
}

export function getNbaGameNumberForDate(isoDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  return NBA_FINALS_2026_GAMES.find((g) => g.date === isoDate)?.gameNumber || null;
}
