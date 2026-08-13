#!/usr/bin/env node
// Orchestrator — tweewekelijkse editie met geheugen. Vier-lagen-funnel:
//   1. collect  (RSS + vaste bronnen + Google Search grounding)
//   2. filter   (Gemini Flash-Lite: dedup + grove filtering)
//   2b. dedup   (tegen state/seen.json: herhaling eruit, updates markeren)
//   3. read      (Gemini 3.6 Flash: lezen, verifiëren, scoren) + audit-steekproef
//   4. synthesize(Opus: nieuwsbrief + strategische conclusies)
// Draait alleen in even ISO-weken (tweewekelijks). Verstuurt NIETS.
//
// Keys (eräSauna-eigen, geen REPP): GOOGLE_API_KEY (lagen 1-3), ANTHROPIC_API_KEY (laag 4).

import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { blocksForDate } from "./lib/cadence.mjs";
import { CostLedger } from "./lib/cost.mjs";
import { collect } from "./lib/collect.mjs";
import { filterCandidates } from "./lib/filter.mjs";
import { dedupAgainstSeen } from "./lib/dedup.mjs";
import { readItems } from "./lib/read.mjs";
import { auditRejected } from "./lib/audit.mjs";
import { synthesize } from "./synthesize.mjs";
import { loadSeen, saveSeen, recordCovered } from "./lib/memory.mjs";
import { MODELS, MONTHLY_CAP_USD, AUDIT_SAMPLE_SIZE } from "./config.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));

function isoParts(now) {
  const publishDate = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 14); // tweewekelijkse periode
  return { publishDate, periodStart: start.toISOString().slice(0, 10), periodEnd: publishDate };
}

async function main() {
  const now = new Date();
  const { active, week, isEdition, extended } = blocksForDate(now, process.env.FORCE_EDITION === "true");

  if (!isEdition) {
    console.log(`[edition] week ${week} — geen editie (tweewekelijks, alleen even weken). Gestopt.`);
    return;
  }

  const activeKeys = active.map((b) => b.key);
  const { publishDate, periodStart, periodEnd } = isoParts(now);
  const editionLabel = `${now.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  const stateRoot = join(ROOT, "state");
  const editionDir = join(stateRoot, editionLabel);
  await mkdir(editionDir, { recursive: true });

  console.log(`[edition] ${editionLabel} · extended(review/prijs)=${extended}`);
  console.log(`[edition] blokken: ${active.map((b) => b.id).join(", ")}`);
  const ledger = await new CostLedger({ stateDir: editionDir, monthlyCapUsd: MONTHLY_CAP_USD }).load();
  const seen = await loadSeen(stateRoot);
  console.log(`[geheugen] ${seen.developments.length} eerder behandelde ontwikkelingen`);

  // Laag 1 — verzamelen.
  const candidates = await collect({ activeKeys, filterModel: MODELS.filter, ledger });
  console.log(`[1/collect] ${candidates.length} kandidaten`);

  // Laag 2 — dedup + grove filter.
  const { kept, rejected } = await filterCandidates({ candidates, model: MODELS.filter, ledger });
  console.log(`[2/filter] ${kept.length} door, ${rejected.length} afgewezen`);

  // Laag 2b — dedup tegen het geheugen (herhaling eruit, updates markeren).
  const { newItems, updates, droppedRepeat } = await dedupAgainstSeen({
    candidates: kept,
    seen,
    model: MODELS.filter,
    ledger,
  });
  console.log(`[2b/geheugen] ${newItems.length} nieuw, ${updates.length} updates, ${droppedRepeat} al behandeld (weggelaten)`);

  // Laag 3 — lezen, verifiëren, scoren (nieuw + updates).
  const findings = await readItems({ items: [...newItems, ...updates], model: MODELS.reader, ledger });
  console.log(`[3/read] ${findings.length} relevante findings (${findings.filter((f) => f.update).length} updates)`);

  // Laag 3b — audit van afgewezen items.
  const audit = await auditRejected({ rejected, size: AUDIT_SAMPLE_SIZE, model: MODELS.auditor, ledger });
  console.log(`[3b/audit] ${audit.checked} gecontroleerd, ${audit.missed.length} mogelijk gemist`);

  // Laag 4 — eindredactie (Opus).
  const meta = { week, editionLabel, periodStart, periodEnd, publishDate, active };
  const { markdown } = await synthesize({
    model: MODELS.editorial,
    meta,
    findings,
    promptPath: join(ROOT, "EDITORIAL-PROMPT.md"),
    ledger,
  });

  // Geheugen bijwerken: behandelde ontwikkelingen vastleggen.
  recordCovered(seen, findings, editionLabel);
  await saveSeen(stateRoot, seen);

  await writeFile(join(editionDir, "newsletter.md"), markdown, "utf8");
  await writeFile(join(editionDir, "findings.json"), JSON.stringify(findings, null, 2), "utf8");
  await writeFile(join(editionDir, "audit.json"), JSON.stringify(audit, null, 2), "utf8");
  const total = await ledger.save();

  console.log(`[edition] geschreven: ${join(editionDir, "newsletter.md")}`);
  console.log(`[geheugen] ${seen.developments.length} ontwikkelingen na deze editie`);
  if (audit.missed.length) console.log(`[audit] LET OP — mogelijk gemiste leads staan in audit.json`);
  console.log(`[cost] deze maand tot nu toe: $${total.toFixed(2)} (cap $${MONTHLY_CAP_USD})`);
  console.log(`[next] render: python3 md-to-email.py "${join(editionDir, "newsletter.md")}" > "${join(editionDir, "newsletter.html")}"`);
  console.log(`[next] verzend (aparte go): node send-newsletter.mjs "${join(editionDir, "newsletter.html")}" "<onderwerp>"`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
