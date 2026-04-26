import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

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

// ─── STATE SIGNING (HMAC-SHA256) ─────────────────────────────────────────────
// Prevents OAuth state tampering / unauthorized brand token overwrite.
// State format: base64url({ brandId, ts }) + "." + HMAC

function getStateSecret(): string {
  return process.env.SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? "gmb-state-secret-fallback";
}

function signState(brandId: string): string {
  const payload = JSON.stringify({ brandId, ts: Date.now() });
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getStateSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyState(state: string): { brandId: string } | null {
  try {
    const dotIdx = state.lastIndexOf(".");
    if (dotIdx === -1) return null;

    const encoded = state.slice(0, dotIdx);
    const sig = state.slice(dotIdx + 1);

    // Verify HMAC
    const expectedSig = crypto
      .createHmac("sha256", getStateSecret())
      .update(encoded)
      .digest("base64url");

    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(sig, "base64url"), Buffer.from(expectedSig, "base64url"))) {
      console.warn("[google-auth] State HMAC mismatch — possible tampering");
      return null;
    }

    const { brandId, ts } = JSON.parse(Buffer.from(encoded, "base64url").toString()) as Record<string, any>;

    // State is valid for 10 minutes only
    if (Date.now() - Number(ts) > 10 * 60 * 1000) {
      console.warn("[google-auth] State expired");
      return null;
    }

    return { brandId: String(brandId) };
  } catch {
    return null;
  }
}

// ─── URL HELPERS ─────────────────────────────────────────────────────────────
// PUBLIC_URL takes precedence (full URL with scheme, e.g. "https://app.example.com").
// Falls back to PUBLIC_DOMAIN, then Replit env vars, then localhost.
function getPublicBaseUrl(): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const domain =
    process.env.PUBLIC_DOMAIN ??
    process.env.REPLIT_DOMAINS?.split(",")[0] ??
    process.env.REPLIT_DEV_DOMAIN;
  if (domain) return `https://${domain}`;
  return "http://localhost:3000";
}

function getCallbackUrl(): string {
  return `${getPublicBaseUrl()}/api/reviews/google-auth/callback`;
}

function getFrontendUrl(): string {
  return `${getPublicBaseUrl()}/reviews`;
}

// ─── ACCOUNT ID HELPER ───────────────────────────────────────────────────────
// Returns { accountId, apiEnableUrl? } — apiEnableUrl is set when the API needs enabling.
export interface EnsureAccountResult {
  accountId: string | null;
  apiEnableUrl?: string;
  rateLimited?: boolean; // true when we're holding back due to quota cooldown
}

// Per-brand cooldown: don't re-attempt within COOLDOWN_MS after a quota error
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const lastQuotaError = new Map<number, number>(); // brandId → timestamp

type FetchAccountsResult =
  | { accountId: string; accountName: string }
  | { error: string; isQuota?: boolean; apiEnableUrl?: string }
  | null;

async function tryFetchAccounts(url: string, headers: Record<string, string>): Promise<FetchAccountsResult> {
  try {
    const res = await fetch(url, { headers });
    let data: Record<string, any>;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      data = (await res.json()) as Record<string, any>;
    } else {
      // Non-JSON response (e.g. HTML error page) — not the accounts API
      return { error: `Non-JSON response (HTTP ${res.status})` };
    }

    if (res.ok) {
      const accounts: any[] = data.accounts ?? [];
      if (accounts.length === 0) return null;
      return {
        accountId: (accounts[0].name as string) ?? "",
        accountName: (accounts[0].accountName as string) ?? (accounts[0].name as string) ?? "",
      };
    }

    const msg: string = data?.error?.message ?? `HTTP ${res.status}`;
    const isQuota = msg.toLowerCase().includes("quota exceeded") || res.status === 429;
    const urlMatch = msg.match(/https:\/\/console\.developers\.google\.com\/apis\/[^\s]+/);
    return { error: msg, isQuota, apiEnableUrl: urlMatch ? urlMatch[0] : undefined };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function ensureAccountId(
  brandId: number,
  accessToken: string
): Promise<EnsureAccountResult> {
  // Cooldown check — if we hit quota recently, don't hammer the API again
  const lastError = lastQuotaError.get(brandId) ?? 0;
  if (Date.now() - lastError < COOLDOWN_MS) {
    const retryInMin = Math.ceil((COOLDOWN_MS - (Date.now() - lastError)) / 60_000);
    console.warn(`[google-auth] ensureAccountId: in cooldown for brandId ${brandId}, retry in ~${retryInMin}m`);
    return { accountId: null, rateLimited: true };
  }

  const headers = { Authorization: `Bearer ${accessToken}` };
  let lastApiEnableUrl: string | undefined;
  let hitQuota = false;

  // Attempt 1: My Business Account Management API (v1)
  const r1 = await tryFetchAccounts(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    headers
  );
  if (r1 && "accountId" in r1 && r1.accountId) {
    lastQuotaError.delete(brandId);
    await db.execute(sql`
      UPDATE google_oauth_tokens
      SET account_id = ${r1.accountId}, account_name = ${r1.accountName}, updated_at = NOW()
      WHERE brand_id = ${brandId}
    `);
    console.log(`[google-auth] ensureAccountId (v1): ${r1.accountId}`);
    return { accountId: r1.accountId };
  }
  if (r1 && "error" in r1) {
    console.warn("[google-auth] v1 accounts API:", r1.error.slice(0, 120));
    if ((r1 as any).isQuota) hitQuota = true;
    if ((r1 as any).apiEnableUrl) lastApiEnableUrl = (r1 as any).apiEnableUrl;
    // If quota hit, stop immediately — don't waste quota on more calls
    if (hitQuota) {
      lastQuotaError.set(brandId, Date.now());
      console.warn(`[google-auth] Quota hit — cooldown set for brandId ${brandId}`);
      return { accountId: null, rateLimited: true };
    }
  }

  // Attempt 2: My Business API v4 (legacy) — only if v1 failed for non-quota reason
  const r2 = await tryFetchAccounts(
    "https://mybusiness.googleapis.com/v4/accounts",
    headers
  );
  if (r2 && "accountId" in r2 && r2.accountId) {
    lastQuotaError.delete(brandId);
    await db.execute(sql`
      UPDATE google_oauth_tokens
      SET account_id = ${r2.accountId}, account_name = ${r2.accountName}, updated_at = NOW()
      WHERE brand_id = ${brandId}
    `);
    console.log(`[google-auth] ensureAccountId (v4): ${r2.accountId}`);
    return { accountId: r2.accountId };
  }
  if (r2 && "error" in r2) {
    console.warn("[google-auth] v4 accounts API:", r2.error.slice(0, 120));
  }

  console.error("[google-auth] ensureAccountId: all attempts failed for brandId", brandId);
  return { accountId: null, apiEnableUrl: lastApiEnableUrl };
}

// ─── TOKEN HELPER ─────────────────────────────────────────────────────────────
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
// Protected by auth middleware (admin must be logged in)
router.get("/url", async (req, res) => {
  const brandId = req.query.brandId as string;
  if (!brandId) return res.status(400).json({ error: "brandId required" });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({ error: "GOOGLE_CLIENT_ID chưa được cài đặt trong Secrets." });
  }

  // Sign state to prevent CSRF / brand-swapping attacks
  const signedState = signState(brandId);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getCallbackUrl());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/business.manage");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", signedState);

  res.redirect(url.toString());
});

