#!/usr/bin/env node
// Orchestrator — één editie voor één PROFIEL (main/fr/de). Vier-lagen-funnel:
//   collect (per profiel-scope) -> filter -> dedup (eigen geheugen) -> read + audit -> Opus.
// Draait alleen in even ISO-weken (tenzij FORCE_EDITION=true). Verstuurt NIETS
// (dat doet de workflow apart). Elk profiel heeft eigen scope, taal, geheugen en pad.
//
// PROFILE=main|fr|de (default main). Keys: GOOGLE_API_KEY (1-3), ANTHROPIC_API_KEY (4).

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
import { MODELS, MONTHLY_CAP_USD, AUDIT_SAMPLE_SIZE, PROFILES } from "./config.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PROFILE = process.env.PROFILE || "main";
const profile = PROFILES[PROFILE];
if (!profile) {
  console.error(`onbekend profiel: ${PROFILE}`);
  process.exit(1);
}

function isoParts(now) {
  const publishDate = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 14);
  return { publishDate, periodStart: start.toISOString().slice(0, 10), periodEnd: publishDate };
}

async function main() {
  const now = new Date();
  const force = process.env.FORCE_EDITION === "true";
  const { active, week, isEdition, extended } = blocksForDate(now, force);

  if (!isEdition) {
    console.log(`[${PROFILE}] week ${week} — geen editie (tweewekelijks). Gestopt.`);
    return;
  }

  const activeKeys = active.map((b) => b.key);
  const { publishDate, periodStart, periodEnd } = isoParts(now);
  const editionLabel = `${now.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  const memoryRoot = join(ROOT, profile.memoryDir);
  const editionDir = join(ROOT, "state", profile.subdir, editionLabel);
  await mkdir(editionDir, { recursive: true });

  console.log(`[${PROFILE}] ${editionLabel} · markten: ${profile.markets.join(", ")}${profile.trendwatch ? " + trendwatch" : ""} · taal: ${profile.language}`);
  const ledger = await new CostLedger({ stateDir: editionDir, monthlyCapUsd: MONTHLY_CAP_USD }).load();
  const seen = await loadSeen(memoryRoot);
  console.log(`[${PROFILE}/geheugen] ${seen.developments.length} eerder behandeld`);

  const candidates = await collect({
    markets: profile.markets,
    trendwatch: profile.trendwatch && activeKeys.includes("trendwatch"),
    filterModel: MODELS.filter,
    ledger,
  });
  console.log(`[${PROFILE}/collect] ${candidates.length} kandidaten`);

  const { kept, rejected } = await filterCandidates({ candidates, model: MODELS.filter, ledger });
  console.log(`[${PROFILE}/filter] ${kept.length} door, ${rejected.length} afgewezen`);

  const { newItems, updates, droppedRepeat } = await dedupAgainstSeen({ candidates: kept, seen, model: MODELS.filter, ledger });
  console.log(`[${PROFILE}/geheugen] ${newItems.length} nieuw, ${updates.length} updates, ${droppedRepeat} al behandeld`);

  const findings = await readItems({ items: [...newItems, ...updates], model: MODELS.reader, ledger });
  console.log(`[${PROFILE}/read] ${findings.length} findings`);

  const audit = await auditRejected({ rejected, size: AUDIT_SAMPLE_SIZE, model: MODELS.auditor, ledger });
  console.log(`[${PROFILE}/audit] ${audit.checked} gecontroleerd, ${audit.missed.length} mogelijk gemist`);

  const meta = { week, editionLabel, periodStart, periodEnd, publishDate, active, marketsLabel: profile.marketsLabel };
  const { markdown } = await synthesize({
    model: MODELS.editorial,
    meta,
    findings,
    promptPath: join(ROOT, "EDITORIAL-PROMPT.md"),
    ledger,
    language: profile.language,
  });

  recordCovered(seen, findings, editionLabel);
  await saveSeen(memoryRoot, seen);

  await writeFile(join(editionDir, "newsletter.md"), markdown, "utf8");
  await writeFile(join(editionDir, "findings.json"), JSON.stringify(findings, null, 2), "utf8");
  await writeFile(join(editionDir, "audit.json"), JSON.stringify(audit, null, 2), "utf8");
  const total = await ledger.save();

  console.log(`[${PROFILE}] geschreven, geheugen nu ${seen.developments.length}`);
  console.log(`[cost] maand tot nu toe: $${total.toFixed(2)} (cap $${MONTHLY_CAP_USD})`);
  // Machine-leesbaar voor de workflow (render + verzend):
  console.log(`EDITIONDIR=${editionDir}`);
  console.log(`SUBJECT=${profile.subject}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
