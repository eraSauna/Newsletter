// Laag 3 — inhoudelijk lezen, verificatie en relevantiescore (Gemini 3.6 Flash).
// Haalt de volledige pagina op en beoordeelt per item. Levert gestructureerde
// findings die laag 4 (Opus) tot de nieuwsbrief verwerkt.

import { geminiCall } from "./gemini.mjs";
import { fetchText, mapLimit } from "./util.mjs";

const SYSTEM = `Je leest en verifieert bronnen voor eräSauna (verplaatsbare outdoor drop-in sauna's; markten NL/BE/FR/DE, trendwatch UK/DK). Beoordeel per bron op basis van de meegeleverde paginatekst. Verzin niets; als iets niet in de tekst staat, laat het leeg of zet relevant=false. Onderscheid plan/voorstel van definitief. Alleen relevant voor een drop-in outdoor saunaconcept; geen indoor spa/thermen.`;

const SCHEMA = {
  type: "object",
  properties: {
    relevant: { type: "boolean" },
    block: { type: "string", description: "locations|swimming|partners|hubs|competitors|trendwatch|innovation|reviews|pricing" },
    title: { type: "string" },
    place: { type: "string" },
    country: { type: "string" },
    type: { type: "string" },
    status: { type: "string", description: "geopend|aangekondigd|vergunning|in aanbouw|exploitant gezocht|tender|definitief|voorstel|pilot|onderzoek" },
    summary: { type: "string" },
    why: { type: "string" },
    action: { type: "string" },
    score: { type: "integer", description: "locatiescore 0-100" },
    priority: { type: "string", description: "A|B|C" },
    date: { type: "string" },
  },
  required: ["relevant", "block", "title", "summary", "score"],
};

/**
 * @returns {Promise<object[]>} findings (alleen relevant=true), incl. bron-URL.
 */
export async function readItems({ items, model, ledger, concurrency = 4 }) {
  const results = await mapLimit(items, concurrency, async (item) => {
    const pageText = await fetchText(item.url);
    const prompt = `Bron: ${item.url}
Titel: ${item.title}
Snippet: ${item.snippet || ""}
Datum (indien bekend): ${item.date || "onbekend"}

Paginatekst:
${pageText || "(kon niet ophalen — beoordeel op titel/snippet, zet relevant met voorzichtigheid)"}

Beoordeel deze bron voor eräSauna en geef het JSON-object volgens het schema. block = het best passende blok. Geef een locatiescore 0-100 en prioriteit A/B/C.`;

    try {
      const { text } = await geminiCall({ model, system: SYSTEM, prompt, schema: SCHEMA, ledger, label: "read" });
      const finding = JSON.parse(text);
      finding.source = item.url;
      finding.date = finding.date || item.date || null;
      finding.update = !!item._isUpdate; // update op eerder behandelde ontwikkeling
      return finding;
    } catch {
      return null;
    }
  });

  return results.filter((f) => f && f.relevant);
}
