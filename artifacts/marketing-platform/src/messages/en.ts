// English — same key set as vi.ts.

const en: Record<string, string> = {
  "common.brand": "Brand",
  "common.brand.choose": "— Choose brand —",
  "common.service": "Service / product",
  "common.language": "Language",
  "common.bypassCache": "Bypass cache (regenerate — costs tokens)",
  "common.bypassCache.hint":
    "Default: same input + same brand within 7 days → returns cached report, free.",
  "common.cacheHit.title": "Cache hit — no AI call",
  "common.cacheHit.body":
    "(cached report from {date} — saved €{cost}). Tick \"Bypass cache\" in the form to regenerate.",
  "common.error.notSelectedBrand": "No brand selected",
  "common.error.serverError": "Could not reach the server",
  "common.action.generate": "Generate",
  "common.action.export": "Export",
  "common.loading": "Loading...",

  "ads.page.title": "Ads Strategy Agent",
  "ads.page.subtitle":
    "4 AI modules to optimise ad spend: audience analysis (M1), weighted keywords (M2), performance audit (M3), trend pulse (M4). Vietnamese UI, German ad output.",
  "ads.tab.audience": "M1 — Audience",
  "ads.tab.keywords": "M2 — Keywords",
  "ads.tab.performance": "M3 — Performance",
  "ads.tab.trend": "M4 — Trend",

  "ads.audience.title": "M1 — Audience Targeting",
  "ads.audience.servicePlaceholder": "e.g. Gel-Nägel Sommer 2026",
  "ads.audience.goal": "Campaign goal",
  "ads.audience.goal.awareness": "Brand awareness",
  "ads.audience.goal.traffic": "Website traffic",
  "ads.audience.goal.leads": "Lead generation",
  "ads.audience.goal.conversions": "Conversions (booking/sale)",
  "ads.audience.goal.retention": "Retention",
  "ads.audience.budget": "Monthly budget (€)",
  "ads.audience.languageHint":
    "Persona names + Meta interests are always in German (Meta-DE requirement).",
  "ads.audience.submit.idle": "Generate personas",
  "ads.audience.submit.loading": "Generating personas…",
  "ads.audience.empty":
    "Fill the form on the left and click \"Generate personas\" to start.",
  "ads.audience.empty.hint":
    "Output: 3-5 personas + Meta/Google targeting JSON ready to paste into Ads Manager.",
  "ads.audience.toast.success": "Personas generated",
  "ads.audience.toast.error": "Persona generation failed",

  "ads.keywords.title": "M2 — Keyword Weight",
  "ads.keywords.servicePlaceholder": "e.g. Gel-Nägel Kempten",
  "ads.keywords.competitors": "Competitors (one per line / comma)",
  "ads.keywords.competitorsPlaceholder":
    "e.g. Nail Lounge Kempten, Beauty Studio Allgäu",
  "ads.keywords.competitorsHint":
    "Leave empty → \"Defensive keywords\" group skipped.",
  "ads.keywords.languageHint":
    "Keywords are always in German (customer search language).",
  "ads.keywords.submit.idle": "Generate keywords",
  "ads.keywords.submit.loading": "Generating keywords…",
  "ads.keywords.empty":
    "Fill the form to generate 4 keyword groups by intent.",
  "ads.keywords.toast.success": "Keywords generated",
  "ads.keywords.toast.error": "Keyword generation failed",

  "ads.performance.title": "M3 — Performance Reality",
  "ads.performance.cplTarget": "CPL target (€)",
  "ads.performance.avgTicket": "Avg ticket (€)",
  "ads.performance.roasTarget": "ROAS target (optional)",
  "ads.performance.submit.idle": "Analyse performance",
  "ads.performance.submit.loading": "Analysing…",
  "ads.performance.empty":
    "Upload an ads CSV (Meta or Google) → AI flags waste and recommends budget reallocation.",
  "ads.performance.exportPdf": "Print / Export PDF",
  "ads.performance.toast.success": "Analysis complete",
  "ads.performance.toast.error": "Analysis failed",

  "ads.trend.title": "M4 — Trend Pulse",
  "ads.trend.regionFocus": "Region focus",
  "ads.trend.regionPlaceholder": "e.g. Bayern",
  "ads.trend.regionHint":
    "Grok will search web / X / news in this region.",
  "ads.trend.topic": "Topic seed (optional)",
  "ads.trend.topicPlaceholder":
    "e.g. Nail Trends 2026 (leave empty = auto-discover)",
  "ads.trend.submit.idle": "Scan trends (live search)",
  "ads.trend.submit.loading": "Scanning trends…",
  "ads.trend.empty":
    "Grok 3 will search web / X / news in real time for rising trends in your region.",
  "ads.trend.toast.success": "Trend scan complete",
  "ads.trend.toast.error": "Trend scan failed",

  "lang.switcher.label": "Interface language",
  "lang.vi": "Tiếng Việt",
  "lang.de": "Deutsch",
  "lang.en": "English",
};

export default en;
