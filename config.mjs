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

// Zoekvenster. Standaard ~2 weken (steady state: alleen nieuw sinds vorige editie).
// Zet de env/Variable BACKLOG_SINCE (bijv. 2026-05-01) om de eerste edities de
// volledige achterstand sinds het voorjaar te laten ophalen — er is sinds mei van
// alles gebeurd dat nog nooit in een editie stond. Verwijder BACKLOG_SINCE zodra
// die achterstand is verwerkt; dan valt het vanzelf terug naar het 2-weken-venster.
const BACKLOG_SINCE = process.env.BACKLOG_SINCE || "";
const WINDOW = {
  nl: BACKLOG_SINCE
    ? "alle relevante ontwikkelingen sinds het voorjaar van 2026 (mei tot nu), niet alleen de afgelopen weken"
    : "afgelopen 2 weken",
  fr: BACKLOG_SINCE
    ? "tous les développements pertinents depuis le printemps 2026 (mai à aujourd'hui), pas seulement les dernières semaines"
    : "derniers 15 jours",
  de: BACKLOG_SINCE
    ? "alle relevanten Entwicklungen seit Frühjahr 2026 (Mai bis heute), nicht nur die letzten Wochen"
    : "letzte 2 Wochen",
  es: BACKLOG_SINCE ? `desde ${BACKLOG_SINCE} hasta hoy` : "últimas dos semanas",
  pt: BACKLOG_SINCE ? `desde ${BACKLOG_SINCE} até hoje` : "últimas duas semanas",
  en: BACKLOG_SINCE ? "since spring 2026 (May until now), not only the last weeks" : "last 2 weeks",
};

// Grounding-query per primaire markt, in de lokale taal. Prioriteit: officiële
// en regionale bronnen; kern = locaties, zwemwater/regelgeving, partners.
export const MARKET_QUERIES = {
  Spanje: `${WINDOW.es}, España (ciudades y costa, incluidas islas): nuevas aperturas, anuncios, permisos o pilotos de sauna comunitaria/pública, sauna pop-up, sauna móvil, sauna al aire libre, sauna de playa, sauna urbana, sesiones compartidas y reservas por sesión (drop-in), sauna social y baño frío. Prioridad: nuevos competidores comparables y proyectos en preparación; verificar acceso público por sesión frente a alquiler privado. También nuevos chiringuitos, beach clubs, bares/restaurantes costeros, puertos y proyectos de hostelería urbanos con espacio exterior apto para una sauna temporal. Buscar fuentes originales del operador, ayuntamientos, licencias y prensa local en español/catalán e inglés. Excluir spas de hotel, termas interiores y venta de equipos sin concepto outdoor drop-in independiente.`,
  Portugal: `${WINDOW.pt}, Portugal (cidades e litoral, incluindo ilhas): novas aberturas, anúncios, licenças ou projetos-piloto de sauna comunitária/pública, sauna pop-up, sauna móvel, sauna ao ar livre, sauna na praia, sauna urbana, sessões partilhadas com reserva por sessão (drop-in), sauna social e banho frio. Prioridade: novos concorrentes comparáveis e projetos em preparação; confirmar acesso público por sessão versus aluguer privado. Também novos bares/restaurantes de praia, beach clubs, marinas e projetos de restauração urbanos com espaço exterior adequado para sauna temporária. Preferir fontes originais dos operadores, câmaras municipais, licenciamentos e imprensa local em português e inglês. Excluir spas de hotel, termas interiores e venda de equipamentos sem conceito outdoor drop-in independente.`,
  Nederland: `${WINDOW.nl}, Nederland: nieuw strandpaviljoen OR strandtent OR beachclub OR horeca aan het water OR nieuwe/uitbreiding jachthaven OR recreatieplas OR stadsstrand OR waterfrontontwikkeling OR tijdelijke horeca vergunning OR horecaconcessie strand OR exploitant gezocht recreatie OR aanbesteding recreatiegebied OR 'zwemmen toegestaan' OR 'nieuw zwemwater' OR 'zwemverbod opgeheven' OR nieuwe zwemsteiger OR openwaterzwemmen gemeente OR buitensauna/mobiele sauna aan het water. Prioriteer gemeente-, provincie- en regionale nieuwsbronnen en officiele bekendmakingen.`,
  "België": `${WINDOW.nl}, Belgie (Vlaanderen, kust, Antwerpen, Gent, Brussel, Limburg): nieuwe strandbar OR strandpaviljoen OR horeca aan het water OR jachthaven OR recreatiedomein OR nieuwe zwemzone OR 'zwemmen toegestaan' OR openluchtzwemmen OR strandconcessie OR exploitant gezocht recreatie OR buitensauna aan het water. Prioriteer gemeente-, VMM- en regionale bronnen.`,
  Frankrijk: `${WINDOW.fr}, France (cotes, lacs, ports): nouvelle paillote OR nouveau restaurant/bar de plage OR guinguette au bord de l'eau OR nouveau port de plaisance OR base de loisirs OR 'baignade autorisee' OR nouvelle zone de baignade OR concession de plage OR appel a projets plage OR sauna exterieur/nordique au bord de l'eau OR bain froid. Prioriser sources locales, communes et prefectures.`,
  Duitsland: `${WINDOW.de}, Deutschland (NRW, Niedersachsen, Hamburg, Bremen, Berlin, Brandenburg, Schleswig-Holstein, Mecklenburg-Vorpommern): neue Strandbar OR Gastronomie am Wasser OR neuer Yachthafen/Marina OR neues Strandbad OR 'Baden wieder erlaubt' OR neue Badestelle OR Sauna am See/Hafen OR mobile Sauna am Wasser OR Betreiber gesucht Freizeit OR Ausschreibung Gastronomie Hafen. Bevorzuge kommunale und regionale Quellen.`,
};

