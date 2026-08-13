// Centrale configuratie voor de eräSauna-funnel.
// Modellen per laag zijn env-gestuurd (GitHub Variables / .env).

export const MODELS = {
  filter: process.env.FILTER_MODEL || "gemini-3.1-flash-lite",
  reader: process.env.READER_MODEL || "gemini-3.6-flash",
  auditor: process.env.AUDIT_MODEL || "gemini-3.6-flash",
  editorial: process.env.EDITORIAL_MODEL || "claude-opus-4-8",
};

export const MONTHLY_CAP_USD = Number(process.env.MONTHLY_CAP_USD || "15");
export const AUDIT_SAMPLE_SIZE = Number(process.env.AUDIT_SAMPLE_SIZE || "20");

export const MARKETS = {
  primary: ["Nederland", "België", "Frankrijk", "Duitsland"],
  trendwatch: ["Groot-Brittannië", "Denemarken"],
};

// Vaste bronnen — RSS wordt elke run opgehaald; portals zijn officiële ankers.
// Vul hier de bronnen aan die je élke editie gecheckt wilt hebben.
export const SOURCES = {
  rss: [
    "https://www.destentor.nl/regio/rss.xml",
    "https://www.pzc.nl/regio/rss.xml",
    "https://www.gelderlander.nl/regio/rss.xml",
    "https://www.bndestem.nl/regio/rss.xml",
  ],
  portals: [
    { name: "officielebekendmakingen.nl (KOOP)", market: "Nederland", url: "https://www.officielebekendmakingen.nl" },
    { name: "TenderNed", market: "Nederland", url: "https://www.tenderned.nl" },
    { name: "VMM zwemwater", market: "België", url: "https://www.vmm.be" },
  ],
};

// Grounding-query per primaire markt, in de lokale taal. Prioriteit: officiële
// en regionale bronnen; kern = locaties, zwemwater/regelgeving, partners.
export const MARKET_QUERIES = {
  Nederland: "afgelopen 2 weken, Nederland: nieuw strandpaviljoen OR strandtent OR beachclub OR horeca aan het water OR nieuwe/uitbreiding jachthaven OR recreatieplas OR stadsstrand OR waterfrontontwikkeling OR tijdelijke horeca vergunning OR horecaconcessie strand OR exploitant gezocht recreatie OR aanbesteding recreatiegebied OR 'zwemmen toegestaan' OR 'nieuw zwemwater' OR 'zwemverbod opgeheven' OR nieuwe zwemsteiger OR openwaterzwemmen gemeente OR buitensauna/mobiele sauna aan het water. Prioriteer gemeente-, provincie- en regionale nieuwsbronnen en officiele bekendmakingen.",
  "België": "afgelopen 2 weken, Belgie (Vlaanderen, kust, Antwerpen, Gent, Brussel, Limburg): nieuwe strandbar OR strandpaviljoen OR horeca aan het water OR jachthaven OR recreatiedomein OR nieuwe zwemzone OR 'zwemmen toegestaan' OR openluchtzwemmen OR strandconcessie OR exploitant gezocht recreatie OR buitensauna aan het water. Prioriteer gemeente-, VMM- en regionale bronnen.",
  Frankrijk: "derniers 15 jours, France (cotes, lacs, ports): nouvelle paillote OR nouveau restaurant/bar de plage OR guinguette au bord de l'eau OR nouveau port de plaisance OR base de loisirs OR 'baignade autorisee' OR nouvelle zone de baignade OR concession de plage OR appel a projets plage OR sauna exterieur/nordique au bord de l'eau OR bain froid. Prioriser sources locales, communes et prefectures.",
  Duitsland: "letzte 2 Wochen, Deutschland (NRW, Niedersachsen, Hamburg, Bremen, Berlin, Brandenburg, Schleswig-Holstein, Mecklenburg-Vorpommern): neue Strandbar OR Gastronomie am Wasser OR neuer Yachthafen/Marina OR neues Strandbad OR 'Baden wieder erlaubt' OR neue Badestelle OR Sauna am See/Hafen OR mobile Sauna am Wasser OR Betreiber gesucht Freizeit OR Ausschreibung Gastronomie Hafen. Bevorzuge kommunale und regionale Quellen.",
};

export const TRENDWATCH_QUERY = "last 2 weeks: UK community sauna OR seaside/beach sauna OR sauna hub OR sauna membership/crowdfunding; Denmark havnebad OR saunaklub OR vinterbadning OR havneudvikling rekreativ. New openings, business/exploitation models, municipal cooperation. Prefer original local sources.";
