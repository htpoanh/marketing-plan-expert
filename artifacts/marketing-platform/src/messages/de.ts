// German — same key set as vi.ts. Missing keys fall back to vi (then to
// the key string itself) at runtime via the I18nProvider.

const de: Record<string, string> = {
  // ── Common ──────────────────────────────────────────────────────────────
  "common.brand": "Marke",
  "common.brand.choose": "— Marke auswählen —",
  "common.service": "Service / Produkt",
  "common.language": "Sprache",
  "common.bypassCache": "Cache überspringen (neu generieren — kostet Token)",
  "common.bypassCache.hint":
    "Standard: gleiche Eingabe + gleiche Marke innerhalb 7 Tagen → alter Bericht zurück, kostenlos.",
  "common.cacheHit.title": "Cache-Treffer — keine KI-Anfrage",
  "common.cacheHit.body":
    "(alter Bericht vom {date} — €{cost} gespart). \"Cache überspringen\" anhaken für Neugenerierung.",
  "common.error.notSelectedBrand": "Keine Marke ausgewählt",
  "common.error.serverError": "Server nicht erreichbar",
  "common.action.generate": "Generieren",
  "common.action.export": "Exportieren",
  "common.loading": "Wird geladen...",

  // ── Ads Strategy page ──────────────────────────────────────────────────
  "ads.page.title": "Ads Strategy Agent",
  "ads.page.subtitle":
    "4 KI-Module zur Werbeoptimierung: Zielgruppen-Analyse (M1), gewichtete Keywords (M2), Performance-Audit (M3), Trend-Erkennung (M4). Vietnamesische Oberfläche, deutsche Werbe-Outputs.",
  "ads.tab.audience": "M1 — Zielgruppe",
  "ads.tab.keywords": "M2 — Keywords",
  "ads.tab.performance": "M3 — Performance",
  "ads.tab.trend": "M4 — Trend",

  // ── M1 Audience ────────────────────────────────────────────────────────
  "ads.audience.title": "M1 — Zielgruppen-Analyse",
  "ads.audience.servicePlaceholder": "z.B. Gel-Nägel Sommer 2026",
  "ads.audience.goal": "Kampagnenziel",
  "ads.audience.goal.awareness": "Markenbekanntheit",
  "ads.audience.goal.traffic": "Website-Traffic",
  "ads.audience.goal.leads": "Lead-Generierung",
  "ads.audience.goal.conversions": "Conversions (Buchung/Verkauf)",
  "ads.audience.goal.retention": "Kundenbindung",
  "ads.audience.budget": "Monatliches Budget (€)",
  "ads.audience.languageHint":
    "Persona-Namen + Meta-Interessen sind immer auf Deutsch (Meta-DE-Anforderung).",
  "ads.audience.submit.idle": "Personas erstellen",
  "ads.audience.submit.loading": "Personas werden generiert…",
  "ads.audience.empty":
    "Formular links ausfüllen und \"Personas erstellen\" klicken.",
  "ads.audience.empty.hint":
    "Output: 3-5 Personas + Meta/Google Targeting JSON, fertig zum Einfügen in den Ads Manager.",
  "ads.audience.toast.success": "Personas erstellt",
  "ads.audience.toast.error": "Persona-Generierung fehlgeschlagen",

  // ── M2 Keywords ────────────────────────────────────────────────────────
  "ads.keywords.title": "M2 — Gewichtete Keywords",
  "ads.keywords.servicePlaceholder": "z.B. Gel-Nägel Kempten",
  "ads.keywords.competitors": "Wettbewerber (Zeile / Komma)",
  "ads.keywords.competitorsPlaceholder":
    "z.B. Nail Lounge Kempten, Beauty Studio Allgäu",
  "ads.keywords.competitorsHint":
    "Leer lassen → \"Defensive Keywords\"-Gruppe wird übersprungen.",
  "ads.keywords.languageHint":
    "Keywords sind immer auf Deutsch (Such-Sprache der Kunden).",
  "ads.keywords.submit.idle": "Keywords generieren",
  "ads.keywords.submit.loading": "Keywords werden generiert…",
  "ads.keywords.empty":
    "Formular links ausfüllen, um 4 Keyword-Gruppen nach Intent zu erstellen.",
  "ads.keywords.toast.success": "Keywords generiert",
  "ads.keywords.toast.error": "Keyword-Generierung fehlgeschlagen",

  // ── M3 Performance ─────────────────────────────────────────────────────
  "ads.performance.title": "M3 — Performance Reality",
  "ads.performance.cplTarget": "CPL-Ziel (€)",
  "ads.performance.avgTicket": "Ø Warenkorbwert (€)",
  "ads.performance.roasTarget": "ROAS-Ziel (optional)",
  "ads.performance.submit.idle": "Performance analysieren",
  "ads.performance.submit.loading": "Wird analysiert…",
  "ads.performance.empty":
    "CSV ads hochladen (Meta oder Google) → KI analysiert Verschwendung + Budget-Vorschläge.",
  "ads.performance.exportPdf": "Drucken / PDF exportieren",
  "ads.performance.toast.success": "Analyse abgeschlossen",
  "ads.performance.toast.error": "Analyse fehlgeschlagen",

  // ── M4 Trend ───────────────────────────────────────────────────────────
  "ads.trend.title": "M4 — Trend Pulse",
  "ads.trend.regionFocus": "Region-Fokus",
  "ads.trend.regionPlaceholder": "z.B. Bayern",
  "ads.trend.regionHint":
    "Claude durchsucht Web/News-DE in dieser Region.",
  "ads.trend.topic": "Thema (optional)",
  "ads.trend.topicPlaceholder":
    "z.B. Nagel-Trends 2026 (leer = automatisch entdecken)",
  "ads.trend.submit.idle": "Trends scannen (Live-Suche)",
  "ads.trend.submit.loading": "Trends werden gescannt…",
  "ads.trend.empty":
    "Claude durchsucht Web/News-DE in Echtzeit nach steigenden Trends in Ihrer Region.",
  "ads.trend.toast.success": "Trend-Scan abgeschlossen",
  "ads.trend.toast.error": "Trend-Scan fehlgeschlagen",

  // ── Language switcher ─────────────────────────────────────────────────
  "lang.switcher.label": "Oberflächensprache",
  "lang.vi": "Tiếng Việt",
  "lang.de": "Deutsch",
  "lang.en": "English",
};

export default de;
