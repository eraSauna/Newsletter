#!/usr/bin/env node
// Orchestrator for one weekly eräSauna edition (split architecture):
//   cadence → research (cheap reading model) → editorial (Opus) → render md.
// It does NOT send. Sending is a separate, explicit step (send-newsletter.mjs).
//
// Needs an eräSauna-owned Anthropic API key in ANTHROPIC_API_KEY. Nothing runs
// against REPP infra. Requires: npm install (see package.json).

import Anthropic from "@anthropic-ai/sdk";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { blocksForDate } from "./lib/cadence.mjs";
import { CostLedger } from "./lib/cost.mjs";
import { researchTask } from "./research.mjs";
import { synthesize } from "./synthesize.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const READING_MODEL = process.env.READING_MODEL || "claude-haiku-4-5";
const EDITORIAL_MODEL = process.env.EDITORIAL_MODEL || "claude-opus-4-8";
const MONTHLY_CAP_USD = Number(process.env.MONTHLY_CAP_USD || "30");
const PRIMARY = "Nederland, België, Frankrijk en Duitsland";

// Per-block research instructions. Weekly core covers the four primary markets;
// trendwatch covers UK/DK. Competitors are event-driven (only report movement).
const TASKS = {
  locations: `Zoek nieuwe/aangekondigde horeca- en verblijfslocaties aan water en waterfront-/gebiedsontwikkelingen in ${PRIMARY}: strandpaviljoens, beachclubs, jachthavens/marina's, recreatieplassen, stadsstranden, tenders/concessies, exploitant-gezocht. Alleen plekken waar een verplaatsbare outdoor drop-in sauna plausibel kan functioneren.`,
  swimming: `Zoek wijzigingen rond zwemmen en waterrecreatie in ${PRIMARY}: nieuw officieel zwemwater, zwemverbod opgeheven, nieuwe zwemsteiger/zwemzone, gemeente stimuleert openwaterzwemmen, oevers toegankelijk, plus relevante lokale regelgeving (omgevingsplan, tijdelijke plaatsing, strand-/havenverordening). Geef zwemmen-wordt-mogelijk extra prioriteit.`,
  partners: `Zoek bewegingen bij mogelijke locatiepartners/afnemers in ${PRIMARY}: strandpaviljoens, boutiquehotels, campings, vakantieparken, jachthaven-/marina-exploitanten, watersport-/surfclubs, gebieds-/recreatieontwikkelaars, gemeenten. Nieuwe vestiging, uitbreiding, nieuwe exploitant, investering, winter-/wellnessstrategie.`,
  hubs: `Zoek nieuwe outdoor sauna- en wellness-hubs in Europa (community sauna, sauna village, harbour/beach/floating sauna, cold plunge-combinaties): locatie, schaal, capaciteit, ticketprijs, businessmodel, financiering, uitbreidingsplannen.`,
  competitors: `Zoek directe/vergelijkbare drop-in outdoor sauna-concurrenten in ${PRIMARY} die deze periode iets doen (nieuwe locatie, prijswijziging, uitbreiding) of nieuwe toetreders. Alleen concurrenten met beweging; als er niets gebeurt, meld "geen beweging".`,
  trendwatch: `Zoek recente ontwikkelingen in Groot-Brittannië en Denemarken rond community sauna, seaside/harbour sauna, memberships, crowdfunding, gemeentelijke samenwerking, winterzwemmen en exploitatiemodellen. Focus op één concrete les per item.`,
  innovation: `Zoek toepasbare product-/operationele innovaties voor een verplaatsbare outdoor drop-in sauna: energiezuinig/slim verwarmen, remote monitoring, smart locks/dynamische toegangscodes, ventilatie/droogventilatie, vandalismebestendige materialen, modulaire funderingen/hijsbare units, off-grid, buitendouches.`,
  reviews: `Zoek terugkerende reviewpatronen (Google/Tripadvisor/Trustpilot/Reddit) voor outdoor drop-in sauna's in ${PRIMARY}: positieve en negatieve patronen rond boeking/smart-lock, temperatuur/opwarmtijd, cold plunge, kleedruimte/sanitair, prijs, drukte, parkeren. Patronen, geen incidenten.`,
  pricing: `Verzamel prijs- en boekingsdata van relevante drop-in outdoor sauna's in ${PRIMARY} en trendmarkten: ticketprijs, sessieduur, capaciteit, model (gedeeld/privé/membership), recente wijzigingen. Markeer als bezetting alleen uit boekingsbeschikbaarheid is afgeleid.`,
};

