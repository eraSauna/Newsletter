// Laag 1 — verzamelen. RSS (alleen NL) + Google Search-grounding per markt in de
// scope van het profiel (lokale taal), plus trendwatch (UK/DK) als het profiel
// dat vraagt. Grounding-redirects worden opgelost; social/dubbel wordt geweerd.

import Parser from "rss-parser";
import { SOURCES, MARKET_QUERIES, TRENDWATCH_QUERY } from "../config.mjs";
import { geminiCall, parseJsonArray } from "./gemini.mjs";
import { resolveFinalUrl, mapLimit } from "./util.mjs";

const rss = new Parser({ timeout: 10000 });

// Backlog-modus (env BACKLOG_SINCE gezet): meer zoekpassen, want er is een hele
// achterstand sinds het voorjaar op te halen. Steady state: 2 passen volstaan.
const PASSES = process.env.BACKLOG_SINCE ? 3 : 2;

const GROUND_INSTRUCTIONS = `Geef UITSLUITEND een JSON-array van gevonden berichten, elk:
{"title":"...","url":"https://... (de echte bron-URL)","source":"naam van de bron","snippet":"korte feitelijke samenvatting","date":"YYYY-MM-DD of null","country":"NL|BE|FR|DE|UK|DK"}.
Regels: alleen echte nieuwsberichten met een bron-URL EN een concrete gedateerde aanleiding — een opening, besluit, vergunning, tender/aanbesteding, start, uitbreiding, pilot of aankondiging. Ontwikkelingen vanaf het voorjaar van 2026 tellen mee, ook als ze niet van deze week zijn. WEER: tijdloze beschrijvingen van al langer bestaande locaties/faciliteiten zonder recente ontwikkeling, marktrapporten, 'industry report/market trends', algemene how-to/blog/listicle, productpagina's of webshops, en Wikipedia. Alleen items die relevant zijn voor een verplaatsbaar outdoor drop-in saunaconcept aan water/natuur/horeca/recreatie. Geen tekst buiten de JSON.`;

export async function collect({ markets, trendwatch, filterModel, ledger }) {
  const candidates = [];

  // RSS-feeds zijn NL — alleen ophalen als Nederland in de profiel-scope zit.
  if (markets.includes("Nederland")) {
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
  }

  // Grounded search per markt in de scope, in de lokale taal.
  for (const market of markets) {
    const q = MARKET_QUERIES[market];
    if (!q) continue;
    // Meerdere passen: Google Search grounding is niet-deterministisch, meer runs
    // leveren meer en stabielere kandidaten (dubbelen worden later ontdubbeld).
    for (let pass = 1; pass <= PASSES; pass++) {
      const { text } = await geminiCall({
        model: filterModel,
        prompt: `${q}\n\n${GROUND_INSTRUCTIONS}`,
        grounding: true,
        ledger,
        label: `collect:${market}#${pass}`,
      });
      for (const it of parseJsonArray(text)) if (it && it.url) candidates.push({ ...it, market });
    }
  }

  // Trendwatch (UK/DK) alleen als het profiel dat vraagt.
  if (trendwatch) {
    const { text } = await geminiCall({
      model: filterModel,
      prompt: `${TRENDWATCH_QUERY}\n\n${GROUND_INSTRUCTIONS}`,
      grounding: true,
      ledger,
      label: "collect:trendwatch",
    });
    for (const it of parseJsonArray(text)) if (it && it.url) candidates.push({ ...it, market: "trendwatch" });
  }

  // Redirects oplossen naar echte bron-URL, social/dubbel weren.
  const resolved = await mapLimit(candidates, 6, async (c) => ({ ...c, url: await resolveFinalUrl(c.url) }));
  const SOCIAL = ["facebook.com", "instagram.com", "twitter.com", "x.com"];
  const seen = new Set();
  return resolved.filter((c) => {
    if (!c.url || seen.has(c.url) || SOCIAL.some((h) => c.url.includes(h))) return false;
    // Onopgeloste grounding-redirect: geen nette, citeerbare bron-URL → weren
    // i.p.v. een rauwe vertexaisearch-link in de mail tonen.
    if (c.url.includes("grounding-api-redirect")) return false;
    seen.add(c.url);
    return true;
  });
}
