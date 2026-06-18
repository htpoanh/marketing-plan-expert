/**
 * Demo seed — populates every v3.0 feature table with realistic sample rows so
 * each page in the UI has something to show. Idempotent: clears the tables it
 * owns before re-inserting. Does NOT touch brands / kol_characters / ai_profiles
 * (those are seeded elsewhere); it only links KOL characters to brand groups.
 *
 * Run:  DATABASE_URL=... npx tsx scripts/seed-demo.ts
 */
import { db, pool } from "@workspace/db";
import {
  reviewsTable,
  contentPlansTable,
  weeklyReportsTable,
  marketIntelligenceTable,
  strategyInboxTable,
  trendInsightsTable,
  adsPerformanceTable,
  adsProposalsTable,
  brandMemoryTable,
  autoReplySettingsTable,
  kolPostsTable,
  kolInteractionsTable,
} from "@workspace/db/schema";

// Brand ids (from seeded brands table).
const HAPPY_WOK = 1;
const PN_KEMPTEN = 2;
const PN_MEMMINGEN = 3;
const HALONG = 5;
const ASIA_MARKT = 9;
const TAKI = 10;
const HAFENCAFE = 11;

const WEEK = 23; // ISO week of 2026-06-03
const day = (offset: number) => {
  const d = new Date("2026-06-03T09:00:00Z");
  d.setDate(d.getDate() + offset);
  return d;
};

