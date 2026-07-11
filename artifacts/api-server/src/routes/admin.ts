import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, chatsTable, messagesTable, filesTable, aiKeysTable, aiConfigTable, auditLogsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../lib/auth";
import {
  AdminListUsersResponseItem,
  AdminCreateUserBody,
  AdminCreateUserResponse,
  AdminUpdateUserParams,
  AdminUpdateUserBody,
  AdminUpdateUserResponse,
  AdminDeleteUserParams,
  AdminGetAiKeysResponse,
  AdminUpdateAiKeysBody,
  AdminGetSystemStatsResponse,
  AdminListAuditLogsQueryParams,
  AdminListAuditLogsResponseItem,
  GetAiConfigResponse,
  AdminUpdateDefaultAiConfigBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function serializeAdminUser(user: typeof usersTable.$inferSelect) {
  const [chatCount] = await db.select({ count: sql<number>`count(*)::int` }).from(chatsTable).where(eq(chatsTable.userId, user.id));
  const [msgCount] = await db.select({ count: sql<number>`count(*)::int` }).from(messagesTable)
    .innerJoin(chatsTable, eq(messagesTable.chatId, chatsTable.id))
    .where(eq(chatsTable.userId, user.id));
  const [fileCount] = await db.select({ count: sql<number>`count(*)::int` }).from(filesTable).where(eq(filesTable.userId, user.id));
  const [tokensRow] = await db.select({ total: sql<number>`coalesce(sum(${messagesTable.tokensUsed}), 0)::int` })
    .from(messagesTable)
    .innerJoin(chatsTable, eq(messagesTable.chatId, chatsTable.id))
    .where(eq(chatsTable.userId, user.id));
  return {
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role as "admin" | "member",
    isActive: user.isActive,
    totalChats: chatCount?.count ?? 0,
    totalMessages: msgCount?.count ?? 0,
    totalFiles: fileCount?.count ?? 0,
    tokensUsed: tokensRow?.total ?? 0,
    createdAt: user.createdAt.toISOString(),
    lastActive: user.lastActiveAt?.toISOString() ?? null,
  };
}

// GET /admin/users
router.get("/admin/users", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable);
  const result = await Promise.all(users.map(serializeAdminUser));
  res.json(result.map(u => AdminListUsersResponseItem.parse(u)));
});

// POST /admin/users
router.post("/admin/users", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = AdminCreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Create a placeholder user (they'll be provisioned on first login via Clerk)
  const [user] = await db.insert(usersTable).values({
    clerkId: `pending_${Date.now()}`,
    email: parsed.data.email,
    name: parsed.data.name,
    role: parsed.data.role ?? "member",
  }).returning();
  const serialized = await serializeAdminUser(user);
  res.status(201).json(AdminCreateUserResponse.parse(serialized));
});

// PATCH /admin/users/:userId
router.patch("/admin/users/:userId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = AdminUpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AdminUpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, params.data.userId)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  // Log action
  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "update_user",
    entityType: "user",
    entityId: params.data.userId,
    details: JSON.stringify(parsed.data),
  });
  const serialized = await serializeAdminUser(user);
  res.json(AdminUpdateUserResponse.parse(serialized));
});

// DELETE /admin/users/:userId
router.delete("/admin/users/:userId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = AdminDeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (params.data.userId === req.userId) {
    res.status(400).json({ error: "Cannot delete yourself" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, params.data.userId));
  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "delete_user",
    entityType: "user",
    entityId: params.data.userId,
  });
  res.sendStatus(204);
});

// GET /admin/ai-keys
router.get("/admin/ai-keys", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const keys = await db.select().from(aiKeysTable);
  const keyMap: Record<string, boolean> = {
    openai: false, anthropic: false, gemini: false, groq: false, openrouter: false,
  };
  for (const k of keys) {
    if (keyMap.hasOwnProperty(k.provider)) {
      keyMap[k.provider] = !!(k.encryptedKey && k.isEnabled);
    }
  }
  res.json(AdminGetAiKeysResponse.parse({
    openaiKeySet: keyMap.openai,
    anthropicKeySet: keyMap.anthropic,
    geminiKeySet: keyMap.gemini,
    groqKeySet: keyMap.groq,
    openrouterKeySet: keyMap.openrouter,
  }));
});

