/**
 * Tiny ads-CSV parser, no external dependencies.
 *
 * Detects whether the file came from Meta Ads Manager or Google Ads (Editor),
 * normalises rows into a canonical shape, and computes aggregate stats so the
 * AI prompt only sees the most relevant data (top + bottom performers + summary)
 * instead of the entire raw export.
 *
 * Why not papaparse / d3-dsv? — payload is small (≤10MB), the formats we
 * handle have well-known headers, and avoiding a dep keeps the api-server
 * bundle slim. Trade-off: we don't handle every CSV edge case (escaped
 * embedded newlines), but Meta + Google exports never produce those.
 */

export type AdsPlatform = "meta" | "google" | "mixed";

/** Canonical, platform-agnostic shape used downstream by the prompt builder. */
export type NormalizedAdRow = {
  platform: "meta" | "google";
  campaign: string;
  adSet: string;
  ad: string | null;
  status: string | null;
  spendEur: number;
  impressions: number;
  clicks: number;
  ctr: number;            // 0..1 (NOT percentage)
  cpcEur: number;         // EUR
  conversions: number;    // "Results" on Meta, "Conversions" on Google
  cpaEur: number;         // EUR per conversion (0 if no conversions)
  conversionValueEur: number | null; // Google only — null on Meta
  roas: number | null;    // conversionValue/spend (Google only)
};

export type AggregateStats = {
  rowCount: number;
  campaignCount: number;
  adSetCount: number;
  totalSpendEur: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalConversionValueEur: number | null;
  avgCtr: number;
  avgCpcEur: number;
  avgCpaEur: number;
  blendedRoas: number | null;
};

export type ParsedCsv = {
  platform: AdsPlatform;
  rows: NormalizedAdRow[];
  stats: AggregateStats;
  /** Original header row — kept for debugging / displaying in the UI. */
  headers: string[];
  /** Format-detection details: which header tokens matched. */
  detection: {
    matched: AdsPlatform | null;
    metaSignals: string[];
    googleSignals: string[];
  };
};

export class CsvParseError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "CsvParseError";
  }
}

// ─── Header signals (case + space + ()-insensitive) ──────────────────────────
// Meta exports vary slightly across "Ads Reporting" vs "Ads Manager Export"
// — the most stable signals are spend column + Frequency / Reach.
const META_HEADER_TOKENS = [
  "amount spent",
  "campaign name",
  "ad set name",
  "frequency",
  "reach",
  "cost per result",
  "results",
  "ctr (link click",
];
const GOOGLE_HEADER_TOKENS = [
  "ad group",
  "avg. cpc",
  "cost / conv",
  "conv. value",
  "all conv. value",
  "campaign",
];

function normalizeHeader(s: string): string {
  return s.toLowerCase().trim();
}

function detectPlatform(headers: string[]): {
  platform: AdsPlatform | null;
  metaSignals: string[];
  googleSignals: string[];
} {
  const lower = headers.map(normalizeHeader);
  const metaSignals = META_HEADER_TOKENS.filter((t) =>
    lower.some((h) => h.includes(t)),
  );
  const googleSignals = GOOGLE_HEADER_TOKENS.filter((t) =>
    lower.some((h) => h.includes(t)),
  );

  // Disambiguate when both have hits (e.g. both have "Campaign"): take the
  // higher signal count.
  if (metaSignals.length === 0 && googleSignals.length === 0) {
    return { platform: null, metaSignals, googleSignals };
  }
  if (metaSignals.length >= googleSignals.length) {
    return { platform: "meta", metaSignals, googleSignals };
  }
  return { platform: "google", metaSignals, googleSignals };
}

// ─── CSV row splitter (handles quoted commas) ────────────────────────────────
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      // Doubled quote = literal quote
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  out.push(current);
  return out.map((s) => s.trim());
}

// ─── Number coercion with EU-locale support ──────────────────────────────────
// Handles "1.234,56" (German), "1,234.56" (US), "5,30%", "EUR 12.50".
function parseNumber(s: string | undefined): number {
  if (!s) return 0;
  let trimmed = s.trim();
  if (!trimmed) return 0;
  // Strip currency symbols + percent
  trimmed = trimmed.replace(/[€$£¥%]/g, "").replace(/EUR|USD|GBP/i, "").trim();
  if (!trimmed) return 0;

  // Detect German format: contains comma but no dot, OR dot is thousands separator
  const hasComma = trimmed.includes(",");
  const hasDot = trimmed.includes(".");
  if (hasComma && !hasDot) {
    // "1234,56" → 1234.56
    trimmed = trimmed.replace(",", ".");
  } else if (hasComma && hasDot) {
    // Heuristic: which separator comes last — that one is the decimal
    const lastComma = trimmed.lastIndexOf(",");
    const lastDot = trimmed.lastIndexOf(".");
    if (lastComma > lastDot) {
      // German: "1.234,56" → "1234.56"
      trimmed = trimmed.replace(/\./g, "").replace(",", ".");
    } else {
      // US: "1,234.56" → "1234.56"
      trimmed = trimmed.replace(/,/g, "");
    }
  }
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : 0;
}

