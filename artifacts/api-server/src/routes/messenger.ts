import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  messengerConfigsTable,
  messengerSessionsTable,
  appointmentsTable,
  brandsTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import OpenAI from "openai";

const router: IRouter = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Messenger Graph API ───────────────────────────────────────────────────
async function sendMessage(psid: string, token: string, message: string) {
  const url = "https://graph.facebook.com/v19.0/me/messages";
  const body = {
    recipient: { id: psid },
    message: { text: message },
    messaging_type: "RESPONSE",
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) console.error("Messenger send error:", JSON.stringify(data));
  return data;
}

async function sendQuickReplies(psid: string, token: string, text: string, replies: { title: string; payload: string }[]) {
  const url = "https://graph.facebook.com/v19.0/me/messages";
  const body = {
    recipient: { id: psid },
    message: {
      text,
      quick_replies: replies.map(r => ({ content_type: "text", title: r.title, payload: r.payload })),
    },
    messaging_type: "RESPONSE",
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return r.json();
}

// ── AI Chat with GPT-4o ────────────────────────────────────────────────────
async function processMessage(
  userMessage: string,
  session: any,
  brand: any,
  config: any
): Promise<{ reply: string; newState: string; collectedData: any; shouldBookNow: boolean }> {
  const brandName = brand.brandName;
  const services = config.servicesInfo || "Gel Nails, Acryl, Pedicure, Maniküre, Nageldesign";
  const hours = config.businessHoursInfo || "Di–Sa 9:00–19:00, So 10:00–17:00";

  const history = (session.conversationHistory as any[]) || [];
  const collected = (session.collectedData as any) || {};

  const collectedSummary = Object.keys(collected).length > 0
    ? Object.entries(collected).map(([k, v]) => `  - ${k}: ${v}`).join("\n")
    : "  Noch keine";

  const system = `Du bist ein freundlicher KI-Terminassistent für ${brandName}, ein Nagelstudio in Deutschland.

WICHTIGE REGELN:
- Antworte IMMER auf Deutsch, freundlich und natürlich
- Du hilfst beim Terminbuchen und beantwortest Fragen zum Studio
- Wenn der Kunde einen Termin möchte, sammle ALLE nötigen Infos schrittweise:
  1. Welchen Service möchte der Kunde? (Angeboten: ${services})
  2. Welches Datum? (versuche ein konkretes Datum z.B. "Mittwoch 19. März")
  3. Welche Uhrzeit?
  4. Name des Kunden?
  5. Telefonnummer?
- Sobald du eine neue Information erhältst, rufe "save_progress" auf um sie zu speichern
- Wenn du ALLE 5 Informationen hast, rufe "complete_booking" auf
- Antworte KURZ und FREUNDLICH (max 2-3 Sätze)
- Öffnungszeiten: ${hours}

Bereits gesammelte Informationen:
${collectedSummary}`;

  const messages: any[] = [
    { role: "system", content: system },
    ...history.slice(-8),
    { role: "user", content: userMessage },
  ];

  const tools: any[] = [
    {
      type: "function",
      function: {
        name: "save_progress",
        description: "Speichere eine neu erhaltene Information zwischen — rufe dies auf sobald du einen neuen Wert kennst",
        parameters: {
          type: "object",
          properties: {
            customerName: { type: "string", description: "Name des Kunden (falls bekannt)" },
            service: { type: "string", description: "Gewünschter Service (falls bekannt)" },
            preferredDate: { type: "string", description: "Gewünschtes Datum (falls bekannt)" },
            preferredTime: { type: "string", description: "Gewünschte Uhrzeit (falls bekannt)" },
            phone: { type: "string", description: "Telefonnummer (falls bekannt)" },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "complete_booking",
        description: "Rufe diese Funktion auf, wenn ALLE 5 Buchungsinformationen vollständig gesammelt wurden",
        parameters: {
          type: "object",
          properties: {
            customerName: { type: "string" },
            service: { type: "string" },
            preferredDate: { type: "string" },
            preferredTime: { type: "string" },
            phone: { type: "string" },
          },
          required: ["customerName", "service", "preferredDate", "preferredTime", "phone"],
        },
      },
    },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    tools,
    tool_choice: "auto",
    temperature: 0.7,
  });

  const choice = completion.choices[0];

  // AI calls complete_booking → all 5 fields collected
  if (choice.finish_reason === "tool_calls" && choice.message.tool_calls?.[0]) {
    const toolCall = choice.message.tool_calls[0];

    if (toolCall.function.name === "complete_booking") {
      const args = JSON.parse(toolCall.function.arguments);
      return {
        reply: `Vielen Dank, ${args.customerName}! 🙏 Ich habe Ihren Terminwunsch aufgenommen:\n\n📌 Service: ${args.service}\n📅 Datum: ${args.preferredDate}\n⏰ Uhrzeit: ${args.preferredTime}\n📞 Telefon: ${args.phone}\n\nBitte warten Sie kurz — das Team von ${brandName} bestätigt Ihren Termin in Kürze! ✨`,
        newState: "waiting_manager",
        collectedData: { ...collected, ...args },
        shouldBookNow: true,
      };
    }

    // AI calls save_progress → merge partial data, then ask follow-up
    if (toolCall.function.name === "save_progress") {
      const partial = JSON.parse(toolCall.function.arguments);
      const newCollected = { ...collected };
      for (const [k, v] of Object.entries(partial)) {
        if (v) newCollected[k as keyof typeof newCollected] = v as string;
      }

      // Get follow-up question from AI after saving
      const followUp = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          ...messages,
          choice.message,
          { role: "tool", tool_call_id: toolCall.id, content: "Gespeichert." },
        ],
        temperature: 0.7,
      });
      const followUpText = followUp.choices[0]?.message?.content || "Was kann ich noch für Sie tun?";

      return {
        reply: followUpText,
        newState: "collecting",
        collectedData: newCollected,
        shouldBookNow: false,
      };
    }
  }

  const textReply = choice.message.content || "Ich helfe Ihnen gerne weiter!";

  return {
    reply: textReply,
    newState: "collecting",
    collectedData: { ...collected },
    shouldBookNow: false,
  };
}

