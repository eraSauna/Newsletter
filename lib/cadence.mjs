// Cadence resolver for the eräSauna newsletter.
// One Monday email that grows: the weekly core always runs; the bi-weekly and
// 8-weekly blocks join when their ISO-week condition is met.

/** ISO-8601 week number for a Date (UTC-based). */
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// Megaprompt sections mapped to a cadence.
export const BLOCKS = {
  weekly: [
    { id: 1, key: "signals", title: "De belangrijkste signalen van deze week" },
    { id: 2, key: "locations", title: "Nieuwe locatiekansen" },
    { id: 3, key: "swimming", title: "Zwemwater, waterrecreatie en lokale regelgeving" },
    { id: 10, key: "partners", title: "Partner- en acquisitiesignalen" },
    { id: 11, key: "watchlist", title: "Watchlist" },
    { id: 12, key: "actions", title: "Concrete acties voor eräSauna" },
  ],
  biweekly: [
    { id: 4, key: "hubs", title: "Outdoor sauna- en wellness-hubs" },
    { id: 5, key: "competitors", title: "Concurrentiemonitor", eventDriven: true },
    { id: 8, key: "trendwatch", title: "Groot-Brittannië en Denemarken trendwatch" },
    { id: 9, key: "innovation", title: "Product- en operationele innovaties" },
  ],
  eightweekly: [
    { id: 6, key: "reviews", title: "Reviewmonitor" },
    { id: 7, key: "pricing", title: "Prijs- en boekingsmonitor" },
  ],
};

/**
 * Return the blocks that run this Monday, plus the cadence context.
 * @param {Date} date
 */
export function blocksForDate(date) {
  const week = isoWeek(date);
  const runBiweekly = week % 2 === 0;
  const runEightweekly = week % 8 === 0;

  const active = [...BLOCKS.weekly];
  if (runBiweekly) active.push(...BLOCKS.biweekly);
  if (runEightweekly) active.push(...BLOCKS.eightweekly);
  active.sort((a, b) => a.id - b.id);

  return { week, runBiweekly, runEightweekly, active };
}
