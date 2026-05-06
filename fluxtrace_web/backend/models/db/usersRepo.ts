import { count, desc, eq, sql } from "drizzle-orm";
import { analysisBatches, InsertUser, users } from "../../drizzle/schema";
import { ENV } from "../../_core/config/env";
import { getDb } from "./connection";

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.passwordHash !== undefined) {
      values.passwordHash = user.passwordHash;
      (updateSet as Record<string, unknown>).passwordHash = user.passwordHash;
    }
    if (user.mustChangePassword !== undefined) {
      values.mustChangePassword = user.mustChangePassword;
      (updateSet as Record<string, unknown>).mustChangePassword = user.mustChangePassword;
    }

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: users.openId,
        set: updateSet as typeof users.$inferInsert,
      });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(emailCanonical: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user by email: database not available");
    return undefined;
  }

  const email = emailCanonical.trim().toLowerCase();
  const result = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createLocalUser(data: {
  openId: string;
  name: string;
  email: string;
  passwordHash: string;
  role?: "user" | "admin";
}): Promise<typeof users.$inferSelect> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const [row] = await db
    .insert(users)
    .values({
      openId: data.openId,
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      loginMethod: "local",
      role: data.role ?? "user",
      mustChangePassword: false,
      lastSignedIn: new Date(),
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create user");
  }

  return row;
}

export type UserListRow = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  loginMethod: string | null;
  createdAt: Date;
  lastSignedIn: Date;
  hasLocalPassword: boolean;
  mustChangePassword: boolean;
};

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    return undefined;
  }
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0];
}

export async function listUsersForAdmin(): Promise<UserListRow[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }
  const rows = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      role: users.role,
      loginMethod: users.loginMethod,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
      passwordHash: users.passwordHash,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return rows.map((r) => ({
    id: r.id,
    openId: r.openId,
    name: r.name,
    email: r.email,
    role: r.role,
    loginMethod: r.loginMethod,
    createdAt: r.createdAt,
    lastSignedIn: r.lastSignedIn,
    hasLocalPassword: r.passwordHash != null && r.passwordHash.length > 0,
    mustChangePassword: r.mustChangePassword,
  }));
}

export async function countAdmins() {
  const db = await getDb();
  if (!db) {
    return 0;
  }
  const rows = await db
    .select({ n: count() })
    .from(users)
    .where(eq(users.role, "admin"));
  return Number(rows[0]?.n ?? 0);
}

export async function deleteUserById(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }
  return await db.transaction(async (tx) => {
    await tx
      .update(analysisBatches)
      .set({ createdByUserId: null })
      .where(eq(analysisBatches.createdByUserId, id));
    const removed = await tx.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    return removed.length > 0;
  });
}
