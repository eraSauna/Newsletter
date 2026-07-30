// Laag 3b — audit-steekproef. Controleert wekelijks of de goedkope voorfilter
// (laag 2) geen echte leads heeft weggegooid. Neemt een steekproef uit de
// afgewezen items en laat het reader-model (3.6 Flash) opnieuw oordelen.
// Wat het als gemist markeert, komt in de editie-log te staan voor menselijke check.

import { geminiCall } from "./gemini.mjs";
import { fetchText, mapLimit } from "./util.mjs";

const SYSTEM = `Je controleert of een voorfilter een relevante lead voor eräSauna ten onrechte heeft weggegooid (verplaatsbare outdoor drop-in sauna's; NL/BE/FR/DE + UK/DK). Wees streng: markeer alleen als "gemist" wanneer het item duidelijk een kans, partner, relevante regelgeving of directe concurrent-beweging is.`;

/** Kies elke N-de zodat de steekproef over de hele afgewezen lijst spreidt. */
function sample(items, size) {
  if (items.length <= size) return items;
  const step = items.length / size;
  return Array.from({ length: size }, (_, k) => items[Math.floor(k * step)]);
}

/**
 * @returns {Promise<{checked: number, missed: object[]}>}
 */
export async function auditRejected({ rejected, size, model, ledger, concurrency = 3 }) {
  const chosen = sample(rejected, size);
  const verdicts = await mapLimit(chosen, concurrency, async (item) => {
    const pageText = await fetchText(item.url, { maxChars: 4000 });
    const prompt = `Afgewezen item.
Titel: ${item.title}
Snippet: ${item.snippet || ""}
Bron: ${item.url}
Paginatekst: ${pageText || "(niet opgehaald)"}

Is dit ten onrechte weggegooid? Antwoord met JSON: {"missed": true/false, "reason": "kort", "block": "..."}. Geen tekst buiten de JSON.`;
    try {
      const { text } = await geminiCall({ model, system: SYSTEM, prompt, ledger, label: "audit" });
      const m = text.match(/\{[\s\S]*\}/);
      const v = m ? JSON.parse(m[0]) : null;
      return v && v.missed ? { ...item, _audit: v.reason || "", block: v.block } : null;
    } catch {
      return null;
    }
  });
  return { checked: chosen.length, missed: verdicts.filter(Boolean) };
}
