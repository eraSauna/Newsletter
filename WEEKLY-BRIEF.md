# eräSauna Market & Location Intelligence — runbook

Operationele wrapper rond de megaprompt. De megaprompt bepaalt de *inhoud* per
sectie; dit bestand bepaalt *wanneer* elke sectie draait en hoe je verzendt.

## Context (deze sessie)

eräSauna plaatst verplaatsbare, modulaire outdoor drop-in sauna's. Doel: units
neerzetten in **Nederland, België, Frankrijk en Duitsland**. Er zijn al vier
locaties in beeld, een bouwer, en een werkend model. Focus van de intelligence
ligt daarom op **nieuwe kansen en nieuwe locaties**, niet op concept-validatie.

## Markten

- **Primair, elke week gewogen:** Nederland, België, Frankrijk, Duitsland.
- **Trendwatch, tweewekelijks:** Groot-Brittannië, Denemarken (product-/
  exploitatie-inspiratie — geen primaire marktvergelijking).
- **Secundair, alleen op verzoek / bij uitzonderlijk relevante ontwikkeling:**
  Canada, VS, Baltische staten, Oostenrijk, Zwitserland, Tsjechië, Ierland.
  Niet in de routine-scrape.

## Cadans

Eén e-mail per maandag. De kans-kern gaat altijd mee; de andere blokken liften
mee wanneer ze aan de beurt zijn. Zo blijft de wekelijkse mail kort, met periodiek
een vollere editie.

Eén editie per **twee weken** (even ISO-weken). De scheduler draait elke maandag,
maar de code stopt in oneven weken. Elke editie bevat het volle blokkenset;
review- en prijsmonitor komen elke **4 weken** mee (elke tweede editie).

| Blok (megaprompt-sectie) | Cadans |
| --- | --- |
| 1, 2, 3, 4, 5, 8, 9, 10, 11, 12 (signalen, locaties, zwemwater, hubs, concurrentie, trendwatch, innovatie, partners, watchlist, acties) | **elke editie (2-wekelijks)** |
| 6. Reviewmonitor | **elke 4 weken** |
| 7. Prijs- en boekingsmonitor | **elke 4 weken** |

**Concurrentie-regel (sectie 5):** neem een concurrent alleen op als er
werkelijk iets gebeurt (nieuwe locatie, prijswijziging, uitbreiding, nieuwe
toetreder in een doelmarkt of nabij een doellocatie). Gebeurt er niets, dan
niets schrijven — geen "geen nieuws"-regel.

**Geheugen tegen herhaling (`state/seen.json`).** Elke editie wordt éérst tegen
het geheugen gededupliceerd (laag 2b): al behandelde ontwikkelingen vallen af,
zodat je geen herhaald nieuws krijgt. Alleen nieuwe ontwikkelingen en materiële
*updates* (nieuwe status/datum/prijs) blijven over. Na de editie worden de
behandelde ontwikkelingen weggeschreven en door de workflow terug gecommit.

**Welke week draait wat:** even ISO-week = editie; `weeknummer % 4 == 0` = ook
review/prijs. Oneven weken: geen editie.

## Wat de agent per run doet

1. **Kop-variabelen:** ISO-weeknummer, periode (afgelopen 7 dagen), publicatie-
   datum. Bepaal op basis van het weeknummer welke blokken deze editie meelopen.

2. **Research — fan-out web search.** Voor de blokken die deze week draaien,
   gebruik de megaprompt-zoektermen §7 plus de Franse termen hieronder, per markt
   en taal (NL/FR/DE/EN, DK alleen in trendwatch-weken). Prioriteer altijd de
   kans-kern (locaties, zwemwater/regelgeving, partners); officiële bronnen
   (gemeente/commune, bekendmakingen, vergunningen, tenders) boven media.

3. **Selecteer en scoor** (megaprompt §8 + §13). Alleen items die aan een
   selectiecriterium voldoen; locaties interne score 0-100, volledige score
   alleen bij de top-3. Liever 15 sterke items dan 50 matige.

4. **Dedup week-op-week** tegen het vorige-editie-archief. Nog-niet-concrete
   items → watchlist, niet herhalen.

5. **Stel de editie samen:** kans-kern + de blokken die deze week aan de beurt
   zijn, in de sectievolgorde van megaprompt §10. Lege sectie kort weglaten.

6. **QC** — de 15 checks van megaprompt §14.

7. **Render naar e-mail-HTML** en **verzend** naar `info@erasauna.nl` via
   `send-newsletter.mjs` (aparte, expliciete stap; menselijke go bij eerste
   live-run).

## Franse zoektermen (toevoeging op megaprompt §7)

nouvelle paillote / nouveau restaurant de plage / nouveau bar de plage;
nouvelle guinguette au bord de l'eau; nouveau port de plaisance / extension port
de plaisance; nouvelle base de loisirs / plan d'eau; baignade autorisée /
nouvelle zone de baignade / interdiction de baignade levée; sauna extérieur /
sauna mobile / sauna nordique / bain nordique; sauna au bord de l'eau; bain
froid / cold plunge; concession de plage / appel à projets plage; exploitant
recherché loisirs; aménagement des berges / reconquête des quais.

## Output-artefacten per run

`state/YYYY-Www/`: `newsletter.md`, `newsletter.html`, `items.json` (dedup +
welk blok wanneer draaide).

## Verzenden

```bash
RESEND_API_KEY=... \
NEWSLETTER_FROM="eräSauna Intelligence <intel@erasauna.nl>" \
NEWSLETTER_TO="info@erasauna.nl" \
node send-newsletter.mjs state/2026-W31/newsletter.html "Onderwerpregel hier"
```

## Harde regels (deze sessie)

- Nooit iets pushen naar REPP-accounts of REPP-infra.
- Geen keys/accounts uit de steengoed-zip hergebruiken.
- Afzender en ontvanger uitsluitend op `erasauna.nl` / `info@erasauna.nl`.
- Nederlands, zakelijk, geen emoji, geen tijdsbeloften, sentence case.
