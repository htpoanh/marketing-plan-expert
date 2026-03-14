import { Router, type IRouter } from "express";
import OpenAI from "openai";

const router: IRouter = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── POST /ad-analysis/analyze ─────────────────────────────────────────────────
// Accepts: { platform, rawData, contentText, brandName, goal }
router.post("/analyze", async (req, res) => {
  try {
    const { platform, rawData, contentText, brandName, goal } = req.body as {
      platform: string;
      rawData?: string;
      contentText?: string;
      brandName?: string;
      goal?: string;
    };

    if (!rawData && !contentText) {
      return res.status(400).json({ error: "Cần cung cấp dữ liệu hoặc nội dung để phân tích" });
    }

    const platformLabels: Record<string, string> = {
      facebook: "Facebook Ads Manager",
      instagram: "Instagram Insights",
      tiktok: "TikTok Ads Manager",
      google: "Google Ads",
      mixed: "Nhiều nền tảng",
    };

    const systemPrompt = `Du bist ein erfahrener Digital-Marketing-Analyst mit Expertise in ${platformLabels[platform] ?? platform} für den deutschsprachigen Markt. 
Du analysierst Werbedaten von kleinen und mittelständischen Unternehmen und gibst konkrete, umsetzbare Empfehlungen auf Deutsch.
Antworte IMMER auf Deutsch. Sei präzise, praxisorientiert und nutze echte Zahlen aus den Daten.`;

    const userPrompt = `Analysiere die folgenden Werbedaten${brandName ? ` für "${brandName}"` : ""} auf ${platformLabels[platform] ?? platform}.
${goal ? `Marketing-Ziel: ${goal}` : ""}

${rawData ? `--- ROHDATEN / CSV-EXPORT ---\n${rawData.substring(0, 8000)}\n---` : ""}
${contentText ? `--- INHALTE / POSTS ZUR BEWERTUNG ---\n${contentText.substring(0, 4000)}\n---` : ""}

Erstelle eine strukturierte Analyse mit folgenden Abschnitten (JSON-Format):
{
  "summary": "Kurze Zusammenfassung der wichtigsten Erkenntnisse (2-3 Sätze)",
  "keyMetrics": [
    { "label": "Metrik-Name", "value": "Wert", "trend": "up|down|neutral", "comment": "Kurzer Kommentar" }
  ],
  "strengths": ["Stärke 1", "Stärke 2"],
  "weaknesses": ["Schwäche 1", "Schwäche 2"],
  "opportunities": ["Chance 1", "Chance 2"],
  "campaigns": [
    {
      "title": "Kampagnen-Titel",
      "objective": "Ziel der Kampagne",
      "platform": "${platform}",
      "budget": "Empfohlenes Budget (z.B. '50€/Woche')",
      "duration": "Laufzeit (z.B. '2 Wochen')",
      "targetAudience": "Zielgruppe",
      "contentType": "Post/Reel/Story/Video",
      "contentAngle": "Inhaltlicher Ansatz",
      "expectedResult": "Erwartetes Ergebnis",
      "priority": "high|medium|low"
    }
  ],
  "quickWins": ["Sofort umsetzbare Maßnahme 1", "Sofort umsetzbare Maßnahme 2"],
  "contentScore": {
    "score": 75,
    "breakdown": { "relevance": 80, "engagement": 70, "clarity": 75, "cta": 65 },
    "feedback": "Detailliertes Feedback zum Content"
  }
}

Gib NUR gültiges JSON zurück, ohne Markdown-Code-Blöcke.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 3000,
    });

    const raw = completion.choices[0].message.content ?? "{}";
    let analysis: any = {};
    try { analysis = JSON.parse(raw); } catch { analysis = { summary: raw }; }

    res.json({ ok: true, platform, analysis });
  } catch (e: any) {
    console.error("[ad-analysis]", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
