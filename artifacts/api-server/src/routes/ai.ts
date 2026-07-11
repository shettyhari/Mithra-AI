import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { aiConfigTable, aiKeysTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { AVAILABLE_MODELS } from "../lib/ai";
import {
  GetAiConfigResponse,
  ListAiModelsResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /ai/models
router.get("/ai/models", requireAuth, async (req, res): Promise<void> => {
  const keys = await db.select().from(aiKeysTable);
  const enabledProviders = new Set(keys.filter(k => k.isEnabled).map(k => k.provider));
  // Always show openai models (fallback to env var)
  if (process.env.OPENAI_API_KEY) enabledProviders.add("openai");

  const [config] = await db.select().from(aiConfigTable).where(eq(aiConfigTable.userId, req.userId!));

  const models = AVAILABLE_MODELS.map(m => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    isEnabled: enabledProviders.has(m.provider) || enabledProviders.size === 0,
    isDefault: m.id === (config?.defaultModel ?? "gpt-4o-mini"),
    contextWindow: m.contextWindow,
    description: m.description,
  }));

  res.json(models.map(m => ListAiModelsResponseItem.parse(m)));
});

// GET /ai/config
router.get("/ai/config", requireAuth, async (req, res): Promise<void> => {
  let [config] = await db.select().from(aiConfigTable).where(eq(aiConfigTable.userId, req.userId!));
  if (!config) {
    [config] = await db.insert(aiConfigTable).values({ userId: req.userId! }).returning();
  }
  res.json(GetAiConfigResponse.parse({
    id: config.id,
    defaultModel: config.defaultModel,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    streamingEnabled: config.streamingEnabled,
    systemPrompt: config.systemPrompt,
  }));
});

export default router;
