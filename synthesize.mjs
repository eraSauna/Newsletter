// Laag 4 — eindredactie + strategische conclusies (Opus). Zet de gestructureerde,
// geverifieerde findings uit laag 3 om in de nieuwsbrief-markdown volgens de
// megaprompt-structuur. Eén pass per editie.

import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";

/**
 * @returns {Promise<{markdown: string}>}
 */
export async function synthesize({ model, meta, findings, promptPath, ledger, language = "Nederlands" }) {
  const client = new Anthropic(); // ANTHROPIC_API_KEY uit env
  const editorialPrompt = await readFile(promptPath, "utf8");

  const activeList = meta.active.map((b) => `${b.id}. ${b.title}`).join("\n");
  const findingsJson = JSON.stringify(findings, null, 2);

  const userMessage = `Editie-context:
- Weeknummer: ${meta.week}
- Periode: ${meta.periodStart} tot ${meta.periodEnd}
- Publicatiedatum: ${meta.publishDate}
- Markten: ${meta.marketsLabel}
- Taal: schrijf de VOLLEDIGE nieuwsbrief in het ${language}. De sectiestructuur en -volgorde blijven gelijk.

Neem in deze editie UITSLUITEND deze secties op (in deze volgorde):
${activeList}

Hieronder de geverifieerde findings (JSON) uit de leeslaag. Ze zijn al gefilterd
en gescoord; jouw taak is redactie: dedupliceer resterende overlap, kies de
sterkste items per sectie (liever 15 sterke dan 50 matige), schrijf volgens de
sectiestructuur en stijlregels, en trek de strategische conclusies/acties. Neem
alleen bronnen en feiten over die in de findings staan; markeer plan/voorstel vs.
definitief; elke bron als klikbare link.

FINDINGS:
${findingsJson}`;

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
  ledger?.record(model, res.usage, { label: "editorial" });

  const markdown = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { markdown };
}