const READING_SYSTEM = `Je verzamelt gedateerde, geverifieerde findings voor eräSauna (verplaatsbare outdoor drop-in sauna's, markten ${PRIMARY} + UK/DK trendwatch). Zoek op het web, lees kansrijke bronnen, en geef per bevinding: korte feitelijke samenvatting (Nederlands), waarom relevant voor eräSauna, één concrete actie, volledige bron-URL, publicatiedatum (+ datum gebeurtenis). Focus op de afgelopen ~2 weken; ouder mag als nog commercieel actueel, dateer het dan. Alleen relevant voor een drop-in outdoor saunaconcept; geen indoor spa/thermen. Verzin geen bronnen of data. Liever minder maar betrouwbaar.`;

function isoParts(now) {
  const publishDate = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 7);
  return { publishDate, periodStart: start.toISOString().slice(0, 10), periodEnd: publishDate };
}

async function main() {
  const now = new Date();
  const { active, week, runBiweekly, runEightweekly } = blocksForDate(now);
  const { publishDate, periodStart, periodEnd } = isoParts(now);
  const editionDir = join(ROOT, "state", `${now.getUTCFullYear()}-W${String(week).padStart(2, "0")}`);
  await mkdir(editionDir, { recursive: true });

  console.log(`[edition] week ${week} · biweekly=${runBiweekly} · 8-weekly=${runEightweekly}`);
  console.log(`[edition] blokken: ${active.map((b) => b.id).join(", ")}`);

  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const ledger = await new CostLedger({ stateDir: editionDir, monthlyCapUsd: MONTHLY_CAP_USD }).load();

  // 1. Reading: one research task per active block that has a task template.
  const findings = [];
  for (const block of active) {
    const prompt = TASKS[block.key];
    if (!prompt) continue; // signals/watchlist/actions are derived in editorial
    const { text, searches } = await researchTask(client, {
      model: READING_MODEL,
      system: READING_SYSTEM,
      prompt,
      label: `research:${block.key}`,
      ledger,
    });
    findings.push({ block: block.key, label: block.title, text });
    console.log(`[research] ${block.key}: ${searches} searches`);
  }

  // 2. Editorial: Opus writes the newsletter from findings.
  const meta = { week, periodStart, periodEnd, publishDate, active };
  const { markdown } = await synthesize(client, {
    model: EDITORIAL_MODEL,
    meta,
    findings,
    ledger,
    promptPath: join(ROOT, "EDITORIAL-PROMPT.md"),
  });

  // 3. Persist. Rendering to HTML + sending are separate steps.
  await writeFile(join(editionDir, "newsletter.md"), markdown, "utf8");
  await writeFile(join(editionDir, "findings.json"), JSON.stringify(findings, null, 2), "utf8");
  const total = await ledger.save();

  console.log(`[edition] geschreven: ${join(editionDir, "newsletter.md")}`);
  console.log(`[cost] deze maand tot nu toe: $${total.toFixed(2)} (cap $${MONTHLY_CAP_USD})`);
  console.log(`[next] render: python3 md-to-email.py ${join(editionDir, "newsletter.md")} > ${join(editionDir, "newsletter.html")}`);
  console.log(`[next] verzend (aparte go): node send-newsletter.mjs ${join(editionDir, "newsletter.html")} "<onderwerp>"`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
