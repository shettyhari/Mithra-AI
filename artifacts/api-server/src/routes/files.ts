import { Router, type IRouter } from "express";
import { eq, and, ilike, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { filesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { callAi } from "../lib/ai";
import {
  ListFilesQueryParams,
  ListFilesResponseItem,
  UploadFileBody,
  UploadFileResponse,
  GetFileParams,
  GetFileResponse,
  DeleteFileParams,
  GetStorageSummaryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeFile(f: typeof filesTable.$inferSelect) {
  return {
    id: f.id,
    userId: f.userId,
    name: f.name,
    type: f.type,
    mimeType: f.mimeType,
    size: f.size,
    folder: f.folder,
    url: f.url,
    createdAt: f.createdAt.toISOString(),
  };
}

// GET /files/storage-summary
router.get("/files/storage-summary", requireAuth, async (req, res): Promise<void> => {
  const userFiles = await db.select().from(filesTable).where(eq(filesTable.userId, req.userId!));
  const totalBytes = 10 * 1024 * 1024 * 1024; // 10GB quota
  const usedBytes = userFiles.reduce((sum, f) => sum + f.size, 0);
  const byType: Record<string, { bytes: number; count: number }> = {};
  for (const f of userFiles) {
    if (!byType[f.type]) byType[f.type] = { bytes: 0, count: 0 };
    byType[f.type].bytes += f.size;
    byType[f.type].count++;
  }
  res.json(GetStorageSummaryResponse.parse({
    totalBytes,
    usedBytes,
    fileCount: userFiles.length,
    byType: Object.entries(byType).map(([type, data]) => ({ type, ...data })),
  }));
});

// GET /files
router.get("/files", requireAuth, async (req, res): Promise<void> => {
  const params = ListFilesQueryParams.safeParse(req.query);
  const filters = [eq(filesTable.userId, req.userId!)];
  if (params.data?.type) filters.push(eq(filesTable.type, params.data.type));
  if (params.data?.folder) filters.push(eq(filesTable.folder, params.data.folder));
  if (params.data?.search) filters.push(ilike(filesTable.name, `%${params.data.search}%`));
  const files = await db.select().from(filesTable).where(and(...filters));
  res.json(files.map(f => ListFilesResponseItem.parse(serializeFile(f))));
});

// POST /files
router.post("/files", requireAuth, async (req, res): Promise<void> => {
  const parsed = UploadFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [file] = await db.insert(filesTable).values({
    userId: req.userId!,
    ...parsed.data,
  }).returning();
  res.status(201).json(UploadFileResponse.parse(serializeFile(file)));
});

// GET /files/:fileId
router.get("/files/:fileId", requireAuth, async (req, res): Promise<void> => {
  const params = GetFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [file] = await db.select().from(filesTable)
    .where(and(eq(filesTable.id, params.data.fileId), eq(filesTable.userId, req.userId!)));
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.json(GetFileResponse.parse(serializeFile(file)));
});

// POST /files/:fileId/analyze — AI analysis
router.post("/files/:fileId/analyze", requireAuth, async (req, res) => {
  try {
    const fileId = parseInt((req.params.fileId as string));
    const [file] = await db.select().from(filesTable)
      .where(and(eq(filesTable.id, fileId), eq(filesTable.userId, req.userId!)));
    if (!file) return res.status(404).json({ error: "File not found" });

    const prompt = `You are analyzing a file named "${file.name}" (type: ${file.type}, size: ${file.size} bytes).
${req.body?.context ? `Additional context: ${req.body.context}` : ""}
Provide:
1. A concise summary (2-3 sentences) of what this file likely contains based on its name and type.
2. 3-5 key points or suggested uses for this file.
Format your response as JSON: {"summary": "...", "keyPoints": ["...", "...", "..."]}`;

    const raw = (await callAi([{ role: "user", content: prompt }], "gpt-4o-mini", 0.5, 512)).content;
    let summary = raw, keyPoints: string[] = [];
    try {
      const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
      summary = parsed.summary || raw;
      keyPoints = parsed.keyPoints || [];
    } catch {}

    const [updated] = await db.update(filesTable).set({
      aiSummary: summary,
      aiKeyPoints: JSON.stringify(keyPoints),
      aiAnalyzedAt: new Date(),
    }).where(eq(filesTable.id, fileId)).returning();
    res.json({ summary, keyPoints, analyzedAt: updated.aiAnalyzedAt });
  } catch (e) {
    console.error("File analysis error:", e);
    res.status(500).json({ error: "Failed to analyze file" });
  }
});

// DELETE /files/:fileId
router.delete("/files/:fileId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [file] = await db.select().from(filesTable)
    .where(and(eq(filesTable.id, params.data.fileId), eq(filesTable.userId, req.userId!)));
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  await db.delete(filesTable).where(eq(filesTable.id, params.data.fileId));
  res.sendStatus(204);
});

export default router;