export const TRENDWATCH_QUERY = `${WINDOW.en}: UK community sauna OR seaside/beach sauna OR sauna hub OR sauna membership/crowdfunding; Denmark havnebad OR saunaklub OR vinterbadning OR havneudvikling rekreativ. New openings, business/exploitation models, municipal cooperation. Prefer original local sources.`;

// Profielen — elk een aparte nieuwsbrief met eigen scope, taal, geheugen en
// ontvanger. De hoofdmail (main) blijft ongewijzigd: eigen state/seen.json,
// alle markten. Partner-edities draaien geïsoleerd ernaast.
export const PROFILES = {
  iberia: {
    markets: ["Spanje", "Portugal"],
    trendwatch: false,
    language: "Nederlands",
    memoryDir: "state/iberia",
    subdir: "iberia",
    marketsLabel: "Spanje en Portugal — steden en kust, inclusief eilanden",
    subject: "eräSauna Spanje & Portugal — drop-in sauna- en horecamonitor",
    promptFile: "EDITORIAL-IBERIA.md",
    sectionKeys: ["signals", "competitors", "hubs", "locations", "partners", "swimming", "watchlist", "actions"],
    focus: "Uitsluitend Spanje en Portugal. Hoogste prioriteit: nieuwe of aangekondigde publiek toegankelijke outdoor drop-in-, community- en pop-upsauna's in steden en aan de kust. Ook vroege plannen en pilots volgen. Controleer of losse/gedeelde sessies mogelijk zijn; privéverhuur is geen bewezen directe drop-in concurrent. Nieuwe horeca alleen bij een concrete buitenlocatie of samenwerkingskans voor dit concept. Geen algemene hotelspa's, indoor thermen, apparatuurwinkels of willekeurige restaurantopeningen. Bij weinig bewijs geen markttrend of afwezigheid van concurrenten claimen.",
  },
  main: {
    markets: MARKETS.primary,
    trendwatch: true,
    language: "Nederlands",
    memoryDir: "state",
    subdir: "",
    marketsLabel: "Nederland, België, Frankrijk, Duitsland (primair), Groot-Brittannië en Denemarken (trendwatch)",
    subject: "eräSauna Market & Location Intelligence",
  },
  fr: {
    markets: ["Frankrijk"],
    trendwatch: false,
    language: "Nederlands",
    memoryDir: "state/fr",
    subdir: "fr",
    marketsLabel: "France",
    subject: "eräSauna Frankrijk — markt- en locatie-intelligence",
  },
  de: {
    markets: ["Duitsland"],
    trendwatch: false,
    language: "Nederlands",
    memoryDir: "state/de",
    subdir: "de",
    marketsLabel: "Deutschland",
    subject: "eräSauna Duitsland — markt- en locatie-intelligence",
  },
};
