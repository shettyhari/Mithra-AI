import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, userSettingsTable, aiConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Extend Request to include userId and dbUser
declare global {
  namespace Express {
    interface Request {
      userId?: number;
      clerkId?: string;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkId = clerkId;

  // JIT provision user in DB if not present
  let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!user) {
    // Create user from Clerk claims
    const email = (auth.sessionClaims?.email as string) || `${clerkId}@unknown.com`;
    const name = (auth.sessionClaims?.name as string) || "User";
    const avatarUrl = (auth.sessionClaims?.picture as string) || null;

    // First user becomes admin
    const [countRow] = await db.select().from(usersTable);
    const isFirst = !countRow;

    // Concurrent requests on first sign-in can race to insert the same user
    // (unique on clerkId/email) — fall back to re-reading the row instead of erroring.
    const [inserted] = await db.insert(usersTable).values({
      clerkId,
      email,
      name,
      avatarUrl,
      role: isFirst ? "admin" : "member",
    }).onConflictDoNothing().returning();

    if (inserted) {
      user = inserted;
      // Create default settings
      await db.insert(userSettingsTable).values({ userId: user.id }).onConflictDoNothing();
      // Create default AI config
      await db.insert(aiConfigTable).values({ userId: user.id }).onConflictDoNothing();
    } else {
      [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
    }
  }

  // Update last active
  await db.update(usersTable).set({ lastActiveAt: new Date() }).where(eq(usersTable.id, user.id));

  req.userId = user.id;
  next();
};

export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Forbidden: admin access required" });
    return;
  }
  next();
};