// GET /callback  — PUBLIC route, called by Google after user consent
// State is HMAC-verified before any token is stored.
router.get("/callback", async (req, res) => {
  const { code, state: rawState, error } = req.query;
  const frontendUrl = getFrontendUrl();

  if (error) {
    return res.redirect(
      `${frontendUrl}?googleAuthError=${encodeURIComponent(error as string)}&tab=sync`
    );
  }

  if (!code || !rawState) {
    return res.redirect(`${frontendUrl}?googleAuthError=missing_params&tab=sync`);
  }

  // Verify HMAC-signed state — reject any tampered/invalid state
  const verified = verifyState(rawState as string);
  if (!verified) {
    console.warn("[google-auth/callback] Invalid or tampered state parameter");
    return res.redirect(`${frontendUrl}?googleAuthError=invalid_state&tab=sync`);
  }

  const { brandId } = verified;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.redirect(`${frontendUrl}?googleAuthError=missing_credentials&tab=sync`);
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
      return res.redirect(`${frontendUrl}?googleAuthError=token_exchange_failed&tab=sync`);
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

    // Store tokens, keyed by brandId (which was verified via HMAC)
    await db.execute(sql`
      INSERT INTO google_oauth_tokens
        (brand_id, access_token, refresh_token, expiry_date, account_id, account_name, updated_at)
      VALUES
        (${parseInt(brandId)}, ${tokenData.access_token as string},
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

    // Return a simple HTML page that notifies the opener window and closes itself
    return res.send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Kết nối thành công</title></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#e2e8f0">
  <div style="text-align:center;padding:2rem">
    <div style="font-size:3rem;margin-bottom:1rem">✅</div>
    <h2 style="margin:0 0 .5rem;color:#4ade80">Đã kết nối Google Business!</h2>
    <p style="color:#94a3b8;margin:0">Đang đóng cửa sổ này...</p>
  </div>
  <script>
    // Notify the opener window
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', brandId: '${brandId}' }, '*');
    }
    setTimeout(function() { window.close(); }, 1500);
  </script>
</body>
</html>`);
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
      return res.json({ connected: false, hasCredentials: hasClientId && hasClientSecret });
    }

    const row = rows.rows[0] as Record<string, any>;
    const isExpired = row.expiry_date && Date.now() > Number(row.expiry_date);

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
    await db.execute(sql`DELETE FROM google_oauth_tokens WHERE brand_id = ${parseInt(brandId)}`);
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

    let accountId = tokens.account_id as string;
    if (!accountId) {
      const result = await ensureAccountId(parseInt(brandId), tokens.access_token as string);
      accountId = result.accountId ?? "";
      if (!accountId) return res.json({ locations: [], apiEnableUrl: result.apiEnableUrl });
    }

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

// PUT /set-manual-path  — manually set location path (accounts/xxx/locations/yyy)
// Used when the API-based location list fails (e.g. Account Management API not enabled)
router.put("/set-manual-path", async (req, res) => {
  const { brandId, locationPath } = req.body as { brandId?: number; locationPath?: string };
  if (!brandId || !locationPath)
    return res.status(400).json({ error: "brandId and locationPath required" });

  // locationPath must look like accounts/.../locations/...
  if (!locationPath.includes("/locations/")) {
    return res.status(400).json({
      error: "Định dạng không hợp lệ. Cần có dạng: accounts/XXXXXX/locations/YYYYYY",
    });
  }

  try {
    await ensureTable();

    // Extract accountId from path: "accounts/123456789/locations/..."
    const accountId = locationPath.split("/locations/")[0] ?? "";

    await db.execute(sql`
      UPDATE google_oauth_tokens
      SET location_id   = ${locationPath},
          location_name = ${"Địa điểm thủ công"},
          account_id    = CASE WHEN (account_id IS NULL OR account_id = '') THEN ${accountId} ELSE account_id END,
          updated_at    = NOW()
      WHERE brand_id = ${brandId}
    `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to set manual path" });
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
