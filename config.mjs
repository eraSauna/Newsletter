// Centrale configuratie voor de eräSauna-funnel.
// Modellen per laag zijn env-gestuurd zodat je zonder codewijziging kunt bijstellen.

export const MODELS = {
  // Laag 2 — dedup + grove filtering (goedkoop, hoog volume).
  filter: process.env.FILTER_MODEL || "gemini-3.1-flash-lite",
  // Laag 3 — inhoudelijk lezen, verificatie, relevantiescore.
  reader: process.env.READER_MODEL || "gemini-3.6-flash",
  // Laag 3b — audit van afgewezen items (zelfde niveau als de reader).
  auditor: process.env.AUDIT_MODEL || "gemini-3.6-flash",
  // Laag 4 — eindredactie + strategische conclusies.
  editorial: process.env.EDITORIAL_MODEL || "claude-opus-4-8",
};

export const MONTHLY_CAP_USD = Number(process.env.MONTHLY_CAP_USD || "15");

// Hoeveel afgewezen items per editie opnieuw worden gecontroleerd (laag 3b).
export const AUDIT_SAMPLE_SIZE = Number(process.env.AUDIT_SAMPLE_SIZE || "20");

export const MARKETS = {
  primary: ["Nederland", "België", "Frankrijk", "Duitsland"],
  trendwatch: ["Groot-Brittannië", "Denemarken"],
};

// Laag 1 — vaste bronnen. Starter-set; uit te breiden per markt/regio.
// RSS-feeds worden direct opgehaald; portalen zijn zoek-/scrape-ankers.
export const SOURCES = {
  rss: [
    // NL regionaal + water/recreatie (voorbeeld — aanvullen)
    "https://www.destentor.nl/regio/rss.xml",
    "https://www.pzc.nl/regio/rss.xml",
    // BE / VMM zwemwater, FR/DE regionaal: toe te voegen
  ],
  // Gestructureerde officiële bronnen (doorzoeken via grounding + directe queries)
  portals: [
    { name: "officielebekendmakingen.nl (KOOP)", market: "Nederland", url: "https://www.officielebekendmakingen.nl" },
    { name: "TenderNed", market: "Nederland", url: "https://www.tenderned.nl" },
    { name: "VMM zwemwater", market: "België", url: "https://www.vmm.be" },
  ],
};

// Zoekthema's per blok (voeden de grounded search in laag 1). Zie EDITORIAL-PROMPT.md
// en WEEKLY-BRIEF.md voor de volledige zoektermen per taal/markt.
export const QUERIES = {
  locations: "nieuwe strandtent OR strandpaviljoen OR beachclub OR jachthaven OR recreatieplas OR waterfront OR tender horeca aan water",
  swimming: "zwemmen toegestaan OR nieuw zwemwater OR zwemverbod opgeheven OR nieuwe zwemsteiger OR openwaterzwemmen gemeente",
  partners: "nieuwe exploitant OR uitbreiding jachthaven OR camping OR vakantiepark OR strandpaviljoen aan water",
  hubs: "outdoor sauna hub OR community sauna OR floating sauna OR harbour sauna OR cold plunge",
  competitors: "mobiele sauna OR pop-up sauna aan water OR buitensauna boeken OR saunavlot",
  trendwatch: "community sauna UK OR seaside sauna OR sauna membership OR havnebad OR vinterbadning sauna",
  innovation: "outdoor sauna smart lock OR remote monitoring sauna OR modulaire sauna fundering OR energiezuinig verwarmen sauna",
  reviews: "outdoor sauna reviews OR sauna booking klachten OR sauna smart lock ervaring",
  pricing: "sauna ticketprijs OR sauna membership prijs OR drop-in sauna boeken tarief",
};
