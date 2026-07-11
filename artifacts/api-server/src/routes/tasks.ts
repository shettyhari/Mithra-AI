import { Router, type IRouter } from "express";
import { eq, and, or, gte, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { tasksTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  ListTasksQueryParams,
  ListTasksResponseItem,
  CreateTaskBody,
  CreateTaskResponse,
  UpdateTaskParams,
  UpdateTaskBody,
  UpdateTaskResponse,
  DeleteTaskParams,
  ListUpcomingTasksResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeTask(t: typeof tasksTable.$inferSelect) {
  return {
    id: t.id,
    userId: t.userId,
    assignedToId: t.assignedToId,
    title: t.title,
    description: t.description,
    status: t.status as "todo" | "in_progress" | "done",
    priority: t.priority as "low" | "medium" | "high",
    dueDate: t.dueDate,
    isShared: t.isShared,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

// GET /tasks/upcoming
router.get("/tasks/upcoming", requireAuth, async (req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const tasks = await db.select().from(tasksTable).where(
    and(
      or(eq(tasksTable.userId, req.userId!), eq(tasksTable.assignedToId, req.userId!)),
      sql`${tasksTable.dueDate} >= ${today}`,
      sql`${tasksTable.dueDate} <= ${nextWeek}`,
      sql`${tasksTable.status} != 'done'`,
    )
  );
  res.json(tasks.map(t => ListUpcomingTasksResponseItem.parse(serializeTask(t))));
});

// GET /tasks
router.get("/tasks", requireAuth, async (req, res): Promise<void> => {
  const params = ListTasksQueryParams.safeParse(req.query);
  const filters = [
    or(eq(tasksTable.userId, req.userId!), eq(tasksTable.assignedToId, req.userId!))!,
  ];
  if (params.data?.status) filters.push(eq(tasksTable.status, params.data.status));
  if (params.data?.priority) filters.push(eq(tasksTable.priority, params.data.priority));
  const tasks = await db.select().from(tasksTable).where(and(...filters));
  res.json(tasks.map(t => ListTasksResponseItem.parse(serializeTask(t))));
});

// POST /tasks
router.post("/tasks", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [task] = await db.insert(tasksTable).values({
    userId: req.userId!,
    title: parsed.data.title,
    description: parsed.data.description,
    priority: parsed.data.priority ?? "medium",
    dueDate: parsed.data.dueDate,
    assignedToId: parsed.data.assignedToId,
    isShared: parsed.data.isShared ?? false,
  }).returning();
  res.status(201).json(CreateTaskResponse.parse(serializeTask(task)));
});

// PATCH /tasks/:taskId
router.patch("/tasks/:taskId", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.taskId), eq(tasksTable.userId, req.userId!)));
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const [updated] = await db.update(tasksTable).set(parsed.data).where(eq(tasksTable.id, params.data.taskId)).returning();
  res.json(UpdateTaskResponse.parse(serializeTask(updated)));
});

// DELETE /tasks/:taskId
router.delete("/tasks/:taskId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db.select().from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.taskId), eq(tasksTable.userId, req.userId!)));
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  await db.delete(tasksTable).where(eq(tasksTable.id, params.data.taskId));
  res.sendStatus(204);
});

export default router;
