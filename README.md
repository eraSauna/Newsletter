# eräSauna Market & Location Intelligence

Wekelijkse market-, locatie- en concurrentie-intelligence voor eräSauna
(verplaatsbare, modulaire outdoor drop-in sauna's). Doel: nieuwe locaties en
kansen in **Nederland, België, Frankrijk en Duitsland**, met Groot-Brittannië en
Denemarken als trendwatch. Elke maandag één e-mail naar `info@erasauna.nl`.

## Architectuur — vier-lagen-funnel

Elke laag ziet minder items, zodat de dure modellen klein blijven. Goedkoop
filteren, duur schrijven.

```
1. collect   RSS + vaste bronnen + Google Search grounding      → kandidaten
2. filter    Gemini 3.1 Flash-Lite: dedup + grove filtering      → doorlaters
2b. dedup    tegen state/seen.json (geheugen): herhaling eruit,   → nieuw + updates
             updates gemarkeerd
3. read      Gemini 3.6 Flash: lezen, verifiëren, relevantiescore → findings
3b. audit    steekproef afgewezen items opnieuw beoordeeld        → gemiste-leads-log
4. synthesize Opus 4.8: nieuwsbrief + strategische conclusies      → newsletter.md
   → md-to-email.py (HTML) → send-newsletter.mjs (Resend, aparte go)
```

Twee providers: Google Gemini (lagen 1-3) en Anthropic (laag 4). Modellen per
laag staan als env-var (`config.mjs` / `.env`), dus bijstellen kan zonder
codewijziging. De audit-steekproef (3b) borgt dat de goedkope filter geen echte
leads weggooit — false-negatives zijn hier de dure fout.

**Geheugen (`state/seen.json`).** Blijft in de repo staan en wordt elke editie
eerst gelezen: al behandelde ontwikkelingen worden eruit gefilterd (laag 2b), dus
geen herhaald nieuws. Materiële veranderingen (nieuwe status/datum/prijs) komen
terug als *update*. Na elke editie worden de behandelde ontwikkelingen weer
weggeschreven, en de Actions-workflow commit `state/` terug naar de repo.

Bestanden per laag: `lib/collect.mjs`, `lib/filter.mjs`, `lib/dedup.mjs`,
`lib/read.mjs`, `lib/audit.mjs`, `lib/memory.mjs`, `synthesize.mjs`. Orchestratie:
`run-edition.mjs`.

## Cadans — tweewekelijks

Eén editie per **twee weken** (even ISO-weken). De scheduler draait elke maandag,
maar `run-edition.mjs` slaat oneven weken over. Review- en prijsmonitor draaien
elke **4 weken** mee (elke tweede editie). Herhaling wordt niet door de cadans
maar door het seen-geheugen voorkomen.

Zie `WEEKLY-BRIEF.md` (runbook) en `EDITORIAL-PROMPT.md` (redactie-instructie).

## Draaien

```bash
npm install
cp .env.example .env      # vul GOOGLE_API_KEY, ANTHROPIC_API_KEY etc.
node run-edition.mjs      # funnel → state/JAAR-Www/newsletter.md (+ findings.json, audit.json)
python3 md-to-email.py state/2026-W31/newsletter.md > state/2026-W31/newsletter.html
node send-newsletter.mjs state/2026-W31/newsletter.html "Onderwerpregel"   # aparte go
```

`run-edition.mjs` verstuurt niets — het schrijft alleen de editie. Verzenden is
bewust apart.

## Kosten (schatting)

| Laag | Model | ~/maand |
| --- | --- | ---: |
| 2. filter | Gemini 3.1 Flash-Lite | ~$0,15 |
| 3. read + audit | Gemini 3.6 Flash | ~$4 |
| 4. eindredactie | Opus 4.8 | ~$4 |
| grounding | Google Search | ~$0-1 (binnen gratis quotum) |
| **Totaal** | | **~$8-10/maand** |

Elke run logt tokens + kosten naar `state/cost-YYYY-MM.json`. `MONTHLY_CAP_USD`
weigert calls boven de maandlimiet; zet ook een spend limit in de Anthropic
Console. Prijzen staan in `lib/cost.mjs` (geverifieerd juli 2026 — check bij
wijziging). Batch-korting (~50%) op de Gemini-lagen kan het totaal verder drukken.

## Status — automatiseren

Klaar: funnel-code (4 lagen + audit), cadans, kosten-log/cap, mailer, renderer,
editorial-prompt, runbook, proefeditie (`docs/`), GitHub Actions-workflow.

Nog nodig om live te gaan (eräSauna-eigen accounts):
1. **GOOGLE_API_KEY** (Gemini) en **ANTHROPIC_API_KEY** (Opus) — als repo-secrets.
2. **Resend-key + geverifieerd `erasauna.nl`-domein** — dan kan verzonden worden.
3. **Eén live smoke-test** — de Gemini-SDK-calls (grounding, schema) zijn tegen de
   juli-2026-SDK geschreven; eerste run verifieert de veldnamen.
4. Bronnenlijst in `config.mjs` uitbreiden per markt/regio.

## Regels

- Alles op eräSauna-accounts. Nooit REPP-accounts of REPP-infra gebruiken.
- Afzender/ontvanger uitsluitend op `erasauna.nl` / `info@erasauna.nl`.
- Nederlands, zakelijk, geen emoji, geen tijdsbeloften, sentence case.
