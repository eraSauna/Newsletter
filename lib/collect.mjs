// Laag 1 — verzamelen. RSS-feeds + vaste bronnen + Google Search-grounding.
// Levert een platte lijst kandidaat-items op; nog geen filtering of oordeel.

import Parser from "rss-parser";
import { SOURCES, QUERIES, MARKETS } from "../config.mjs";
import { geminiCall, parseJsonArray } from "./gemini.mjs";

const rss = new Parser({ timeout: 10000 });

/** Kandidaat: { title, url, source, snippet, date }. */
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
          snippet: (item.contentSnippet || item.content || "").replace(/<[^>]+>/g, "").slice(0, 400),
          date: item.isoDate || item.pubDate || null,
        });
      }
    } catch {
      /* feed kapot: overslaan */
    }
  }

  // 1b. Grounded search per actief blok (Google Search via Gemini).
  const markets = [...MARKETS.primary, ...MARKETS.trendwatch].join(", ");
  for (const key of activeKeys) {
    const query = QUERIES[key];
    if (!query) continue;
    const prompt = `Zoek recente (afgelopen ~2 weken) berichten in ${markets} over: ${query}.
Geef UITSLUITEND een JSON-array terug van gevonden items, elk:
{"title": "...", "url": "https://...", "source": "...", "snippet": "korte samenvatting", "date": "YYYY-MM-DD of null"}.
Alleen items met een echte bron-URL. Geen tekst buiten de JSON.`;
    const { text } = await geminiCall({
      model: filterModel, // grounding op het goedkope model
      prompt,
      grounding: true,
      ledger,
      label: `collect:${key}`,
    });
    for (const it of parseJsonArray(text)) {
      if (it && it.url) candidates.push({ ...it, block: key });
    }
  }

  // Ontdubbel op exacte URL (grove pre-dedup; semantische dedup zit in laag 2).
  const seen = new Set();
  return candidates.filter((c) => {
    if (!c.url || seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
}
