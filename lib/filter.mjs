// Laag 2 — dedup + grove filtering op het goedkope model (Flash-Lite).
// Beoordeelt titel + snippet (niet de volledige pagina): duidelijk irrelevant of
// dubbel eruit, de rest door naar laag 3. Bewust ruim: liever een twijfelgeval
// doorlaten dan een lead vroeg weggooien (false-negatives zijn de dure fout).

import { geminiCall, parseJsonArray } from "./gemini.mjs";

const SYSTEM = `Je bent een grove voorfilter voor eräSauna (verplaatsbare outdoor drop-in sauna's; markten NL/BE/FR/DE + UK/DK trendwatch). Je beoordeelt alleen titel + snippet, niet de volledige tekst. Doel: duidelijk irrelevante of dubbele items eruit, de rest doorlaten. Wees ruim: bij twijfel doorlaten. Irrelevant = geen enkele link met water/natuur/recreatie/horeca-locaties, zwemmen/waterrecreatie, outdoor sauna, of directe drop-in concurrenten. Indoor spa/thermen/hotelsauna zonder outdoor drop-in = irrelevant. Ook irrelevant: tijdloze/evergreen beschrijvingen van al langer bestaande locaties of faciliteiten zonder concrete recente ontwikkeling (opening, besluit, vergunning, tender, uitbreiding), marktrapporten en 'industry report/market trends', algemene how-to/blog/listicle, productpagina's/webshops, en items buiten NL/BE/FR/DE/UK/DK. Let op: een gedateerde ontwikkeling sinds het voorjaar van 2026 is nieuw en telt mee — die niet afwijzen omdat hij niet van deze week is.`;

/**
 * @returns {Promise<{kept: object[], rejected: object[]}>}
 */
export async function filterCandidates({ candidates, model, ledger }) {
  if (candidates.length === 0) return { kept: [], rejected: [] };

  // Batch: één call over de hele lijst, terug met keep-beslissingen per index.
  const list = candidates
    .map((c, i) => `${i}. [${c.source || "?"}] ${c.title} — ${c.snippet || ""}`)
    .join("\n");

  const prompt = `Hieronder genummerde kandidaten. Geef een JSON-array terug, één object per kandidaat:
{"i": <index>, "keep": true/false, "dup_of": <index of null>, "reason": "kort"}.
Zet keep=false alleen bij duidelijke irrelevantie of tijdloze/evergreen content zonder recente ontwikkeling; dup_of naar de laagste index bij duidelijke dubbelen. Geen tekst buiten de JSON.

${list}`;

  const { text } = await geminiCall({ model, system: SYSTEM, prompt, ledger, label: "filter" });
  const decisions = parseJsonArray(text);
  const byIndex = new Map(decisions.map((d) => [d.i, d]));

  const kept = [];
  const rejected = [];
  candidates.forEach((c, i) => {
    const d = byIndex.get(i);
    const keep = d ? d.keep && d.dup_of == null : true; // ontbreekt beslissing → doorlaten
    (keep ? kept : rejected).push({ ...c, _filter: d?.reason || "" });
  });
  return { kept, rejected };
}
