// Cadence resolver — tweewekelijkse editie.
// De scheduler mag elke maandag draaien; de code bepaalt of het een editieweek is
// (even ISO-week). Review/prijs draaien elke 4 weken mee. Herhaling wordt niet
// door de cadans voorkomen maar door het seen-geheugen (lib/memory.mjs).

export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// Elke editie (tweewekelijks).
export const EDITION_BLOCKS = [
  { id: 1, key: "signals", title: "De belangrijkste signalen van deze editie" },
  { id: 2, key: "locations", title: "Nieuwe locatiekansen" },
  { id: 3, key: "swimming", title: "Zwemwater, waterrecreatie en lokale regelgeving" },
  { id: 4, key: "hubs", title: "Outdoor sauna- en wellness-hubs" },
  { id: 5, key: "competitors", title: "Concurrentiemonitor", eventDriven: true },
  { id: 8, key: "trendwatch", title: "Groot-Brittannië en Denemarken trendwatch" },
  { id: 9, key: "innovation", title: "Product- en operationele innovaties" },
  { id: 10, key: "partners", title: "Partner- en acquisitiesignalen" },
  { id: 11, key: "watchlist", title: "Watchlist" },
  { id: 12, key: "actions", title: "Concrete acties voor eräSauna" },
];

// Elke 4 weken (elke tweede editie).
export const EXTENDED_BLOCKS = [
  { id: 6, key: "reviews", title: "Reviewmonitor" },
  { id: 7, key: "pricing", title: "Prijs- en boekingsmonitor" },
];

/** Editie in even ISO-weken. */
export function isEditionWeek(date) {
  return isoWeek(date) % 2 === 0;
}

export function blocksForDate(date) {
  const week = isoWeek(date);
  if (week % 2 !== 0) return { week, isEdition: false, extended: false, active: [] };
  const extended = week % 4 === 0;
  const active = [...EDITION_BLOCKS];
  if (extended) active.push(...EXTENDED_BLOCKS);
  active.sort((a, b) => a.id - b.id);
  return { week, isEdition: true, extended, active };
}
