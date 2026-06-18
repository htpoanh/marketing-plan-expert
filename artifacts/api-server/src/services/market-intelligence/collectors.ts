/**
 * Phase C — Market Research collectors.
 *
 * Each collector returns `InsertMarketIntelligence[]` (without brandId/week,
 * which the orchestrator stamps). Free sources (news RSS, Maps via the existing
 * GOOGLE_API_KEY) run live. Key-gated sources (Google Trends, Reddit, TikTok)
 * check for their env key and, when absent, return a single 'inactive' row so
 * the UI clearly shows what's wired vs. waiting on credentials.
 */
import type { InsertMarketIntelligence } from "@workspace/db/schema";

export type CollectorRow = Omit<
  InsertMarketIntelligence,
  "id" | "brandId" | "weekNumber" | "createdAt" | "incorporated"
>;

function inactiveRow(source: string, envVar: string): CollectorRow {
  return {
    source,
    category: "inactive",
    title: `${source}: nicht aktiv — ${envVar} fehlt`,
    content: { hint: `Setze ${envVar} in den Env-Variablen, um diese Quelle zu aktivieren.` },
    relevanceScore: 0,
    urgency: "low",
  };
}

// ── News (Google News RSS, free, no key) ─────────────────────────────────────
/** Minimal RSS <item> extraction without an XML dependency. */
function parseRssItems(xml: string, max = 8): Array<{ title: string; link: string; pubDate: string }> {
  const items: Array<{ title: string; link: string; pubDate: string }> = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) && items.length < max) {
    const block = m[1];
    const pick = (tag: string) => {
      const cdata = new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`).exec(block);
      if (cdata) return cdata[1].trim();
      const plain = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(block);
      return plain ? plain[1].trim() : "";
    };
    items.push({ title: pick("title"), link: pick("link"), pubDate: pick("pubDate") });
  }
  return items;
}

export async function collectNews(query: string): Promise<CollectorRow[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=de&gl=DE&ceid=DE:de`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "ThaiHoangBot/1.0" } });
    if (!res.ok) return [inactiveRow("news", "GOOGLE_NEWS")];
    const xml = await res.text();
    const items = parseRssItems(xml);
    if (items.length === 0) return [];
    return items.map((it) => ({
      source: "news",
      category: "event",
      title: it.title,
      content: { link: it.link, pubDate: it.pubDate, query },
      relevanceScore: 50,
      urgency: "medium",
    }));
  } catch (e) {
    return [
      {
        source: "news",
        category: "inactive",
        title: "news: Fehler beim Abruf",
        content: { error: e instanceof Error ? e.message : String(e) },
        relevanceScore: 0,
        urgency: "low",
      },
    ];
  }
}

// ── Maps competitor scan (Places API New, uses existing GOOGLE_API_KEY) ───────
interface PlacesSearchResponse {
  places?: Array<{
    displayName?: { text?: string };
    rating?: number;
    userRatingCount?: number;
    formattedAddress?: string;
  }>;
  error?: { message?: string };
}

export async function collectMapsCompetitors(query: string): Promise<CollectorRow[]> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return [inactiveRow("maps", "GOOGLE_API_KEY")];
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.displayName,places.rating,places.userRatingCount,places.formattedAddress",
      },
      body: JSON.stringify({ textQuery: query, languageCode: "de", maxResultCount: 8 }),
    });
    const data = (await res.json().catch(() => ({}))) as PlacesSearchResponse;
    if (!res.ok) {
      return [
        {
          source: "maps",
          category: "inactive",
          title: "maps: API-Fehler",
          content: { error: data.error?.message ?? `HTTP ${res.status}` },
          relevanceScore: 0,
          urgency: "low",
        },
      ];
    }
    const places = data.places ?? [];
    return places.map((p) => ({
      source: "maps",
      category: "competitor",
      title: p.displayName?.text ?? "Unbekannt",
      content: {
        rating: p.rating ?? null,
        reviewCount: p.userRatingCount ?? null,
        address: p.formattedAddress ?? null,
        query,
      },
      relevanceScore: 60,
      urgency: "low",
    }));
  } catch (e) {
    return [
      {
        source: "maps",
        category: "inactive",
        title: "maps: Fehler beim Abruf",
        content: { error: e instanceof Error ? e.message : String(e) },
        relevanceScore: 0,
        urgency: "low",
      },
    ];
  }
}

// ── Key-gated scaffolds ───────────────────────────────────────────────────────
export async function collectTrends(_query: string): Promise<CollectorRow[]> {
  if (!process.env.GOOGLE_TRENDS_API_KEY) return [inactiveRow("trends", "GOOGLE_TRENDS_API_KEY")];
  // TODO: wire Google Trends once key provided.
  return [inactiveRow("trends", "GOOGLE_TRENDS_API_KEY")];
}

export async function collectReddit(_query: string): Promise<CollectorRow[]> {
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
    return [inactiveRow("reddit", "REDDIT_CLIENT_ID/SECRET")];
  }
  // TODO: wire Reddit search once keys provided.
  return [inactiveRow("reddit", "REDDIT_CLIENT_ID/SECRET")];
}

export async function collectTiktok(_query: string): Promise<CollectorRow[]> {
  // TikTok research is done via Claude web-search (M4) until a dedicated key exists.
  return [
    {
      source: "tiktok",
      category: "inactive",
      title: "tiktok: via Claude-Web-Suche (M4) — dedizierte API folgt",
      content: { hint: "Nutze vorerst Trend Intelligence (Claude) für TikTok-Signale." },
      relevanceScore: 0,
      urgency: "low",
    },
  ];
}