// ── Webhook Verification (GET) ─────────────────────────────────────────────
router.get("/webhook", async (req: Request, res: Response) => {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode !== "subscribe") {
      res.status(400).send("Bad mode");
      return;
    }

    // Check verify_token against all configured brands
    const configs = await db.select().from(messengerConfigsTable);
    const matched = configs.find(c => c.verifyToken && c.verifyToken === token);

    if (!matched) {
      console.error("Webhook verify_token mismatch. Got:", token);
      res.status(403).send("Forbidden");
      return;
    }

    console.log("Messenger webhook verified for brand:", matched.brandId);
    res.status(200).send(challenge);
  } catch (err) {
    console.error("Webhook verify error:", err);
    res.status(500).send("Error");
  }
});

// ── Webhook Receive Messages (POST) ─────────────────────────────────────────
router.post("/webhook", async (req: Request, res: Response) => {
  res.status(200).send("EVENT_RECEIVED");

  try {
    const body = req.body;
    if (body.object !== "page") return;

    for (const entry of (body.entry || [])) {
      const pageId = entry.id;

      // Find config for this page
      const [config] = await db.select().from(messengerConfigsTable).where(eq(messengerConfigsTable.pageId, pageId));
      if (!config || !config.isActive || !config.pageAccessToken) {
        console.log("No active config for page:", pageId);
        continue;
      }

      const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, config.brandId!));
      if (!brand) continue;

      for (const event of (entry.messaging || [])) {
        const senderPsid = event.sender?.id;
        if (!senderPsid || senderPsid === pageId) continue;

        // ── MANAGER replies via quick reply payload or text ──
        if (senderPsid === config.managerPsid && event.message) {
          // Support quick reply payload: CONFIRM_123 / REJECT_123
          const payload = event.message.quick_reply?.payload as string | undefined;
          const text = (event.message.text ?? "").trim().toLowerCase();

          let apptId: number | null = null;
          let isJa = false;
          let isNein = false;

          if (payload?.startsWith("CONFIRM_")) {
            apptId = parseInt(payload.replace("CONFIRM_", ""));
            isJa = true;
          } else if (payload?.startsWith("REJECT_")) {
            apptId = parseInt(payload.replace("REJECT_", ""));
            isNein = true;
          } else {
            isJa = text === "ja" || text === "yes" || text === "✅" || text.startsWith("ja ");
            isNein = text === "nein" || text === "no" || text === "❌" || text.startsWith("nein ");
          }

          if (isJa || isNein) {
            // Find appointment: by ID (from quick reply) or latest pending
            let pendingAppt: any;
            if (apptId) {
              [pendingAppt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, apptId));
            } else {
              [pendingAppt] = await db
                .select().from(appointmentsTable)
                .where(eq(appointmentsTable.brandId, brand.id))
                .orderBy(desc(appointmentsTable.createdAt))
                .limit(1);
            }

            if (pendingAppt && pendingAppt.status === "pending") {
              if (isJa) {
                await db.update(appointmentsTable)
                  .set({ status: "confirmed", confirmedAt: new Date(), updatedAt: new Date() })
                  .where(eq(appointmentsTable.id, pendingAppt.id));
                await sendMessage(pendingAppt.customerPsid, config.pageAccessToken,
                  `✅ Ihr Termin wurde bestätigt!\n\n📌 ${pendingAppt.service}\n📅 ${pendingAppt.preferredDate} um ${pendingAppt.preferredTime}\n\nWir freuen uns auf Sie bei ${brand.brandName}! Bei Fragen einfach hier schreiben. 💅`
                );
                await sendMessage(senderPsid, config.pageAccessToken,
                  `✅ Bestätigt: ${pendingAppt.customerName} — ${pendingAppt.service} am ${pendingAppt.preferredDate} ${pendingAppt.preferredTime}`
                );
              } else {
                await db.update(appointmentsTable)
                  .set({ status: "rejected", updatedAt: new Date() })
                  .where(eq(appointmentsTable.id, pendingAppt.id));
                await sendMessage(pendingAppt.customerPsid, config.pageAccessToken,
                  `Leider ist der gewünschte Termin (${pendingAppt.preferredDate} um ${pendingAppt.preferredTime}) nicht verfügbar. 😔\n\nMöchten Sie einen anderen Termin? Schreiben Sie einfach Ihre gewünschte Zeit!`
                );
                await sendMessage(senderPsid, config.pageAccessToken, `❌ Abgelehnt — Kunde wurde informiert.`);
              }

              // Reset customer session
              await db.update(messengerSessionsTable)
                .set({ state: "idle", collectedData: {}, conversationHistory: [], updatedAt: new Date() })
                .where(eq(messengerSessionsTable.psid, pendingAppt.customerPsid));
            }
            continue;
          }
        }

        // ── CUSTOMER message ──
        if (!event.message?.text) continue;
        const userText = event.message.text;

        // Get or create session
        let [session] = await db.select().from(messengerSessionsTable).where(eq(messengerSessionsTable.psid, senderPsid));

        const isNewSession = !session;
        if (!session) {
          [session] = await db.insert(messengerSessionsTable).values({
            psid: senderPsid,
            brandId: brand.id,
            state: "idle",
            collectedData: {},
            conversationHistory: [],
          }).returning();

          // Send welcome message on first contact
          const welcome = config.welcomeMessage || `Hallo! 👋 Willkommen bei ${brand.brandName}! Wie kann ich Ihnen helfen? Möchten Sie einen Termin buchen?`;
          await sendMessage(senderPsid, config.pageAccessToken, welcome);
        }

        // Block customer messages while waiting for manager confirmation
        if (session.state === "waiting_manager") {
          await sendMessage(senderPsid, config.pageAccessToken,
            `⏳ Ihre Buchungsanfrage wird gerade vom Team geprüft. Bitte warten Sie auf die Bestätigung!`
          );
          continue;
        }

        // Update history
        const history = ((session.conversationHistory as any[]) || []);
        const updatedHistory = [...history.slice(-8), { role: "user", content: userText }];

        // AI processes message
        let aiResult: Awaited<ReturnType<typeof processMessage>>;
        try {
          aiResult = await processMessage(
            userText, { ...session, conversationHistory: updatedHistory }, brand, config
          );
        } catch (aiErr: any) {
          console.error("AI error in processMessage:", aiErr?.message);
          await sendMessage(senderPsid, config.pageAccessToken,
            `Entschuldigung, es gab einen technischen Fehler. Bitte versuchen Sie es gleich nochmal! 🙏`
          );
          continue;
        }
        const { reply, newState, collectedData, shouldBookNow } = aiResult;

        if (shouldBookNow) {
          // Save appointment
          const [appt] = await db.insert(appointmentsTable).values({
            brandId: brand.id,
            customerPsid: senderPsid,
            customerName: collectedData.customerName,
            service: collectedData.service,
            preferredDate: collectedData.preferredDate,
            preferredTime: collectedData.preferredTime,
            phone: collectedData.phone,
            status: "pending",
            managerNotifiedAt: new Date(),
          }).returning();

          // Update session
          await db.update(messengerSessionsTable)
            .set({
              state: "waiting_manager",
              collectedData,
              appointmentId: appt.id,
              conversationHistory: [...updatedHistory, { role: "assistant", content: reply }],
              updatedAt: new Date(),
            })
            .where(eq(messengerSessionsTable.psid, senderPsid));

          // Send "wait" reply to customer
          await sendMessage(senderPsid, config.pageAccessToken, reply);

          // Notify manager with quick reply buttons (includes appointment ID to avoid wrong confirmation)
          if (config.managerPsid) {
            const managerMsg = `📅 NEUE BUCHUNGSANFRAGE #${appt.id}\n\n👤 ${collectedData.customerName}\n💅 ${collectedData.service}\n📆 ${collectedData.preferredDate} um ${collectedData.preferredTime}\n📞 ${collectedData.phone}`;
            await sendQuickReplies(config.managerPsid, config.pageAccessToken, managerMsg, [
              { title: "✅ Bestätigen", payload: `CONFIRM_${appt.id}` },
              { title: "❌ Ablehnen", payload: `REJECT_${appt.id}` },
            ]);
          }
        } else {
          // Normal conversation
          await db.update(messengerSessionsTable)
            .set({
              state: newState,
              collectedData,
              conversationHistory: [...updatedHistory, { role: "assistant", content: reply }],
              updatedAt: new Date(),
            })
            .where(eq(messengerSessionsTable.psid, senderPsid));

          await sendMessage(senderPsid, config.pageAccessToken, reply);
        }
      }
    }
  } catch (err) {
    console.error("Messenger webhook processing error:", err);
  }
});