function findColumnIndex(
  headers: string[],
  ...tokens: string[]
): number {
  const lower = headers.map(normalizeHeader);
  for (const token of tokens) {
    const idx = lower.findIndex((h) => h.includes(token));
    if (idx !== -1) return idx;
  }
  return -1;
}

// ─── Row normalisation ───────────────────────────────────────────────────────
function normalizeMetaRow(
  raw: string[],
  columnMap: ReturnType<typeof buildMetaColumnMap>,
): NormalizedAdRow {
  const get = (i: number): string => (i >= 0 && i < raw.length ? raw[i] : "");
  const spend = parseNumber(get(columnMap.spend));
  const impressions = Math.round(parseNumber(get(columnMap.impressions)));
  const clicks = Math.round(parseNumber(get(columnMap.clicks)));
  const conversions = Math.round(parseNumber(get(columnMap.results)));
  const ctrRaw = parseNumber(get(columnMap.ctr));
  // Meta CTR is a percentage (e.g. "3.32%") — normalise to 0..1
  const ctr = ctrRaw > 1 ? ctrRaw / 100 : ctrRaw;

  return {
    platform: "meta",
    campaign: get(columnMap.campaign) || "(unknown)",
    adSet: get(columnMap.adSet) || "(unknown)",
    ad: get(columnMap.ad) || null,
    status: null,
    spendEur: spend,
    impressions,
    clicks,
    ctr,
    cpcEur: clicks > 0 ? spend / clicks : 0,
    conversions,
    cpaEur: conversions > 0 ? spend / conversions : 0,
    conversionValueEur: null,
    roas: null,
  };
}

function buildMetaColumnMap(headers: string[]) {
  return {
    campaign: findColumnIndex(headers, "campaign name", "campaign"),
    adSet: findColumnIndex(headers, "ad set name", "ad set"),
    ad: findColumnIndex(headers, "ad name"),
    spend: findColumnIndex(headers, "amount spent", "spend"),
    impressions: findColumnIndex(headers, "impressions"),
    clicks: findColumnIndex(headers, "link clicks", "clicks"),
    ctr: findColumnIndex(headers, "ctr"),
    results: findColumnIndex(headers, "results", "conversions"),
  };
}

function normalizeGoogleRow(
  raw: string[],
  columnMap: ReturnType<typeof buildGoogleColumnMap>,
): NormalizedAdRow {
  const get = (i: number): string => (i >= 0 && i < raw.length ? raw[i] : "");
  const spend = parseNumber(get(columnMap.cost));
  const impressions = Math.round(parseNumber(get(columnMap.impressions)));
  const clicks = Math.round(parseNumber(get(columnMap.clicks)));
  const conversions = parseNumber(get(columnMap.conversions));
  const ctrRaw = parseNumber(get(columnMap.ctr));
  const ctr = ctrRaw > 1 ? ctrRaw / 100 : ctrRaw;
  const conversionValue =
    columnMap.convValue >= 0
      ? parseNumber(get(columnMap.convValue))
      : null;

  return {
    platform: "google",
    campaign: get(columnMap.campaign) || "(unknown)",
    adSet: get(columnMap.adGroup) || "(unknown)",
    ad: null,
    status: get(columnMap.status) || null,
    spendEur: spend,
    impressions,
    clicks,
    ctr,
    cpcEur: clicks > 0 ? spend / clicks : 0,
    conversions,
    cpaEur: conversions > 0 ? spend / conversions : 0,
    conversionValueEur: conversionValue,
    roas:
      conversionValue != null && spend > 0 ? conversionValue / spend : null,
  };
}

function buildGoogleColumnMap(headers: string[]) {
  return {
    campaign: findColumnIndex(headers, "campaign"),
    adGroup: findColumnIndex(headers, "ad group"),
    status: findColumnIndex(headers, "status"),
    cost: findColumnIndex(headers, "cost"),
    impressions: findColumnIndex(headers, "impressions"),
    clicks: findColumnIndex(headers, "clicks"),
    ctr: findColumnIndex(headers, "ctr"),
    conversions: findColumnIndex(headers, "conversions", "conv."),
    convValue: findColumnIndex(headers, "conv. value", "conversion value"),
  };
}

