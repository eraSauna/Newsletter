// Editorial layer: Opus turns the collected findings into the newsletter
// markdown, following the megaprompt structure. One pass per edition.

import { readFile } from "node:fs/promises";

/**
 * @returns {Promise<{markdown: string, usd: number}>}
 */
export async function synthesize(client, { model, meta, findings, ledger, promptPath }) {
  const editorialPrompt = await readFile(promptPath, "utf8");

  const activeList = meta.active.map((b) => `${b.id}. ${b.title}`).join("\n");
  const findingsBlock = findings
    .map((f) => `## Findings — ${f.label}\n\n${f.text}`)
    .join("\n\n---\n\n");

  const userMessage = `Editie-context:
- Weeknummer: ${meta.week}
- Periode: ${meta.periodStart} tot ${meta.periodEnd}
- Publicatiedatum: ${meta.publishDate}
- Markten: Nederland, België, Frankrijk, Duitsland (primair); Groot-Brittannië, Denemarken (trendwatch)

Neem in deze editie UITSLUITEND deze secties op (in deze volgorde):
${activeList}

Hieronder de ruwe research-findings per blok. Dedupliceer, pas de selectie- en
scoringscriteria toe, en schrijf de nieuwsbrief in markdown volgens de
sectiestructuur en stijlregels. Verzin geen bronnen of data die niet in de
findings staan; markeer plan/voorstel vs. definitief; elke bron als klikbare
link.

${findingsBlock}`;

  ledger?.assertUnderCap();
  const stream = client.messages.stream({
    model,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: editorialPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  const res = await stream.finalMessage();

  const usd = ledger?.record(model, res.usage, { label: "editorial" }) ?? 0;
  const markdown = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  return { markdown, usd };
}
