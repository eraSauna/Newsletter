# eräSauna Market & Location Intelligence

Wekelijkse market-, locatie- en concurrentie-intelligence voor eräSauna
(verplaatsbare, modulaire outdoor drop-in sauna's). Doel: nieuwe locaties en
kansen in **Nederland, België, Frankrijk en Duitsland**, met Groot-Brittannië en
Denemarken als trendwatch. Elke maandag één e-mail naar `info@erasauna.nl`.

## Architectuur (split)

Goedkoop lezen, duur schrijven:

```
cadans (welke blokken deze week)
   → research.mjs   — reading model (Haiku) zoekt + leest via web_search/web_fetch
   → synthesize.mjs — Opus schrijft de nieuwsbrief (EDITORIAL-PROMPT.md)
   → md-to-email.py — markdown → e-mail-HTML
   → send-newsletter.mjs — Resend → info@erasauna.nl   (aparte, expliciete stap)
```

Het lezen kost de meeste tokens en draait daarom op een goedkoop model; alleen de
eindredactie draait op Opus. Kosten worden per call gelogd (`lib/cost.mjs`) met
een harde maandcap.

## Cadans — één maandag-mail die meegroeit

| Blok | Cadans |
| --- | --- |
| Signalen, locatiekansen, zwemwater/regelgeving, partners, watchlist, acties | wekelijks |
| Hubs, concurrentie (bij beweging), UK/DK-trendwatch, product-innovatie | tweewekelijks (even weken) |
| Reviewmonitor, prijs-/boekingsmonitor | elke 8 weken |

Zie `WEEKLY-BRIEF.md` voor de volledige runbook en `EDITORIAL-PROMPT.md` voor de
redactie-instructie.

## Draaien

```bash
npm install
cp .env.example .env      # vul ANTHROPIC_API_KEY etc.
node run-edition.mjs      # research + eindredactie → state/JAAR-Www/newsletter.md
python3 md-to-email.py state/2026-W31/newsletter.md > state/2026-W31/newsletter.html
# verzenden is een aparte, expliciete stap:
node send-newsletter.mjs state/2026-W31/newsletter.html "Onderwerpregel"
```

`run-edition.mjs` verstuurt niets — het schrijft alleen de editie. Verzenden
gebeurt bewust apart.

## Kosten

- Reading (Haiku) ~$1-3,5/mnd, editorial (Opus) ~$3-4/mnd → **~$5-7/mnd gesplitst.**
- Elke run logt tokens + kosten naar `state/cost-YYYY-MM.json`.
- `MONTHLY_CAP_USD` weigert calls boven de maandlimiet; zet ook een spend limit in
  de Anthropic Console. De WebSearch-vergoeding per zoekopdracht staat als
  schatting in `lib/cost.mjs` (tarief nog te verifiëren).

## Status — automatiseren

Klaar en getest: cadans, kosten-log/cap, mailer, renderer, editorial-prompt,
runbook, proefeditie (`docs/`).

Nog nodig om live te gaan (eräSauna-eigen accounts):
1. **Anthropic API-key** (`ANTHROPIC_API_KEY`) — dan draait research + eindredactie.
2. **Resend-key + geverifieerd `erasauna.nl`-domein** — dan kan verzonden worden.
3. **Maandag-scheduler** die `run-edition.mjs` draait (cron/hosted runner).

## Regels

- Alles op eräSauna-accounts. Nooit REPP-accounts of REPP-infra gebruiken.
- Afzender/ontvanger uitsluitend op `erasauna.nl` / `info@erasauna.nl`.
- Nederlands, zakelijk, geen emoji, geen tijdsbeloften, sentence case.