// ─── Aggregate stats ─────────────────────────────────────────────────────────
function aggregateStats(rows: NormalizedAdRow[]): AggregateStats {
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalConversions = 0;
  let totalConversionValue = 0;
  let hasAnyConversionValue = false;
  const campaigns = new Set<string>();
  const adSets = new Set<string>();

  for (const r of rows) {
    totalSpend += r.spendEur;
    totalImpressions += r.impressions;
    totalClicks += r.clicks;
    totalConversions += r.conversions;
    if (r.conversionValueEur != null) {
      totalConversionValue += r.conversionValueEur;
      hasAnyConversionValue = true;
    }
    campaigns.add(r.campaign);
    adSets.add(`${r.campaign}::${r.adSet}`);
  }

  const avgCtr =
    totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

  return {
    rowCount: rows.length,
    campaignCount: campaigns.size,
    adSetCount: adSets.size,
    totalSpendEur: round2(totalSpend),
    totalImpressions,
    totalClicks,
    totalConversions: round2(totalConversions),
    totalConversionValueEur: hasAnyConversionValue
      ? round2(totalConversionValue)
      : null,
    avgCtr: round4(avgCtr),
    avgCpcEur: round2(avgCpc),
    avgCpaEur: round2(avgCpa),
    blendedRoas:
      hasAnyConversionValue && totalSpend > 0
        ? round2(totalConversionValue / totalSpend)
        : null,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ─── Top / bottom selection ──────────────────────────────────────────────────
/**
 * Returns the rows with the highest and lowest values of `metric`. Used to
 * surface only the most relevant rows to Sonnet (keeping prompt token count
 * predictable regardless of CSV size).
 */
export function selectTopAndBottom(
  rows: NormalizedAdRow[],
  metric: "spendEur" | "cpaEur" | "roas" | "ctr",
  count = 10,
): { top: NormalizedAdRow[]; bottom: NormalizedAdRow[] } {
  // Filter out rows where metric is null/undefined (e.g. ROAS on Meta)
  const valid = rows.filter((r) => {
    const v = r[metric];
    return v != null && Number.isFinite(v);
  });
  const sorted = [...valid].sort(
    (a, b) => (b[metric] as number) - (a[metric] as number),
  );
  return {
    top: sorted.slice(0, count),
    bottom: sorted.slice(-count).reverse(),
  };
}

// ─── Public entry ────────────────────────────────────────────────────────────
export function parseAdsCsv(input: string): ParsedCsv {
  if (!input || input.trim().length === 0) {
    throw new CsvParseError(
      "CSV is empty",
      "Make sure you exported with at least one row of data.",
    );
  }
  // Strip BOM
  let text = input.replace(/^﻿/, "");
  // Normalise CRLF
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new CsvParseError(
      "CSV has no data rows",
      "Need at least a header line + 1 data row.",
    );
  }

  const headers = splitCsvLine(lines[0]);
  const detection = detectPlatform(headers);
  if (!detection.platform) {
    throw new CsvParseError(
      "Could not detect ad platform from headers",
      "Expected Meta Ads Manager export columns (e.g. 'Amount spent', 'Campaign name', 'Reach') or Google Ads Editor export columns (e.g. 'Cost', 'Ad group', 'Avg. CPC').",
    );
  }

  const rows: NormalizedAdRow[] = [];
  if (detection.platform === "meta") {
    const cm = buildMetaColumnMap(headers);
    if (cm.campaign === -1 || cm.spend === -1 || cm.impressions === -1) {
      throw new CsvParseError(
        "Meta CSV missing required columns",
        "Need at minimum: 'Campaign name', 'Amount spent', 'Impressions'.",
      );
    }
    for (let i = 1; i < lines.length; i++) {
      const cells = splitCsvLine(lines[i]);
      if (cells.every((c) => !c)) continue; // empty row
      rows.push(normalizeMetaRow(cells, cm));
    }
  } else {
    const cm = buildGoogleColumnMap(headers);
    if (cm.campaign === -1 || cm.cost === -1 || cm.impressions === -1) {
      throw new CsvParseError(
        "Google CSV missing required columns",
        "Need at minimum: 'Campaign', 'Cost', 'Impressions'.",
      );
    }
    for (let i = 1; i < lines.length; i++) {
      const cells = splitCsvLine(lines[i]);
      if (cells.every((c) => !c)) continue;
      rows.push(normalizeGoogleRow(cells, cm));
    }
  }

  if (rows.length === 0) {
    throw new CsvParseError(
      "CSV has headers but no usable data rows",
      "Every row was empty or could not be parsed.",
    );
  }

  return {
    platform: detection.platform,
    rows,
    stats: aggregateStats(rows),
    headers,
    detection,
  };
}