// ── Make.com Integration Endpoint ──────────────────────────────────────────
// Make.com scenario calls this with the customer message → we return the AI reply
// Make.com then sends the reply back via Facebook Messenger module
router.post("/process-make", async (req: Request, res: Response) => {
  try {
    const { senderId, message, pageId, brandId } = req.body as {
      senderId: string;
      message: string;
      pageId?: string;
      brandId?: number;
    };

    if (!senderId || !message) {
      return res.status(400).json({ error: "senderId and message are required" });
    }

    // Find config by pageId or brandId
    let config: any;
    if (pageId) {
      [config] = await db.select().from(messengerConfigsTable).where(eq(messengerConfigsTable.pageId, pageId));
    } else if (brandId) {
      [config] = await db.select().from(messengerConfigsTable).where(eq(messengerConfigsTable.brandId, brandId));
    } else {
      // Fall back to first active config
      const configs = await db.select().from(messengerConfigsTable).where(eq(messengerConfigsTable.isActive, true));
      config = configs[0];
    }

    if (!config) return res.status(404).json({ error: "No Messenger config found for this page/brand" });

    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, config.brandId));
    if (!brand) return res.status(404).json({ error: "Brand not found" });

    // Get or create session
    let [session] = await db.select().from(messengerSessionsTable).where(eq(messengerSessionsTable.psid, senderId));
    if (!session) {
      [session] = await db.insert(messengerSessionsTable).values({
        psid: senderId,
        brandId: config.brandId,
        state: "idle",
        collectedData: {},
        conversationHistory: [],
      }).returning();
    }

    const history = ((session.conversationHistory as any[]) || []);
    const updatedHistory = [...history.slice(-8), { role: "user", content: message }];

    const { reply, newState, collectedData, shouldBookNow } = await processMessage(
      message, { ...session, conversationHistory: updatedHistory }, brand, config
    );

    if (shouldBookNow) {
      const [appt] = await db.insert(appointmentsTable).values({
        brandId: config.brandId,
        customerPsid: senderId,
        customerName: collectedData.customerName,
        service: collectedData.service,
        preferredDate: collectedData.preferredDate,
        preferredTime: collectedData.preferredTime,
        phone: collectedData.phone,
        status: "pending",
        managerNotifiedAt: new Date(),
      }).returning();

      await db.update(messengerSessionsTable)
        .set({ state: "waiting_manager", collectedData, appointmentId: appt.id, conversationHistory: [...updatedHistory, { role: "assistant", content: reply }], updatedAt: new Date() })
        .where(eq(messengerSessionsTable.psid, senderId));

      // Return reply + booking data (Make.com sends reply, and optionally notifies manager via separate route)
      return res.json({
        reply,
        bookingCreated: true,
        appointmentId: appt.id,
        bookingData: collectedData,
        managerMessage: `📅 NEUE BUCHUNGSANFRAGE\n\n👤 ${collectedData.customerName}\n💅 ${collectedData.service}\n📆 ${collectedData.preferredDate} um ${collectedData.preferredTime}\n📞 ${collectedData.phone}\n\nAntworten Sie mit JA oder NEIN.`,
        managerPsid: config.managerPsid,
      });
    } else {
      await db.update(messengerSessionsTable)
        .set({ state: newState, collectedData, conversationHistory: [...updatedHistory, { role: "assistant", content: reply }], updatedAt: new Date() })
        .where(eq(messengerSessionsTable.psid, senderId));

      return res.json({ reply, bookingCreated: false });
    }
  } catch (err: any) {
    console.error("Make.com process error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Config CRUD ────────────────────────────────────────────────────────────
router.get("/config/:brandId", async (req: Request, res: Response) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const [config] = await db.select().from(messengerConfigsTable).where(eq(messengerConfigsTable.brandId, brandId));
    res.json(config ?? null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/config/:brandId", async (req: Request, res: Response) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const { pageAccessToken, verifyToken, managerPsid, pageId, isActive, welcomeMessage, businessHoursInfo, servicesInfo } = req.body;

    const [existing] = await db.select().from(messengerConfigsTable).where(eq(messengerConfigsTable.brandId, brandId));

    if (existing) {
      const [updated] = await db.update(messengerConfigsTable)
        .set({ pageAccessToken, verifyToken, managerPsid, pageId, isActive, welcomeMessage, businessHoursInfo, servicesInfo, updatedAt: new Date() })
        .where(eq(messengerConfigsTable.brandId, brandId))
        .returning();
      res.json({ ok: true, config: updated });
    } else {
      const [created] = await db.insert(messengerConfigsTable)
        .values({ brandId, pageAccessToken, verifyToken, managerPsid, pageId, isActive: isActive ?? false, welcomeMessage, businessHoursInfo, servicesInfo })
        .returning();
      res.json({ ok: true, config: created });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Appointments ───────────────────────────────────────────────────────────
router.get("/appointments", async (req: Request, res: Response) => {
  try {
    const brandId = req.query.brandId ? parseInt(req.query.brandId as string) : undefined;
    const query = db.select({
      id: appointmentsTable.id,
      brandId: appointmentsTable.brandId,
      brandName: brandsTable.brandName,
      customerPsid: appointmentsTable.customerPsid,
      customerName: appointmentsTable.customerName,
      service: appointmentsTable.service,
      preferredDate: appointmentsTable.preferredDate,
      preferredTime: appointmentsTable.preferredTime,
      phone: appointmentsTable.phone,
      status: appointmentsTable.status,
      notes: appointmentsTable.notes,
      createdAt: appointmentsTable.createdAt,
      confirmedAt: appointmentsTable.confirmedAt,
    }).from(appointmentsTable)
      .leftJoin(brandsTable, eq(appointmentsTable.brandId, brandsTable.id))
      .orderBy(desc(appointmentsTable.createdAt))
      .limit(100);

    const results = await query;
    const filtered = brandId ? results.filter(r => r.brandId === brandId) : results;
    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/appointments/:id/status", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    const [appt] = await db.update(appointmentsTable)
      .set({ status, confirmedAt: status === "confirmed" ? new Date() : undefined, updatedAt: new Date() })
      .where(eq(appointmentsTable.id, id))
      .returning();

    // If confirming/rejecting, also send Messenger message to customer
    if (appt && (status === "confirmed" || status === "rejected")) {
      const [config] = await db.select().from(messengerConfigsTable).where(eq(messengerConfigsTable.brandId, appt.brandId!));
      const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, appt.brandId!));

      if (config?.pageAccessToken && appt.customerPsid) {
        if (status === "confirmed") {
          await sendMessage(appt.customerPsid, config.pageAccessToken,
            `✅ Ihr Termin wurde bestätigt!\n\n📌 ${appt.service}\n📅 ${appt.preferredDate} um ${appt.preferredTime}\n\nWir freuen uns auf Sie bei ${brand?.brandName}! 💅`
          );
        } else {
          await sendMessage(appt.customerPsid, config.pageAccessToken,
            `Leider ist der gewünschte Termin nicht verfügbar. Möchten Sie einen anderen Termin vereinbaren?`
          );
        }
        await db.update(messengerSessionsTable)
          .set({ state: "idle", collectedData: {}, conversationHistory: [], updatedAt: new Date() })
          .where(eq(messengerSessionsTable.psid, appt.customerPsid));
      }
    }

    res.json({ ok: true, appointment: appt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get all brand configs summary ─────────────────────────────────────────
router.get("/overview", async (_req: Request, res: Response) => {
  try {
    const brands = await db.select().from(brandsTable).orderBy(brandsTable.brandName);
    const configs = await db.select().from(messengerConfigsTable);
    const appts = await db.select().from(appointmentsTable);

    const result = brands.map(b => {
      const cfg = configs.find(c => c.brandId === b.id);
      const brandAppts = appts.filter(a => a.brandId === b.id);
      return {
        brand: b,
        config: cfg ?? null,
        stats: {
          pending: brandAppts.filter(a => a.status === "pending").length,
          confirmed: brandAppts.filter(a => a.status === "confirmed").length,
          total: brandAppts.length,
        },
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
