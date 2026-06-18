import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { kolCharactersTable, kolPostsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { generateKolDraft } from "../../services/virtual-kol/generate.service";
import { synthesizeVoice } from "../../services/virtual-kol/elevenlabs";

const router: IRouter = Router();

// ── GET /virtual-kol/characters ──────────────────────────────────────────────
router.get("/characters", async (_req, res) => {
  try {
    const rows = await db.select().from(kolCharactersTable).orderBy(kolCharactersTable.id);
    return res.json(rows);
  } catch (error) {
    console.error("[virtual-kol/characters] failed", error);
    return res.status(500).json({ error: "Failed to list characters" });
  }
});

// ── GET /virtual-kol/posts ───────────────────────────────────────────────────
router.get("/posts", async (req, res) => {
  try {
    const characterId = req.query.characterId ? Number(req.query.characterId) : undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const rows = await db
      .select()
      .from(kolPostsTable)
      .where(
        characterId !== undefined && !Number.isNaN(characterId)
          ? eq(kolPostsTable.characterId, characterId)
          : undefined,
      )
      .orderBy(desc(kolPostsTable.createdAt))
      .limit(limit);
    return res.json(rows);
  } catch (error) {
    console.error("[virtual-kol/posts] failed", error);
    return res.status(500).json({ error: "Failed to list posts" });
  }
});

// ── POST /virtual-kol/generate ───────────────────────────────────────────────
router.post("/generate", async (req, res) => {
  try {
    const characterId = Number(req.body?.characterId);
    const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
    if (Number.isNaN(characterId)) return res.status(400).json({ error: "characterId erforderlich" });
    if (!topic) return res.status(400).json({ error: "topic erforderlich" });

    const [character] = await db
      .select()
      .from(kolCharactersTable)
      .where(eq(kolCharactersTable.id, characterId));
    if (!character) return res.status(404).json({ error: "Charakter nicht gefunden" });

    let draft;
    try {
      draft = await generateKolDraft(character, topic);
    } catch (e) {
      return res.status(502).json({ error: `AI-Fehler: ${e instanceof Error ? e.message : String(e)}` });
    }

    // Optional TTS (inactive without ElevenLabs key).
    let voice: Awaited<ReturnType<typeof synthesizeVoice>> | null = null;
    try {
      voice = await synthesizeVoice({ handle: character.handle, text: draft.script });
    } catch (e) {
      voice = { active: false, reason: e instanceof Error ? e.message : String(e) };
    }

    const [post] = await db
      .insert(kolPostsTable)
      .values({
        characterId,
        script: draft.script,
        caption: draft.caption,
        hashtags: draft.hashtags,
        audioUrl: voice?.active ? voice.audioUrl : null,
        status: "draft",
      })
      .returning();

    return res.status(201).json({ post, voice });
  } catch (error) {
    console.error("[virtual-kol/generate] failed", error);
    return res.status(500).json({ error: "KOL-Generierung fehlgeschlagen" });
  }
});

export default router;
