// 2026 NBA Finals schedule — Games 4 through 7. Games 5-7 are conditional
// ("if necessary") since the Finals end as soon as one team clinches 4 wins.
//
// Matchup: San Antonio Spurs vs New York Knicks. The 2-2-1-1-1 home rotation
// below assumes the Spurs are the higher seed (Games 1-2, 5, 7 at Frost Bank
// Center in San Antonio; Games 3-4, 6 at Madison Square Garden in New York).
// If the Knicks turn out to be the higher seed, swap the arena values.

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
    fixture: "Game 4: Spurs @ Knicks",
    date: "2026-06-11",
    timeEt: "8:30 PM ET",
    arena: "Madison Square Garden, New York NY",
    ifNecessary: false,
  },
  {
    gameNumber: 5,
    fixture: "Game 5: Knicks @ Spurs",
    date: "2026-06-13",
    timeEt: "8:00 PM ET",
    arena: "Frost Bank Center, San Antonio TX",
    ifNecessary: true,
  },
  {
    gameNumber: 6,
    fixture: "Game 6: Spurs @ Knicks",
    date: "2026-06-16",
    timeEt: "8:30 PM ET",
    arena: "Madison Square Garden, New York NY",
    ifNecessary: true,
  },
  {
    gameNumber: 7,
    fixture: "Game 7: Knicks @ Spurs",
    date: "2026-06-19",
    timeEt: "8:00 PM ET",
    arena: "Frost Bank Center, San Antonio TX",
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
