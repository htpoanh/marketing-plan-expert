import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { reviewsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// ─── DB SETUP ────────────────────────────────────────────────────────────────
let dbSetupDone = false;
async function ensureTable() {
  if (dbSetupDone) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS google_oauth_tokens (
      id SERIAL PRIMARY KEY,
      brand_id INTEGER NOT NULL UNIQUE,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expiry_date BIGINT,
      account_id TEXT,
      account_name TEXT,
      location_id TEXT,
      location_name TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  dbSetupDone = true;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getCallbackUrl(): string {
  const domain =
    process.env.REPLIT_DOMAINS?.split(",")[0] ??
    process.env.REPLIT_DEV_DOMAIN ??
    "localhost:3000";
  return `https://${domain}/api/reviews/google-auth/callback`;
}

function getFrontendUrl(): string {
  const domain =
    process.env.REPLIT_DOMAINS?.split(",")[0] ??
    process.env.REPLIT_DEV_DOMAIN ??
    "localhost:3000";
  return `https://${domain}/reviews`;
}

export async function getValidTokens(brandId: number): Promise<Record<string, any> | null> {
  await ensureTable();
  const rows = await db.execute(sql`
    SELECT * FROM google_oauth_tokens WHERE brand_id = ${brandId} LIMIT 1
  `);
  if (rows.rows.length === 0) return null;

  const token = rows.rows[0] as Record<string, any>;

  // Refresh if expiring within 60 seconds
  if (token.expiry_date && Date.now() > Number(token.expiry_date) - 60_000) {
    if (!token.refresh_token) return null;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    try {
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: token.refresh_token as string,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
        }).toString(),
      });
      const refreshData = (await refreshRes.json()) as Record<string, any>;
      if (!refreshRes.ok || !refreshData.access_token) return null;

      const newExpiry = refreshData.expires_in
        ? Date.now() + Number(refreshData.expires_in) * 1000
        : null;
      await db.execute(sql`
        UPDATE google_oauth_tokens
        SET access_token = ${refreshData.access_token as string},
            expiry_date  = ${newExpiry},
            updated_at   = NOW()
        WHERE brand_id = ${brandId}
      `);
      return { ...token, access_token: refreshData.access_token as string };
    } catch (e) {
      console.error("[google-auth] Token refresh failed:", e);
      return null;
    }
  }

  return token;
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// GET /url?brandId=X  →  redirect to Google OAuth consent
router.get("/url", async (req, res) => {
  const brandId = req.query.brandId as string;
  if (!brandId) return res.status(400).json({ error: "brandId required" });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res
      .status(503)
      .json({ error: "GOOGLE_CLIENT_ID chưa được cài đặt trong Secrets." });
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getCallbackUrl());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/business.manage");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", brandId);

  res.redirect(url.toString());
});

// GET /callback  — PUBLIC route, called by Google after user consent
router.get("/callback", async (req, res) => {
  const { code, state: brandId, error } = req.query;
  const frontendUrl = getFrontendUrl();

  if (error) {
    return res.redirect(
      `${frontendUrl}?googleAuthError=${encodeURIComponent(error as string)}&tab=sync`
    );
  }

  if (!code || !brandId) {
    return res.redirect(`${frontendUrl}?googleAuthError=missing_params&tab=sync`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.redirect(
      `${frontendUrl}?googleAuthError=missing_credentials&tab=sync`
    );
  }

  try {
    await ensureTable();

    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getCallbackUrl(),
        grant_type: "authorization_code",
      }).toString(),
    });
    const tokenData = (await tokenRes.json()) as Record<string, any>;

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("[google-auth/callback] Token exchange failed:", tokenData);
      return res.redirect(
        `${frontendUrl}?googleAuthError=token_exchange_failed&tab=sync`
      );
    }

    // Fetch Google Business Profile account info
    let accountId = "";
    let accountName = "";
    try {
      const accountsRes = await fetch(
        "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
        { headers: { Authorization: `Bearer ${tokenData.access_token as string}` } }
      );
      const accountsData = (await accountsRes.json()) as Record<string, any>;
      const accounts: any[] = accountsData.accounts ?? [];
      if (accounts.length > 0) {
        accountId = accounts[0].name ?? "";
        accountName = accounts[0].accountName ?? accounts[0].name ?? "";
      }
    } catch (e) {
      console.warn("[google-auth/callback] Could not fetch account info:", e);
    }

    const expiryDate = tokenData.expires_in
      ? Date.now() + Number(tokenData.expires_in) * 1000
      : null;

    await db.execute(sql`
      INSERT INTO google_oauth_tokens
        (brand_id, access_token, refresh_token, expiry_date, account_id, account_name, updated_at)
      VALUES
        (${parseInt(brandId as string)}, ${tokenData.access_token as string},
         ${(tokenData.refresh_token as string) ?? null}, ${expiryDate},
         ${accountId}, ${accountName}, NOW())
      ON CONFLICT (brand_id) DO UPDATE
        SET access_token  = EXCLUDED.access_token,
            refresh_token = COALESCE(EXCLUDED.refresh_token, google_oauth_tokens.refresh_token),
            expiry_date   = EXCLUDED.expiry_date,
            account_id    = EXCLUDED.account_id,
            account_name  = EXCLUDED.account_name,
            updated_at    = NOW()
    `);

    return res.redirect(`${frontendUrl}?googleConnected=true&tab=sync`);
  } catch (err) {
    console.error("[google-auth/callback] Unexpected error:", err);
    return res.redirect(`${frontendUrl}?googleAuthError=server_error&tab=sync`);
  }
});

