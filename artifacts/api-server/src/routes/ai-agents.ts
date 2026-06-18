import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { aiAgentConfigsTable, aiProfilesTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

const router: IRouter = Router();

const DEFAULT_AGENTS = [
  {
    agentKey: "trend",
    agentName: "Agent 1 — Nghiên cứu Xu hướng",
    aiModel: "Claude Sonnet",
    defaultRole: "Chuyên gia phân tích xu hướng thị trường thời gian thực. Nghiên cứu keyword trending, bối cảnh mùa vụ, và góc độ tiếp cận tốt nhất cho chiến dịch.",
    expertiseArea: "",
    customInstructions: "",
    outputStyle: "",
    isActive: true,
  },
  {
    agentKey: "openai",
    agentName: "Agent 2 & 4 — Chiến lược & Prompt",
    aiModel: "Claude Sonnet (chiến lược) + GPT-4o (prompt ảnh)",
    defaultRole: "Chuyên gia chiến lược marketing và prompt engineering. Phân tích trend, chọn mô hình marketing phù hợp (AIDA, STP, 4P...) và tạo prompts chuyên nghiệp cho hình ảnh/video.",
    expertiseArea: "",
    customInstructions: "",
    outputStyle: "",
    isActive: true,
  },
  {
    agentKey: "gemini",
    agentName: "Agent 3 — Viết nội dung",
    aiModel: "Gemini 3 Flash",
    defaultRole: "Copywriter hàng đầu, chuyên viết nội dung viral tiếng Việt cho mạng xã hội. Tạo caption, hooks, hashtags theo từng nền tảng và mô hình marketing đã chọn.",
    expertiseArea: "",
    customInstructions: "",
    outputStyle: "",
    isActive: true,
  },
  {
    agentKey: "claude",
    agentName: "Agent 5 — Biên tập & Trả lời Reviews",
    aiModel: "Claude Sonnet (Anthropic)",
    defaultRole: "Chuyên gia biên tập tiếng Đức cao cấp và chuyên gia viết phản hồi Google Reviews. Tinh chỉnh nội dung từ Gemini để đảm bảo ngữ pháp tự nhiên, cảm xúc chân thật, phù hợp văn hóa Đức. Viết phản hồi đánh giá Google Maps chuyên nghiệp, ấm áp và thuyết phục bằng tiếng Đức.",
    expertiseArea: "",
    customInstructions: "",
    outputStyle: "",
    isActive: true,
  },
];

async function getDefaultProfileId(): Promise<number> {
  const [existing] = await db
    .select()
    .from(aiProfilesTable)
    .where(eq(aiProfilesTable.isDefault, true));
  if (existing) return existing.id;

  const [created] = await db
    .insert(aiProfilesTable)
    .values({ profileName: "Mặc định", industry: "Chung", isDefault: true })
    .returning();
  return created.id;
}

async function ensureDefaultAgents(profileId: number) {
  for (const agent of DEFAULT_AGENTS) {
    const existing = await db
      .select()
      .from(aiAgentConfigsTable)
      .where(
        and(
          eq(aiAgentConfigsTable.profileId, profileId),
          eq(aiAgentConfigsTable.agentKey, agent.agentKey)
        )
      );
    if (existing.length === 0) {
      await db.insert(aiAgentConfigsTable).values({ ...agent, profileId });
    }
  }
}

router.get("/", async (_req, res) => {
  try {
    const profileId = await getDefaultProfileId();
    await ensureDefaultAgents(profileId);
    const agents = await db
      .select()
      .from(aiAgentConfigsTable)
      .where(eq(aiAgentConfigsTable.profileId, profileId))
      .orderBy(aiAgentConfigsTable.id);
    return res.json(agents);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch AI agent configs" });
  }
});

router.put("/:agentKey", async (req, res) => {
  try {
    const { agentKey } = req.params;
    const { expertiseArea, customInstructions, outputStyle, agentName, isActive } = req.body;

    const profileId = await getDefaultProfileId();
    const [existing] = await db
      .select()
      .from(aiAgentConfigsTable)
      .where(
        and(
          eq(aiAgentConfigsTable.profileId, profileId),
          eq(aiAgentConfigsTable.agentKey, agentKey)
        )
      );

    if (!existing) {
      return res.status(404).json({ error: "Agent config not found" });
    }

    const [updated] = await db
      .update(aiAgentConfigsTable)
      .set({
        agentName: agentName ?? existing.agentName,
        expertiseArea: expertiseArea ?? existing.expertiseArea,
        customInstructions: customInstructions ?? existing.customInstructions,
        outputStyle: outputStyle ?? existing.outputStyle,
        isActive: isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(aiAgentConfigsTable.id, existing.id))
      .returning();

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: "Failed to update AI agent config" });
  }
});

router.post("/reset/:agentKey", async (req, res) => {
  try {
    const { agentKey } = req.params;
    const defaultAgent = DEFAULT_AGENTS.find(a => a.agentKey === agentKey);
    if (!defaultAgent) return res.status(404).json({ error: "Agent not found" });

    const profileId = await getDefaultProfileId();
    const [updated] = await db
      .update(aiAgentConfigsTable)
      .set({
        expertiseArea: "",
        customInstructions: "",
        outputStyle: "",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiAgentConfigsTable.profileId, profileId),
          eq(aiAgentConfigsTable.agentKey, agentKey)
        )
      )
      .returning();

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: "Failed to reset AI agent config" });
  }
});

export default router;
