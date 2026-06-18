import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { aiProfilesTable, aiAgentConfigsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

const DEFAULT_AGENT_TEMPLATES = [
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

async function ensureDefaultProfile() {
  const existing = await db
    .select()
    .from(aiProfilesTable)
    .where(eq(aiProfilesTable.isDefault, true));

  if (existing.length === 0) {
    const [profile] = await db
      .insert(aiProfilesTable)
      .values({ profileName: "Mặc định", industry: "Chung", isDefault: true })
      .returning();
    for (const tpl of DEFAULT_AGENT_TEMPLATES) {
      await db.insert(aiAgentConfigsTable).values({ ...tpl, profileId: profile.id });
    }
    return profile;
  }

  const defaultProfile = existing[0];
  for (const tpl of DEFAULT_AGENT_TEMPLATES) {
    const existingAgent = await db
      .select()
      .from(aiAgentConfigsTable)
      .where(
        and(
          eq(aiAgentConfigsTable.profileId, defaultProfile.id),
          eq(aiAgentConfigsTable.agentKey, tpl.agentKey)
        )
      );
    if (existingAgent.length === 0) {
      await db.insert(aiAgentConfigsTable).values({ ...tpl, profileId: defaultProfile.id });
    }
  }
  return defaultProfile;
}

router.get("/", async (_req, res) => {
  try {
    await ensureDefaultProfile();
    const profiles = await db
      .select()
      .from(aiProfilesTable)
      .orderBy(aiProfilesTable.id);
    res.json(profiles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch profiles" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { profileName, industry, description, cloneFromId } = req.body;
    if (!profileName) return res.status(400).json({ error: "profileName is required" });

    const [newProfile] = await db
      .insert(aiProfilesTable)
      .values({ profileName, industry: industry ?? "", description: description ?? "", isDefault: false })
      .returning();

    if (cloneFromId) {
      const sourceAgents = await db
        .select()
        .from(aiAgentConfigsTable)
        .where(eq(aiAgentConfigsTable.profileId, Number(cloneFromId)));

      for (const agent of sourceAgents) {
        await db.insert(aiAgentConfigsTable).values({
          profileId: newProfile.id,
          agentKey: agent.agentKey,
          agentName: agent.agentName,
          aiModel: agent.aiModel,
          defaultRole: agent.defaultRole,
          expertiseArea: agent.expertiseArea ?? "",
          customInstructions: agent.customInstructions ?? "",
          outputStyle: agent.outputStyle ?? "",
          isActive: agent.isActive,
        });
      }
    } else {
      for (const tpl of DEFAULT_AGENT_TEMPLATES) {
        await db.insert(aiAgentConfigsTable).values({ ...tpl, profileId: newProfile.id });
      }
    }

    const agents = await db
      .select()
      .from(aiAgentConfigsTable)
      .where(eq(aiAgentConfigsTable.profileId, newProfile.id));

    return res.json({ ...newProfile, agents });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to create profile" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const profileId = Number(req.params.id);
    const { profileName, industry, description } = req.body;

    const [updated] = await db
      .update(aiProfilesTable)
      .set({
        ...(profileName && { profileName }),
        ...(industry !== undefined && { industry }),
        ...(description !== undefined && { description }),
        updatedAt: new Date(),
      })
      .where(eq(aiProfilesTable.id, profileId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Profile not found" });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const profileId = Number(req.params.id);
    const [profile] = await db
      .select()
      .from(aiProfilesTable)
      .where(eq(aiProfilesTable.id, profileId));

    if (!profile) return res.status(404).json({ error: "Profile not found" });
    if (profile.isDefault) return res.status(400).json({ error: "Cannot delete default profile" });

    await db.delete(aiAgentConfigsTable).where(eq(aiAgentConfigsTable.profileId, profileId));
    await db.delete(aiProfilesTable).where(eq(aiProfilesTable.id, profileId));

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete profile" });
  }
});

router.get("/:id/agents", async (req, res) => {
  try {
    const profileId = Number(req.params.id);
    const agents = await db
      .select()
      .from(aiAgentConfigsTable)
      .where(eq(aiAgentConfigsTable.profileId, profileId))
      .orderBy(aiAgentConfigsTable.id);
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

router.put("/:id/agents/:agentKey", async (req, res) => {
  try {
    const profileId = Number(req.params.id);
    const { agentKey } = req.params;
    const { expertiseArea, customInstructions, outputStyle } = req.body;

    const [existing] = await db
      .select()
      .from(aiAgentConfigsTable)
      .where(
        and(
          eq(aiAgentConfigsTable.profileId, profileId),
          eq(aiAgentConfigsTable.agentKey, agentKey)
        )
      );

    if (!existing) return res.status(404).json({ error: "Agent not found" });

    const [updated] = await db
      .update(aiAgentConfigsTable)
      .set({
        expertiseArea: expertiseArea ?? existing.expertiseArea,
        customInstructions: customInstructions ?? existing.customInstructions,
        outputStyle: outputStyle ?? existing.outputStyle,
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
    return res.status(500).json({ error: "Failed to update agent" });
  }
});

router.post("/:id/reset/:agentKey", async (req, res) => {
  try {
    const profileId = Number(req.params.id);
    const { agentKey } = req.params;

    const [updated] = await db
      .update(aiAgentConfigsTable)
      .set({ expertiseArea: "", customInstructions: "", outputStyle: "", updatedAt: new Date() })
      .where(
        and(
          eq(aiAgentConfigsTable.profileId, profileId),
          eq(aiAgentConfigsTable.agentKey, agentKey)
        )
      )
      .returning();

    if (!updated) return res.status(404).json({ error: "Agent not found" });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: "Failed to reset agent" });
  }
});

export default router;
