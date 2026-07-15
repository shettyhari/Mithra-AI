import { getAuth, clerkClient } from "@clerk/express";
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
    // sessionClaims from the JWT often omit name/email/picture unless the
    // Clerk session token is customized — fetch the real profile from Clerk's
    // Backend API so we JIT-provision with the actual signed-in identity.
    let email = (auth.sessionClaims?.email as string) || "";
    let name = (auth.sessionClaims?.name as string) || "";
    let avatarUrl = (auth.sessionClaims?.picture as string) || null;

    if (!email || !name) {
      try {
        const clerkUser = await clerkClient.users.getUser(clerkId);
        email = email || clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress || "";
        name = name || [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || clerkUser.username || "";
        avatarUrl = avatarUrl || clerkUser.imageUrl || null;
      } catch (err) {
        req.log.warn({ err }, "Failed to fetch Clerk user profile during JIT provisioning");
      }
    }

    email = email || `${clerkId}@unknown.com`;
    name = name || "User";

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

  // Self-heal: users provisioned before the real-name fetch was added are
  // stuck with the literal "User" placeholder / unknown.com email — refresh
  // them from Clerk once so the UI shows their actual signed-in identity.
  if (user.name === "User" || user.email.endsWith("@unknown.com")) {
    try {
      const clerkUser = await clerkClient.users.getUser(clerkId);
      const freshEmail = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;
      const freshName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || clerkUser.username;
      if (freshName || freshEmail) {
        [user] = await db.update(usersTable).set({
          name: freshName || user.name,
          email: freshEmail || user.email,
          avatarUrl: clerkUser.imageUrl || user.avatarUrl,
        }).where(eq(usersTable.id, user.id)).returning();
      }
    } catch (err) {
      req.log.warn({ err }, "Failed to backfill Clerk user profile");
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
