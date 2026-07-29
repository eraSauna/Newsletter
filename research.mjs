// Reading layer: cheap model gathers findings via the built-in web_search /
// web_fetch server tools. Returns raw findings text per task; the editorial
// layer (synthesize.mjs) turns findings into the newsletter.
//
// Split architecture: this runs on a cheap model (default Haiku 4.5); the
// editorial pass runs on Opus. See WEEKLY-BRIEF.md.

const READING_TOOLS = [
  { type: "web_search_20250305", name: "web_search", max_uses: 8 },
  { type: "web_fetch_20250910", name: "web_fetch", max_uses: 8 },
];

/**
 * Run one research task on the reading model, resolving server-tool pauses.
 * @returns {Promise<{text: string, usd: number, searches: number}>}
 */
export async function researchTask(client, { model, system, prompt, label, ledger, maxTurns = 6 }) {
  const messages = [{ role: "user", content: prompt }];
  let searches = 0;
  let usd = 0;
  let finalText = "";

  for (let turn = 0; turn < maxTurns; turn++) {
    ledger?.assertUnderCap();
    const res = await client.messages.create({
      model,
      max_tokens: 8000,
      system,
      tools: READING_TOOLS,
      messages,
    });

    searches += res.content.filter(
      (b) => b.type === "server_tool_use" && b.name === "web_search"
    ).length;
    usd += ledger?.record(model, res.usage, { label, webSearches: 0 }) ?? 0;

    finalText = res.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue; // server resumes its own tool loop
    }
    break;
  }

  // account for web-search fees once, after the loop
  if (searches > 0) ledger?.record(model, { input_tokens: 0, output_tokens: 0 }, { label: `${label} (searches)`, webSearches: searches });

  return { text: finalText, usd, searches };
}
