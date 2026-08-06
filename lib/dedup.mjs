// Dedup tegen het seen-geheugen. Gooit al-behandelde ontwikkelingen eruit vóór
// de dure leeslaag. Onderscheidt: nieuw (behandelen), herhaling (weglaten), of
// update (behandelen, gemarkeerd als update op een eerdere editie).

import { geminiCall, parseJsonArray } from "./gemini.mjs";
import { seenUrls, seenSummaries } from "./memory.mjs";

const SYSTEM = `Je vergelijkt nieuwe kandidaat-berichten met ontwikkelingen die eräSauna in eerdere edities al behandelde. Doel: herhaling voorkomen. Per kandidaat kies je: "new" (gaat over een ontwikkeling die niet in de lijst staat), "repeat" (zelfde ontwikkeling, geen materiële verandering — weglaten), of "update" (zelfde ontwikkeling maar met een materiële verandering: nieuwe status, datum, prijs, opening, vergunning). Wees streng op "repeat": bij twijfel tussen new en repeat, kies new.`;

/**
 * @returns {Promise<{newItems: object[], updates: object[], droppedRepeat: number}>}
 */
export async function dedupAgainstSeen({ candidates, seen, model, ledger }) {
  // 1. Exacte URL-match = al behandeld.
  const urls = seenUrls(seen);
  const fresh = candidates.filter((c) => c.url && !urls.has(c.url));
  const urlDropped = candidates.length - fresh.length;

  if (fresh.length === 0 || seen.developments.length === 0) {
    return { newItems: fresh, updates: [], droppedRepeat: urlDropped };
  }

  // 2. Semantische vergelijking tegen behandelde ontwikkelingen.
  const seenList = seenSummaries(seen).join("\n");
  const candList = fresh.map((c, i) => `${i}. ${c.title} — ${c.snippet || ""}`).join("\n");
  const prompt = `AL BEHANDELDE ONTWIKKELINGEN:
${seenList}

NIEUWE KANDIDATEN:
${candList}

Geef een JSON-array, één object per kandidaat: {"i": <index>, "verdict": "new"|"repeat"|"update", "reason": "kort"}. Geen tekst buiten de JSON.`;

  const { text } = await geminiCall({ model, system: SYSTEM, prompt, ledger, label: "dedup" });
  const byIndex = new Map(parseJsonArray(text).map((d) => [d.i, d]));

  const newItems = [];
  const updates = [];
  let droppedRepeat = urlDropped;
  fresh.forEach((c, i) => {
    const v = byIndex.get(i)?.verdict || "new"; // ontbreekt oordeel → nieuw behandelen
    if (v === "repeat") droppedRepeat++;
    else if (v === "update") updates.push({ ...c, _isUpdate: true });
    else newItems.push(c);
  });

  return { newItems, updates, droppedRepeat };
}