// GET /status?brandId=X
router.get("/status", async (req, res) => {
  const brandId = req.query.brandId as string;
  if (!brandId) return res.status(400).json({ error: "brandId required" });

  const hasClientId = !!process.env.GOOGLE_CLIENT_ID;
  const hasClientSecret = !!process.env.GOOGLE_CLIENT_SECRET;

  try {
    await ensureTable();
    const rows = await db.execute(sql`
      SELECT brand_id, account_id, account_name, location_id, location_name, expiry_date, updated_at
      FROM google_oauth_tokens WHERE brand_id = ${parseInt(brandId)}
    `);

    if (rows.rows.length === 0) {
      return res.json({
        connected: false,
        hasCredentials: hasClientId && hasClientSecret,
      });
    }

    const row = rows.rows[0] as Record<string, any>;
    const isExpired =
      row.expiry_date && Date.now() > Number(row.expiry_date);

    return res.json({
      connected: true,
      hasCredentials: hasClientId && hasClientSecret,
      accountId: row.account_id,
      accountName: row.account_name,
      locationId: row.location_id,
      locationName: row.location_name,
      isExpired,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    console.error("[google-auth/status] Error:", err);
    res.status(500).json({ error: "Failed to get status" });
  }
});

// DELETE /disconnect?brandId=X
router.delete("/disconnect", async (req, res) => {
  const brandId = req.query.brandId as string;
  if (!brandId) return res.status(400).json({ error: "brandId required" });

  try {
    await ensureTable();
    await db.execute(sql`
      DELETE FROM google_oauth_tokens WHERE brand_id = ${parseInt(brandId)}
    `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

// GET /locations?brandId=X  — list Business Profile locations for selection
router.get("/locations", async (req, res) => {
  const brandId = req.query.brandId as string;
  if (!brandId) return res.status(400).json({ error: "brandId required" });

  try {
    const tokens = await getValidTokens(parseInt(brandId));
    if (!tokens) return res.status(401).json({ error: "Not connected to Google" });

    const accountId = tokens.account_id as string;
    if (!accountId) return res.json({ locations: [] });

    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations?readMask=name,title,storefrontAddress`,
      { headers: { Authorization: `Bearer ${tokens.access_token as string}` } }
    );
    const locData = (await locRes.json()) as Record<string, any>;
    const locations: { id: string; name: string }[] = (locData.locations ?? []).map(
      (loc: Record<string, any>) => ({
        id: loc.name as string,
        name: (loc.title as string) ?? (loc.name as string),
      })
    );

    res.json({ locations });
  } catch (err) {
    console.error("[google-auth/locations] Error:", err);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

// PUT /set-location  — save selected location for a brand
router.put("/set-location", async (req, res) => {
  const { brandId, locationId, locationName } = req.body as {
    brandId?: number;
    locationId?: string;
    locationName?: string;
  };
  if (!brandId || !locationId)
    return res.status(400).json({ error: "brandId and locationId required" });

  try {
    await ensureTable();
    await db.execute(sql`
      UPDATE google_oauth_tokens
      SET location_id   = ${locationId},
          location_name = ${locationName ?? ""},
          updated_at    = NOW()
      WHERE brand_id = ${brandId}
    `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to set location" });
  }
});

export default router;
