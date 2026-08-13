// Laag 1 — verzamelen. RSS + vaste bronnen + Google Search-grounding PER MARKT
// (lokale taal). Levert kandidaat-items; nog geen oordeel. Grounding-redirects
// worden opgelost naar de echte bron-URL en er wordt op URL ontdubbeld.

import Parser from "rss-parser";
import { SOURCES, MARKET_QUERIES, TRENDWATCH_QUERY, MARKETS } from "../config.mjs";
import { geminiCall, parseJsonArray } from "./gemini.mjs";
import { resolveFinalUrl, mapLimit } from "./util.mjs";

const rss = new Parser({ timeout: 10000 });

const GROUND_INSTRUCTIONS = `Geef UITSLUITEND een JSON-array van gevonden berichten, elk:
{"title":"...","url":"https://... (de echte bron-URL)","source":"naam van de bron","snippet":"korte feitelijke samenvatting","date":"YYYY-MM-DD of null","country":"NL|BE|FR|DE|UK|DK"}.
Regels: alleen echte, recente nieuwsberichten met een bron-URL. GEEN marktrapporten, GEEN 'industry report/market trends', GEEN algemene how-to/blog/listicle, GEEN productpagina's of webshops, GEEN Wikipedia. Alleen items die relevant zijn voor een verplaatsbaar outdoor drop-in saunaconcept aan water/natuur/horeca/recreatie. Geen tekst buiten de JSON.`;

export async function collect({ activeKeys, filterModel, ledger }) {
  const candidates = [];

  // 1a. RSS-feeds (altijd).
  for (const feedUrl of SOURCES.rss) {
    try {
      const feed = await rss.parseURL(feedUrl);
      for (const item of (feed.items || []).slice(0, 20)) {
        candidates.push({
          title: item.title?.trim() || "",
          url: item.link?.trim() || "",
          source: feed.title || feedUrl,
          snippet: (item.contentSnippet || item.content || "").replace(/<[^>]+>/g, " ").slice(0, 400),
          date: item.isoDate || item.pubDate || null,
        });
      }
    } catch {
      /* feed kapot: overslaan */
    }
  }

  // 1b. Grounded search per PRIMAIRE markt in de lokale taal.
  for (const market of MARKETS.primary) {
    const q = MARKET_QUERIES[market];
    if (!q) continue;
    const { text } = await geminiCall({
      model: filterModel,
      prompt: `${q}\n\n${GROUND_INSTRUCTIONS}`,
      grounding: true,
      ledger,
      label: `collect:${market}`,
    });
    for (const it of parseJsonArray(text)) if (it && it.url) candidates.push({ ...it, market });
  }

  // 1c. Trendwatch (UK/DK) alleen als het trendwatch-blok deze editie draait.
  if (activeKeys.includes("trendwatch")) {
    const { text } = await geminiCall({
      model: filterModel,
      prompt: `${TRENDWATCH_QUERY}\n\n${GROUND_INSTRUCTIONS}`,
      grounding: true,
      ledger,
      label: "collect:trendwatch",
    });
    for (const it of parseJsonArray(text)) if (it && it.url) candidates.push({ ...it, market: "trendwatch" });
  }

  // Grounding-redirects oplossen naar de echte bron-URL, dan ontdubbelen op URL.
  const resolved = await mapLimit(candidates, 6, async (c) => ({ ...c, url: await resolveFinalUrl(c.url) }));
  const seen = new Set();
  return resolved.filter((c) => {
    if (!c.url || seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
}
