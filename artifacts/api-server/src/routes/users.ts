import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, userSettingsTable, aiConfigTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  GetMeResponse,
  UpdateMeBody,
  UpdateMeResponse,
  GetUserSettingsResponse,
  UpdateUserSettingsBody,
  UpdateUserSettingsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /users/me
router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(GetMeResponse.parse({
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  }));
});

// PATCH /users/me
router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, req.userId!))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(UpdateMeResponse.parse({
    id: updated.id,
    clerkId: updated.clerkId,
    email: updated.email,
    name: updated.name,
    avatarUrl: updated.avatarUrl,
    role: updated.role,
    isActive: updated.isActive,
    createdAt: updated.createdAt.toISOString(),
  }));
});

// GET /users/me/settings
router.get("/users/me/settings", requireAuth, async (req, res): Promise<void> => {
  let [settings] = await db
    .select()
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, req.userId!));
  if (!settings) {
    // Create default settings
    [settings] = await db.insert(userSettingsTable).values({ userId: req.userId! }).returning();
  }
  res.json(GetUserSettingsResponse.parse({
    id: settings.id,
    userId: settings.userId,
    theme: settings.theme,
    accentColor: settings.accentColor,
    language: settings.language,
    animationsEnabled: settings.animationsEnabled,
    voiceEnabled: settings.voiceEnabled,
    voiceId: settings.voiceId,
    voiceSpeed: settings.voiceSpeed,
    voicePitch: settings.voicePitch,
    customInstructions: settings.customInstructions,
    notificationsEnabled: settings.notificationsEnabled,
  }));
});

// PATCH /users/me/settings
router.patch("/users/me/settings", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateUserSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Upsert settings
  const existing = await db
    .select()
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, req.userId!));
  let settings;
  if (existing.length === 0) {
    [settings] = await db
      .insert(userSettingsTable)
      .values({ userId: req.userId!, ...parsed.data })
      .returning();
  } else {
    [settings] = await db
      .update(userSettingsTable)
      .set(parsed.data)
      .where(eq(userSettingsTable.userId, req.userId!))
      .returning();
  }
  if (!settings) {
    res.status(500).json({ error: "Failed to update settings" });
    return;
  }
  res.json(UpdateUserSettingsResponse.parse({
    id: settings.id,
    userId: settings.userId,
    theme: settings.theme,
    accentColor: settings.accentColor,
    language: settings.language,
    animationsEnabled: settings.animationsEnabled,
    voiceEnabled: settings.voiceEnabled,
    voiceId: settings.voiceId,
    voiceSpeed: settings.voiceSpeed,
    voicePitch: settings.voicePitch,
    customInstructions: settings.customInstructions,
    notificationsEnabled: settings.notificationsEnabled,
  }));
});

export default router;
