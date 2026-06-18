/**
 * Phase E — assemble a weekly report from the data the other phases produce.
 *
 * Deterministic (no AI) so it always succeeds and is unit-testable. Pulls:
 *   - reply_queue        → review/comment handling KPIs + stats
 *   - trend_insights     → top scored trends
 *   - strategy_inbox     → pending ideas to slot in
 *   - market_intelligence → recent external signals
 * and derives rule-based insight cards (success / danger / info).
 */
import { db } from "@workspace/db";
import {
  replyQueueTable,
  trendInsightsTable,
  strategyInboxTable,
  marketIntelligenceTable,
  weeklyReportsTable,
  type WeeklyKpi,
  type WeeklySections,
  type WeeklyInsight,
  type WeeklyReport,
} from "@workspace/db/schema";
import { and, desc, gte, sql, eq, ne } from "drizzle-orm";

export function startOfIsoWeek(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Monday=0
  d.setDate(d.getDate() - day);
  return d;
}

export function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

/** Pure: turn KPIs + sections into success/danger/info insight cards. */
export function buildInsights(kpi: WeeklyKpi, sections: WeeklySections): WeeklyInsight[] {
  const insights: WeeklyInsight[] = [];

  if (kpi.reviewsAutoReplied > 0) {
    insights.push({
      kind: "success",
      title: `${kpi.reviewsAutoReplied} Bewertungen automatisch beantwortet`,
      detail: "Auto-Reply hält die Reaktionszeit niedrig — weiter so.",
    });
  }
  if (kpi.reviewsEscalated > 0) {
    insights.push({
      kind: "danger",
      title: `${kpi.reviewsEscalated} negative Bewertung(en) brauchen dich`,
      detail: "Im /inbox unter Google Reviews persönlich bearbeiten.",
    });
  }
  if (kpi.strategyItemsPending > 0) {
    insights.push({
      kind: "info",
      title: `${kpi.strategyItemsPending} Strategie-Ideen warten`,
      detail: "Im Strategie-Posteingang prüfen und in den Wochenplan aufnehmen.",
    });
  }
  const topTrend = sections.topTrends[0];
  if (topTrend && topTrend.score > 50) {
    insights.push({
      kind: "info",
      title: `Trend „${topTrend.trendName}" lohnt sich (Score ${topTrend.score})`,
      detail: "Diese Woche Content dazu produzieren, solange der Trend läuft.",
    });
  }
  if (kpi.marketSignals === 0) {
    insights.push({
      kind: "info",
      title: "Keine frischen Marktsignale",
      detail: "Market-Scan starten oder API-Keys ergänzen (Trends/Reddit).",
    });
  }
  return insights;
}

export async function buildWeeklyReportData(now = new Date()): Promise<{
  weekNumber: number;
  weekStart: string;
  kpi: WeeklyKpi;
  sections: WeeklySections;
}> {
  const weekStartDate = startOfIsoWeek(now);
  const weekNumber = isoWeekNumber(now);

  const count = async (where: ReturnType<typeof and> | undefined): Promise<number> => {
    const [r] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(replyQueueTable)
      .where(where);
    return r?.c ?? 0;
  };

  const reviewsAutoReplied = await count(
    and(
      eq(replyQueueTable.platform, "google"),
      eq(replyQueueTable.status, "auto_sent"),
      gte(replyQueueTable.createdAt, weekStartDate),
    ),
  );
  const reviewsEscalated = await count(
    and(eq(replyQueueTable.status, "escalated"), gte(replyQueueTable.createdAt, weekStartDate)),
  );
  const commentsHandled = await count(
    and(
      sql`${replyQueueTable.platform} IN ('facebook', 'instagram')`,
      sql`${replyQueueTable.status} IN ('auto_sent', 'manual_sent')`,
      gte(replyQueueTable.createdAt, weekStartDate),
    ),
  );

  const [trendsProposedRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(trendInsightsTable)
    .where(eq(trendInsightsTable.status, "proposed"));
  const trendsProposed = trendsProposedRow?.c ?? 0;

  const [pendingRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(strategyInboxTable)
    .where(sql`${strategyInboxTable.status} IN ('pending', 'analyzed')`);
  const strategyItemsPending = pendingRow?.c ?? 0;

  const [signalsRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(marketIntelligenceTable)
    .where(
      and(
        gte(marketIntelligenceTable.createdAt, weekStartDate),
        ne(marketIntelligenceTable.category, "inactive"),
      ),
    );
  const marketSignals = signalsRow?.c ?? 0;

  const topTrendRows = await db
    .select({
      brandId: trendInsightsTable.brandId,
      trendName: trendInsightsTable.trendName,
      trendScore: trendInsightsTable.trendScore,
    })
    .from(trendInsightsTable)
    .orderBy(desc(trendInsightsTable.trendScore))
    .limit(5);

  const pendingStrategyRows = await db
    .select({
      id: strategyInboxTable.id,
      brandId: strategyInboxTable.brandId,
      content: strategyInboxTable.content,
    })
    .from(strategyInboxTable)
    .where(sql`${strategyInboxTable.status} IN ('pending', 'analyzed')`)
    .orderBy(desc(strategyInboxTable.createdAt))
    .limit(10);

  const marketRows = await db
    .select({ source: marketIntelligenceTable.source, title: marketIntelligenceTable.title })
    .from(marketIntelligenceTable)
    .where(ne(marketIntelligenceTable.category, "inactive"))
    .orderBy(desc(marketIntelligenceTable.createdAt))
    .limit(10);

  const kpi: WeeklyKpi = {
    reviewsAutoReplied,
    reviewsEscalated,
    commentsHandled,
    trendsProposed,
    strategyItemsPending,
    marketSignals,
  };

  const sections: WeeklySections = {
    replyStats: { reviewsAutoReplied, reviewsEscalated, commentsHandled },
    topTrends: topTrendRows.map((t) => ({
      brandId: t.brandId,
      trendName: t.trendName,
      score: parseFloat(t.trendScore),
    })),
    pendingStrategy: pendingStrategyRows,
    marketSignals: marketRows,
    insights: [],
  };
  sections.insights = buildInsights(kpi, sections);

  return {
    weekNumber,
    weekStart: weekStartDate.toISOString().slice(0, 10),
    kpi,
    sections,
  };
}

export async function generateWeeklyReport(now = new Date()): Promise<WeeklyReport> {
  const data = await buildWeeklyReportData(now);
  const [row] = await db
    .insert(weeklyReportsTable)
    .values({
      weekNumber: data.weekNumber,
      weekStart: data.weekStart,
      kpiData: data.kpi,
      sections: data.sections,
    })
    .returning();
  return row;
}
