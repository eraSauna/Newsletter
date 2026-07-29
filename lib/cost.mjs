// Cost tracking + hard monthly cap for the eräSauna newsletter pipeline.
// Ground truth for billing is the Anthropic Console; this is a local mirror so
// each edition carries its own cost line and a runaway run is refused.
//
// Prices are USD per 1,000,000 tokens (input / output). Source: Anthropic model
// pricing at build time — verify against the Console; update here on change.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

export const PRICES = {
  "claude-opus-4-8": { in: 5.0, out: 25.0 },
  "claude-sonnet-5": { in: 3.0, out: 15.0 }, // intro $2/$10 through 2026-08-31
  "claude-haiku-4-5": { in: 1.0, out: 5.0 },
};

// Per-search fee for the built-in web_search server tool, USD per search.
// TODO: confirm the exact rate against Anthropic pricing before trusting totals.
export const WEB_SEARCH_PER_CALL = 0.01;

function costFor(model, usage) {
  const p = PRICES[model];
  if (!p) return 0;
  const input = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) * 0.1;
  const output = usage.output_tokens || 0;
  return (input * p.in + output * p.out) / 1_000_000;
}

/** Simple monthly ledger persisted to state/cost-YYYY-MM.json. */
export class CostLedger {
  constructor({ stateDir, monthlyCapUsd, now }) {
    this.stateDir = stateDir;
    this.cap = monthlyCapUsd ?? Infinity;
    this.month = (now ?? new Date()).toISOString().slice(0, 7); // YYYY-MM
    this.file = join(stateDir, `cost-${this.month}.json`);
    this.data = { month: this.month, total_usd: 0, calls: [] };
  }

  async load() {
    try {
      this.data = JSON.parse(await readFile(this.file, "utf8"));
    } catch {
      /* first run this month */
    }
    return this;
  }

  /** Throw before spending if the month's cap would be exceeded. */
  assertUnderCap() {
    if (this.data.total_usd >= this.cap) {
      throw new Error(
        `[cost] Maandcap bereikt: $${this.data.total_usd.toFixed(2)} >= $${this.cap} (${this.month}). Run gestopt.`
      );
    }
  }

  record(model, usage, { label = "", webSearches = 0 } = {}) {
    const usd = costFor(model, usage) + webSearches * WEB_SEARCH_PER_CALL;
    this.data.total_usd += usd;
    this.data.calls.push({
      label,
      model,
      input_tokens: usage.input_tokens || 0,
      output_tokens: usage.output_tokens || 0,
      web_searches: webSearches,
      usd: Number(usd.toFixed(4)),
    });
    return usd;
  }

  async save() {
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify(this.data, null, 2), "utf8");
    return this.data.total_usd;
  }
}