async function main() {
  console.log("Clearing demo tables…");
  await db.delete(kolInteractionsTable);
  await db.delete(kolPostsTable);
  await db.delete(adsProposalsTable);
  await db.delete(adsPerformanceTable);
  await db.delete(trendInsightsTable);
  await db.delete(marketIntelligenceTable);
  await db.delete(strategyInboxTable);
  await db.delete(weeklyReportsTable);
  await db.delete(brandMemoryTable);
  await db.delete(autoReplySettingsTable);
  await db.delete(contentPlansTable);
  await db.delete(reviewsTable);

  // ── Reviews (Google Business) ──────────────────────────────────────────────
  console.log("Seeding reviews…");
  await db.insert(reviewsTable).values([
    {
      brandId: HAPPY_WOK,
      reviewerName: "Markus Hofer",
      rating: 5,
      reviewText: "Bestes Mittagessen in Kempten! Schnell, frisch und super freundlich.",
      reviewDate: day(-2),
      replied: true,
      replyText: "Vielen Dank, Markus! Wir freuen uns, dich bald wieder zu sehen. 🥢",
      replyDate: day(-1),
    },
    {
      brandId: HAPPY_WOK,
      reviewerName: "Lena S.",
      rating: 4,
      reviewText: "Lecker, aber mittags etwas lange Wartezeit.",
      reviewDate: day(-4),
      replied: false,
    },
    {
      brandId: PN_KEMPTEN,
      reviewerName: "Sandra Bauer",
      rating: 5,
      reviewText: "Wunderschöne Nägel, sehr sauber und entspannte Atmosphäre!",
      reviewDate: day(-3),
      replied: true,
      replyText: "Danke dir, Sandra! Bis zum nächsten Termin. 💅",
      replyDate: day(-2),
    },
    {
      brandId: PN_KEMPTEN,
      reviewerName: "Anonym",
      rating: 2,
      reviewText: "Termin hat sich um 30 Minuten verspätet.",
      reviewDate: day(-1),
      replied: false,
    },
    {
      brandId: TAKI,
      reviewerName: "Julian Werner",
      rating: 5,
      reviewText: "Fusion-Küche auf Top-Niveau. Das Ramen war fantastisch!",
      reviewDate: day(-5),
      replied: false,
    },
  ]);

  // ── Auto-reply settings (Phase G) ───────────────────────────────────────────
  console.log("Seeding auto-reply settings…");
  await db.insert(autoReplySettingsTable).values([
    { brandId: HAPPY_WOK, googleEnabled: true, fbCommentsEnabled: true, igCommentsEnabled: false, dailyCap: 40, escalateThreshold: 2 },
    { brandId: PN_KEMPTEN, googleEnabled: true, fbCommentsEnabled: false, igCommentsEnabled: true, dailyCap: 30, escalateThreshold: 3 },
    { brandId: TAKI, googleEnabled: false, fbCommentsEnabled: false, igCommentsEnabled: false, dailyCap: 50, escalateThreshold: 2 },
  ]);

  // ── Content plans / pipeline (Phase F) ──────────────────────────────────────
  console.log("Seeding content plans…");
  await db.insert(contentPlansTable).values([
    {
      brandId: HAPPY_WOK,
      publishDate: day(1),
      scheduledDate: day(1),
      weekNumber: WEEK,
      platform: "instagram",
      contentType: "reel",
      topic: "Wok in Aktion – Mittagsangebot",
      hook: "POV: Dein Mittag in 90 Sekunden 🔥",
      caption: "Frisch aus dem Wok, direkt auf deinen Teller. Mittagsangebot ab 7,90 € – nur in Kempten! 🥢",
      shortCaption: "Mittagsangebot ab 7,90 €",
      cta: "Heute vorbeikommen!",
      hashtags: "#HappyWokKempten #Kempten #AsianFood #Mittagstisch #Wok",
      imagePrompt: "Close-up of flaming wok with colorful vegetables, steam, warm tones, appetizing food photography",
      videoPrompt: "9:16, ~10s, wok tossing noodles over flame, ASMR sizzling, fast cuts",
      aiReasoning: "Verbindet Content-Pillar 'Wok in Aktion' mit dem Mittagsangebot für die Berufsschule-Zielgruppe.",
      trendSource: "ASMR Food Reels",
      status: "approved",
      adsSuitable: true,
    },
    {
      brandId: PN_KEMPTEN,
      publishDate: day(2),
      scheduledDate: day(2),
      weekNumber: WEEK,
      platform: "instagram",
      contentType: "carousel",
      topic: "Sommer Gel-Nägel – Pastell-Trend",
      hook: "Diese Sommerfarben sind 2026 überall 🌸",
      caption: "Pastell trifft Chrome – unsere Sommer-Designs sind da! Jetzt Termin sichern. 💅",
      shortCaption: "Sommer-Designs 2026",
      cta: "Termin buchen",
      hashtags: "#ParadiseNailsKempten #NailsKempten #SommerNägel #NailTrends2026",
      imagePrompt: "Pastel chrome gel nails, soft summer palette, elegant hand pose, studio lighting",
      videoPrompt: "9:16, ~8s, before/after nail reveal, smooth transition",
      aiReasoning: "Saisonaler Pastell-Trend passt zur 'Trending Nail Trends' Pillar und treibt Buchungen.",
      status: "draft",
      adsSuitable: true,
    },
    {
      brandId: TAKI,
      publishDate: day(3),
      weekNumber: WEEK,
      platform: "tiktok",
      contentType: "video",
      topic: "Ramen Pull-Shot",
      hook: "Der perfekte Cheese-Pull… aber mit Ramen 🍜",
      caption: "Vietnamesisch-japanische Fusion, frisch gemacht in Memmingen.",
      hashtags: "#TakiTaki #Memmingen #Ramen #Fusion",
      imagePrompt: "Steaming ramen bowl, chopstick noodle pull, dark moody backdrop",
      videoPrompt: "9:16, ~12s, slow-mo noodle pull, steam rising",
      status: "scheduled",
      adsSuitable: false,
    },
  ]);

  // ── Strategy inbox (Phase B) ────────────────────────────────────────────────
  console.log("Seeding strategy inbox…");
  await db.insert(strategyInboxTable).values([
    {
      brandId: null,
      inputType: "company_goal",
      content: "Ziel Q3: Instagram-Reichweite über alle Nagelstudios um 30% steigern.",
      priority: "high",
      status: "analyzed",
      incorporatedInWeek: WEEK,
      claudeAnalysis: {
        summary: "Reichweiten-Wachstum über koordinierte Reel-Serie + lokale Hashtag-Strategie.",
        feasibility: { rating: "high", rationale: "Bestehende Studios liefern genug Content-Substanz; Reels skalieren günstig." },
        timeline: "8–10 Wochen",
        resources: ["1 Content-Creator je Studio", "Reel-Templates", "Metricool-Planung"],
        risks: ["Memmingen hat sehr schwache Basis (12 Posts)", "Konsistenz bei mehreren Standorten"],
        recommendedWeek: `KW ${WEEK}`,
        alignsWithTrends: "Pastell-Sommer-Trend liefert direkt Content-Anlässe.",
      },
    },
    {
      brandId: HAPPY_WOK,
      inputType: "campaign_idea",
      content: "Schulstart-Aktion: Kombi-Menü für Berufsschüler ab September.",
      priority: "medium",
      status: "pending",
      deadline: "2026-08-15",
    },
    {
      brandId: PN_MEMMINGEN,
      inputType: "format_test",
      content: "Test: täglich 1 Story mit Before/After, 2 Wochen lang.",
      priority: "high",
      status: "pending",
    },
  ]);

  // ── Trend insights (Phase D) ────────────────────────────────────────────────
  console.log("Seeding trend insights…");
  await db.insert(trendInsightsTable).values([
    {
      brandId: PN_KEMPTEN,
      trendName: "Chrome Pastel Nails",
      description: "Pastellfarben kombiniert mit Chrome-Finish dominieren Sommer-2026 Nail-Feeds.",
      source: "tiktok",
      trendScore: "78.0",
      factors: { trendStrength: 9, relevance: 9, strategyAlignment: 8, productionDifficulty: 3 },
      momentum: "rising",
      estimatedWindowDays: 45,
      suggestedAngle: "Before/After Reveal mit Chrome-Pulver-Closeup.",
      suggestedKeywords: ["chromenails", "pastellnägel", "sommernägel2026"],
      strategyAlignmentNote: "align — passt zum Q3-Reichweitenziel",
      recommendedAction: "Jetzt produzieren — hohes Potenzial, geringe Schwierigkeit.",
      status: "proposed",
      weekNumber: WEEK,
    },
    {
      brandId: HAPPY_WOK,
      trendName: "ASMR Wok Sounds",
      description: "ASMR-Food-Clips mit Sizzling-Sound performen stark im DACH-Raum.",
      source: "grok",
      trendScore: "64.0",
      factors: { trendStrength: 8, relevance: 8, strategyAlignment: 8, productionDifficulty: 4 },
      momentum: "peak",
      estimatedWindowDays: 30,
      suggestedAngle: "Nahaufnahme Wok-Flamme + Original-Sound.",
      suggestedKeywords: ["asmrfood", "wok", "streetfood"],
      strategyAlignmentNote: "align",
      recommendedAction: "Diese Woche einplanen.",
      status: "actioned",
      weekNumber: WEEK,
    },
    {
      brandId: TAKI,
      trendName: "Ramen Pull-Shots",
      description: "Cheese-Pull-Format auf Ramen übertragen — guter Hook-Wert.",
      source: "tiktok",
      trendScore: "41.0",
      factors: { trendStrength: 6, relevance: 7, strategyAlignment: 5, productionDifficulty: 5 },
      momentum: "rising",
      estimatedWindowDays: 60,
      suggestedAngle: "Slow-Motion Noodle-Pull.",
      suggestedKeywords: ["ramen", "noodlepull", "fusionfood"],
      strategyAlignmentNote: "neutral",
      recommendedAction: "Backlog — bei Kapazität umsetzen.",
      status: "backlog",
      weekNumber: WEEK,
    },
  ]);

  // ── Market intelligence (Phase C) ───────────────────────────────────────────
  console.log("Seeding market intelligence…");
  await db.insert(marketIntelligenceTable).values([
    {
      brandId: PN_KEMPTEN,
      weekNumber: WEEK,
      source: "maps",
      category: "competitor",
      title: "Nageldesign Allgäu",
      content: { rating: 4.7, reviewCount: 212, address: "Bahnhofstraße 12, Kempten", query: "Nagelstudio Kempten" },
      relevanceScore: 70,
      urgency: "medium",
    },
    {
      brandId: HAPPY_WOK,
      weekNumber: WEEK,
      source: "news",
      category: "event",
      title: "Stadtfest Kempten lockt im Juni tausende Besucher in die Innenstadt",
      content: { link: "https://news.google.com/...", pubDate: "2026-06-01", query: "Kempten Veranstaltung Juni" },
      relevanceScore: 60,
      urgency: "high",
    },
    {
      brandId: null,
      weekNumber: WEEK,
      source: "trends",
      category: "inactive",
      title: "trends: nicht aktiv — GOOGLE_TRENDS_API_KEY fehlt",
      content: { hint: "Setze GOOGLE_TRENDS_API_KEY, um diese Quelle zu aktivieren." },
      relevanceScore: 0,
      urgency: "low",
    },
  ]);

  // ── Ads performance + proposals (Phase A) ───────────────────────────────────
  console.log("Seeding ads performance…");
  await db.insert(adsPerformanceTable).values([
    {
      brandId: PN_KEMPTEN,
      platform: "facebook",
      weekStart: "2026-05-25",
      spendEur: "120.00",
      reach: 18400,
      impressions: 42100,
      clicks: 690,
      ctr: "0.0164",
      cpm: "2.85",
      cpc: "0.17",
      roas: "3.20",
      topCreativeId: "creative_pastel_reel",
    },
    {
      brandId: PN_KEMPTEN,
      platform: "tiktok",
      weekStart: "2026-05-25",
      spendEur: "80.00",
      reach: 26500,
      impressions: 61200,
      clicks: 410,
      ctr: "0.0067",
      cpm: "1.31",
      cpc: "0.20",
      roas: "1.80",
      topCreativeId: "creative_beforeafter",
    },
    {
      brandId: HAPPY_WOK,
      platform: "facebook",
      weekStart: "2026-05-25",
      spendEur: "60.00",
      reach: 9200,
      impressions: 20100,
      clicks: 540,
      ctr: "0.0269",
      cpm: "2.99",
      cpc: "0.11",
      roas: "4.10",
      topCreativeId: "creative_wok_asmr",
    },
  ]);

  console.log("Seeding ads proposals…");
  await db.insert(adsProposalsTable).values([
    {
      brandId: PN_KEMPTEN,
      platform: "facebook",
      campaignType: "Conversion – Terminbuchung",
      budgetEur: "150.00",
      budgetChangeReason: "ROAS 3.2 auf Facebook > TikTok 1.8 — Budget zu Facebook verschieben.",
      targeting: { geo: "Kempten +15km", age: "18-45", interests: ["Beauty", "Nageldesign"] },
      expectedReach: 23000,
      status: "proposed",
    },
    {
      brandId: HAPPY_WOK,
      platform: "facebook",
      campaignType: "Reichweite – Mittagsangebot",
      budgetEur: "80.00",
      budgetChangeReason: "Bestes ROAS (4.1) im Portfolio — Budget erhöhen vor Stadtfest.",
      targeting: { geo: "Kempten +5km", age: "16-30", interests: ["Streetfood", "Berufsschule"] },
      expectedReach: 12000,
      status: "approved",
    },
  ]);

  // ── Brand memory (Phase I) ──────────────────────────────────────────────────
  console.log("Seeding brand memory…");
  await db.insert(brandMemoryTable).values([
    {
      brandId: PN_KEMPTEN,
      version: 3,
      topFormats: [{ format: "before_after_reel", score: 92 }, { format: "carousel", score: 74 }],
      topTopics: [{ topic: "Sommer-Designs", score: 88 }, { topic: "Nail-Care-Tipps", score: 61 }],
      bestHours: [12, 18, 20],
      provenHashtags: ["#NailsKempten", "#NailTrends2026", "#Kempten"],
      topIntentKeywords: [{ intent: "termin_buchen", count: 34 }, { intent: "preis_anfrage", count: 21 }],
      trendAlignments: [{ trend: "Chrome Pastel Nails", score: 78 }],
      notes: ["Reels schlagen Carousels deutlich.", "Beste Performance abends 18-20 Uhr."],
    },
    {
      brandId: HAPPY_WOK,
      version: 2,
      topFormats: [{ format: "asmr_reel", score: 85 }],
      topTopics: [{ topic: "Mittagsangebot", score: 79 }, { topic: "Wok in Aktion", score: 72 }],
      bestHours: [11, 12, 17],
      provenHashtags: ["#HappyWokKempten", "#AsianFood", "#Kempten"],
      topIntentKeywords: [{ intent: "oeffnungszeiten", count: 18 }, { intent: "lieferung", count: 15 }],
      trendAlignments: [{ trend: "ASMR Wok Sounds", score: 64 }],
      notes: ["Mittags-Posts vor 12 Uhr posten."],
    },
  ]);

  // ── Weekly report (Phase E) ─────────────────────────────────────────────────
  console.log("Seeding weekly report…");
  await db.insert(weeklyReportsTable).values({
    weekNumber: WEEK,
    weekStart: "2026-06-01",
    kpiData: {
      reviewsAutoReplied: 3,
      reviewsEscalated: 2,
      commentsHandled: 14,
      trendsProposed: 2,
      strategyItemsPending: 2,
      marketSignals: 3,
    },
    sections: {
      replyStats: { google: 3, facebook: 8, instagram: 6 },
      topTrends: [
        { brandId: PN_KEMPTEN, trendName: "Chrome Pastel Nails", score: 78 },
        { brandId: HAPPY_WOK, trendName: "ASMR Wok Sounds", score: 64 },
      ],
      pendingStrategy: [
        { id: 2, brandId: HAPPY_WOK, content: "Schulstart-Aktion: Kombi-Menü für Berufsschüler ab September." },
        { id: 3, brandId: PN_MEMMINGEN, content: "Test: täglich 1 Story mit Before/After, 2 Wochen lang." },
      ],
      marketSignals: [
        { source: "maps", title: "Nageldesign Allgäu (4.7 ★, 212 Reviews)" },
        { source: "news", title: "Stadtfest Kempten im Juni" },
      ],
      insights: [
        { kind: "success", title: "Happy Wok Top-ROAS", detail: "Facebook-Ads erreichen 4.1 ROAS — bestes Ergebnis im Portfolio." },
        { kind: "danger", title: "Memmingen unterversorgt", detail: "Nur 12 IG-Posts — höchste Content-Priorität." },
        { kind: "info", title: "Stadtfest-Chance", detail: "Lokales Event diese Woche — Reichweiten-Boost für Kempten-Brands nutzen." },
      ],
    },
    trendAnalysis:
      "KW 23 dominiert vom Pastell-Chrome-Trend (Nails) und ASMR-Food (Happy Wok). Beide stark, gut umsetzbar. Empfehlung: Budget zu Facebook (höchstes ROAS), Reel-Serie für Memmingen starten.",
    chatLog: [],
    approvedByUser: false,
    autoApproved: false,
  });

  // ── Link KOL characters to brand groups + posts/interactions (Phase H) ───────
  console.log("Linking KOL characters + seeding posts…");
  await pool.query("update kol_characters set brand_ids = $1 where id = 1", [JSON.stringify([HAPPY_WOK, ASIA_MARKT, TAKI])]);
  await pool.query("update kol_characters set brand_ids = $1 where id = 2", [JSON.stringify([PN_KEMPTEN, PN_MEMMINGEN, HALONG])]);
  await pool.query("update kol_characters set brand_ids = $1 where id = 3", [JSON.stringify([HAFENCAFE])]);

  await db.insert(kolPostsTable).values([
    {
      characterId: 1,
      script: "Hallo, ich bin Thái An! Heute koche ich mit euch ein Mittagswok in unter 5 Minuten.",
      caption: "Schnelles Wok-Rezept für die Mittagspause 🥢 #HappyWok (KI-generierte Figur)",
      hashtags: ["HappyWokKempten", "AsianFood", "Mittagstisch"],
      status: "published",
      performance: { views: 12400, likes: 820, comments: 47 },
    },
    {
      characterId: 2,
      script: "Hi, Pearl hier! Diese Sommerfarben müsst ihr 2026 ausprobieren.",
      caption: "Pastell-Chrome Sommer-Nägel 💅 (KI-generierte Figur) #NailTrends2026",
      hashtags: ["ParadiseNails", "SommerNägel", "NailTrends2026"],
      status: "draft",
    },
  ]);

  await db.insert(kolInteractionsTable).values([
    {
      characterId: 1,
      platform: "instagram",
      incomingMessage: "Habt ihr das Rezept auch vegetarisch?",
      generatedReply: "Klar! Einfach Tofu statt Hähnchen — schmeckt genauso lecker. 🌱",
      sent: true,
    },
    {
      characterId: 2,
      platform: "tiktok",
      incomingMessage: "Wie lange hält so ein Chrome-Design?",
      generatedReply: "Bei guter Pflege ca. 3-4 Wochen. Buch dir gern einen Termin! 💅",
      sent: false,
    },
  ]);

  console.log("✅ Demo seed complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