// PATCH /admin/ai-keys
router.patch("/admin/ai-keys", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = AdminUpdateAiKeysBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Array<{ provider: string; key: string | null | undefined }> = [
    { provider: "openai", key: parsed.data.openaiKey },
    { provider: "anthropic", key: parsed.data.anthropicKey },
    { provider: "gemini", key: parsed.data.geminiKey },
    { provider: "groq", key: parsed.data.groqKey },
    { provider: "openrouter", key: parsed.data.openrouterKey },
  ];
  for (const { provider, key } of updates) {
    if (key !== undefined) {
      const encryptedKey = key ? Buffer.from(key).toString("base64") : null;
      await db.insert(aiKeysTable).values({
        provider,
        encryptedKey,
        isEnabled: !!key,
      }).onConflictDoUpdate({
        target: aiKeysTable.provider,
        set: { encryptedKey, isEnabled: !!key, updatedAt: new Date() },
      });
    }
  }
  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "update_ai_keys",
    entityType: "ai_keys",
  });
  // Return updated status
  const keys = await db.select().from(aiKeysTable);
  const keyMap: Record<string, boolean> = { openai: false, anthropic: false, gemini: false, groq: false, openrouter: false };
  for (const k of keys) {
    if (keyMap.hasOwnProperty(k.provider)) keyMap[k.provider] = !!(k.encryptedKey && k.isEnabled);
  }
  res.json(AdminGetAiKeysResponse.parse({
    openaiKeySet: keyMap.openai,
    anthropicKeySet: keyMap.anthropic,
    geminiKeySet: keyMap.gemini,
    groqKeySet: keyMap.groq,
    openrouterKeySet: keyMap.openrouter,
  }));
});

// GET /admin/system-stats
router.get("/admin/system-stats", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
  const [activeUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(eq(usersTable.isActive, true));
  const [totalChats] = await db.select({ count: sql<number>`count(*)::int` }).from(chatsTable);
  const [totalMessages] = await db.select({ count: sql<number>`count(*)::int` }).from(messagesTable);
  const [totalFiles] = await db.select({ count: sql<number>`count(*)::int` }).from(filesTable);
  const [totalTokens] = await db.select({ total: sql<number>`coalesce(sum(${messagesTable.tokensUsed}), 0)::int` }).from(messagesTable);
  const [storageBytes] = await db.select({ total: sql<number>`coalesce(sum(${filesTable.size}), 0)::int` }).from(filesTable);

  res.json(AdminGetSystemStatsResponse.parse({
    totalUsers: totalUsers?.count ?? 0,
    activeUsers: activeUsers?.count ?? 0,
    totalChats: totalChats?.count ?? 0,
    totalMessages: totalMessages?.count ?? 0,
    totalFiles: totalFiles?.count ?? 0,
    totalTokensUsed: totalTokens?.total ?? 0,
    storageUsedBytes: storageBytes?.total ?? 0,
  }));
});

// GET /admin/audit-logs
router.get("/admin/audit-logs", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = AdminListAuditLogsQueryParams.safeParse(req.query);
  const limit = params.data?.limit ?? 100;
  const logs = await db.select({
    id: auditLogsTable.id,
    userId: auditLogsTable.userId,
    userEmail: usersTable.email,
    action: auditLogsTable.action,
    entityType: auditLogsTable.entityType,
    entityId: auditLogsTable.entityId,
    details: auditLogsTable.details,
    createdAt: auditLogsTable.createdAt,
  })
    .from(auditLogsTable)
    .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
    .orderBy(sql`${auditLogsTable.createdAt} desc`)
    .limit(limit);

  res.json(logs.map(l => AdminListAuditLogsResponseItem.parse({
    id: l.id,
    userId: l.userId,
    userEmail: l.userEmail,
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    details: l.details,
    createdAt: l.createdAt.toISOString(),
  })));
});

// GET /admin/default-ai-config
router.get("/admin/default-ai-config", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  let [config] = await db.select().from(aiConfigTable).where(sql`${aiConfigTable.userId} is null`);
  if (!config) {
    [config] = await db.insert(aiConfigTable).values({ userId: null }).returning();
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

// PATCH /admin/default-ai-config
router.patch("/admin/default-ai-config", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = AdminUpdateDefaultAiConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db.select().from(aiConfigTable).where(sql`${aiConfigTable.userId} is null`);
  let config;
  if (existing.length === 0) {
    [config] = await db.insert(aiConfigTable).values({ userId: null, ...parsed.data }).returning();
  } else {
    [config] = await db.update(aiConfigTable).set(parsed.data).where(sql`${aiConfigTable.userId} is null`).returning();
  }
  if (!config) {
    res.status(500).json({ error: "Failed to update config" });
    return;
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
