// Persistent "seen"-geheugen. Blijft als state/seen.json in de repo staan zodat
// de bot elke editie eerst leest wat al is behandeld en niets herhaalt. Nieuwe
// ontwikkelingen komen erbij; bestaande worden bijgewerkt bij een materiële
// verandering (status/datum/prijs).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

export function devKey(finding) {
  const base = `${finding.title || ""} ${finding.place || ""} ${finding.country || ""}`;
  return base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function loadSeen(stateRoot) {
  const file = join(stateRoot, "seen.json");
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return { developments: [] };
  }
}

export async function saveSeen(stateRoot, seen) {
  const file = join(stateRoot, "seen.json");
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(seen, null, 2), "utf8");
}

/** Alle eerder behandelde bron-URL's, voor snelle exacte dedup. */
export function seenUrls(seen) {
  const set = new Set();
  for (const d of seen.developments) for (const u of d.urls || []) set.add(u);
  return set;
}

/** Compacte lijst behandelde ontwikkelingen voor semantische dedup (prompt). */
export function seenSummaries(seen, limit = 200) {
  return seen.developments
    .slice(-limit)
    .map((d, i) => `${i}. ${d.title} — ${d.place || ""} ${d.country || ""} [status: ${d.status || "?"}]`);
}

/** Voeg de behandelde findings toe of werk bestaande ontwikkelingen bij. */
export function recordCovered(seen, findings, editionLabel) {
  const byKey = new Map(seen.developments.map((d) => [d.key, d]));
  for (const f of findings) {
    const key = devKey(f);
    const existing = byKey.get(key);
    if (existing) {
      existing.status = f.status || existing.status;
      existing.lastSeen = editionLabel;
      if (f.source && !(existing.urls || []).includes(f.source)) {
        existing.urls = [...(existing.urls || []), f.source];
      }
    } else {
      const dev = {
        key,
        title: f.title,
        place: f.place || "",
        country: f.country || "",
        status: f.status || "",
        urls: f.source ? [f.source] : [],
        firstSeen: editionLabel,
        lastSeen: editionLabel,
      };
      seen.developments.push(dev);
      byKey.set(key, dev);
    }
  }
  return seen;
}
